import { MAX_DPR, TILE, WORLD_H, WORLD_W } from '../config';
import { ANIMALS } from '../data/animals';
import { RANKS } from '../data/ninja';
import type { Camera } from '../core/camera';
import { groundTransform, ISO_K, project, projectAngle } from '../core/iso';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { Game } from '../game/game';
import { DEFENSES, GUARD_SHOW } from '../game/systems/towers';
import { upgradeTime } from '../game/upgrade';

/** Altura da plataforma da torre (fração da altura do sprite, de baixo para cima) por nível. */
const GUARD_PLATFORM: Record<number, number> = { 1: 0.58, 2: 0.6, 3: 0.6 };
import { darkness } from '../game/time';
import { missionFocus } from '../game/missionView';
import { MISSION_RANKS } from '../data/missions';
import { territoryCenter, territoryRadius } from '../game/village';
import type { Building, Effect, GameState, ResourceNode, Site, Unit } from '../game/types';
import { fogVersion, isExplored, isExploredPx } from '../game/explore';
import { seasonOf } from '../game/mood';
import { searchTiles } from '../game/systems/villagers';
import { MAP_H, MAP_W } from '../config';
import { buildingCenter, doorPos } from '../game/world';
import { art, ART_SCALE, artFrames, drawArt, SHEET_ROWS, smoothIfShrunk } from './art';
import { drawEffect } from './effects';
import { natureOf, Particles } from './particles';
import { drawDeco, lightWeatherFx, Seasonal, SEASON_VIEW, snowCap, snowField, type Deco } from './seasonal';
import { drawBuilding, drawNode, drawProjectile, drawUnit, isStump, workImpact, type WorkAction } from './sprites';
import { drawWaterAnim, renderTerrain, waterDepth } from './terrain';

export interface Ghost {
  type: BuildingType;
  tx: number;
  ty: number;
  valid: boolean;
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

type Drawable = { y: number; x: number; /** chave de profundidade (começa em y) */ k?: number; b?: Building; n?: ResourceNode; u?: Unit; site?: Site; deco?: Deco };

/**
 * Desenho isométrico em duas passadas:
 * 1. "chão": tudo que fica deitado (terreno, campos, marcações) é desenhado em coordenadas de mundo
 *    com a transformação `groundTransform`;
 * 2. "em pé": prédios, árvores e unidades são desenhados de frente no ponto projetado, do fundo para a frente.
 */
/** Segundos da árvore tombando. */
const TREE_FALL = 1.1;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement | null = null;
  /** Cache por mapa (a vila e o mapa de missão alternam na tela). */
  private maps = new WeakMap<GameState, { terrain: HTMLCanvasElement; depth: Uint8Array; seasonal: Seasonal }>();
  private dpr = 1;
  private list: Drawable[] = [];
  /** Transparência atual de prédios/árvores que tapam alguém (chave → alpha), para a transição ficar suave. */
  private fade = new Map<string, number>();
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

  resize(w: number, h: number) {
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
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
    let cache = this.maps.get(s);
    if (!cache) {
      cache = { terrain: renderTerrain(s), depth: waterDepth(s), seasonal: new Seasonal() };
      this.maps.set(s, cache);
    }
    this.terrain = cache.terrain;
    this.depth = cache.depth;
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
    ctx.drawImage(this.terrain, 0, 0);
    drawWaterAnim(ctx, s, this.depth, time);
    this.seasonal.drawIce(ctx, s, this.depth);
    this.seasonal.drawWet(ctx);
    this.seasonal.drawGround(ctx, s);
    this.seasonal.drawCloudShadows(ctx, s);
    ctx.drawImage(this.fogTexture(s), -FOG_PAD * TILE, -FOG_PAD * TILE, WORLD_W + FOG_PAD * 2 * TILE, WORLD_H + FOG_PAD * 2 * TILE);

    // chão batido sob prédios
    ctx.fillStyle = 'rgba(120,90,55,0.35)';
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      if (d.walkable) continue;
      ctx.beginPath();
      ctx.roundRect(b.tx * TILE - 4, b.ty * TILE - 4, d.w * TILE + 8, d.h * TILE + 10, 8);
      ctx.fill();
    }
    // campos e áreas abertas ficam deitados no chão
    // (os que têm arte isométrica vão como decalque logo depois desta passada)
    for (const b of s.buildings) if (BUILDINGS[b.type].walkable && !art(b.type)) drawBuilding(ctx, b, time, night, s.level);

