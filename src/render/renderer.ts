import { CELL, MAX_DPR, SUB, TILE } from '../config';
import { ANIMALS } from '../data/animals';
import { RANKS } from '../data/ninja';
import type { Camera } from '../core/camera';
import { groundTransform, ISO_K, project, projectAngle } from '../core/iso';
import { dragonPoint } from '../game/dragonFlight';
import { type BuildingType, defOf, layoutKey } from '../data/buildings';
import type { Game } from '../game/game';
import { DEFENSES } from '../game/systems/towers';
import { upgradeTime } from '../game/upgrade';

/** Altura da plataforma da torre (fração da altura do sprite, de baixo para cima) por nível. */
const GUARD_PLATFORM: Record<number, number> = { 1: 0.58, 2: 0.6, 3: 0.6 };
import { darkness } from '../game/time';
import { missionFocus } from '../game/missionView';
import { MISSION_RANKS } from '../data/missions';
import { territoryCenter, territoryRadius } from '../game/village';
import type { Building, Effect, GameState, ResourceNode, Site, Unit } from '../game/types';
import { plainTokens } from '../core/tokens';
import { artLayout, tileOf } from '../data/layout';
import { pieceCovers, pieceSet, type PieceSet } from './pieces';
import type { Nature } from '../data/natures';
import type { Vfx } from '../data/vfx';
import { CHEST_LINGER, doneFor, fogVersion, isExplored, isExploredPx } from '../game/explore';
import { CAVE_PROPS, type CaveDeco, caveDecos, drawCaveDeco, drawCaveFlat } from './cave';
import { drawThemeDeco, type ThemeDeco, themeDecos } from './themeProps';
import { wallEnds } from '../game/walls';
import { seasonOf } from '../game/mood';
import { searchTiles } from '../game/systems/villagers';
import { isRoad } from '../game/roads';
import { buildingCenter, doorPos, doorTile, hasWater, nodeArt, T } from '../game/world';
import { art, artFoot, ART_SCALE, smoothIfShrunk } from './art';
import { drawEffect } from './effects';
import { natureOf, Particles } from './particles';
import { drawDeco, lightWeatherFx, Seasonal, SEASON_VIEW, snowCap, snowField, type Deco } from './seasonal';
import { drawBuilding, drawNode, drawProjectile, drawUnit, isStump, workImpact, type WorkAction } from './sprites';
import { Terrain } from './terrain';

export interface Ghost {
  type: BuildingType;
  tx: number;
  ty: number;
  valid: boolean;
  /** Espelhado (botão Girar; o de margem escolhe sozinho até o jogador girar: aí `flipLocked`). */
  flip?: boolean;
  flipLocked?: boolean;
  /** Nível do prédio sendo movido: o fantasma mostra a arte e o terreno desse nível (construir novo = 1). */
  level?: number;
  /** Movendo: o prédio de origem some e no lugar dele fica só a base marcada (dá para ver quantos tiles andou). */
  moveId?: number;
  moveFrom?: { tx: number; ty: number; w: number; h: number };
  /** Onde o jogador tocou (o prédio de margem gruda na beira mais perto e pode ficar noutro tile). */
  at?: { tx: number; ty: number };
}

/** Estado de interface que o render mostra por cima do mundo. */
export interface Overlay {
  group: number[];
  hoverUnitId: number | null;
  selectBox: { x0: number; y0: number; x1: number; y1: number } | null;
}
const NO_OVERLAY: Overlay = { group: [], hoverUnitId: null, selectBox: null };

/** Item em pé na cena (prédio, nó ou unidade), ordenado por profundidade (y da cena). */
/** Tiles de névoa em volta do mapa (só na textura). */
const FOG_PAD = 3;

const TAU = Math.PI * 2;
/** Como mostrar quem passa atrás de um prédio (as mesmas chaves de ui/settings.ts `OcclusionCfg`). */
export type Occlusion = { silhouette: boolean; fade: boolean; cutout: boolean; dither: boolean };
/** Corpo de um personagem para saber quem o tapa (ponto do peito na cena, índice na lista ordenada). */
type Body = { x: number; y: number; i: number; u: Unit };
type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Pontilhado ordenado (matriz de Bayer 4×4): `k` de 16 pixels opacos em cada bloco de 4×4, aninhados (k ⊂ k+1). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayerCache = new Map<number, HTMLCanvasElement>();
function bayer(k: number): HTMLCanvasElement {
  k = Math.max(0, Math.min(16, k));
  let c = bayerCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 4;
    const x = c.getContext('2d')!;
    const img = x.createImageData(4, 4);
    for (let i = 0; i < 16; i++) img.data[i * 4 + 3] = BAYER4[i]! < k ? 255 : 0;
    x.putImageData(img, 0, 0);
    bayerCache.set(k, c);
  }
  return c;
}

type Drawable = { y: number; x: number; /** chave de profundidade (começa em y) */ k?: number; b?: Building; n?: ResourceNode; u?: Unit; site?: Site; deco?: Deco;
  /** Muralha de terra (Doryuuheki) parada no chão: entra na ordem de profundidade como um objeto. */
  wall?: Effect;
  /** Enfeite da mina (render/cave.ts). */
  cave?: CaveDeco;
  theme?: ThemeDeco;
  /** Peça da arte (Editor de cenário): 0 = o resto em pé, 1… = peça pintada, cada uma na profundidade da sua âncora. */
  piece?: number;
  /** Vigia no alto da torre: onde ficam os pés dele na cena (a plataforma), em vez do ponto lógico (a porta). */
  lift?: { x: number; y: number; towerId: number; b: Building };
  /** Camada de cima do prédio (arte `<arte>-top`, ex. telhado e pilastras da torre): desenhada por cima da base e de
   * quem está lá dentro (o vigia). */
  top?: boolean };

/**
 * Desenho isométrico em duas passadas:
 * 1. "chão": tudo que fica deitado (terreno, campos, marcações) é desenhado em coordenadas de mundo
 *    com a transformação `groundTransform`;
 * 2. "em pé": prédios, árvores e unidades são desenhados de frente no ponto projetado, do fundo para a frente.
 */
