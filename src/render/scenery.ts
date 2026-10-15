// Cenário parado em blocos: árvores, rochas, veios e ervas pintados UMA vez em imagens (faixas horizontais da cena,
// cortadas em colunas) e colados prontos a cada quadro, em vez de desenhados um a um (~2 mil por quadro com o mapa
// inteiro à vista: o "em pé" era a etapa mais cara no celular).
//
// Profundidade: cada bloco entra na ordem de desenho no começo da sua faixa (pela linha de base `k` dos recursos dele);
// o que fica numa faixa (ninja, prédio, peça...) é desenhado depois do bloco e, logo em seguida, as árvores do bloco
// que estão NA FRENTE dele são redesenhadas recortadas no retângulo dele (`front`). Assim a ordem fica exata para
// qualquer tamanho de faixa, como no desenho um a um.
//
// Um recurso sai do bloco e volta a ser desenhado sozinho enquanto está "vivo": sendo trabalhado (treme, a rocha
// encolhe), caindo, marcado para limpar. Bloco que mudou (cortaram, rebrotou, explorou, mudou a estação ou a neve)
// é repintado dentro de um orçamento por quadro; enquanto não dá, os recursos dele são desenhados um a um (como antes).
import { layoutVersion } from '../data/layout';
import { isExplored } from '../game/explore';
import type { GameState, ResourceNode } from '../game/types';
import { nodeArt } from '../game/world';
import { SEASON_VIEW } from './seasonal';

/** Altura de uma faixa (px da cena). */
export const BAND = 128;
/** Largura de uma coluna (px da cena). */
export const COLW = 512;
/** Folga do bloco acima da faixa (a copa sobe ~120 px da base) e abaixo (a base fica ~20 px abaixo do ponto). */
export const PAD_TOP = 160;
export const PAD_BOT = 50;
/** Altura de um bloco (px da cena). */
export const TILE_H = BAND + PAD_TOP + PAD_BOT;
/** Escala máxima dos blocos: as artes do cenário são guardadas em 2×, mais que isso não ganha detalhe. */
const MAX_SCALE = 2;
/** Orçamento (ms) para repintar blocos por quadro (sempre ao menos um). */
const PAINT_MS = 3;
/** Segundos sem aparecer até um bloco ser descartado. */
const KEEP_S = 10;

/** Um recurso no índice: ponto projetado, linha de base e o retângulo (px da cena) que o desenho ocupa. */
export interface SceneNode {
  n: ResourceNode;
  x: number;
  y: number;
  k: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface StripTile {
  band: number;
  col: number;
  /** Escala do canvas (px do canvas por px da cena). */
  s: number;
  /** Assinatura do conteúdo pintado (recursos, estágios, estação, neve). */
  key: number;
  c: HTMLCanvasElement;
  /** Recursos pintados nele, pela linha de base. */
  painted: SceneNode[];
  seen: number;
}

/** Escala do bloco para a escala da tela: a potência de 2 logo acima (reduzir até 2× fica nítido), até 2. */
export function stripScale(z: number) {
  let s = 0.125;
  while (s < z && s < MAX_SCALE) s *= 2;
  return s;
}

const cellKey = (band: number, col: number) => (band + 4096) * 8192 + (col + 4096);
const artCodes = new Map<string, number>();
const mix = (h: number, v: number) => (Math.imul(h, 31) + v) | 0;

export class Scenery {
  /** Recursos por célula (faixa × coluna); um recurso largo entra em mais de uma coluna. */
  private cells = new Map<number, SceneNode[]>();
  private tiles = new Map<string, StripTile>();
  private sig = '';
  /** Blocos colados neste quadro (célula → bloco). */
  drawn = new Map<number, StripTile>();

  /** Índice mudou? (`sig` é montada pelo renderer: recursos, prédios, layout, nível.) */
  needsIndex(sig: string) {
    return sig !== this.sig;
  }

  setIndex(sig: string, nodes: SceneNode[]) {
    this.sig = sig;
    this.cells.clear();
    for (const e of nodes) {
      const band = Math.floor(e.k / BAND);
      for (let col = Math.floor(e.x0 / COLW); col <= Math.floor(e.x1 / COLW); col++) {
        const key = cellKey(band, col);
        let list = this.cells.get(key);
        if (!list) this.cells.set(key, (list = []));
        list.push(e);
      }
    }
    for (const list of this.cells.values()) list.sort((a, b) => a.k - b.k);
    // conteúdo mudou de lugar: os blocos guardados não servem mais
    this.tiles.clear();
  }