    if (sel?.kind === 'building') {
      const b = g.building(sel.id);
      if (b) {
        const d = BUILDINGS[b.type];
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

    // decalques: campos com arte isométrica (fazenda, treino, horta) ficam no chão, sob todo mundo
    for (const b of s.buildings) if (BUILDINGS[b.type].walkable && art(b.type)) this.building(b, time, night, s.level);
    this.drawHarvest(g);

    // ================= passada 2: em pé, do fundo para a frente =================
    const m = 110;
    const x0 = cam.left - m;
    const y0 = cam.top - m;
    const x1 = cam.left + cam.viewW / cam.zoom + m;
    const y1 = cam.top + cam.viewH / cam.zoom + m;
    const seen = (p: { x: number; y: number }) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;

    const list = this.list;
    list.length = 0;
    for (const b of s.buildings) {
      if (BUILDINGS[b.type].walkable) continue;
      const c = buildingCenter(b);
      const p = project(c.x, c.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, b });
    }
    // na névoa não aparece nada em pé: nem recursos, nem bichos e inimigos, nem locais ainda não achados
    for (const n of s.nodes) {
      if (!isExplored(s, n.tx, n.ty)) continue;
      const p = project(n.tx * TILE + TILE / 2, n.ty * TILE + TILE / 2);
      if (seen(p)) list.push({ x: p.x, y: p.y, n });
    }
    for (const site of s.sites) {
      if (!site.found || (site.done && site.kind !== 'chest')) continue; // baú aberto fica no chão (aberto) até reaparecer noutro lugar
      const p = project(site.tx * TILE + TILE / 2, site.ty * TILE + TILE / 2);
      if (seen(p)) list.push({ x: p.x, y: p.y, site });
    }
    this.decos = this.seasonal.decorations(s, (x, y) => g.world.walkablePx(x, y));
    for (const deco of this.decos) {
      const p = project(deco.x, deco.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, deco });
    }
    for (const u of s.units) {
      if (u.hidden || (u.faction !== 'village' && !isExploredPx(s, u.x, u.y))) continue;
      const p = project(u.x, u.y);
      if (seen(p)) list.push({ x: p.x, y: p.y, u });
    }
    // Prédios ocupam vários tiles: o centro não basta para saber quem fica na frente. Uma unidade (ou árvore)
    // diante de uma face frontal do prédio (x além da direita ou y além do fundo do retângulo) vem depois dele;
    // as outras próximas vêm antes.
    for (const d of list) d.k = d.y;
    const blocks = list.filter((d) => d.b);
    for (const d of list) {
      if (d.b) continue;
      const wx = d.u ? d.u.x / TILE : d.deco ? d.deco.x / TILE : d.n ? d.n.tx + 0.5 : d.site!.tx + 0.5;
      const wy = d.u ? d.u.y / TILE : d.deco ? d.deco.y / TILE : d.n ? d.n.ty + 0.5 : d.site!.ty + 0.5;
      for (const o of blocks) {
        const b = o.b!;
        const def = BUILDINGS[b.type];
        if (wx < b.tx - 3 || wy < b.ty - 3 || wx > b.tx + def.w + 3 || wy > b.ty + def.h + 3) continue;
        const front = wx >= b.tx + def.w || wy >= b.ty + def.h;
        if (front && d.k! <= o.y) d.k = o.y + 0.01;
        else if (!front && d.k! >= o.y) d.k = o.y - 0.01;
      }
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
    for (const d of list) {
      if (d.b || d.n) {
        // quem tapa uma unidade fica semitransparente (some e volta suavemente)
        const key = d.b ? `b${d.b.id}` : `n${d.n!.id}`;
        const target = occluded.has(d) ? 0.38 : 1;
        const cur = this.fade.get(key) ?? 1;
        const a = cur + (target - cur) * Math.min(1, dt * 10 || 1);
        if (Math.abs(a - 1) < 0.01) this.fade.delete(key);
        else this.fade.set(key, a);
        ctx.globalAlpha = a;
      }
      if (d.b) this.building(d.b, time, night, s.level);
      else if (d.site) this.drawSite(d.site, d.x, d.y, time, sel?.kind === 'site' && sel.id === d.site.id);
      else if (d.deco) drawDeco(ctx, d.deco, d.x, d.y, time);
      else if (d.n) {
        // drawNode desenha no centro do tile em mundo: desloca para o ponto projetado
        ctx.save();
        ctx.translate(d.x - (d.n.tx * TILE + TILE / 2), d.y - (d.n.ty * TILE + TILE / 2));
        this.node(d.n, time);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (d.u) {
        const u = this.projected(d.u);
        const selected = (sel?.kind === 'unit' && sel.id === u.id) || group.has(u.id);
        const tc = teamColor.get(u.kind === 'clone' ? (u.ownerId ?? -1) : u.id);
        if (tc) {
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
        drawUnit(ctx, u, time, selected, workAction(g, d.u));
        // inverno: bafo de frio de vez em quando
        if (SEASON_VIEW.season === 'winter' && !lightWeatherFx() && !u.animal && u.kind !== 'clone' && Math.random() < dt * 0.35) {
          const dir = Math.cos(u.facing) >= 0 ? 1 : -1;
          this.particles.breath(u.x + dir * 4, u.y - 20, dir);
        }
        if (u.missionId != null) this.missionBadge(u, time);
        if (selected && !group.has(u.id)) this.label(ctx, u.name, u.x, u.y - 34, cam.zoom);
      }
    }
    if (ghost) this.ghostSprite(ghost);

    this.drawHover(g, ov.hoverUnitId, sel?.kind === 'unit' ? sel.id : null, cam, time);
    this.commandFlags(g, teamColor, time);
    for (const p of s.projectiles) {
      if (p.dead) continue;
      const a = project(p.x, p.y);
      const v = project(p.vx, p.vy);
      const t = project(p.tx, p.ty);
      // projéteis voam na altura do peito
      const pp = { ...p, x: a.x, y: a.y - 8, vx: v.x, vy: v.y, tx: t.x, ty: t.y - 8 };
      this.particles.trail(pp, pp.x, pp.y, dt);
      drawProjectile(ctx, pp, time);
    }
    for (const e of s.effects) {
      if (e.kind === 'afterimage') {
        this.afterimage(g, e, time);
        continue;
      }
      if (e.kind === 'burst') this.seasonal.onEffect(s, e, natureOf(e.color));
      const a = project(e.x, e.y);
      const b = e.x2 != null && e.y2 != null ? project(e.x2, e.y2) : null;
      const pe = b ? { ...e, x: a.x, y: a.y, x2: b.x, y2: b.y } : { ...e, x: a.x, y: a.y };
      this.particles.effect(e, pe);
      drawEffect(ctx, pe, cam.zoom, this.particles.snowy);
    }
    this.particles.update(dt);
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
  private occluders(list: Drawable[]): Set<Drawable> {
    const out = new Set<Drawable>();
    const bodies: { x: number; y: number; i: number }[] = [];
    list.forEach((d, i) => {
      if (d.u && !d.u.dead) bodies.push({ x: d.x, y: d.y - 12, i });
    });
    if (!bodies.length) return out;
    list.forEach((d, i) => {
      let r: { x0: number; x1: number; y0: number; y1: number } | null = null;
      if (d.b) {
        const { front, width } = this.footprint(d.b.type, d.b.tx, d.b.ty);
        const pic = art(d.b.type);
        const h = pic ? (width / pic.naturalWidth) * pic.naturalHeight : width * 0.8;
        r = { x0: front.x - width / 2, x1: front.x + width / 2, y0: front.y - h, y1: front.y };
      } else if (d.n && d.n.type === 'tree') r = { x0: d.x - 16, x1: d.x + 16, y0: d.y - 50, y1: d.y - 6 };
      if (!r) return;
      // só conta quem está atrás (desenhado antes) e com o corpo dentro do sprite
      if (bodies.some((u) => u.i < i && u.x > r.x0 + 4 && u.x < r.x1 - 4 && u.y > r.y0 && u.y < r.y1)) out.add(d);
    });
    return out;
  }

  /** Ponta da frente do losango da base (onde o sprite do prédio apoia) e largura do losango, na cena. */
  private footprint(type: BuildingType, tx: number, ty: number) {
    const d = BUILDINGS[type];
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

  private building(b: Building, time: number, night: number, level: number) {
    const ctx = this.ctx;
    const d = BUILDINGS[b.type];
    const { front, width } = this.footprint(b.type, b.tx, b.ty);
    // arte do nível do prédio (upgrade), se existir; senão a do nível 1.
    // A Residência do Hokage não tem upgrade próprio: cresce junto com o nível da vila (Aldeia = 1 … Grande Vila Oculta = 4).
    const lvl = b.type === 'hokage' ? level + 1 : (b.level ?? 1);
    const artName = lvl > 1 && art(`${b.type}-${lvl}`) ? `${b.type}-${lvl}` : b.type;
    const pic = art(artName);
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
    const h = ((width * (ART_SCALE[artName] ?? 1)) / pic.naturalWidth) * pic.naturalHeight;
    drawArt(ctx, pic, front.x, front.y + 4, h);
    if (SEASON_VIEW.snow > 0.03 && (!d.walkable || b.type === 'farm' || b.type === 'herbgarden')) {
      ctx.globalAlpha *= Math.min(1, SEASON_VIEW.snow * 1.4);
      // canteiros: neve pintada no próprio desenho (terra branca, plantas e cerca aparecendo); prédios: no telhado
      drawArt(ctx, d.walkable ? snowField(pic, artName) : snowCap(pic, artName, true), front.x, front.y + 4, h);
    }
    ctx.restore();
    // inverno: fumaça saindo das chaminés das casas
    if (b.type === 'house' && b.built && SEASON_VIEW.season === 'winter' && !lightWeatherFx() && Math.random() < this.frameDt * 1.6)
      this.particles.chimney(front.x + width * 0.16, front.y + 4 - h * 0.86);
    if (b.type === 'tower' && b.built && (b.shot ?? 0) > 0) this.towerGuard(b, front.x, front.y + 4 - h * (GUARD_PLATFORM[lvl] ?? 0.58), time);
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

  /** Guarda no alto da torre: arremessa a kunai (ciclo do golpe) e depois fica de vigia, olhando para o alvo. */
  private towerGuard(b: Building, x: number, y: number, time: number) {
    const pic = art('tower-guard');
    if (!pic) return;
    const since = GUARD_SHOW - (b.shot ?? 0);
    const sheet = artFrames(pic);
    const frame = since < 0.5 ? Math.min(sheet.frames - 1, Math.floor((since / 0.5) * sheet.frames)) : sheet.idle;
    const a = projectAngle(b.aim ?? Math.PI / 4);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const row = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? SHEET_ROWS.front : SHEET_ROWS.back) : SHEET_ROWS.side;
    const ctx = this.ctx;
    ctx.save();
    // some devagar no fim da vigia
    ctx.globalAlpha = Math.min(1, (b.shot ?? 0) / 0.4);
    drawArt(ctx, pic, x, y, 26, row === SHEET_ROWS.side && dx < 0, frame, row);
    ctx.restore();
    void time;
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
    if (!this.fog) {
      this.fog = document.createElement('canvas');
      this.fog.width = MAP_W + FOG_PAD * 2;
      this.fog.height = MAP_H + FOG_PAD * 2;
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

  /** Local especial (ruínas, baú, mina): arte isométrica com um brilho que chama atenção enquanto não foi investigado. */
  private drawSite(site: Site, x: number, y: number, time: number, selected: boolean) {
    const ctx = this.ctx;
    const pic = (site.kind === 'chest' && site.done && art('chest-open')) || art(site.kind);
    const w = site.kind === 'chest' ? 30 : site.kind === 'ruin' ? 84 : 90;
    if (!site.done) {
      const a = 0.25 + 0.2 * Math.sin(time * 3 + site.id);
      ctx.fillStyle = `rgba(255,211,77,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, w * 0.45, w * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (selected) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, w * 0.5, w * 0.21, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (pic && site.kind === 'chest') {
      // baú sem chão na arte: sombra própria (encaixa em qualquer piso) e a mesma escala aberto ou fechado
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, w * 0.46, w * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      const pw = (w * pic.naturalWidth) / 96;
      const ph = (pw / pic.naturalWidth) * pic.naturalHeight;
      smoothIfShrunk(ctx, pw, pic.naturalWidth);
      ctx.drawImage(pic, x - pw / 2 + (site.done ? -w * 0.06 : 0), y + w * 0.12 - ph, pw, ph);
      ctx.imageSmoothingEnabled = true;
    } else if (pic) {
      const h = (w / pic.naturalWidth) * pic.naturalHeight;
      smoothIfShrunk(ctx, w, pic.naturalWidth);
      ctx.drawImage(pic, x - w / 2, y + w * 0.18 - h, w, h);
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
      ctx.rect(0, 0, WORLD_W, WORLD_H);
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

  /** Bandeiras de "defender ponto" (em pé). */
  private commandFlags(g: Game, teamColor: Map<number, string>, time: number) {
    const ctx = this.ctx;
    for (const u of g.state.units) {
      const c = u.command;
      if (!c || u.dead || c.kind !== 'move') continue;
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
      if (!b.built || !BUILDINGS[b.type].lights) continue;
      const d = doorPos(b);
      // no inverno as casas ficam com as janelas mais quentes (lareira acesa)
      glow(d.x, d.y, 14, winter ? 66 : 55, winter ? 'rgba(255,160,70,A)' : 'rgba(255,190,90,A)', (winter ? 0.5 : 0.35) * night);
    }
    for (const d of this.decos) if (d.kind === 'lantern') glow(d.x, d.y, 21, 34, 'rgba(255,120,50,A)', 0.6 * night);
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
    const d = BUILDINGS[gh.type];
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
    ctx.strokeStyle = gh.valid ? '#5ee05e' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, d.w * TILE, d.h * TILE);
    // porta
    ctx.fillStyle = gh.valid ? 'rgba(255,255,255,0.6)' : 'rgba(255,90,90,0.6)';
    ctx.fillRect((gh.tx + Math.floor(d.w / 2)) * TILE + 8, (gh.ty + d.h) * TILE + 2, TILE - 16, 6);
  }

  /** Prévia translúcida do prédio em pé sobre a base. */
  private ghostSprite(gh: Ghost) {
    const pic = art(gh.type);
    if (!pic) return;
    const { front, width } = this.footprint(gh.type, gh.tx, gh.ty);
    const ctx = this.ctx;
    ctx.globalAlpha = 0.6;
    drawArt(ctx, pic, front.x, front.y + 4, ((width * (ART_SCALE[gh.type] ?? 1)) / pic.naturalWidth) * pic.naturalHeight);
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