/** Segundos da árvore tombando. */
const TREE_FALL = 1.1;
/** Estilo do golpe → natureza para a neve (derrete/congela). */
const VFX_NATURE: Partial<Record<Vfx, Nature>> = { fire: 'katon', lava: 'katon', heat: 'katon', water: 'suiton', ice: 'suiton', earth: 'doton', wind: 'fuuton', lightning: 'raiton' };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain | null = null;
  /** Cache por mapa (a vila e o mapa de missão alternam na tela). */
  private maps = new WeakMap<GameState, { terrain: Terrain; seasonal: Seasonal; rev: number }>();
  private dpr = 1;
  private list: Drawable[] = [];
  /** Transparência atual de prédios/árvores que tapam alguém (chave → alpha), para a transição ficar suave. */
  private fade = new Map<string, number>();
  /**
   * Como mostrar quem passa atrás de um prédio/árvore (Configurações → "Atrás de prédios", posto pelo main): silhueta
   * do personagem por cima, esmaecer o prédio inteiro (o de sempre), furo em volta do personagem e pontilhado no lugar
   * da transparência (no esmaecer e no furo). Combinam entre si.
   */
  occl: Occlusion = { silhouette: false, fade: true, cutout: false, dither: false };
  /** Camadas fora da tela para o furo, o pontilhado e a silhueta (crescem conforme a necessidade). */
  private layerA: HTMLCanvasElement | null = null;
  private layerB: HTMLCanvasElement | null = null;
  /** Redesenho só para máscara (silhueta): sem efeitos colaterais (fumaça de chaminé). */
  private maskPass = false;
  /** Mapa sendo desenhado agora (o chão do prédio de margem confere onde é água de verdade). */
  private mapState: GameState | null = null;
  private lastTime = 0;
  /** Visual das estações (neve no chão, gelo, árvores, decorações). */
  private seasonal!: Seasonal;
  /** Segundos desde o quadro anterior (0 com o jogo pausado no relógio do render). */
  private frameDt = 0;
  /** Decorações do quadro (lanternas acendem à noite em `lights`). */
  private decos: Deco[] = [];
  private depth: Uint8Array = new Uint8Array(0);
  /** Névoa: 1 pixel por tile, ampliado com suavização (borda macia). Refeita só quando algo é revelado. */
  private fog: HTMLCanvasElement | null = null;
  private fogVer = -1;
  private fogOf: GameState | null = null;
  private fogSoft: HTMLCanvasElement | null = null;
  private particles = new Particles();
  /** Árvores: era árvore no quadro anterior (para pegar a hora em que vira toco) e quando começou a cair. */
  private treeWas = new Map<number, { tree: boolean; t: number }>();
  private treeFall = new Map<number, number>();
  /** Recurso sendo golpeado agora: força da tremida (0–1) por id. */
  private hitNodes = new Map<number, number>();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  /** Teto da resolução (Configurações → Qualidade). */
  maxDpr = MAX_DPR;
  /** Fração das partículas pela qualidade (o zoom afastado corta mais pela metade). */
  particleBase = 1;

  resize(w: number, h: number) {
    this.dpr = Math.min(MAX_DPR, this.maxDpr, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  /** Cópia da unidade já na cena (posição e direção projetadas), para as funções de desenho. */
  private projected(u: Unit): Unit {
    const p = project(u.x, u.y);
    return { ...u, x: p.x, y: p.y, facing: projectAngle(u.facing) };
  }

  render(g: Game, cam: Camera, ghost: Ghost | null, time: number, ov: Overlay = NO_OVERLAY) {
    const s = g.state;
    this.mapState = s;
    cam.map = s; // a câmera fica dentro do mapa que está na tela (a vila é maior que os mapas de missão)
    this.level = s.level;
    this.season = seasonOf(s);
    this.kages = s.kageHistory?.length ?? 0;
    this.theme = s.sceneInfo?.theme ?? '';
    this.seed = s.seed;
    let cache = this.maps.get(s);
    if (!cache) {
      cache = { terrain: new Terrain(s), seasonal: new Seasonal(s), rev: g.terrainRev };
      this.maps.set(s, cache);
    } else if (cache.rev !== g.terrainRev) {
      // aterraram/cavaram: o chão (blocos e profundidade da água) e a água da neve/gelo se refazem
      cache.terrain = new Terrain(s);
      cache.seasonal.refreshWater(s);
      cache.rev = g.terrainRev;
    }
    this.terrain = cache.terrain;
    this.depth = cache.terrain.depth;
    this.seasonal = cache.seasonal;
    const ctx = this.ctx;
    const z = cam.zoom * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16210f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z, 0, 0, z, -cam.left * z, -cam.top * z);
    ctx.imageSmoothingEnabled = true;

    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.frameDt = dt;
    this.seasonal.frame(s, dt);
    this.particles.snowy = s.snow > 0.15;
    // mapa inteiro à vista: menos partículas (continuam aparecendo, só em menor número) e sem enfeites miúdos
    const far = cam.zoom < 0.85;
    this.particles.density = this.particleBase * (far ? 0.5 : 1);
    {
      // chuva: só gera gotas onde a câmera vê
      const l = cam.left - 60;
      const t = cam.top - 140;
      const r = cam.left + cam.viewW / cam.zoom + 60;
      const b = cam.top + cam.viewH / cam.zoom + 60;
      this.seasonal.rainFrame(s, dt, (x, y) => {
        const p = project(x, y);
        return p.x > l && p.x < r && p.y > t && p.y < b;
      });
    }

    // caverna (mapa de mina): sempre escura, iluminada pelas tochas da equipe
    const night = s.sceneInfo?.kind === 'mine' || s.sceneInfo?.kind === 'hideout' ? 0.8 : darkness(s);
    const sel = g.selected;
    const hkSel = sel?.kind === 'building' && g.building(sel.id)?.type === 'hokage';

    // cor da equipe de cada ninja + quem está "em foco" (selecionado, do grupo ou da equipe selecionada)
    const teamColor = new Map<number, string>();
    for (const t of s.teams) for (const id of t.senseiId != null ? [t.senseiId, ...t.memberIds] : t.memberIds) teamColor.set(id, t.color);
    const focus = new Set<number>();
    if (sel?.kind === 'unit') focus.add(sel.id);
    for (const id of ov.group) focus.add(id);
    const group = new Set(ov.group);
    if (sel?.kind === 'team') {
      const t = g.team(sel.id);
      if (t) for (const id of t.senseiId != null ? [t.senseiId, ...t.memberIds] : t.memberIds) focus.add(id);
    }

    // ================= passada 1: chão =================
    ctx.save();
    groundTransform(ctx);
    this.terrain!.draw(ctx, cam, time);
    this.seasonal.drawIce(ctx, s, this.depth);
    this.seasonal.drawWet(ctx);
    this.seasonal.drawGround(ctx, s);
    this.seasonal.drawCloudShadows(ctx, s);
    // aterrar (marrom) / cavar (azul) marcados, esperando um morador
    for (const e of s.earthworks ?? []) {
      ctx.fillStyle = e.op === 'fill' ? 'rgba(168,131,85,0.55)' : 'rgba(80,150,225,0.5)';
      ctx.fillRect(e.tx * TILE + 2, e.ty * TILE + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = e.op === 'fill' ? 'rgba(255,200,120,0.9)' : 'rgba(170,220,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(e.tx * TILE + 2, e.ty * TILE + 2, TILE - 4, TILE - 4);
      ctx.setLineDash([]);
    }
    ctx.drawImage(this.fogTexture(s), -FOG_PAD * TILE, -FOG_PAD * TILE, (s.mapW + FOG_PAD * 2) * TILE, (s.mapH + FOG_PAD * 2) * TILE);

    // movendo um prédio: o de origem não é desenhado (só a base marcada, em ghostGround)
    const shown = ghost?.moveId != null ? s.buildings.filter((b) => b.id !== ghost.moveId) : s.buildings;
    // chão batido sob prédios (o de margem: só sob as células de terra, e sombra na água sob o píer e o barco)
    ctx.fillStyle = 'rgba(120,90,55,0.35)';
    for (const b of shown) {
      const d = defOf(b);
      if (d.walkable) continue;
      if (tileOf(layoutKey(b), 0, 0) !== undefined && hasWater(b)) {
        this.shoreGround(b);
        continue;
      }
      ctx.beginPath();
      ctx.roundRect(b.tx * TILE - 4, b.ty * TILE - 4, d.w * TILE + 8, d.h * TILE + 10, 8);
      ctx.fill();
    }
    // campos e áreas abertas ficam deitados no chão
    // (os que têm arte isométrica vão como decalque logo depois desta passada)
    for (const b of shown) if (defOf(b).walkable && !art(b.type)) drawBuilding(ctx, b, time, night, s.level);

    if (sel?.kind === 'building') {
      const b = g.building(sel.id);
      if (b) {
        const d = defOf(b);
        ctx.strokeStyle = '#ffd34d';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(b.tx * TILE - 3, b.ty * TILE - 3, d.w * TILE + 6, d.h * TILE + 6);
        ctx.setLineDash([]);
        // alcance de coleta (lenhador, pedreira, mina): de onde os trabalhadores buscam recursos
        if (b.type === 'lumber' || b.type === 'quarry' || b.type === 'ironmine') {
          const p = doorPos(b);
          ctx.strokeStyle = 'rgba(127,211,107,0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, searchTiles(b) * TILE, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const def = DEFENSES[b.type];
        if (def) {
          const c = buildingCenter(b);
          ctx.strokeStyle = 'rgba(255,211,77,0.35)';
          ctx.beginPath();
          ctx.arc(c.x, c.y, def.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    if (ghost || hkSel) this.drawTerritory(g, !!ghost);
    if (ghost) this.ghostGround(ghost);
    this.commandLines(g, focus, teamColor, time);
    this.drawObjectives(g, time);
    ctx.restore();

    this.drawRoads(g);
    // decalques: campos com arte isométrica (fazenda, treino, horta) ficam no chão, sob todo mundo; com peças
    // (Editor de cenário), só o "resto" vai no chão e as peças entram em pé
    for (const b of shown) {
      const box = this.artBox(b, s.level);
      const set = box && pieceSet(box.artName, box.pic);
      if (set) {
        if (artLayout(box!.artName)!.ground ?? !!defOf(b).walkable) this.drawPiece(b, 0, s.level);
      } else if (defOf(b).walkable && art(b.type)) this.building(b, time, night, s.level);
    }
    this.drawHarvest(g);
    this.drawTethers(g, time);
    drawCaveFlat(ctx, s, (tx, ty) => isExplored(s, tx, ty));

    // ================= passada 2: em pé, do fundo para a frente =================
    const m = 110;
    const x0 = cam.left - m;
    const y0 = cam.top - m;
    const x1 = cam.left + cam.viewW / cam.zoom + m;
    const y1 = cam.top + cam.viewH / cam.zoom + m;
    const seen = (p: { x: number; y: number }) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;

    const list = this.list;
    list.length = 0;
    for (const b of shown) {
      const def = defOf(b);
      const box = this.artBox(b, s.level);
      const set = box && pieceSet(box.artName, box.pic);
      if (set) {
        // peças pintadas: cada uma na profundidade da âncora (onde toca o chão); o resto em pé no meio do prédio
        const c = buildingCenter(b);
        if (!seen(project(c.x, c.y))) continue;
        const L = artLayout(box!.artName)!;
        L.pieces!.forEach((p, i) => {
          if (set.canvases[i + 1]) list.push({ x: box!.left + (box!.flip ? 1 - p.ax : p.ax) * box!.w, y: box!.top + p.ay * box!.h, b, piece: i + 1 });
        });
        if (!(L.ground ?? !!def.walkable) && set.canvases[0]) {
          const pc = project(c.x, c.y);
          list.push({ x: pc.x, y: pc.y, b, piece: 0 });
        }
        if (art(`${box!.artName}-top`)) list.push({ ...project(c.x, c.y), b, top: true });
        continue;
      }
      if (def.walkable) continue;
      const c = buildingCenter(b);
      const p = project(c.x, c.y);
      if (seen(p)) {
        list.push({ x: p.x, y: p.y, b });
        if (box && art(`${box.artName}-top`)) list.push({ x: p.x, y: p.y, b, top: true });
      }
    }
    // na névoa não aparece nada em pé: nem recursos, nem bichos e inimigos, nem locais ainda não achados
    for (const n of s.nodes) {
      if (n.cleared || !isExplored(s, n.tx, n.ty)) continue; // arrancado (limpar área): não há o que desenhar
      const p = project(n.tx * TILE + TILE / 2, n.ty * TILE + TILE / 2);
      if (seen(p)) list.push({ x: p.x, y: p.y, n });
    }
    for (const site of s.sites) {
      if (!site.found || (site.done && site.kind !== 'chest')) continue;
      const p = project(site.tx * TILE + TILE / 2, site.ty * TILE + TILE / 2);
      // baú aberto: fica uns segundos no chão e some numa nuvem de poeira até reaparecer noutro lugar
      if (site.done && doneFor(site) > CHEST_LINGER) {
        if (!this.chestGone.has(site.id) && doneFor(site) < CHEST_LINGER + 2) this.particles.puff(p.x, p.y - 8);
        this.chestGone.add(site.id);
        continue;
      }
      this.chestGone.delete(site.id);
      if (!seen(p)) continue;
      // peças pintadas (ruína, mina): cada uma na profundidade da âncora; o resto em pé no ponto do local
      const box = this.siteBox(site, p.x, p.y);
      const set = box && site.kind !== 'chest' ? pieceSet(box.name, box.pic) : null;
      if (set) {
        artLayout(box!.name)!.pieces!.forEach((pc, i) => {
          if (set.canvases[i + 1]) list.push({ x: box!.left + pc.ax * box!.w, y: box!.top + pc.ay * box!.h, site, piece: i + 1 });
        });
        if (set.canvases[0]) list.push({ x: p.x, y: p.y, site, piece: 0 });
      } else list.push({ x: p.x, y: p.y, site });
    }
    // enfeites (boneco de neve, lanternas) só em chão livre: nada dentro de campo, horta ou arena
    this.decos = this.seasonal.decorations(s, (x, y) => g.world.walkablePx(x, y) && !g.world.buildingIdAt(Math.floor(x / TILE), Math.floor(y / TILE)));
    for (const deco of this.decos) {
      const p = project(deco.x, deco.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, deco });
    }
    // mina: estalagmites, cristais, cogumelos, escoras… (só desenho, render/cave.ts)
    for (const cave of caveDecos(s)) {
      if (CAVE_PROPS[cave.prop]!.flat || !isExploredPx(s, cave.x, cave.y)) continue;
      const p = project(cave.x, cave.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, cave });
    }
    // mapas temáticos: barcos, redes, palmeiras, poço… (só desenho, render/themeProps.ts)
    for (const theme of themeDecos(s)) {
      if (!isExploredPx(s, theme.x, theme.y)) continue;
      const p = project(theme.x, theme.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, theme });
    }
    for (const u of s.units) {
      if (u.hidden || (u.faction !== 'village' && !isExploredPx(s, u.x, u.y))) continue;
      // vigia da torre: desenhado na plataforma (entre as peças da arte, ver abaixo)
      const tw = u.state === 'towerWatch' && u.onTower != null ? g.building(u.onTower) : undefined;
      const spot = tw && this.guardSpot(tw, s.level);
      if (spot) {
        if (seen(spot)) list.push({ x: spot.x, y: spot.y, u, lift: { ...spot, towerId: tw!.id, b: tw! } });
        continue;
      }
      const p = project(u.x, u.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, u });
    }
    for (const e of s.effects) {
      if (e.kind !== 'wall') continue;
      const p = project(e.x, e.y);
      if (seen(p)) list.push({ x: p.x, y: p.y + 3, wall: e });
    }
    // Prédios ocupam vários tiles: o centro não basta para saber quem fica na frente. Uma unidade (ou árvore)
    // diante de uma face frontal do prédio (x além da direita ou y além do fundo do retângulo) vem depois dele;
    // as outras próximas vêm antes.
    // profundidade = a linha onde o desenho toca o chão (os pés do boneco, a base da rocha/baú), não o ponto lógico:
    // o sprite do ninja é desenhado 9 px abaixo do ponto dele, a rocha ~6 px, o baú ~5 px; comparar os pontos lógicos
    // fazia quem estava logo à frente de um baú ficar atrás dele. `depth` do Editor de cenário ajusta à mão.
    for (const d of list) d.k = this.baseLine(d);
    const blocks = list.filter((d) => d.b && d.piece == null && !d.top);
    for (const d of list) {
      if (d.b) continue;
      const wx = d.u ? d.u.x / TILE : d.deco ? d.deco.x / TILE : d.cave ? d.cave.x / TILE : d.wall ? d.wall.x / TILE : d.n ? d.n.tx + 0.5 : d.site!.tx + 0.5;
      const wy = d.u ? d.u.y / TILE : d.deco ? d.deco.y / TILE : d.cave ? d.cave.y / TILE : d.wall ? d.wall.y / TILE : d.n ? d.n.ty + 0.5 : d.site!.ty + 0.5;
      for (const o of blocks) {
        const b = o.b!;
        const def = defOf(b);
        if (wx < b.tx - 3 || wy < b.ty - 3 || wx > b.tx + def.w + 3 || wy > b.ty + def.h + 3) continue;
        const front = wx >= b.tx + def.w || wy >= b.ty + def.h;
        if (front && d.k! <= o.y) d.k = o.y + 0.01;
        else if (!front && d.k! >= o.y) d.k = o.y - 0.01;
      }
    }
    // sentado na arquibancada (Exame): desenhado logo depois da peça mais ao fundo do prédio (a arquibancada), por
    // cima dela e sem deixá-la transparente; as outras peças (muros dos lados e da frente) seguem na frente
    const perchY = new Map<number, number>();
    for (const d of list) {
      const id = d.u?.perch;
      if (id == null) continue;
      let y = perchY.get(id);
      if (y === undefined) {
        const b = g.building(id);
        const box = b && this.artBox(b, s.level);
        const L = box && artLayout(box.artName);
        y = box && L?.pieces?.length ? Math.min(...L.pieces.map((p) => box.top + p.ay * box.h)) : -Infinity;
        perchY.set(id, y);
      }
      if (d.k! <= y) d.k = y + 0.02 + d.y * 1e-5;
    }
    // camada de cima (`<arte>-top`): logo depois da base do mesmo prédio
    for (const d of list) {
      if (!d.top) continue;
      const base = list.filter((o) => o.b === d.b && !o.top);
      if (base.length) d.k = Math.max(...base.map((o) => o.k!)) + 0.001;
    }
    // vigia da torre: logo depois da arte da torre (ou das peças de baixo) e antes das peças marcadas "por cima do
    // vigia" (telhado, parapeito da frente) e da camada de cima, que o cobrem
    for (const d of list) {
      if (!d.lift) continue;
      const mine = list.filter((o) => o.b?.id === d.lift!.towerId);
      if (!mine.length) continue;
      const box = this.artBox(mine[0]!.b!, s.level);
      const L = box && artLayout(box.artName);
      const isOver = (o: Drawable) => !!o.top || (o.piece != null && o.piece > 0 && !!L?.pieces?.[o.piece - 1]?.over);
      const under = mine.filter((o) => !isOver(o));
      d.k = Math.max(...(under.length ? under : mine).map((o) => o.k!)) + 0.002;
      mine.filter(isOver).forEach((o, i) => (o.k = d.k! + 0.001 * (i + 1)));
    }
    list.sort((a, b) => a.k! - b.k!);

    this.drawCamps(g, time);
    // quem está golpeando um recurso agora (o quadro do impacto do morador) faz ele tremer
    this.hitNodes.clear();
    for (const u of s.units)
      if (u.kind === 'villager' && u.state === 'gather' && u.taskId != null && !u.dead) {
        const k = workImpact(u, time);
        if (k > (this.hitNodes.get(u.taskId) ?? 0)) this.hitNodes.set(u.taskId, k);
      }
    const occluded = this.occluders(list);
    const drawBlock = (d: Drawable) => {
      if (d.b && d.top) this.drawTop(d.b, s.level);
      else if (d.b && d.piece != null) this.drawPiece(d.b, d.piece, s.level);
      else if (d.b) this.building(d.b, time, night, s.level);
      else if (d.site && d.piece != null) this.drawSitePiece(d.site, d.piece, time, sel?.kind === 'site' && sel.id === d.site.id);
      else if (d.n) {
        // drawNode desenha no centro do tile em mundo: desloca para o ponto projetado
        const c = this.ctx;
        c.save();
        c.translate(d.x - (d.n.tx * TILE + TILE / 2), d.y - (d.n.ty * TILE + TILE / 2));
        this.node(d.n, time);
        c.restore();
      }
    };
    for (const d of list) {
      if (d.b || d.n || (d.site && d.piece != null)) {
        // quem tapa uma unidade fica semitransparente (some e volta suavemente), com furo e/ou pontilhado se ligados
        const key = d.b ? `b${d.b.id}:${d.top ? 'top' : (d.piece ?? '')}` : d.n ? `n${d.n.id}` : `s${d.site!.id}:${d.piece}`;
        const hits = occluded.get(d);
        const target = hits && this.occl.fade ? 0.38 : 1;
        const cur = this.fade.get(key) ?? 1;
        const a = cur + (target - cur) * Math.min(1, dt * 10 || 1);
        if (Math.abs(a - 1) < 0.01) this.fade.delete(key);
        else this.fade.set(key, a);
        const holes = this.occl.cutout && hits ? hits : null;
        const r = (holes || (this.occl.dither && a < 0.99)) && this.blockRect(d, s.level);
        if (r) this.occludedBlock(r, () => drawBlock(d), a, holes);
        else {
          ctx.globalAlpha = a;
          drawBlock(d);
        }
        ctx.globalAlpha = 1;
        // marcado para limpar (limpar área): anel tracejado laranja no pé, girando devagar
        if (d.n?.clear) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,170,60,0.95)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 3]);
          ctx.lineDashOffset = -time * 8;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + 4, 14, 6.5, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }
      if (d.site) this.drawSite(d.site, d.x, d.y, time, sel?.kind === 'site' && sel.id === d.site.id);
      else if (d.deco) drawDeco(ctx, d.deco, d.x, d.y, time);
      else if (d.cave) drawCaveDeco(ctx, d.cave, d.x, d.y);
      else if (d.theme) drawThemeDeco(ctx, d.theme, d.x, d.y);
      else if (d.wall) drawWall(ctx, d.wall);
      ctx.globalAlpha = 1;
      if (d.u) {
        // vigia: anda entre os pontos da plataforma (só desenho), a 70%, e esmaece junto com a torre
        const u = d.lift ? this.watchPose(d.u, d.lift, time) : this.projected(d.u);
        if (d.lift) ctx.globalAlpha = this.towerFade(d.lift.towerId);
        const selected = (sel?.kind === 'unit' && sel.id === u.id) || group.has(u.id);
        const tc = teamColor.get(u.kind === 'clone' ? (u.ownerId ?? -1) : u.id);
        if (tc && (!far || focus.has(u.id))) {
          ctx.strokeStyle = tc;
          ctx.lineWidth = focus.has(u.id) ? 2.5 : 1.3;
          ctx.globalAlpha = focus.has(u.id) ? 1 : 0.75;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 7, 9, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (selected) {
          ctx.strokeStyle = '#ffd34d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 7, 11, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // inimigo lutando: anel vermelho no chão (na luta grande dá para ver quem é quem)
        if (!far && !tc && u.combatTimer > 0 && !u.cloak && (u.faction === 'enemy' || (u.faction === 'wild' && u.targetId != null))) {
          ctx.strokeStyle = 'rgba(255,80,70,0.85)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 7, u.animal ? 13 : 9, u.animal ? 5.5 : 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        drawUnit(ctx, u, time, selected, workAction(g, d.u));
        // inverno: bafo de frio de vez em quando
        if (SEASON_VIEW.season === 'winter' && !lightWeatherFx() && !u.animal && u.kind !== 'clone' && Math.random() < dt * 0.35) {
          const dir = Math.cos(u.facing) >= 0 ? 1 : -1;
          this.particles.breath(u.x + dir * 4, u.y - 20, dir);
        }
        if (u.missionId != null && !far) this.missionBadge(u, time);
        if (selected && !group.has(u.id)) this.label(ctx, u.name, u.x, u.y - 34, cam.zoom);
      }
    }
    if (this.occl.silhouette) this.silhouettes(list, occluded, drawBlock, teamColor, focus, time);
    if (ghost) this.ghostSprite(ghost);

    this.drawHover(g, ov.hoverUnitId, sel?.kind === 'unit' ? sel.id : null, cam, time);
    this.commandFlags(g, teamColor, time);
    const flying = [];
    for (const p of s.projectiles) {
      if (p.dead) continue;
      const a = project(p.x, p.y);
      const v = project(p.vx, p.vy);
      const t = project(p.tx, p.ty);
      // projéteis voam na altura do peito
      const dragon = p.dragon ? dragonPoint(p.dragon, p.dragon.elapsed / p.dragon.duration) : null;
      const pp = { ...p, x: a.x, y: a.y - (dragon?.z ?? 8), vx: v.x,
        vy: v.y - (dragon && p.dragon ? dragon.vz / p.dragon.duration : 0), tx: t.x, ty: t.y - (dragon ? 0 : 8) };
      this.particles.trail(pp, pp.x, pp.y, dt);
      flying.push(pp);
    }
    this.particles.update(dt);
    this.particles.draw(ctx, 'trail');
    for (const p of flying) drawProjectile(ctx, p, time);
    for (const e of s.effects) {
      if (e.kind === 'wall') continue; // em pé, na ordem de profundidade
      if (e.kind === 'afterimage') {
        this.afterimage(g, e, time);
        continue;
      }
      // neve: fogo/lava/calor derretem, água/gelo congelam a poça
      if (e.kind === 'burst') this.seasonal.onEffect(s, e, e.vfx ? VFX_NATURE[e.vfx] ?? null : natureOf(e.color));
      const a = project(e.x, e.y);
      const b = e.x2 != null && e.y2 != null ? project(e.x2, e.y2) : null;
      const pe = b ? { ...e, x: a.x, y: a.y, x2: b.x, y2: b.y } : { ...e, x: a.x, y: a.y };
      this.particles.effect(e, pe);
      drawEffect(ctx, pe, cam.zoom, this.particles.snowy);
    }
    ctx.globalAlpha = 1;
    this.particles.draw(ctx);
    this.seasonal.drawRain(ctx, s);

    // ================= espaço de tela =================
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (night > 0) {
      ctx.fillStyle = `rgba(10,16,48,${0.55 * night})`;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      this.lights(g, cam, night);
    }
    this.weatherOverlay(s, cam, time);
    this.moment(s, cam);
    this.missionArrows(g, cam);
    if (ov.selectBox) {
      const b = ov.selectBox;
      const x = Math.min(b.x0, b.x1);
      const y = Math.min(b.y0, b.y1);
      const w = Math.abs(b.x1 - b.x0);
      const h = Math.abs(b.y1 - b.y0);
      ctx.fillStyle = 'rgba(255,211,77,0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    if (s.flags.alert) {
      const a = 0.25 + 0.15 * Math.sin(time * 6);
      const gr = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, Math.min(cam.viewW, cam.viewH) * 0.45, cam.viewW / 2, cam.viewH / 2, Math.max(cam.viewW, cam.viewH) * 0.7);
      gr.addColorStop(0, 'rgba(200,0,0,0)');
      gr.addColorStop(1, `rgba(200,0,0,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    }
  }

  /**
   * Prédios e árvores que ficam NA FRENTE de alguma unidade: desenhados depois dela (mais perto da câmera)
   * e com o retângulo do sprite cobrindo o corpo da unidade.
   */
  private occluders(list: Drawable[]): Map<Drawable, Body[]> {
    const out = new Map<Drawable, Body[]>();
    const bodies: Body[] = [];
    list.forEach((d, i) => {
      // o vigia lá em cima não "está atrás" da própria torre (senão o parapeito por cima dele ficava transparente)
      if (d.u && !d.u.dead && !d.lift) bodies.push({ x: d.x, y: d.y - 12, i, u: d.u });
    });
    if (!bodies.length) return out;
    // peça pintada: a área de transparência do Editor de cenário, se houver; senão os pixels da própria peça (o
    // retângulo em volta de uma peça curva, como o muro de trás da arena, pegava quem estava só perto dela)
    const pieceHit = (
      d: Drawable,
      i: number,
      box: { left: number; top: number; w: number; h: number; flip?: boolean },
      set: PieceSet,
      fade: [number, number, number, number] | undefined,
    ) => {
      const p = d.piece!;
      // fração da imagem na horizontal (espelhada no prédio de margem virado)
      const u = (x: number) => (box.flip ? 1 - (x - box.left) / box.w : (x - box.left) / box.w);
      if (fade) {
        const [fa, fb] = box.flip ? [1 - fade[2], 1 - fade[0]] : [fade[0], fade[2]];
        const r = { x0: box.left + fa * box.w, x1: box.left + fb * box.w, y0: box.top + fade[1] * box.h, y1: box.top + fade[3] * box.h };
        return bodies.filter((u) => u.i < i && u.x > r.x0 + 4 && u.x < r.x1 - 4 && u.y > r.y0 && u.y < r.y1);
      }
      const at = (x: number, y: number) => pieceCovers(set, p, u(x), (y - box.top) / box.h);
      return bodies.filter((u) => u.i < i && (at(u.x, u.y) || at(u.x - 4, u.y - 6) || at(u.x + 4, u.y - 6) || at(u.x, u.y + 8)));
    };
    const add = (d: Drawable, hit: Body[]) => {
      if (hit.length) out.set(d, hit);
    };
    list.forEach((d, i) => {
      let r: { x0: number; x1: number; y0: number; y1: number } | null = null;
      if (d.b && d.piece != null) {
        const box = this.artBox(d.b, this.level);
        const set = box && pieceSet(box.artName, box.pic);
        if (box && set) {
          const L = artLayout(box.artName)!;
          add(d, pieceHit(d, i, box, set, d.piece === 0 ? L.fade : L.pieces![d.piece - 1]?.fade));
        }
        return;
      } else if (d.b) {
        const { front, width } = this.footprint(d.b.type, d.b.tx, d.b.ty, d.b.level, d.b.flip);
        const pic = art(d.b.type);
        const h = pic ? (width / pic.naturalWidth) * pic.naturalHeight : width * 0.8;
        r = { x0: front.x - width / 2, x1: front.x + width / 2, y0: front.y - h, y1: front.y };
      } else if (d.site && d.piece != null) {
        const p = project(d.site.tx * TILE + TILE / 2, d.site.ty * TILE + TILE / 2);
        const box = this.siteBox(d.site, p.x, p.y);
        const set = box && pieceSet(box.name, box.pic);
        if (box && set) {
          const L = artLayout(box.name)!;
          add(d, pieceHit(d, i, box, set, d.piece === 0 ? L.fade : L.pieces![d.piece - 1]?.fade));
        }
        return;
      } else if (d.n && d.n.type === 'tree') r = { x0: d.x - 16, x1: d.x + 16, y0: d.y - 50, y1: d.y - 6 };
      if (!r) return;
      // só conta quem está atrás (desenhado antes) e com o corpo dentro do sprite
      add(d, bodies.filter((u) => u.i < i && u.x > r.x0 + 4 && u.x < r.x1 - 4 && u.y > r.y0 && u.y < r.y1));
    });
    return out;
  }

  /** Retângulo (px da cena) do que um prédio/peça/árvore/peça de local desenha, com folga; null = desenha direto. */
  private blockRect(d: Drawable, level: number): Rect | null {
    const pad = 10;
    if (d.b) {
      const box = this.artBox(d.b, level);
      return box ? { x0: box.left - pad, y0: box.top - pad, x1: box.left + box.w + pad, y1: box.top + box.h + pad } : null;
    }
    if (d.n) return { x0: d.x - 48, x1: d.x + 48, y0: d.y - 120, y1: d.y + 20 };
    if (d.site) {
      const p = project(d.site.tx * TILE + TILE / 2, d.site.ty * TILE + TILE / 2);
      const box = this.siteBox(d.site, p.x, p.y);
      return box ? { x0: box.left - pad, y0: box.top - pad, x1: box.left + box.w + pad, y1: box.top + box.h + pad } : null;
    }
    return null;
  }

  /**
   * Prepara uma camada fora da tela que cobre o retângulo `r` (px da cena) com a mesma transformação do mapa e desenha
   * `draw` nela. Devolve a camada e onde ela cai na tela (px do aparelho), ou null se estiver fora da tela.
   */
  private toLayer(which: 'A' | 'B', r: Rect, draw: () => void) {
    const main = this.ctx;
    const T = main.getTransform();
    const x0 = Math.max(0, Math.floor(T.a * r.x0 + T.e));
    const y0 = Math.max(0, Math.floor(T.d * r.y0 + T.f));
    const x1 = Math.min(this.canvas.width, Math.ceil(T.a * r.x1 + T.e));
    const y1 = Math.min(this.canvas.height, Math.ceil(T.d * r.y1 + T.f));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return null;
    let c = which === 'A' ? this.layerA : this.layerB;
    if (!c || c.width < w || c.height < h) {
      c = document.createElement('canvas');
      c.width = Math.max(w, c?.width ?? 0);
      c.height = Math.max(h, c?.height ?? 0);
      if (which === 'A') this.layerA = c;
      else this.layerB = c;
    }
    const l = c.getContext('2d')!;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, w, h);
    l.setTransform(T.a, T.b, T.c, T.d, T.e - x0, T.f - y0);
    l.imageSmoothingEnabled = main.imageSmoothingEnabled;
    this.ctx = l;
    try {
      draw();
    } finally {
      this.ctx = main;
    }
    return { c, l, x0, y0, w, h, T };
  }

  /**
   * Prédio/árvore que tapa alguém, numa camada: esmaecido `a` (alfa ou pontilhado) e com um furo em volta de cada
   * personagem atrás (`holes`), suave ou pontilhado.
   */
  private occludedBlock(r: Rect, draw: () => void, a: number, holes: Body[] | null) {
    const L = this.toLayer('A', r, draw);
    if (!L) return;
    const { c, l, x0, y0, w, h, T } = L;
    const dither = this.occl.dither;
    // pontilhado alinhado ao mundo (não "anda" com a câmera) e no tamanho do pixel da arte
    const pat = (k: number) => {
      const p = l.createPattern(bayer(k), 'repeat')!;
      const s = Math.max(1, Math.round(T.a * 0.54));
      p.setTransform(new DOMMatrix().translate(T.e - x0, T.f - y0).scale(s));
      return p;
    };
    l.globalCompositeOperation = 'destination-out';
    if (dither && a < 0.99) {
      l.save();
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.imageSmoothingEnabled = false;
      l.fillStyle = pat(Math.round((1 - a) * 16));
      l.fillRect(0, 0, w, h);
      l.restore();
    }
    for (const b of holes ?? []) {
      // o meio do corpo (os pés estão ~9 px abaixo do ponto e a cabeça ~25 acima); bicho grande, furo maior
      const R = b.u.animal ? 34 : 24;
      const cy = b.y + 4;
      if (dither) {
        for (const [rr, k] of [[R, 6], [R * 0.78, 10], [R * 0.55, 14]] as const) {
          l.save();
          l.beginPath();
          l.arc(b.x, cy, rr, 0, TAU);
          l.clip();
          l.setTransform(1, 0, 0, 1, 0, 0);
          l.imageSmoothingEnabled = false;
          l.fillStyle = pat(k);
          l.fillRect(0, 0, w, h);
          l.restore();
        }
      } else {
        const g = l.createRadialGradient(b.x, cy, 0, b.x, cy, R);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g;
        l.fillRect(b.x - R, cy - R, R * 2, R * 2);
      }
    }
    l.globalCompositeOperation = 'source-over';
    const main = this.ctx;
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalAlpha = dither ? 1 : a;
    main.drawImage(c, 0, 0, w, h, x0, y0, w, h);
    main.restore();
  }

  /**
   * Silhueta de quem está atrás de um prédio/árvore: o desenho do personagem pintado numa cor só, recortado pelos
   * pixels de quem o tapa, por cima de tudo. Só para quem importa ver (ninjas da vila, inimigos, bicho lutando e o
   * selecionado/grupo): com 150 moradores a vila não vira um mar de contornos.
   */
  private silhouettes(list: Drawable[], occluded: Map<Drawable, Body[]>, drawBlock: (d: Drawable) => void, teamColor: Map<number, string>, focus: Set<number>, time: number) {
    const covers = new Map<Unit, Drawable[]>();
    for (const [d, hits] of occluded) for (const b of hits) (covers.get(b.u) ?? covers.set(b.u, []).get(b.u)!).push(d);
    for (const [u, blocks] of covers) {
      const enemy = u.faction === 'enemy' || (u.faction === 'wild' && u.targetId != null);
      if (!(focus.has(u.id) || (u.faction === 'village' && u.ninja) || enemy) || (u.cloak && u.faction !== 'village')) continue;
      const pu = this.projected(u);
      const big = u.animal ? 70 : 28;
      const r = { x0: pu.x - big, x1: pu.x + big, y0: pu.y - (u.animal ? 130 : 56), y1: pu.y + 18 };
      const color = enemy ? '#ff5a4a' : (teamColor.get(u.id) ?? '#8fe3ff');
      const A = this.toLayer('A', r, () => drawUnit(this.ctx, pu, time, false, undefined, true));
      if (!A) continue;
      // só a parte tapada: os pixels de quem tapa (redesenhados numa segunda camada, sem efeitos)
      this.maskPass = true;
      const B = this.toLayer('B', r, () => {
        for (const d of blocks) drawBlock(d);
      });
      this.maskPass = false;
      if (!B) continue;
      const { c, l, x0, y0, w, h } = A;
      l.save();
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-in';
      l.fillStyle = color;
      l.fillRect(0, 0, w, h);
      l.globalCompositeOperation = 'destination-in';
      l.drawImage(B.c, 0, 0, w, h, 0, 0, w, h);
      l.restore();
      const main = this.ctx;
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = 0.6;
      main.drawImage(c, 0, 0, w, h, x0, y0, w, h);
      main.restore();
    }
  }

  /**
   * Arte do prédio (com o nível) e onde ela fica na cena, com escala e deslocamento do Editor de cenário.
   * `x`/`baseY`: meio da base (onde apoia); `left`/`top`/`w`/`h`: o retângulo desenhado.
   */
  artBox(b: Building, level: number) {
    // a Residência guarda o nível da vila (+1) em `level` (syncHokage); sem ele (prévia do editor), o da vila
    const lvl = b.level ?? (b.type === 'hokage' ? level + 1 : 1);
    // Editor de cenário: desenha exatamente a variante escolhida na lista (face do Monte, tema, estação)
    if (this.previewArt && art(this.previewArt)) return this.boxFor(b, this.previewArt, lvl);
    const faces = b.type === 'monument' ? `monument-f${Math.max(1, Math.min(6, this.kages))}` : '';
    const base =
      b.type === 'cherry' ? (this.season === 'spring' ? 'cherry' : this.season === 'winter' ? 'cherry-bare' : 'cherry-green') : faces && art(faces) ? faces : b.type;
    const themed = this.theme && art(`${b.type}-${this.theme}`) ? `${b.type}-${this.theme}` : '';
    const artName = themed || (lvl > 1 && art(`${base}-${lvl}`) ? `${base}-${lvl}` : base);
    return this.boxFor(b, artName, lvl);
  }

  /** Retângulo de uma arte de prédio na cena (escala/deslocamento do layout, com o da arte-base nas variantes). */
  private boxFor(b: Building, artName: string, lvl: number) {
    const pic = art(artName);
    if (!pic || !pic.naturalWidth) return null;
    const { front, width } = this.footprint(b.type, b.tx, b.ty, b.level, b.flip);
    const L = artLayout(artName);
    const h0 = ((width * (ART_SCALE[artName] ?? 1) * (L?.scale ?? 1)) / pic.naturalWidth) * pic.naturalHeight;
    const w = (h0 / pic.naturalHeight) * pic.naturalWidth;
    const h = h0 * (L?.squash ?? 1); // achatamento do Editor de cenário: só a altura
    // espelhado (prédio de margem): a arte vira em volta da ponta da frente, então o deslocamento lateral também
    const flip = !!b.flip;
    const x = front.x + (flip ? -1 : 1) * (L?.dx ?? 0);
    const baseY = front.y + 4 + (L?.dy ?? 0);
    return { artName, pic, lvl, front, width, h, w, x, baseY, left: x - w / 2, top: baseY - h, flip };
  }

  /** Camada de cima do prédio (`<arte>-top`), no mesmo retângulo da base (as duas imagens têm o mesmo tamanho). */
  private drawTop(b: Building, level: number) {
    const box = this.artBox(b, level);
    const top = box && art(`${box.artName}-top`);
    if (!box || !top || !top.naturalWidth) return;
    const ctx = this.ctx;
    ctx.save();
    if (!b.built) ctx.globalAlpha *= 0.35 + 0.45 * (b.progress / Math.max(1, defOf(b).buildTime));
    this.drawBox(top, box);
    ctx.restore();
  }

  /** Desenha a arte inteira no retângulo da caixa (largura e altura próprias: o achatamento muda só a altura). */
  private drawBox(img: HTMLImageElement | HTMLCanvasElement, box: { left: number; top: number; w: number; h: number; x: number; flip: boolean }) {
    const ctx = this.ctx;
    const nw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
    ctx.save();
    smoothIfShrunk(ctx, box.w, nw);
    if (box.flip) {
      ctx.translate(box.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-box.x, 0);
    }
    ctx.drawImage(img, box.left, box.top, box.w, box.h);
    ctx.restore();
  }

  /**
   * (chão) Terreno com água: terra batida sob as células de muro; sob as de água, só a sombra do píer/roda onde o mapa
   * é água de verdade. Célula de água em cima de terra não desenha nada (o autor reprovou pintar água ali).
   */
  private shoreGround(b: Building) {
    const ctx = this.ctx;
    const d = defOf(b);
    const cells = (want: string) => {
      ctx.beginPath();
      for (let fy = 0; fy < d.h * SUB; fy++)
        for (let fx = 0; fx < d.w * SUB; fx++)
          if (tileOf(layoutKey(b), fx, fy, b.flip) === want) ctx.roundRect(b.tx * TILE + fx * CELL - 2, b.ty * TILE + fy * CELL - 2, CELL + 4, CELL + 4, 4);
    };
    ctx.save();
    cells('#');
    ctx.fillStyle = 'rgba(120,90,55,0.35)';
    ctx.fill();
    // célula de água: sombra do píer/roda só sobre a água do mapa
    const s = this.mapState;
    const wet = (fx: number, fy: number) => {
      const tx = b.tx + Math.floor(fx / SUB);
      const ty = b.ty + Math.floor(fy / SUB);
      return !!s && tx >= 0 && ty >= 0 && tx < s.mapW && ty < s.mapH && s.tiles[ty * s.mapW + tx] === T.WATER;
    };
    ctx.beginPath();
    for (let fy = 0; fy < d.h * SUB; fy++)
      for (let fx = 0; fx < d.w * SUB; fx++)
        if (tileOf(layoutKey(b), fx, fy, b.flip) === '~' && wet(fx, fy)) ctx.roundRect(b.tx * TILE + fx * CELL - 2, b.ty * TILE + fy * CELL - 2, CELL + 4, CELL + 4, 4);
    ctx.fillStyle = 'rgba(8,24,44,0.3)';
    ctx.fill();
    ctx.restore();
  }

  /** Uma peça pintada do prédio (0 = o resto). */
  private drawPiece(b: Building, i: number, level: number) {
    const box = this.artBox(b, level);
    const set = box && pieceSet(box.artName, box.pic);
    const cv = set?.canvases[i];
    if (!box || !cv) return;
    const ctx = this.ctx;
    const d = defOf(b);
    ctx.save();
    if (!b.built) ctx.globalAlpha *= 0.35 + 0.45 * Math.min(1, b.progress / Math.max(1, d.buildTime));
    smoothIfShrunk(ctx, box.w, box.pic.naturalWidth);
    if (box.flip) {
      ctx.translate(box.left + box.w, box.top);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0, box.w, box.h);
    } else ctx.drawImage(cv, box.left, box.top, box.w, box.h);
    ctx.restore();
    if (i === 0 || i === set!.canvases.length - 1) this.buildBars(b, box.front);
  }

  /** Barra da obra (construção ou upgrade) na base do prédio. */
  private buildBars(b: Building, front: { x: number; y: number }) {
    const ctx = this.ctx;
    const d = defOf(b);
    const k = b.built ? (b.upgrade != null ? Math.min(1, b.upgrade / upgradeTime(b)) : -1) : b.progress / Math.max(1, d.buildTime);
    if (k < 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(front.x - 20, front.y + 6, 40, 4);
    ctx.fillStyle = b.built ? '#5ee05e' : '#ffd34d';
    ctx.fillRect(front.x - 19, front.y + 7, 38 * k, 2);
  }

  /** Ponta da frente do losango da base (onde o sprite do prédio apoia) e largura do losango, na cena. */
  private footprint(type: BuildingType, tx: number, ty: number, level = 1, flip = false) {
    const d = defOf({ type, level, flip });
    const front = project((tx + d.w) * TILE, (ty + d.h) * TILE);
    return { front, width: (d.w + d.h) * TILE * ISO_K };
  }

  /** Prédio em pé: arte isométrica apoiada na base; sem arte, o desenho antigo como "placa" de frente. */
  /**
   * Recurso no mapa: treme a cada machadada/picaretada (no quadro do impacto do morador) e a árvore que vira toco
   * cai para o lado antes de sobrar só o toco. Só visual (fora do estado).
   */
  private node(n: ResourceNode, time: number) {
    const ctx = this.ctx;
    const hit = this.hitNodes.get(n.id) ?? 0;
    const shake = hit ? Math.sin(time * 70) * 1.6 * hit : 0;
    if (n.type === 'tree') {
      const stump = isStump(n);
      const was = this.treeWas.get(n.id);
      this.treeWas.set(n.id, { tree: !stump, t: time });
      // acabou de virar toco (visto como árvore há pouco): começa a queda
      if (stump && was?.tree && time - was.t < 0.5) this.treeFall.set(n.id, time);
      if (!stump) this.treeFall.delete(n.id);
      const start = this.treeFall.get(n.id);
      if (stump && start != null) {
        const k = (time - start) / TREE_FALL;
        if (k >= 1) this.treeFall.delete(n.id);
        else {
          drawNode(ctx, n); // o toco fica; a árvore tomba por cima, girando pela base
          const bx = n.tx * TILE + TILE / 2;
          const by = n.ty * TILE + TILE * 0.7;
          const dir = n.id % 2 ? 1 : -1;
          const ease = Math.min(1, k / 0.75) ** 2.2; // acelera caindo
          ctx.save();
          ctx.translate(bx, by - 2);
          ctx.rotate(dir * ease * 1.45);
          ctx.globalAlpha *= k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          ctx.translate(-bx, -(by - 2));
          drawNode(ctx, n, true);
          ctx.restore();
          if (k > 0.72 && !this.treeDust.has(n.id)) {
            this.treeDust.add(n.id);
            const p = project(bx + dir * 34, by - 4);
            this.particles.dust(p.x, p.y, 10);
          }
          return;
        }
      }
      this.treeDust.delete(n.id);
    }
    if (shake) {
      ctx.save();
      ctx.translate(shake, 0);
      drawNode(ctx, n);
      ctx.restore();
    } else drawNode(ctx, n);
  }
  private treeDust = new Set<number>();
  /** Nível da vila no quadro atual (arte da Residência por nível). */
  private level = 0;
  /** Estação do mapa sendo desenhado (a cerejeira muda de arte: florida, verde, sem folhas). */
  private season = 'spring';
  /** Editor de cenário: nome da arte a desenhar no lugar da escolhida pelo jogo (variante); null no jogo. */
  previewArt: string | null = null;
  /** Kages que a vila já teve: o Monte dos Kages mostra um rosto por Kage (até 6, `monument-f<n>`). */
  private kages = 0;
  /** Tema do mapa de missão (pescadores, deserto): casa, mercado e torre trocam de arte (`<tipo>-<tema>`). */
  private theme = '';
  /** Semente do mapa desenhado (a variante de ruína/mina de cada região). */
  private seed = 0;

  private building(b: Building, time: number, night: number, level: number) {
    const ctx = this.ctx;
    const d = defOf(b);
    const { front, width } = this.footprint(b.type, b.tx, b.ty, b.level, b.flip);
    // arte do nível do prédio (upgrade), se existir; senão a do nível 1.
    // A Residência do Hokage não tem upgrade próprio: cresce junto com o nível da vila (Aldeia = 1 … Grande Vila Oculta = 4).
    const lvl = b.level ?? (b.type === 'hokage' ? level + 1 : 1);
    // a arte vem do artBox (nível, tema do mapa, faces do Monte, estação da cerejeira, variante do editor)
    const chosen = this.artBox(b, level);
    const artName = chosen?.artName ?? (lvl > 1 && art(`${b.type}-${lvl}`) ? `${b.type}-${lvl}` : b.type);
    const pic = chosen?.pic ?? art(artName);
    if (!pic) {
      ctx.save();
      ctx.translate(front.x - (b.tx + d.w / 2) * TILE, front.y - 6 - (b.ty + d.h) * TILE);
      drawBuilding(ctx, b, time, night, level);
      ctx.restore();
      return;
    }
    const k = b.built ? 1 : b.progress / Math.max(1, d.buildTime);
    ctx.save();
    if (!b.built) ctx.globalAlpha = 0.35 + 0.45 * k;
    const box = chosen ?? this.artBox(b, level)!;
    const h = box.h;
    this.drawBox(pic, box);
    if (SEASON_VIEW.snow > 0.03 && (!d.walkable || b.type === 'farm' || b.type === 'herbgarden')) {
      ctx.globalAlpha *= Math.min(1, SEASON_VIEW.snow * 1.4);
      // canteiros: neve pintada no próprio desenho (terra branca, plantas e cerca aparecendo); prédios: no telhado
      this.drawBox(d.walkable ? snowField(pic, artName) : snowCap(pic, artName, true), box);
    }
    ctx.restore();
    // inverno: fumaça saindo das chaminés das casas
    // marcas do Editor de cenário (px a partir do meio da base, tamanho 1×) ou as posições de sempre
    const mk = artLayout(artName)?.marks;
    if (!this.maskPass && b.type === 'house' && b.built && SEASON_VIEW.season === 'winter' && !lightWeatherFx() && Math.random() < this.frameDt * 1.6)
      this.particles.chimney(mk?.chimney ? box.x + (box.flip ? -1 : 1) * mk.chimney[0] : front.x + (box.flip ? -1 : 1) * width * 0.16, mk?.chimney ? box.baseY + mk.chimney[1] : front.y + 4 - h * 0.86);
    // obra de upgrade: barra amarela na base
    if (b.built && b.upgrade != null) {
      const k2 = Math.min(1, b.upgrade / upgradeTime(b));
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(front.x - 20, front.y + 6, 40, 4);
      ctx.fillStyle = '#5ee05e';
      ctx.fillRect(front.x - 19, front.y + 7, 38 * k2, 2);
    }
    if (!b.built) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(front.x - 20, front.y + 6, 40, 4);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(front.x - 19, front.y + 7, 38 * k, 2);
    }
  }

  /**
   * Onde ficam os pés do vigia na cena: a marca "guarda" da arte no Editor de cenário (px a partir do meio da base) ou
   * a altura padrão da plataforma por nível.
   */
  guardSpot(b: Building, level: number): { x: number; y: number } | null {
    const box = this.artBox(b, level);
    if (!box) return null;
    const mk = artLayout(box.artName)?.marks?.guard;
    // marcas em px a partir do meio da base; espelhado, o x troca de lado com a arte
    return mk ? { x: box.x + (box.flip ? -1 : 1) * mk[0], y: box.baseY + mk[1] } : { x: box.x, y: box.baseY - box.h * (GUARD_PLATFORM[box.lvl] ?? 0.58) };
  }

  /** Pontos da plataforma da torre (pés, na cena): a marca `guard` e as `guard2`/`guard3` da arte; sem elas, dois
   * passos para trás de cada lado da principal. */
  private guardSpots(b: Building, level: number): { x: number; y: number }[] {
    const main = this.guardSpot(b, level);
    const box = this.artBox(b, level);
    if (!main || !box) return [];
    const mk = artLayout(box.artName)?.marks;
    const extra = (['guard2', 'guard3'] as const).map((k) => mk?.[k]).filter((m): m is [number, number] => !!m);
    if (extra.length) return [main, ...extra.map((m) => ({ x: box.x + (box.flip ? -1 : 1) * m[0], y: box.baseY + m[1] }))];
    const s = box.w * 0.11;
    return [main, { x: main.x - s, y: main.y - s * 0.5 }, { x: main.x + s, y: main.y - s * 0.5 }];
  }

  /**
   * O vigia lá em cima (só desenho): a cada ~5 s anda até outro ponto da plataforma e fica olhando para um lado
   * (frente, esquerda, direita); arremessando, vira para o alvo. A 70% do tamanho, para caber na plataforma.
   */
  private watchPose(u: Unit, lift: { x: number; y: number; b: Building }, time: number): Unit {
    const base = this.projected(u);
    const pts = this.guardSpots(lift.b, this.level);
    const SEG = 5;
    const t = time + u.id * 1.37;
    const seg = Math.floor(t / SEG);
    const pick = (k: number) => (pts.length ? pts[((Math.imul(k + u.id, 2654435761) >>> 0) % pts.length)]! : lift);
    const from = pick(seg - 1);
    const to = pick(seg);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const walk = Math.min(1.5, dist / 16);
    const k = walk > 0 ? Math.min(1, (t - seg * SEG) / walk) : 1;
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k;
    const throwing = u.anim > 0 && u.animKind === 'throw';
    const moving = !throwing && k < 1 && dist > 0.5;
    const LOOK = [Math.PI / 2, 0, Math.PI, Math.PI / 2];
    const facing = throwing ? base.facing : moving ? Math.atan2(to.y - from.y, to.x - from.x) : LOOK[(seg + u.id) % LOOK.length]!;
    // a 100% na torre em camadas (arte com `-top`, feita para caber o ninja); 70% nas artes antigas, pequenas para ele
    const box = this.artBox(lift.b, this.level);
    const full = !!box && !!art(`${box.artName}-top`);
    return { ...base, x, y: y - 9, moving, facing, drawScale: full ? 1 : 0.7 }; // os pés ficam 9 px abaixo do ponto
  }

  /** Transparência atual da torre (a menor das peças dela): o vigia esmaece junto quando alguém passa atrás. */
  private towerFade(id: number) {
    let a = 1;
    for (const [k, v] of this.fade) if (k.startsWith(`b${id}:`)) a = Math.min(a, v);
    return a;
  }

  /** Shunshin: vulto do ninja onde ele estava, apagando rápido. */
  private afterimage(g: Game, e: Effect, time: number) {
    const u = g.unit(e.uid);
    if (!u) return;
    const ghost = this.projected({ ...u, x: e.x, y: e.y, facing: e.facing ?? u.facing, moving: true, hp: u.maxHp, stun: 0, shield: 0, hitFlash: 0, role: undefined, loot: undefined, mark: undefined });
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - e.t / e.life);
    drawUnit(ctx, ghost, time, false, undefined, true);
    ctx.restore();
  }

  /** Ruas calçadas (game/roads.ts): pedras no losango de cada tile, com a borda escura onde a rua acaba. */
  private drawRoads(g: Game) {
    const s = g.state;
    if (!s.roads?.some((w) => w)) return;
    const ctx = this.ctx;
    const winter = this.season === 'winter';
    const P = (x: number, y: number) => project(x * TILE, y * TILE);
    for (let ty = 0; ty < s.mapH; ty++)
      for (let tx = 0; tx < s.mapW; tx++) {
        if (!isRoad(s, tx, ty) || !isExplored(s, tx, ty)) continue;
        const a = P(tx, ty);
        const b = P(tx + 1, ty);
        const c = P(tx + 1, ty + 1);
        const d = P(tx, ty + 1);
        ctx.fillStyle = winter ? '#a8a49c' : '#8f8676';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        // 2×2 pedras por tile, cada uma um losango menor com cor sorteada pelo lugar (fixa)
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const h = ((tx * 7 + ty * 13 + i * 3 + j * 5) * 2654435761) >>> 28;
            ctx.fillStyle = winter ? (h & 1 ? '#d8d6d0' : '#c8c4bc') : h & 1 ? '#b4aa98' : h & 2 ? '#a69c8a' : '#bcb2a0';
            const x0 = tx + i * 0.5 + 0.05;
            const y0 = ty + j * 0.5 + 0.05;
            const q = [P(x0, y0), P(x0 + 0.4, y0), P(x0 + 0.4, y0 + 0.4), P(x0, y0 + 0.4)];
            ctx.beginPath();
            ctx.moveTo(q[0]!.x, q[0]!.y);
            for (const p of q.slice(1)) ctx.lineTo(p.x, p.y);
            ctx.closePath();
            ctx.fill();
          }
        // borda onde a rua acaba (meio-fio)
        ctx.strokeStyle = '#5e5648';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (!isRoad(s, tx, ty - 1)) (ctx.moveTo(a.x, a.y), ctx.lineTo(b.x, b.y));
        if (!isRoad(s, tx + 1, ty)) (ctx.moveTo(b.x, b.y), ctx.lineTo(c.x, c.y));
        if (!isRoad(s, tx, ty + 1)) (ctx.moveTo(c.x, c.y), ctx.lineTo(d.x, d.y));
        if (!isRoad(s, tx - 1, ty)) (ctx.moveTo(d.x, d.y), ctx.lineTo(a.x, a.y));
        ctx.stroke();
      }
  }

  /** Kage Mane: faixa de sombra no chão do ninja até o preso, ondulando nas bordas (por baixo de todo mundo). */
  private drawTethers(g: Game, time: number) {
    const ctx = this.ctx;
    for (const e of g.state.effects) {
      if (e.kind !== 'tether' || e.x2 == null || e.y2 == null) continue;
      const a = project(e.x, e.y);
      const b = project(e.x2, e.y2);
      const k = e.t / e.life;
      // cresce do lançador até o alvo no começo e encolhe de volta no fim
      const grow = Math.min(1, e.t / 0.25) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      const bx = a.x + (b.x - a.x) * grow;
      const by = a.y + (b.y - a.y) * grow;
      const len = Math.hypot(bx - a.x, by - a.y) || 1;
      const nx = -(by - a.y) / len;
      const ny = (bx - a.x) / len;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const w = 2.5 + Math.sin(t * 9 + time * 8) * 0.9;
        ctx.lineTo(a.x + (bx - a.x) * t + nx * w, a.y + (by - a.y) * t + ny * w * 0.5);
      }
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        const w = 2.5 + Math.cos(t * 7 + time * 7) * 0.9;
        ctx.lineTo(a.x + (bx - a.x) * t - nx * w, a.y + (by - a.y) * t - ny * w * 0.5);
      }
      ctx.fill();
      // poça de sombra sob o preso
      if (grow >= 1) {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 9, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Canteiros recém-colhidos: terra à mostra que some aos poucos (a planta volta a crescer), com brotinhos. */
  private drawHarvest(g: Game) {
    const ctx = this.ctx;
    for (const e of g.state.effects) {
      if (e.kind !== 'harvest') continue;
      const k = e.t / e.life;
      const p = project(e.x, e.y);
      const r = (e.r ?? 10) * ISO_K;
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.6, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // brotos crescendo
      if (k > 0.3) {
        ctx.fillStyle = '#6fbf4a';
        const h = 1 + (k - 0.3) * 5;
        for (const [ox, oy] of [[-5, -1], [0, 1], [5, -1], [-2, 3], [3, 3]]) ctx.fillRect(p.x + ox! - 0.5, p.y + oy! - h, 1.5, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Destaque da unidade sob o mouse (no mapa ou na lista do painel): anel pulsante, seta e nome. */
  /** Momento especial (`fx 'moment'`): o fundo escurece nas bordas e o nome da técnica aparece grande no centro. */
  private moment(s: GameState, cam: Camera) {
    const e = s.effects.find((o) => o.kind === 'moment');
    if (!e) return;
    const ctx = this.ctx;
    const k = e.t / e.life;
    const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    const W = cam.viewW;
    const H = cam.viewH;
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${0.55 * a})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    const size = Math.round(Math.min(34, Math.max(20, W / 28)));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = H * 0.3 - (1 - a) * 8;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const text = plainTokens(e.text ?? '');
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = e.color;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  /** Clima e estação em espaço de tela: tom da estação, chuva, neve e relâmpagos (congela com o jogo pausado). */
  private weatherOverlay(s: GameState, cam: Camera, time: number) {
    const ctx = this.ctx;
    const W = cam.viewW;
    const H = cam.viewH;
    const season = seasonOf(s);
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(210,228,255,0.11)';
      ctx.fillRect(0, 0, W, H);
    } else if (season === 'autumn') {
      ctx.fillStyle = 'rgba(255,150,50,0.06)';
      ctx.fillRect(0, 0, W, H);
    }
    const hash = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
    const blizzard = s.weather === 'storm' && season === 'winter';
    if (blizzard) {
      // nevasca: muita neve inclinada pelo vento e uma névoa branca nas bordas
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const n = lightWeatherFx() ? 120 : 260;
      for (let i = 0; i < n; i++) {
        const y = (hash(i) * H + time * (90 + hash(i + 3.1) * 60)) % (H + 10);
        const x = (((hash(i + 7.3) * W + time * (180 + hash(i + 1.3) * 80)) % (W + 20)) + W + 20) % (W + 20) - 10;
        ctx.fillRect(x, y, 1.5 + hash(i + 2.2) * 1.5, 1.2 + hash(i + 2.2));
      }
      if (!lightWeatherFx()) {
        const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(235,242,255,0)');
        gr.addColorStop(1, `rgba(235,242,255,${0.45 + Math.sin(time * 0.7) * 0.08})`);
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (this.seasonal.flash > 0) {
      // a chuva cai no mapa (embaixo das nuvens, ver seasonal.rainFrame); aqui só o clarão do raio
      ctx.fillStyle = `rgba(235,240,255,${0.3 * this.seasonal.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (s.weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 120; i++) {
        const y = (hash(i) * H + time * (28 + hash(i + 3.1) * 30)) % (H + 10);
        const x = (hash(i + 7.3) * W + Math.sin(time * 1.3 + i) * 14 + W) % W;
        ctx.beginPath();
        ctx.arc(x, y, 1 + hash(i + 2.2) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // outono: folhas caindo; primavera: pétalas de cerejeira
    if ((season === 'autumn' || season === 'spring') && !blizzard) {
      const n = lightWeatherFx() ? 10 : 24;
      const cols = season === 'autumn' ? ['#e8802a', '#f4ba38', '#cc4a2a'] : ['#ffc8dc', '#ffe0ea', '#f7a8c4'];
      for (let i = 0; i < n; i++) {
        const y = (hash(i + 40) * H + time * (22 + hash(i + 41) * 18)) % (H + 10);
        const x = (hash(i + 47.3) * W + Math.sin(time * 0.9 + i * 1.7) * 26 + time * 12 + W * 2) % W;
        const rot = time * (1.5 + hash(i + 43)) + i;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(1, Math.abs(Math.sin(rot * 0.7)) * 0.7 + 0.3);
        ctx.fillStyle = cols[i % cols.length]!;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Textura da névoa (refeita só quando o estado ou o explorado muda). */
  private fogTexture(s: GameState) {
    // um tamanho por mapa (a vila é maior que os mapas de missão): troca de mapa refaz as duas texturas
    if (!this.fog || this.fog.width !== s.mapW + FOG_PAD * 2 || this.fog.height !== s.mapH + FOG_PAD * 2) {
      this.fog = document.createElement('canvas');
      this.fog.width = s.mapW + FOG_PAD * 2;
      this.fog.height = s.mapH + FOG_PAD * 2;
      this.fogSoft = null;
      this.fogOf = null;
    }
    if (this.fogVer !== fogVersion || this.fogOf !== s) {
      this.fogVer = fogVersion;
      this.fogOf = s;
      const c = this.fog.getContext('2d')!;
      // moldura de névoa em volta do mapa: o desfoque não "vaza" pelas bordas
      const W = this.fog.width;
      const H = this.fog.height;
      const img = c.createImageData(W, H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          img.data[i] = 10;
          img.data[i + 1] = 13;
          img.data[i + 2] = 18;
          img.data[i + 3] = isExplored(s, x - FOG_PAD, y - FOG_PAD) ? 0 : 236;
        }
      c.putImageData(img, 0, 0);
      // versão 8× maior com desfoque: borda da névoa macia em vez de degraus de tile
      if (!this.fogSoft) {
        this.fogSoft = document.createElement('canvas');
        this.fogSoft.width = W * 8;
        this.fogSoft.height = H * 8;
      }
      const sc = this.fogSoft.getContext('2d')!;
      sc.clearRect(0, 0, this.fogSoft.width, this.fogSoft.height);
      sc.imageSmoothingEnabled = true;
      sc.filter = 'blur(6px)';
      sc.drawImage(this.fog, 0, 0, this.fogSoft.width, this.fogSoft.height);
      sc.filter = 'none';
    }
    return this.fogSoft ?? this.fog;
  }

  /**
   * Arte do local: baú aberto/fechado; ruína e mina têm duas versões (a editada à mão e a `-alt` do Codex) e cada área do
   * mapa (grade 3×2) sorteia uma pela semente da partida: os locais da mesma região ficam parecidos, os de outra variam.
   */
  private siteArt(site: Site) {
    if (this.previewArt && art(this.previewArt)) return this.previewArt;
    if (site.kind === 'chest') return site.done && art('chest-open') ? 'chest-open' : 'chest';
    if (site.kind !== 'ruin' && site.kind !== 'cave') return site.kind;
    const zone = Math.floor(site.tx / 24) + 3 * Math.floor(site.ty / 24);
    const alt = (Math.imul((this.seed ^ (zone * 0x45d9f3b)) >>> 0, 2654435761) >>> 16) & 1;
    return alt && art(`${site.kind}-alt`) ? `${site.kind}-alt` : site.kind;
  }

  /** Local especial (ruínas, baú, mina): arte isométrica com um brilho que chama atenção enquanto não foi investigado. */
  /** Arte do local e onde fica na cena (x, y = ponto do local já projetado), com escala/deslocamento do layout. */
  siteBox(site: Site, x: number, y: number) {
    const name = this.siteArt(site);
    const pic = art(name);
    if (!pic || !pic.naturalWidth) return null;
    const L = artLayout(name);
    const w = (site.kind === 'chest' ? 30 : site.kind === 'ruin' ? 84 : 90) * (L?.scale ?? 1);
    const h = (w / pic.naturalWidth) * pic.naturalHeight * (L?.squash ?? 1);
    const cx = x + (L?.dx ?? 0);
    const top = y + (L?.dy ?? 0) + w * 0.18 - h;
    const f = artFoot(pic); // onde o desenho toca o chão (anel e brilho centrados aí)
    return { name, pic, w, h, left: cx - w / 2, top, x: cx, y: y + (L?.dy ?? 0), fx: cx - w / 2 + f.cx * w, fy: top + f.by * h, fr: f.hw * w };
  }

  /** Peça pintada de um local (0 = resto, com o brilho de "ainda não investigado" e a seleção). */
  private drawSitePiece(site: Site, i: number, time: number, selected: boolean) {
    const p = project(site.tx * TILE + TILE / 2, site.ty * TILE + TILE / 2);
    const box = this.siteBox(site, p.x, p.y);
    const cv = box && pieceSet(box.name, box.pic)?.canvases[i];
    if (!box || !cv) return;
    const ctx = this.ctx;
    if (i === 0) {
      if (!site.done) {
        ctx.fillStyle = `rgba(255,211,77,${0.25 + 0.2 * Math.sin(time * 3 + site.id)})`;
        ctx.beginPath();
        ctx.ellipse(box.fx, box.fy - box.fr * 0.45, box.fr * 1.08, box.fr * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selected) {
        ctx.strokeStyle = '#ffd34d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(box.fx, box.fy - box.fr * 0.45, box.fr * 1.18, box.fr * 0.56, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    smoothIfShrunk(ctx, box.w, box.pic.naturalWidth);
    ctx.drawImage(cv, box.left, box.top, box.w, box.h);
    ctx.imageSmoothingEnabled = true;
  }

  /** Baús abertos que já sumiram (a poeira sai uma vez só). */
  private chestGone = new Set<number>();

  private drawSite(site: Site, x: number, y: number, time: number, selected: boolean) {
    const ctx = this.ctx;
    const name = this.siteArt(site);
    const pic = art(name);
    const L = artLayout(name); // escala e deslocamento do Editor de cenário
    const w = (site.kind === 'chest' ? 30 : site.kind === 'ruin' ? 84 : 90) * (L?.scale ?? 1);
    x += L?.dx ?? 0;
    y += L?.dy ?? 0;
    // retângulo da arte (baú: mesma escala aberto ou fechado) e onde ela toca o chão: anel, brilho e sombra ficam aí
    // (a base isométrica 2:1 tem o centro meia largura/2 acima da ponta de baixo)
    const chest = site.kind === 'chest';
    const pw = pic ? (chest ? (w * pic.naturalWidth) / 96 : w) : 0;
    const ph = pic ? (pw / pic.naturalWidth) * pic.naturalHeight * (L?.squash ?? 1) : 0;
    const left = x - pw / 2 + (chest && site.done ? -w * 0.06 : 0);
    const top = (chest ? y + w * 0.12 : y + w * 0.18) - ph;
    const f = pic ? artFoot(pic) : { cx: 0.5, by: 1, hw: 0.4 };
    const fx = pic ? left + f.cx * pw : x;
    const fy = pic ? top + f.by * ph : y + 4;
    const fr = pic ? f.hw * pw : w * 0.4;
    const fade = chest && site.done ? Math.max(0, Math.min(1, (CHEST_LINGER - doneFor(site)) / 1.2)) : 1; // baú aberto some aos poucos
    if (!site.done) {
      const a = 0.25 + 0.2 * Math.sin(time * 3 + site.id);
      ctx.fillStyle = `rgba(255,211,77,${a})`;
      ctx.beginPath();
      ctx.ellipse(fx, fy - fr * 0.45, fr * 1.08, fr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (selected) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(fx, fy - fr * 0.45, fr * 1.18, fr * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (pic && chest) {
      // baú sem chão na arte: sombra própria (encaixa em qualquer piso)
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - fr * 0.45, fr * 1.0, fr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      smoothIfShrunk(ctx, pw, pic.naturalWidth);
      ctx.drawImage(pic, left, top, pw, ph);
      ctx.restore();
      ctx.imageSmoothingEnabled = true;
    } else if (pic) {
      smoothIfShrunk(ctx, pw, pic.naturalWidth);
      ctx.drawImage(pic, left, top, pw, ph);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.fillStyle = site.kind === 'chest' ? '#8a5a2b' : '#777';
      ctx.fillRect(x - w / 4, y - w / 3, w / 2, w / 3);
    }
  }

  private drawHover(g: Game, id: number | null, selectedId: number | null, cam: Camera, time: number) {
    const real = g.unit(id);
    if (!real || real.dead) return;
    const u = this.projected(real);
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65 + 0.35 * pulse;
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 7, 12 + pulse * 2, 5.5 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // dentro de um prédio só o anel na porta e o nome aparecem
    const top = u.y - (u.hidden ? 20 : 40) - pulse * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(u.x - 5, top - 6);
    ctx.lineTo(u.x + 5, top - 6);
    ctx.lineTo(u.x, top);
    ctx.fill();
    if (u.id !== selectedId) {
      this.label(ctx, u.hidden ? `${u.name} (dentro)` : u.name, u.x, top - 22, cam.zoom);
      this.label(ctx, unitTag(u), u.x, top - 11, cam.zoom, true);
    }
  }

  /** Barracas e fogueira dos acampamentos/covis de missões ativas. */
  private drawCamps(g: Game, time: number) {
    const ctx = this.ctx;
    for (const mi of g.state.missions) {
      if (mi.status !== 'active' || (mi.type !== 'camp' && mi.type !== 'wanted')) continue;
      const m = project(mi.x, mi.y);
      for (const [ox, oy, c] of [[-34, -18, '#8a6a4a'], [30, -14, '#6f5a7a'], [-6, -40, '#7a5a3a']] as const) {
        const x = m.x + ox;
        const y = m.y + oy;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 10, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x - 15, y + 9);
        ctx.lineTo(x, y - 12);
        ctx.lineTo(x + 15, y + 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(x - 3, y + 9);
        ctx.lineTo(x, y - 2);
        ctx.lineTo(x + 3, y + 9);
        ctx.fill();
      }
      // fogueira
      ctx.fillStyle = '#5a3b22';
      ctx.fillRect(m.x - 7, m.y - 1, 14, 3);
      const f = 1 + Math.sin(time * 12) * 0.15;
      const gr = ctx.createRadialGradient(m.x, m.y - 4, 0, m.x, m.y - 4, 9 * f);
      gr.addColorStop(0, '#fff3b0');
      gr.addColorStop(0.5, '#ff8a2b');
      gr.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 4, 9 * f, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Marca alvos de missão (losango vermelho; chefe = estrela dourada; mercador = moeda). `u` já na cena. */
  private missionBadge(u: Unit, time: number) {
    const ctx = this.ctx;
    const y = u.y - (u.animal ? 30 : 34) + Math.sin(time * 4 + u.id) * 1.5;
    if (u.faction === 'village') {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(u.x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6a00';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', u.x, y + 0.5);
      return;
    }
    const boss = u.name.startsWith('★');
    ctx.fillStyle = boss ? '#ffd34d' : '#ff4d4d';
    ctx.beginPath();
    if (boss)
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 2.3 : 5.5;
        ctx.lineTo(u.x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    else {
      ctx.moveTo(u.x, y - 4);
      ctx.lineTo(u.x + 3, y);
      ctx.lineTo(u.x, y + 4);
      ctx.lineTo(u.x - 3, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** (chão) Anel pulsante no ponto de interesse de cada missão ativa. */
  private drawObjectives(g: Game, time: number) {
    const ctx = this.ctx;
    for (const m of g.state.missions) {
      if (m.status !== 'active') continue;
      const p = missionFocus(g, m);
      const k = (time * 0.8) % 1;
      ctx.strokeStyle = MISSION_RANKS[m.rank]!.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + k * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** Setas na borda da tela apontando para missões fora de vista. */
  private missionArrows(g: Game, cam: Camera) {
    const ctx = this.ctx;
    const pad = 46;
    for (const m of g.state.missions) {
      if (m.status !== 'active') continue;
      const w = missionFocus(g, m);
      const p = cam.worldToScreen(w.x, w.y);
      if (p.x > 0 && p.y > 40 && p.x < cam.viewW && p.y < cam.viewH) continue;
      const cx = cam.viewW / 2;
      const cy = cam.viewH / 2;
      const a = Math.atan2(p.y - cy, p.x - cx);
      const t = Math.min((cam.viewW / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), (cam.viewH / 2 - pad) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * t;
      const y = cy + Math.sin(a) * t;
      const color = MISSION_RANKS[m.rank]!.color;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(20,16,12,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(MISSION_RANKS[m.rank]!.label, 0, 1);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(13, -5);
      ctx.lineTo(13, 5);
      ctx.fill();
      ctx.restore();
    }
  }

  /** (chão) Limite do território: escurece o que está fora quando se está construindo. */
  private drawTerritory(g: Game, dim: boolean) {
    const c = territoryCenter(g.state);
    if (!c) return;
    const ctx = this.ctx;
    const r = territoryRadius(g.state) * TILE;
    const cx = c.tx * TILE;
    const cy = c.ty * TILE;
    if (dim) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.rect(0, 0, g.state.mapW * TILE, g.state.mapH * TILE);
      ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
    ctx.strokeStyle = 'rgba(255,211,77,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** (chão) Linhas das ordens do jogador: caminho até o ponto e mira no alvo de ataque. */
  private commandLines(g: Game, focus: Set<number>, teamColor: Map<number, string>, time: number) {
    const ctx = this.ctx;
    for (const u of g.state.units) {
      const c = u.command;
      if (!c || u.dead || !focus.has(u.id)) continue;
      if (c.kind === 'move') {
        if (u.hidden) continue;
        ctx.strokeStyle = teamColor.get(u.id) ?? '#ffd34d';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (c.kind === 'attack') {
        const t = g.unit(c.targetId);
        if (!t || t.dead) continue;
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, 12 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** Linha (y da cena) em que o desenho de `d` toca o chão, mais o ajuste `depth` da arte. */
  baseLine(d: Drawable): number {
    if (d.u) return d.y + (d.u.animal ? ANIMALS[d.u.animal].size * 0.7 : 9);
    if (d.n) {
      const L = artLayout(nodeArt(d.n));
      return d.y + TILE * 0.2 + (L?.dy ?? 0) + (L?.depth ?? 0);
    }
    if (d.site && d.piece == null) {
      const box = this.siteBox(d.site, d.x, d.y);
      return box ? box.y + box.w * (d.site.kind === 'chest' && d.site.done ? 0.12 : 0.18) + (artLayout(box.name)?.depth ?? 0) : d.y;
    }
    if (d.b && d.piece == null) {
      const box = this.artBox(d.b, this.level);
      return d.y + ((box && artLayout(box.artName)?.depth) ?? 0);
    }
    return d.y;
  }

  /** Bandeiras de "defender ponto" (em pé); some quando o ninja chega nela (ficaria por cima dele). */
  private commandFlags(g: Game, teamColor: Map<number, string>, time: number) {
    const ctx = this.ctx;
    for (const u of g.state.units) {
      const c = u.command;
      if (!c || u.dead || c.kind !== 'move') continue;
      if (!u.hidden && Math.hypot(c.x - u.x, c.y - u.y) < 20) continue;
      const p = project(c.x, c.y);
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 4);
      ctx.lineTo(p.x, p.y - 14);
      ctx.stroke();
      ctx.fillStyle = teamColor.get(u.id) ?? '#ffd34d';
      const wave = Math.sin(time * 5 + u.id) * 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.x + 10, p.y - 11 + wave);
      ctx.lineTo(p.x, p.y - 8);
      ctx.fill();
    }
  }

  private lights(g: Game, cam: Camera, night: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const glow = (wx: number, wy: number, lift: number, r: number, color: string, a: number) => {
      const p = cam.worldToScreen(wx, wy);
      p.y -= lift * cam.zoom;
      const rr = r * cam.zoom;
      if (p.x < -rr || p.y < -rr || p.x > cam.viewW + rr || p.y > cam.viewH + rr) return;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      gr.addColorStop(0, color.replace('A', String(a)));
      gr.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = gr;
      ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    };
    const winter = seasonOf(g.state) === 'winter';
    for (const b of g.state.buildings) {
      // lanterna de pedra (decoração): luz quente em volta à noite
      if (b.built && b.type === 'lantern') {
        const c = buildingCenter(b);
        glow(c.x, c.y, 10, 48, 'rgba(255,190,90,A)', 0.55 * night);
      }
      if (!b.built || !defOf(b).lights) continue;
      const d = doorPos(b);
      // no inverno as casas ficam com as janelas mais quentes (lareira acesa)
      glow(d.x, d.y, 14, winter ? 66 : 55, winter ? 'rgba(255,160,70,A)' : 'rgba(255,190,90,A)', (winter ? 0.5 : 0.35) * night);
    }
    for (const d of this.decos) if (d.kind === 'lantern') glow(d.x, d.y, 21, 34, 'rgba(255,120,50,A)', 0.6 * night);
    // mina: cristais, cogumelos, tochas e lanternas das escoras com luz própria (tremendo de leve)
    for (const d of caveDecos(g.state)) {
      const lg = CAVE_PROPS[d.prop]!.glow;
      if (lg && isExploredPx(g.state, d.x, d.y)) glow(d.x, d.y, lg[1], lg[2], lg[0], 0.42 + Math.sin(performance.now() / 300 + d.x) * 0.05);
    }
    if (g.state.sceneInfo?.kind === 'mine' || g.state.sceneInfo?.kind === 'hideout')
      for (const u of g.state.units) if (!u.dead && !u.hidden && u.faction === 'village') glow(u.x, u.y, 12, 95, 'rgba(255,170,90,A)', 0.28);
    for (const p of g.state.projectiles) if (!p.dead && p.kind !== 'kunai') glow(p.x, p.y, 8, 40, hexA(p.color), 0.5 * night);
    for (const e of g.state.effects) if (e.kind === 'burst' || e.kind === 'bolt') glow(e.x, e.y, 0, (e.r ?? 20) * 2, hexA(e.color), 0.5 * night * (1 - e.t / e.life));
    ctx.globalCompositeOperation = 'source-over';
  }

  private label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, zoom: number, sub = false) {
    const size = (sub ? 7.5 : 9) * Math.max(1, 1 / zoom);
    ctx.font = `${sub ? 700 : 600} ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = sub ? '#ffd34d' : '#fff';
    ctx.fillText(text, x, y);
  }

  /** (chão) Grade e base do prédio que está sendo posicionado: verde = pode, vermelho = não pode. */
  private ghostGround(gh: Ghost) {
    const ctx = this.ctx;
    // de onde o prédio está saindo: só a base, tracejada (o prédio não é desenhado ali)
    if (gh.moveFrom) {
      const o = gh.moveFrom;
      ctx.fillStyle = 'rgba(255,211,77,0.18)';
      ctx.fillRect(o.tx * TILE, o.ty * TILE, o.w * TILE, o.h * TILE);
      ctx.strokeStyle = 'rgba(255,211,77,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(o.tx * TILE, o.ty * TILE, o.w * TILE, o.h * TILE);
      ctx.setLineDash([]);
    }
    const d = defOf(gh);
    const x = gh.tx * TILE;
    const y = gh.ty * TILE;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= d.w + 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * TILE, y - 3 * TILE);
      ctx.lineTo(x + i * TILE, y + (d.h + 3) * TILE);
      ctx.stroke();
    }
    for (let j = -3; j <= d.h + 3; j++) {
      ctx.beginPath();
      ctx.moveTo(x - 3 * TILE, y + j * TILE);
      ctx.lineTo(x + (d.w + 3) * TILE, y + j * TILE);
      ctx.stroke();
    }
    ctx.fillStyle = gh.valid ? 'rgba(80,220,100,0.35)' : 'rgba(240,60,60,0.4)';
    ctx.fillRect(x, y, d.w * TILE, d.h * TILE);
    // prédio de margem: as células que vão na água em azul
    if (hasWater(gh) && tileOf(layoutKey(gh), 0, 0) !== undefined) {
      ctx.fillStyle = 'rgba(70,150,255,0.45)';
      for (let fy = 0; fy < d.h * SUB; fy++)
        for (let fx = 0; fx < d.w * SUB; fx++) if (tileOf(layoutKey(gh), fx, fy, gh.flip) === '~') ctx.fillRect(x + fx * CELL, y + fy * CELL, CELL, CELL);
    }
    ctx.strokeStyle = gh.valid ? '#5ee05e' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, d.w * TILE, d.h * TILE);
    // porta
    const door = doorTile({ type: gh.type, tx: gh.tx, ty: gh.ty, flip: gh.flip, level: gh.level } as Building);
    ctx.fillStyle = gh.valid ? 'rgba(255,255,255,0.6)' : 'rgba(255,90,90,0.6)';
    ctx.fillRect(door.tx * TILE + 8, door.ty * TILE + 2, TILE - 16, 6);
  }

  /** Prévia translúcida do prédio em pé sobre a base. */
  private ghostSprite(gh: Ghost) {
    // como o prédio pronto vai ficar: escala e deslocamento do Editor de cenário e o lado espelhado
    const box = this.artBox({ type: gh.type, tx: gh.tx, ty: gh.ty, flip: gh.flip, level: gh.level } as Building, this.level);
    if (!box) return;
    const ctx = this.ctx;
    ctx.globalAlpha = 0.6;
    this.drawBox(box.pic, box);
    ctx.globalAlpha = 1;
  }
}

/** Linha de baixo do rótulo de hover: patente e nível (ninja), "Renegado", "Morador(a)" ou o animal. */
function unitTag(u: Unit) {
  if (u.animal) return ANIMALS[u.animal].name;
  if (u.ninja) {
    const who = u.kind === 'clone' ? 'Clone · ' : u.faction === 'enemy' ? 'Renegado · ' : u.faction === 'guest' ? 'Convidado · ' : '';
    return `${who}${RANKS[u.ninja.rank].name} · Nv ${u.ninja.level}`;
  }
  return 'Morador(a)';
}

/** Animação de trabalho do morador: derrubando árvore, quebrando pedra, capinando/colhendo ou construindo. */
function workAction(g: Game, u: Unit): WorkAction | undefined {
  if (u.kind !== 'villager') return undefined;
  if (u.state === 'farming') return 'farm';
  if (u.state === 'build') return 'chop';
  if (u.state === 'gather') {
    const n = g.node(u.taskId);
    return n?.type === 'tree' ? 'chop' : n ? 'mine' : undefined;
  }
  return undefined;
}

function hexA(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},A)`;
}

/**
 * Muralha de terra (Doryuuheki): bloco de pedra de pé no chão, perpendicular a para onde foi levantada. Brota do chão
 * (0,25 s), fica, e no fim afunda se esfarelando. As pontas vêm do mundo e são projetadas (casa com a vista isométrica).
 */
function drawWall(ctx: CanvasRenderingContext2D, e: Effect) {
  const [wa, wb] = wallEnds(e);
  const a = project(wa.x, wa.y);
  const b = project(wb.x, wb.y);
  const rise = Math.min(1, e.t / 0.25);
  const end = e.life - e.t < 0.45 ? (e.life - e.t) / 0.45 : 1;
  const H = 24 * rise * (0.4 + 0.6 * end);
  // espessura: o topo recua um pouco "para dentro" da tela
  const nx = -(b.y - a.y);
  const ny = b.x - a.x;
  const nl = Math.hypot(nx, ny) || 1;
  const th = 4;
  let tx = (nx / nl) * th;
  let ty = (ny / nl) * th * 0.5;
  if (ty > 0) [tx, ty] = [-tx, -ty];
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, end * 1.5));
  // sombra no chão
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + 1);
  ctx.lineTo(b.x, b.y + 1);
  ctx.lineTo(b.x + tx * 1.5, b.y + ty * 1.5 + 2);
  ctx.lineTo(a.x + tx * 1.5, a.y + ty * 1.5 + 2);
  ctx.fill();
  // face da frente (com blocos de pedra) e topo
  const g = ctx.createLinearGradient(0, Math.min(a.y, b.y) - H, 0, Math.max(a.y, b.y));
  g.addColorStop(0, '#b0814c');
  g.addColorStop(1, '#7a5532');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#3e2a16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y - H);
  ctx.lineTo(a.x, a.y - H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c99a62';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - H);
  ctx.lineTo(b.x, b.y - H);
  ctx.lineTo(b.x + tx, b.y - H + ty);
  ctx.lineTo(a.x + tx, a.y - H + ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // juntas dos blocos: três fiadas, com as juntas verticais alternadas
  ctx.strokeStyle = 'rgba(62,42,22,0.55)';
  ctx.lineWidth = 0.8;
  const rows = 3;
  for (let r = 1; r < rows; r++) {
    const k = r / rows;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - H * k);
    ctx.lineTo(b.x, b.y - H * k);
    ctx.stroke();
  }
  for (let r = 0; r < rows; r++) {
    const k0 = r / rows;
    const k1 = (r + 1) / rows;
    for (const f of r % 2 ? [0.5] : [0.3, 0.7]) {
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      ctx.beginPath();
      ctx.moveTo(x, y - H * k0);
      ctx.lineTo(x, y - H * k1);
      ctx.stroke();
    }
  }
  // brilho na borda de cima
  ctx.strokeStyle = 'rgba(255,230,190,0.45)';
  ctx.beginPath();
  ctx.moveTo(a.x + 1, a.y - H + 1);
  ctx.lineTo(b.x - 1, b.y - H + 1);
  ctx.stroke();
  ctx.restore();
}

