// Corte do interior de um prédio (mostrado no painel): cômodo gerado conforme o tipo
// e quem está lá dentro — dormindo nas camas, estudando nas mesas ou abrigado.
import type { BuildingDef, BuildingType } from '../data/buildings';
import type { Unit } from '../game/types';
import { drawUnit } from './sprites';

type Ctx = CanvasRenderingContext2D;
type Spot = { x: number; y: number; bed?: boolean };

/** Espaço lógico do cômodo; o canvas é escalado para caber. */
export const ROOM_W = 176;
export const ROOM_H = 99;

type Kind = 'home' | 'ward' | 'class' | 'office' | 'work';
const KIND: Partial<Record<BuildingType, Kind>> = {
  house: 'home', hospital: 'ward', academy: 'class', library: 'class', hokage: 'office',
};

const FLOOR_Y = 30;

function rect(ctx: Ctx, c: string, x: number, y: number, w: number, h: number, r = 0) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function bed(ctx: Ctx, x: number, y: number, blanket: string) {
  rect(ctx, '#5a3b22', x - 9, y - 4, 18, 30, 2);
  rect(ctx, '#efe6d2', x - 7, y - 2, 14, 26, 2);
  rect(ctx, '#fff', x - 5, y - 1, 10, 6, 2);
  rect(ctx, blanket, x - 7, y + 9, 14, 15, 2);
}

/** Móveis do cômodo + onde cada ocupante fica. Camas primeiro, depois lugares em pé. */
function furnish(ctx: Ctx, kind: Kind, def: BuildingDef, beds: number): Spot[] {
  const spots: Spot[] = [];
  const blanket = kind === 'ward' ? '#7fb6d9' : def.roof;
  if (beds > 0) {
    const gap = Math.min(26, (ROOM_W - 40) / beds);
    const x0 = ROOM_W / 2 - (gap * (beds - 1)) / 2;
    for (let i = 0; i < beds; i++) {
      const x = x0 + i * gap;
      bed(ctx, x, FLOOR_Y + 6, blanket);
      spots.push({ x, y: FLOOR_Y + 12, bed: true });
    }
  }
  if (kind === 'class') {
    // quadro e carteiras
    rect(ctx, '#2f4a3a', ROOM_W / 2 - 34, 8, 68, 16, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(ROOM_W / 2 - 26, 13, 30, 1.5);
    ctx.fillRect(ROOM_W / 2 - 26, 17, 44, 1.5);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 4; c++) {
        const x = 34 + c * 36;
        const y = FLOOR_Y + 14 + r * 26;
        rect(ctx, '#8a6238', x - 11, y - 9, 22, 7, 1.5);
        rect(ctx, '#f0e6c8', x - 5, y - 8, 10, 4, 1);
        spots.push({ x, y: y + 8 });
      }
  } else if (kind === 'office') {
    rect(ctx, '#7a1f1a', ROOM_W / 2 - 3, 6, 6, 20);
    rect(ctx, '#6b4424', ROOM_W / 2 - 22, FLOOR_Y + 42, 44, 10, 2);
    rect(ctx, '#f0e6c8', ROOM_W / 2 - 6, FLOOR_Y + 44, 12, 5, 1);
  } else if (kind === 'home') {
    rect(ctx, '#7b5a34', 18, FLOOR_Y + 40, 26, 14, 3);
    rect(ctx, '#a03a2c', ROOM_W - 44, FLOOR_Y + 38, 22, 16, 8);
  } else if (kind === 'work') {
    rect(ctx, '#6b4424', 16, FLOOR_Y + 4, 40, 10, 2);
    rect(ctx, '#6b4424', ROOM_W - 56, FLOOR_Y + 4, 40, 10, 2);
    rect(ctx, def.roof, 22, FLOOR_Y + 6, 8, 5, 1);
    rect(ctx, def.roof, ROOM_W - 40, FLOOR_Y + 6, 12, 5, 1);
  }
  // lugares em pé (quem sobra, ou prédios sem cama)
  for (let i = 0; i < 12; i++) spots.push({ x: 30 + (i % 6) * 23, y: FLOOR_Y + (kind === 'class' ? 62 : 44) + Math.floor(i / 6) * 14 });
  return spots;
}

export function drawInterior(ctx: Ctx, w: number, h: number, def: BuildingDef, occupants: Unit[], time: number, night: boolean, housing = def.housing ?? 0) {
  const k = Math.min(w / ROOM_W, h / ROOM_H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(k, 0, 0, k, (w - ROOM_W * k) / 2, (h - ROOM_H * k) / 2);

  // paredes e piso
  rect(ctx, def.wall, 0, 0, ROOM_W, FLOOR_Y);
  rect(ctx, 'rgba(0,0,0,0.18)', 0, FLOOR_Y - 4, ROOM_W, 4);
  rect(ctx, '#b08a5a', 0, FLOOR_Y, ROOM_W, ROOM_H - FLOOR_Y);
  ctx.strokeStyle = 'rgba(70,45,20,0.28)';
  ctx.lineWidth = 0.6;
  for (let y = FLOOR_Y + 11; y < ROOM_H; y += 11) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ROOM_W, y);
    ctx.stroke();
  }
  // janelas (céu conforme a hora) e porta
  for (const x of [14, ROOM_W - 34]) {
    rect(ctx, '#5a3b22', x - 1.5, 7.5, 23, 15, 2);
    rect(ctx, night ? '#1c2550' : '#9fd8ff', x, 9, 20, 12, 1);
  }
  rect(ctx, '#5a3b22', ROOM_W / 2 - 9, ROOM_H - 4, 18, 4);

  const kind = KIND[def.type] ?? (def.housing ? 'home' : 'work');
  const beds = kind === 'ward' ? 5 : housing;
  const spots = furnish(ctx, kind, def, Math.min(beds, 8));

  const free = spots.slice();
  for (const u of occupants) {
    const lying = u.state === 'sleep' || u.state === 'rest' || u.state === 'cmdRest';
    const i = Math.max(0, free.findIndex((s) => !!s.bed === lying));
    const s = free.splice(i, 1)[0] ?? { x: ROOM_W / 2, y: FLOOR_Y + 50 };
    const ghost: Unit = { ...u, x: s.x, y: s.y, moving: false, facing: Math.PI / 2, hitFlash: 0, stun: 0, shield: 0, carry: null, hidden: false };
    drawUnit(ctx, ghost, time, false);
    if (s.bed) {
      // cobertor por cima do corpo e "z" subindo
      rect(ctx, kind === 'ward' ? '#7fb6d9' : def.roof, s.x - 7, s.y + 3, 14, 15, 2);
      if (u.state === 'sleep') {
        const p = (time * 0.5 + u.id * 0.37) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px system-ui, sans-serif';
        ctx.fillText('z', s.x + 7 + p * 4, s.y - 12 - p * 10);
        ctx.globalAlpha = 1;
      }
    }
  }
  if (night) rect(ctx, 'rgba(10,16,48,0.28)', 0, 0, ROOM_W, ROOM_H);
}