  /**
   * Quadro: decide, para cada célula à vista, se cola o bloco pronto (repintando dentro do orçamento) ou se os
   * recursos dela vão um a um. `live`: recursos que ficam fora dos blocos agora. Devolve os blocos a colar e os
   * recursos a desenhar sozinhos.
   */
  frame(
    s: GameState,
    view: { x0: number; y0: number; x1: number; y1: number },
    scale: number,
    live: (n: ResourceNode) => boolean,
    paint: (ctx: CanvasRenderingContext2D, tile: StripTile) => void,
  ): { tiles: StripTile[]; single: SceneNode[] } {
    const now = performance.now() / 1000;
    const t0 = performance.now();
    let painted = 0;
    this.drawn.clear();
    const tiles: StripTile[] = [];
    const single: SceneNode[] = [];
    const singleIds = new Set<number>();
    const one = (e: SceneNode) => {
      if (singleIds.has(e.n.id)) return;
      singleIds.add(e.n.id);
      single.push(e);
    };
    const glob = mix(mix(mix(layoutVersion, SEASON_VIEW.season.length * 7 + SEASON_VIEW.season.charCodeAt(0)), SEASON_VIEW.snow > 0.03 ? Math.round(SEASON_VIEW.snow * 10) : 0), 1);
    const b0 = Math.floor((view.y0 - PAD_BOT) / BAND) - 1;
    const b1 = Math.floor((view.y1 + PAD_TOP) / BAND);
    const c0 = Math.floor(view.x0 / COLW);
    const c1 = Math.floor(view.x1 / COLW);
    for (let band = b0; band <= b1; band++) {
      // o bloco cobre de band*BAND - PAD_TOP até (band+1)*BAND + PAD_BOT
      if (band * BAND - PAD_TOP > view.y1 || (band + 1) * BAND + PAD_BOT < view.y0) continue;
      for (let col = c0; col <= c1; col++) {
        const ck = cellKey(band, col);
        const list = this.cells.get(ck);
        if (!list) continue;
        // o que vai no bloco agora e a assinatura disso
        let key = glob;
        const keep: SceneNode[] = [];
        for (const e of list) {
          const n = e.n;
          if (n.cleared || !isExplored(s, n.tx, n.ty)) continue;
          if (live(n)) {
            one(e);
            continue;
          }
          keep.push(e);
          const art = nodeArt(n);
          let code = artCodes.get(art);
          if (code === undefined) artCodes.set(art, (code = artCodes.size + 1));
          key = mix(mix(key, n.id), code);
          // rocha, veio e erva encolhem com o que sobra; a árvore não
          if (n.type !== 'tree') key = mix(key, Math.round((20 * n.amount) / Math.max(1, n.max)));
        }
        if (!keep.length) continue;
        const id = `${ck}:${scale}`;
        let tile = this.tiles.get(id);
        if (!tile || tile.key !== key) {
          if (painted === 0 || performance.now() - t0 < PAINT_MS) {
            tile = this.paintTile(tile, band, col, scale, key, keep, paint);
            this.tiles.set(id, tile);
            painted++;
          } else {
            // sem orçamento: o mesmo conteúdo noutra escala serve (fica um pouco mais mole); senão um a um
            const other = this.tiles.get(`${ck}:${scale * 2}`) ?? this.tiles.get(`${ck}:${scale / 2}`);
            if (other && other.key === key) tile = other;
            else {
              for (const e of keep) one(e);
              continue;
            }
          }
        }
        tile.seen = now;
        tiles.push(tile);
        this.drawn.set(ck, tile);
      }
    }
    for (const [id, t] of this.tiles) if (now - t.seen > KEEP_S) this.tiles.delete(id);
    return { tiles, single };
  }

  private paintTile(old: StripTile | undefined, band: number, col: number, s: number, key: number, painted: SceneNode[], paint: (ctx: CanvasRenderingContext2D, tile: StripTile) => void) {
    const w = Math.ceil(COLW * s);
    const h = Math.ceil(TILE_H * s);
    const c = old && old.c.width === w && old.c.height === h ? old.c : document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // px da cena → px do canvas
    ctx.setTransform(s, 0, 0, s, -col * COLW * s, -(band * BAND - PAD_TOP) * s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    const tile: StripTile = { band, col, s, key, c, painted, seen: 0 };
    paint(ctx, tile);
    return tile;
  }

  /** Recursos pintados em blocos colados neste quadro, na faixa `band`, que cruzam o retângulo e estão depois de `k`. */
  front(band: number, r: { x0: number; y0: number; x1: number; y1: number }, k: number): SceneNode[] {
    let out: SceneNode[] | null = null;
    for (let col = Math.floor(r.x0 / COLW); col <= Math.floor(r.x1 / COLW); col++) {
      const t = this.drawn.get(cellKey(band, col));
      if (!t) continue;
      for (const e of t.painted) {
        if (e.k <= k || e.x1 < r.x0 || e.x0 > r.x1 || e.y1 < r.y0 || e.y0 > r.y1) continue;
        (out ??= []).push(e);
      }
    }
    if (!out) return [];
    // um recurso largo aparece em duas colunas: uma vez só, na ordem da profundidade
    if (out.length > 1) {
      const seen = new Set<number>();
      out = out.filter((e) => !seen.has(e.n.id) && !!seen.add(e.n.id)).sort((a, b) => a.k - b.k);
    }
    return out;
  }

  /** Recursos pintados em blocos colados neste quadro em volta de um ponto (para saber quem tapa um personagem). */
  around(x: number, y0: number, y1: number, fn: (e: SceneNode) => void) {
    for (let band = Math.floor(y0 / BAND); band <= Math.floor(y1 / BAND); band++)
      for (let col = Math.floor((x - 20) / COLW); col <= Math.floor((x + 20) / COLW); col++) {
        const t = this.drawn.get(cellKey(band, col));
        if (t) for (const e of t.painted) fn(e);
      }
  }
}
