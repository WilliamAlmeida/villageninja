import { MAX_DPR, TILE, WORLD_H, WORLD_W } from '../config';
import type { Camera } from '../core/camera';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { Game } from '../game/game';
import { DEFENSES } from '../game/systems/towers';
import { darkness } from '../game/time';
import type { Building, ResourceNode, Unit } from '../game/types';
import { buildingCenter, doorPos } from '../game/world';
import { drawEffect } from './effects';
import { drawBuilding, drawNode, drawProjectile, drawUnit, paintBuilding } from './sprites';
import { renderTerrain } from './terrain';

export interface Ghost {
  type: BuildingType;
  tx: number;
  ty: number;
  valid: boolean;
}

type Drawable = { y: number; b?: Building; n?: ResourceNode; u?: Unit };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement | null = null;
  private terrainSeed = NaN;
  private dpr = 1;
  private list: Drawable[] = [];

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

  render(g: Game, cam: Camera, ghost: Ghost | null, time: number) {
    const s = g.state;
    if (!this.terrain || this.terrainSeed !== s.seed) {
      this.terrain = renderTerrain(s);
      this.terrainSeed = s.seed;
    }
    const ctx = this.ctx;
    const z = cam.zoom * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b2a16';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z, 0, 0, z, -cam.left * z, -cam.top * z);
    ctx.imageSmoothingEnabled = true;

    // terreno (só a parte visível)
    const vx0 = Math.max(0, cam.left);
    const vy0 = Math.max(0, cam.top);
    const vw = Math.min(WORLD_W - vx0, cam.viewW / cam.zoom + 2);
    const vh = Math.min(WORLD_H - vy0, cam.viewH / cam.zoom + 2);
    ctx.drawImage(this.terrain, vx0, vy0, vw, vh, vx0, vy0, vw, vh);

    const m = 64;
    const x0 = cam.left - m;
    const y0 = cam.top - m;
    const x1 = cam.left + cam.viewW / cam.zoom + m;
    const y1 = cam.top + cam.viewH / cam.zoom + m;
    const night = darkness(s);
    const sel = g.selected;

    // chão batido sob prédios
    ctx.fillStyle = 'rgba(120,90,55,0.35)';
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      if (d.walkable) continue;
      ctx.beginPath();
      ctx.roundRect(b.tx * TILE - 6, b.ty * TILE - 4, d.w * TILE + 12, d.h * TILE + 14, 8);
      ctx.fill();
    }

    // seleção (prédio) embaixo
    if (sel?.kind === 'building') {
      const b = g.building(sel.id);
      if (b) {
        const d = BUILDINGS[b.type];
        ctx.strokeStyle = '#ffd34d';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(b.tx * TILE - 3, b.ty * TILE - 3, d.w * TILE + 6, d.h * TILE + 6);
        ctx.setLineDash([]);
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

    // ordenação por profundidade (y)
    const list = this.list;
    list.length = 0;
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      const bx = b.tx * TILE;
      const by = b.ty * TILE;
      if (bx + d.w * TILE < x0 || bx > x1 || by + d.h * TILE < y0 || by - 40 > y1) continue;
      list.push({ y: d.walkable ? by : by + d.h * TILE, b });
    }
    for (const n of s.nodes) {
      const nx = n.tx * TILE;
      const ny = n.ty * TILE;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      list.push({ y: ny + TILE * 0.75, n });
    }
    for (const u of s.units) {
      if (u.hidden || u.x < x0 || u.x > x1 || u.y < y0 || u.y > y1) continue;
      list.push({ y: u.y + 6, u });
    }
    list.sort((a, b) => a.y - b.y);

    for (const d of list) {
      if (d.b) drawBuilding(ctx, d.b, time, night);
      else if (d.n) drawNode(ctx, d.n);
      else if (d.u) {
        const selected = sel?.kind === 'unit' && sel.id === d.u.id;
        if (selected) {
          ctx.strokeStyle = '#ffd34d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(d.u.x, d.u.y + 7, 11, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        drawUnit(ctx, d.u, time, selected);
        if (selected) this.label(ctx, d.u.name, d.u.x, d.u.y - 34, cam.zoom);
      }
    }

    for (const p of s.projectiles) if (!p.dead) drawProjectile(ctx, p, time);
    for (const e of s.effects) drawEffect(ctx, e, cam.zoom);

    if (ghost) this.drawGhost(ctx, ghost, time);

    // ---- espaço de tela ----
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (night > 0) {
      ctx.fillStyle = `rgba(10,16,48,${0.55 * night})`;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      this.lights(g, cam, night);
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

  private lights(g: Game, cam: Camera, night: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const glow = (wx: number, wy: number, r: number, color: string, a: number) => {
      const p = cam.worldToScreen(wx, wy);
      const rr = r * cam.zoom;
      if (p.x < -rr || p.y < -rr || p.x > cam.viewW + rr || p.y > cam.viewH + rr) return;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      gr.addColorStop(0, color.replace('A', String(a)));
      gr.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = gr;
      ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    };
    for (const b of g.state.buildings) {
      if (!b.built || !BUILDINGS[b.type].lights) continue;
      const d = doorPos(b);
      glow(d.x, d.y - 14, 55, 'rgba(255,190,90,A)', 0.35 * night);
    }
    for (const p of g.state.projectiles) if (!p.dead && p.kind !== 'kunai') glow(p.x, p.y, 40, hexA(p.color), 0.5 * night);
    for (const e of g.state.effects) if (e.kind === 'burst' || e.kind === 'bolt') glow(e.x, e.y, (e.r ?? 20) * 2, hexA(e.color), 0.5 * night * (1 - e.t / e.life));
    ctx.globalCompositeOperation = 'source-over';
  }

  private label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, zoom: number) {
    const size = 9 * Math.max(1, 1 / zoom);
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y);
  }

  private drawGhost(ctx: CanvasRenderingContext2D, gh: Ghost, time: number) {
    const d = BUILDINGS[gh.type];
    const x = gh.tx * TILE;
    const y = gh.ty * TILE;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
    ctx.globalAlpha = 0.6;
    paintBuilding(ctx, d, x, y, d.w * TILE, d.h * TILE, time, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gh.valid ? 'rgba(80,220,100,0.3)' : 'rgba(240,60,60,0.35)';
    ctx.fillRect(x, y, d.w * TILE, d.h * TILE);
    ctx.strokeStyle = gh.valid ? '#5ee05e' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, d.w * TILE, d.h * TILE);
    // porta
    ctx.fillStyle = gh.valid ? 'rgba(255,255,255,0.5)' : 'rgba(255,90,90,0.5)';
    ctx.fillRect((gh.tx + Math.floor(d.w / 2)) * TILE + 8, (gh.ty + d.h) * TILE + 2, TILE - 16, 6);
  }
}

function hexA(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},A)`;
}
