// Desenho procedural de tudo (sem assets). Trocar por spritesheets no futuro
// é só reimplementar estas funções mantendo as assinaturas.
import { TILE } from '../config';
import { ANIMALS } from '../data/animals';
import { BUILDINGS, type BuildingDef } from '../data/buildings';
import { RANKS } from '../data/ninja';
import type { Building, Projectile, ResourceNode, Unit } from '../game/types';

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------------------------------------------------------------- recursos
const nodeCache = new Map<string, HTMLCanvasElement>();
const TREE_COLORS = ['#2f6b2a', '#3a7a30', '#2a5e2e', '#477f2f'];

function nodeSprite(type: ResourceNode['type'], variant: number) {
  const key = `${type}${variant}`;
  let c = nodeCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  const cx = 24;
  const cy = 26;
  if (type === 'herb') {
    // erva medicinal brilhante
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    g.addColorStop(0, 'rgba(125,255,154,0.55)');
    g.addColorStop(1, 'rgba(125,255,154,0)');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, 16);
    ctx.fillStyle = '#2f7d3a';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ellipse(ctx, cx + Math.cos(a) * 5, cy + Math.sin(a) * 4, 4.5, 2, a);
    }
    ctx.fillStyle = ['#e05ad1', '#ffe14d', '#7fc8ff', '#ff8a8a'][variant % 4]!;
    circle(ctx, cx, cy - 1, 2.5);
    circle(ctx, cx + 4, cy - 4, 1.8);
    circle(ctx, cx - 4, cy - 3, 1.8);
  } else if (type === 'tree') {
    const col = TREE_COLORS[variant % 4]!;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx + 3, cy + 12, 13, 6);
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(cx - 2.5, cy + 2, 5, 11);
    ctx.fillStyle = shade(col, -0.08);
    circle(ctx, cx - 6, cy + 1, 9);
    circle(ctx, cx + 6, cy + 1, 9);
    ctx.fillStyle = col;
    circle(ctx, cx, cy - 5, 11);
    circle(ctx, cx - 5, cy, 8);
    ctx.fillStyle = shade(col, 0.12);
    circle(ctx, cx - 3, cy - 8, 5);
    circle(ctx, cx + 4, cy - 4, 3);
  } else {
    // rocha ou minério
    const r = 9 + (variant % 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx + 2, cy + 8, r + 2, 5);
    ctx.fillStyle = '#7d8287';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + variant;
      const rr = r * (0.75 + ((i * 37 + variant * 13) % 10) / 30);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a9aeb3';
    ellipse(ctx, cx - 2, cy - 3, r * 0.55, r * 0.35);
    ctx.fillStyle = '#5e6266';
    ellipse(ctx, cx + 3, cy + 3, r * 0.35, r * 0.2);
    if (type === 'ore') {
      // veios de ferro (ferrugem + brilho metálico)
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + variant;
        ctx.fillStyle = i % 2 ? '#c0622b' : '#8f4a24';
        ellipse(ctx, cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.3, 2.4, 1.6, a);
      }
      ctx.fillStyle = '#e8eef4';
      circle(ctx, cx - 3, cy - 4, 1.2);
    }
  }
  nodeCache.set(key, c);
  return c;
}

export function drawNode(ctx: Ctx, n: ResourceNode) {
  const s = 0.65 + 0.35 * (n.amount / n.max);
  const img = nodeSprite(n.type, n.variant);
  const cx = n.tx * TILE + TILE / 2;
  const cy = n.ty * TILE + TILE / 2;
  const size = 48 * s;
  ctx.drawImage(img, cx - size / 2, cy - size * 0.55, size, size);
}

// ---------------------------------------------------------------- unidades
const TOOL: Record<string, string> = { gather: 'axe', farming: 'hoe', build: 'hammer' };

export function drawUnit(ctx: Ctx, u: Unit, t: number, selected: boolean) {
  if (u.animal) drawAnimal(ctx, u, t);
  else drawHuman(ctx, u, t);
  if (u.stun > 0) {
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      circle(ctx, u.x + Math.cos(a) * 7, u.y - 22 + Math.sin(a) * 2.5, 1.6);
    }
  }
  if (u.shield > 0) {
    ctx.strokeStyle = 'rgba(168,123,69,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(u.x, u.y - 2, 15, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(u.x, u.y - 2, 15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  const hostile = u.faction !== 'village';
  if (selected || u.hp < u.maxHp || (hostile && u.kind !== 'animal')) drawBars(ctx, u, selected);
}

function drawBars(ctx: Ctx, u: Unit, selected: boolean) {
  const w = u.boss ? 44 : u.animal ? 22 : 18;
  const x = u.x - w / 2;
  const y = u.y - (u.animal ? ANIMALS[u.animal].size + 14 : 24);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  const r = Math.max(0, u.hp / u.maxHp);
  ctx.fillStyle = u.faction === 'village' ? (r > 0.5 ? '#5ee05e' : r > 0.25 ? '#ffd34d' : '#ff5a5a') : '#ff4d4d';
  ctx.fillRect(x, y, w * r, 2);
  if (u.ninja && u.kind !== 'clone' && (selected || u.combatTimer > 0)) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y + 3, w + 2, 3);
    ctx.fillStyle = '#4da6ff';
    ctx.fillRect(x, y + 3.5, (w * u.chakra) / Math.max(1, u.maxChakra), 1.6);
  }
}

function drawHuman(ctx: Ctx, u: Unit, t: number) {
  const step = u.moving ? Math.sin(t * 13 + u.id) : 0;
  const bob = u.moving ? -Math.abs(step) * 1.5 : 0;
  const x = u.x;
  const y = u.y + bob;
  const fx = Math.cos(u.facing);
  const fy = Math.sin(u.facing);
  const flash = u.hitFlash > 0;
  if (u.kind === 'clone') ctx.globalAlpha = 0.8;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, u.x, u.y + 7, 8, 3.5);

  // pés
  ctx.fillStyle = '#2b2622';
  circle(ctx, x - 3, y + 6 + step * 1.5, 2);
  circle(ctx, x + 3, y + 6 - step * 1.5, 2);

  // carga nas costas
  if (u.carry) {
    ctx.fillStyle = u.carry.res === 'wood' ? '#8a5a2b' : '#9aa0a6';
    if (u.carry.res === 'wood') ctx.fillRect(x - 7, y - 9, 14, 4);
    else circle(ctx, x, y - 6, 4);
  }

  // corpo
  const vest = u.ninja && u.faction === 'village' ? RANKS[u.ninja.rank].vest : null;
  ctx.fillStyle = flash ? '#ffffff' : u.look.cloth;
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 4, 12, 10, 4);
  ctx.fill();
  if (vest && !flash) {
    ctx.fillStyle = vest;
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 3.5, 10, 8, 3);
    ctx.fill();
    ctx.fillStyle = shade(vest, -0.12);
    ctx.fillRect(x - 4, y + 0.5, 3, 2.5);
    ctx.fillRect(x + 1, y + 0.5, 3, 2.5);
  }

  // mãos (golpe projeta a mão na direção do alvo)
  ctx.fillStyle = flash ? '#ffffff' : u.look.skin;
  const punch = u.anim > 0 ? Math.sin((u.anim / 0.25) * Math.PI) : 0;
  if (punch > 0) circle(ctx, x + fx * (7 + punch * 5), y + fy * (5 + punch * 5), 2.2);
  else circle(ctx, x + 6.5, y + 1 + step, 2.1);
  circle(ctx, x - 6.5, y + 1 - step, 2.1);

  // ferramenta de trabalho
  const tool = u.kind === 'villager' ? TOOL[u.state] : undefined;
  if (tool) {
    const a = u.facing + Math.sin(t * 12 + u.id) * 0.9;
    const hx = x + 6;
    const hy = y + 1;
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9);
    ctx.stroke();
    ctx.fillStyle = tool === 'hoe' ? '#8d8d8d' : '#b8bec4';
    circle(ctx, hx + Math.cos(a) * 9, hy + Math.sin(a) * 9, 2.2);
  }

  // cabeça
  const hy = y - 8;
  ctx.fillStyle = flash ? '#ffffff' : u.look.skin;
  circle(ctx, x, hy, 5.6);
  const back = fy < -0.35;
  ctx.fillStyle = u.look.hair;
  if (back) circle(ctx, x, hy, 5.9);
  else {
    ctx.beginPath();
    ctx.arc(x, hy, 5.9, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
  }
  if (u.look.spiky) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.1 + i * 0.27);
      ctx.moveTo(x + Math.cos(a) * 4, hy + Math.sin(a) * 4);
      ctx.lineTo(x + Math.cos(a + 0.1) * 8.5, hy + Math.sin(a + 0.1) * 8.5);
      ctx.lineTo(x + Math.cos(a + 0.35) * 4.5, hy + Math.sin(a + 0.35) * 4.5);
    }
    ctx.fill();
  }
  if (!back) {
    ctx.fillStyle = '#1a1a1a';
    const ex = fx * 1.6;
    circle(ctx, x - 2 + ex, hy + 1.2, 0.9);
    circle(ctx, x + 2 + ex, hy + 1.2, 0.9);
  }

  // bandana ninja (hitai-ate)
  if (u.ninja && u.ninja.rank !== 'kage') {
    const rogue = u.faction === 'enemy';
    ctx.fillStyle = rogue ? '#222' : u.faction === 'guest' ? '#7a4b1a' : '#1f3a5f';
    ctx.fillRect(x - 5.6, hy - 3.6, 11.2, 2.6);
    ctx.fillStyle = '#cfd6dd';
    ctx.fillRect(x - 2.6 + fx, hy - 4, 5.2, 3.3);
    if (rogue) {
      ctx.strokeStyle = '#d33';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 2.6 + fx, hy - 2.4);
      ctx.lineTo(x + 2.6 + fx, hy - 2.4);
      ctx.stroke();
    }
  } else if (u.ninja?.rank === 'kage') {
    ctx.fillStyle = '#f4f1ea';
    ellipse(ctx, x, hy - 2, 9.5, 5.5);
    ctx.fillStyle = '#c0392b';
    ellipse(ctx, x, hy - 4, 4.5, 2.6);
  }
  ctx.globalAlpha = 1;
}

function drawAnimal(ctx: Ctx, u: Unit, t: number) {
  const def = ANIMALS[u.animal!];
  const s = def.size;
  const col = u.hitFlash > 0 ? '#ffffff' : def.color;
  const step = u.moving ? Math.sin(t * 14 + u.id) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, u.x, u.y + s * 0.5, s * 1.3, s * 0.5);
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(u.facing);

  if (u.animal === 'snake') {
    for (let i = 7; i >= 0; i--) {
      const px = -i * s * 0.55;
      const py = Math.sin(t * 6 - i * 0.9 + u.id) * s * 0.35;
      ctx.fillStyle = i % 2 ? shade(def.color, -0.1) : col;
      circle(ctx, px, py, s * (0.55 - i * 0.03));
    }
    ctx.fillStyle = col;
    ellipse(ctx, s * 0.5, 0, s * 0.75, s * 0.55);
    ctx.fillStyle = '#ffe14d';
    circle(ctx, s * 0.8, -s * 0.25, 1.8);
    circle(ctx, s * 0.8, s * 0.25, 1.8);
    if (u.anim > 0) {
      ctx.strokeStyle = '#ff5a8a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 1.2, 0);
      ctx.lineTo(s * 1.8, 0);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // patas
  ctx.fillStyle = shade(def.color, -0.25);
  for (const [lx, ly] of [[0.6, 0.55], [0.6, -0.55], [-0.6, 0.55], [-0.6, -0.55]] as const) {
    const o = (lx > 0 ? step : -step) * s * 0.25;
    circle(ctx, lx * s + o * Math.sign(ly), ly * s, s * 0.22);
  }
  // cauda
  ctx.fillStyle = col;
  if (u.animal === 'wolf') ellipse(ctx, -s * 1.35, Math.sin(t * 8) * 1.5, s * 0.5, s * 0.22);
  if (u.animal === 'titan') {
    // várias caudas em chamas balançando
    for (let i = -1; i <= 1; i++) {
      const a = i * 0.45 + Math.sin(t * 3 + i) * 0.2;
      ctx.fillStyle = i ? shade(def.color, 0.1) : col;
      ellipse(ctx, -s * 1.1 - Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.9, s * 0.75, s * 0.22, a);
      ctx.fillStyle = 'rgba(255,140,60,0.7)';
      circle(ctx, -s * 1.1 - Math.cos(a) * s * 1.25, Math.sin(a) * s * 1.6, s * 0.14);
    }
  }
  // corpo
  ellipse(ctx, 0, 0, s * 1.1, s * (u.animal === 'bear' ? 0.8 : 0.6));
  ctx.fillStyle = shade(def.color, 0.1);
  ellipse(ctx, -s * 0.1, 0, s * 0.7, s * 0.3);
  // cabeça
  const lunge = u.anim > 0 ? s * 0.3 : 0;
  ctx.fillStyle = col;
  circle(ctx, s * 1.05 + lunge, 0, s * 0.5);
  if (u.animal === 'wolf') {
    ellipse(ctx, s * 1.5 + lunge, 0, s * 0.35, s * 0.2);
    ctx.fillStyle = shade(def.color, -0.2);
    ctx.beginPath();
    ctx.moveTo(s * 0.9 + lunge, -s * 0.3);
    ctx.lineTo(s * 0.7 + lunge, -s * 0.75);
    ctx.lineTo(s * 1.15 + lunge, -s * 0.4);
    ctx.moveTo(s * 0.9 + lunge, s * 0.3);
    ctx.lineTo(s * 0.7 + lunge, s * 0.75);
    ctx.lineTo(s * 1.15 + lunge, s * 0.4);
    ctx.fill();
  } else if (u.animal === 'boar') {
    ctx.strokeStyle = '#f2ead8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 1.4 + lunge, -s * 0.2);
    ctx.lineTo(s * 1.7 + lunge, -s * 0.4);
    ctx.moveTo(s * 1.4 + lunge, s * 0.2);
    ctx.lineTo(s * 1.7 + lunge, s * 0.4);
    ctx.stroke();
  } else if (u.animal === 'titan') {
    ctx.fillStyle = '#f2ead8';
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.9 + lunge, sy * s * 0.3);
      ctx.lineTo(s * 0.55 + lunge, sy * s * 0.85);
      ctx.lineTo(s * 1.05 + lunge, sy * s * 0.4);
      ctx.fill();
    }
  } else if (u.animal === 'bear') {
    ctx.fillStyle = shade(def.color, -0.15);
    circle(ctx, s * 0.95 + lunge, -s * 0.45, s * 0.18);
    circle(ctx, s * 0.95 + lunge, s * 0.45, s * 0.18);
  }
  ctx.fillStyle = u.faction === 'wild' ? '#ffcf3f' : '#111';
  circle(ctx, s * 1.25 + lunge, -s * 0.18, 1.2);
  circle(ctx, s * 1.25 + lunge, s * 0.18, 1.2);
  ctx.restore();
}

// ---------------------------------------------------------------- prédios
export function drawBuilding(ctx: Ctx, b: Building, t: number, night: number, villageLevel = 0) {
  const def = BUILDINGS[b.type];
  const x = b.tx * TILE;
  const y = b.ty * TILE;
  const w = def.w * TILE;
  const h = def.h * TILE;
  const k = b.built ? 1 : b.progress / Math.max(1, def.buildTime);

  ctx.save();
  if (!b.built) ctx.globalAlpha = 0.35 + 0.45 * k;
  paintBuilding(ctx, def, x, y, w, h, t, b.built ? night : 0);
  ctx.restore();
  if (b.type === 'hokage') paintBanners(ctx, x, y, w, h, t, villageLevel);

  if (!b.built) {
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#6b4a2b';
    for (const [px, py] of [[x + 2, y + 2], [x + w - 5, y + 2], [x + 2, y + h - 5], [x + w - 5, y + h - 5]] as const) ctx.fillRect(px, py, 3, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x + 4, y + h + 2, w - 8, 4);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x + 5, y + h + 3, (w - 10) * k, 2);
  }
}

export function paintBuilding(ctx: Ctx, def: BuildingDef, x: number, y: number, w: number, h: number, t: number, night: number) {
  switch (def.type) {
    case 'farm':
      return paintFarm(ctx, x, y, w, h, t);
    case 'herbgarden':
      return paintHerbGarden(ctx, x, y, w, h, t);
    case 'arena':
      return paintArena(ctx, x, y, w, h);
    case 'monument':
      return paintMonument(ctx, x, y, w, h);
    case 'training':
      return paintTraining(ctx, x, y, w, h);
    case 'tower':
      return paintTower(ctx, def, x, y, w, h);
    case 'hokage':
      return paintHokage(ctx, def, x, y, w, h, night);
    default:
      paintHouse(ctx, def, x, y, w, h, night);
  }
  if (def.type === 'market') {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f2ead8' : '#c0392b';
      ctx.fillRect(x + 3 + ((w - 6) / 6) * i, y + h * 0.58, (w - 6) / 6, 6);
    }
    ctx.fillStyle = '#e74c3c';
    circle(ctx, x + 6, y + h * 0.58 + 9, 3);
    circle(ctx, x + w - 6, y + h * 0.58 + 9, 3);
  } else if (def.type === 'lumber') {
    ctx.fillStyle = '#8a5a2b';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w - 2, y + h * 0.5 + i * 5, 10, 4);
    ctx.fillStyle = '#c8a26a';
    for (let i = 0; i < 3; i++) circle(ctx, x + w + 8, y + h * 0.5 + i * 5 + 2, 2);
  } else if (def.type === 'quarry') {
    ctx.fillStyle = '#9aa0a6';
    circle(ctx, x + w + 2, y + h - 6, 4);
    circle(ctx, x + w + 7, y + h - 4, 3);
    circle(ctx, x + w + 4, y + h - 11, 3);
  } else if (def.type === 'forge') {
    // chaminé com brasa e bigorna na frente
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(x + w - 12, y - 8, 8, 14);
    const glow = 0.5 + 0.3 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,140,40,${glow})`;
    circle(ctx, x + w - 8, y - 9, 3);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + w + 1, y + h - 10, 9, 4);
    ctx.fillRect(x + w + 3, y + h - 6, 5, 5);
  } else if (def.type === 'ironmine') {
    for (const [ox, oy, r] of [[2, -6, 4], [7, -4, 3], [4, -11, 3]] as const) {
      ctx.fillStyle = '#6e6e72';
      circle(ctx, x + w + ox, y + h + oy, r);
      ctx.fillStyle = '#c0622b';
      circle(ctx, x + w + ox + 1, y + h + oy - 1, r * 0.4);
    }
  }
  const SIGNS: Partial<Record<BuildingDef['type'], [string, string]>> = {
    academy: ['忍', '#c0392b'], hospital: ['医', '#2e8b57'], library: ['書', '#6c3483'], missions: ['任', '#2c3e50'],
    pharmacy: ['薬', '#2e7d6b'], sealshop: ['封', '#8e2a22'], forge: ['鍛', '#5a3a2a'],
  };
  const sign = SIGNS[def.type];
  if (sign) {
    const [label, color] = sign;
    ctx.fillStyle = '#f7f1e3';
    ctx.fillRect(x + w / 2 - 7, y + h * 0.18 - 7, 14, 14);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h * 0.18 + 0.5);
  }
}

function paintHouse(ctx: Ctx, def: BuildingDef, x: number, y: number, w: number, h: number, night: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 5, y + 6, w - 4, h - 2);
  // parede frontal
  const wy = y + h * 0.5;
  ctx.fillStyle = def.wall;
  ctx.fillRect(x + 2, wy, w - 4, h * 0.5 - 1);
  ctx.fillStyle = shade(def.wall, -0.18);
  ctx.fillRect(x + 2, y + h - 4, w - 4, 3);
  // porta
  ctx.fillStyle = '#5a3b22';
  ctx.fillRect(x + w / 2 - 4, y + h - 13, 8, 12);
  // janelas
  ctx.fillStyle = night > 0.2 ? `rgba(255,214,120,${0.6 + night * 0.4})` : '#3d4a5c';
  const wn = Math.max(1, Math.floor(w / TILE));
  for (let i = 0; i < wn; i++) {
    const cx = x + ((i + 0.5) * w) / wn;
    if (Math.abs(cx - (x + w / 2)) < 8) continue;
    ctx.fillRect(cx - 3, wy + 4, 6, 5);
  }
  // telhado (vista 3/4)
  const ry = y + h * 0.58;
  ctx.fillStyle = shade(def.roof, -0.15);
  ctx.beginPath();
  ctx.moveTo(x - 3, ry);
  ctx.lineTo(x + w + 3, ry);
  ctx.lineTo(x + w + 1, y + h * 0.22);
  ctx.lineTo(x - 1, y + h * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = def.roof;
  ctx.beginPath();
  ctx.moveTo(x - 1, y + h * 0.24);
  ctx.lineTo(x + w + 1, y + h * 0.24);
  ctx.lineTo(x + w - 1, y - 3);
  ctx.lineTo(x + 1, y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(def.roof, -0.28);
  ctx.lineWidth = 1;
  for (let ly = y + 2; ly < ry - 2; ly += 5) {
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  }
  ctx.fillStyle = shade(def.roof, 0.18);
  ctx.fillRect(x - 1, y + h * 0.22 - 1.5, w + 2, 3);
  // pontas curvadas do telhado (estilo japonês)
  ctx.fillStyle = shade(def.roof, -0.25);
  circle(ctx, x - 3, ry, 2.5);
  circle(ctx, x + w + 3, ry, 2.5);
}

/** Estandartes ao redor da Residência do Hokage: um por nível da vila. */
function paintBanners(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, level: number) {
  const spots = [
    [x - 4, y + h - 6],
    [x + w + 4, y + h - 6],
    [x - 4, y + h * 0.35],
    [x + w + 4, y + h * 0.35],
  ];
  for (let i = 0; i < Math.min(level, spots.length); i++) {
    const [px, py] = spots[i]!;
    const dir = px < x + w / 2 ? -1 : 1;
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 22);
    ctx.stroke();
    const wave = Math.sin(t * 4 + i) * 1.5;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(px, py - 22);
    ctx.lineTo(px + dir * 10, py - 21 + wave);
    ctx.lineTo(px + dir * 10, py - 11 + wave);
    ctx.lineTo(px, py - 12);
    ctx.fill();
    ctx.fillStyle = '#f7f1e3';
    circle(ctx, px + dir * 5, py - 16.5 + wave / 2, 2);
  }
}

function paintHokage(ctx: Ctx, def: BuildingDef, x: number, y: number, w: number, h: number, night: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, cx + 5, cy + 8, w * 0.52, h * 0.5);
  // base cilíndrica
  ctx.fillStyle = def.wall;
  ctx.fillRect(x + 4, cy, w - 8, h / 2 - 2);
  ellipse(ctx, cx, y + h - 2, w / 2 - 4, 6);
  ctx.fillStyle = night > 0.2 ? `rgba(255,214,120,${0.6 + night * 0.4})` : '#3d4a5c';
  for (const ox of [-w * 0.3, w * 0.3]) ctx.fillRect(cx + ox - 4, cy + 10, 8, 8);
  ctx.fillStyle = '#5a3b22';
  ctx.fillRect(cx - 6, y + h - 16, 12, 15);
  // telhado redondo
  ctx.fillStyle = shade(def.roof, -0.2);
  ellipse(ctx, cx, cy + 2, w * 0.56, h * 0.42);
  ctx.fillStyle = def.roof;
  ellipse(ctx, cx, cy - 3, w * 0.5, h * 0.38);
  ctx.strokeStyle = shade(def.roof, -0.3);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, w * 0.5 * (i / 4), h * 0.38 * (i / 4), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = '#f7f1e3';
  circle(ctx, cx, cy - 4, 10);
  ctx.fillStyle = '#c0392b';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('火', cx, cy - 3.5);
}

function paintFarm(ctx: Ctx, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillStyle = '#7a5532';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const growth = 0.5 + 0.5 * Math.sin(t * 0.05);
  for (let row = 0; row < 6; row++) {
    const ry = y + 6 + row * ((h - 12) / 5);
    ctx.fillStyle = '#5e3f24';
    ctx.fillRect(x + 4, ry - 1, w - 8, 2);
    ctx.fillStyle = row % 2 ? '#8fc04a' : `rgba(${200 + growth * 30},${190 + growth * 20},80,1)`;
    for (let cx = x + 7; cx < x + w - 5; cx += 6) circle(ctx, cx, ry - 2, 2 + growth);
  }
  ctx.strokeStyle = '#a07a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#6b4a2b';
  for (let px = x + 1; px <= x + w; px += 12) {
    ctx.fillRect(px - 1, y, 3, 3);
    ctx.fillRect(px - 1, y + h - 3, 3, 3);
  }
}

function paintHerbGarden(ctx: Ctx, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillStyle = '#5b4630';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  for (let row = 0; row < 4; row++) {
    const ry = y + 9 + row * ((h - 16) / 3);
    for (let cx = x + 8; cx < x + w - 5; cx += 9) {
      const sway = Math.sin(t * 2 + cx + row) * 0.6;
      ctx.fillStyle = row % 2 ? '#3f8f4a' : '#5fae5a';
      ellipse(ctx, cx - 2 + sway, ry, 3, 1.6, -0.5);
      ellipse(ctx, cx + 2 + sway, ry, 3, 1.6, 0.5);
      ctx.fillStyle = ['#e05ad1', '#ffe14d', '#7fc8ff'][(row + Math.floor(cx)) % 3]!;
      circle(ctx, cx + sway, ry - 2, 1.3);
    }
  }
  ctx.strokeStyle = '#8fbf6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function paintMonument(ctx: Ctx, x: number, y: number, w: number, h: number) {
  // paredão de rocha com rostos esculpidos
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 4, y + 6, w, h);
  ctx.fillStyle = '#7a6e62';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + 4, y - 14);
  ctx.lineTo(x + w * 0.3, y - 22);
  ctx.lineTo(x + w * 0.6, y - 18);
  ctx.lineTo(x + w - 3, y - 24);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const cx = x + w * (0.15 + i * 0.23);
    const cy = y + 4;
    ctx.fillStyle = '#9a8e80';
    ellipse(ctx, cx, cy, 11, 14);
    ctx.fillStyle = '#5e544a';
    circle(ctx, cx - 4, cy - 2, 1.6);
    circle(ctx, cx + 4, cy - 2, 1.6);
    ctx.fillRect(cx - 3, cy + 6, 6, 1.5);
    ctx.fillStyle = '#6e6358';
    ctx.fillRect(cx - 9, cy - 10, 18, 3);
  }
}

function paintArena(ctx: Ctx, x: number, y: number, w: number, h: number) {
  // muro de pedra, chão de areia batida e o símbolo do exame
  ctx.fillStyle = '#8d8174';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
  ctx.strokeStyle = 'rgba(120,90,50,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w * 0.3, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 8);
  ctx.lineTo(x + w / 2, y + h - 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,90,50,0.35)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('中忍', x + w / 2, y + h * 0.22);
  // estandartes nos cantos
  for (const [px, c] of [[x + 3, '#c0392b'], [x + w - 3, '#2c5e8f']] as const) {
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(px - 1, y - 14, 2, 18);
    ctx.fillStyle = c;
    ctx.fillRect(px + (px < x + w / 2 ? 1 : -9), y - 14, 8, 10);
  }
}

function paintTraining(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#b08a5a';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = '#d9c7a0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  for (const [px, py] of [[0.2, 0.25], [0.5, 0.2], [0.8, 0.3]] as const) {
    const cx = x + w * px;
    const cy = y + h * py;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx + 2, cy + 4, 6, 3);
    ctx.fillStyle = '#7b5233';
    circle(ctx, cx, cy, 5);
    ctx.fillStyle = '#a57c4f';
    circle(ctx, cx, cy, 3);
  }
  const tx = x + w * 0.7;
  const ty = y + h * 0.72;
  for (const [r, c] of [[9, '#c0392b'], [6, '#f2ead8'], [3, '#c0392b']] as const) {
    ctx.fillStyle = c;
    circle(ctx, tx, ty, r);
  }
}

function paintTower(ctx: Ctx, def: BuildingDef, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ellipse(ctx, cx + 6, y + h - 2, 14, 6);
  ctx.strokeStyle = def.wall;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 2);
  ctx.lineTo(x + 7, y - 10);
  ctx.moveTo(x + w - 4, y + h - 2);
  ctx.lineTo(x + w - 7, y - 10);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + h * 0.5);
  ctx.lineTo(x + w - 5, y + h * 0.1);
  ctx.moveTo(x + w - 5, y + h * 0.5);
  ctx.lineTo(x + 5, y + h * 0.1);
  ctx.stroke();
  ctx.fillStyle = shade(def.wall, 0.15);
  ctx.fillRect(x - 2, y - 18, w + 4, 10);
  ctx.fillStyle = def.roof;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 16);
  ctx.lineTo(cx, y - 30);
  ctx.lineTo(x + w + 5, y - 16);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- projéteis
export function drawProjectile(ctx: Ctx, p: Projectile, t: number) {
  const a = Math.atan2(p.vy, p.vx);
  const sp = Math.hypot(p.vx, p.vy);
  const dx = p.vx / sp;
  const dy = p.vy / sp;
  switch (p.kind) {
    case 'kunai':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.fillStyle = '#4b5158';
      ctx.fillRect(-6, -1, 7, 2);
      ctx.fillStyle = '#dfe6ec';
      ctx.beginPath();
      ctx.moveTo(1, -2);
      ctx.lineTo(6, 0);
      ctx.lineTo(1, 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'blade':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-4, 0, 9, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    case 'rock':
      ctx.fillStyle = 'rgba(160,120,70,0.4)';
      for (let i = 1; i <= 3; i++) circle(ctx, p.x - dx * i * 6, p.y - dy * i * 6, p.size * (1 - i * 0.2));
      ctx.fillStyle = p.color;
      circle(ctx, p.x, p.y, p.size);
      ctx.fillStyle = '#6b4a2b';
      circle(ctx, p.x + 2, p.y + 2, p.size * 0.4);
      return;
    case 'spark': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const r = p.size * 2.2;
        const aa = t * 30 + i * 1.3;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(aa) * r, p.y + Math.sin(aa) * r);
      }
      ctx.stroke();
      glowOrb(ctx, p.x, p.y, p.size, p.color);
      return;
    }
    case 'dragon':
      for (let i = 8; i >= 1; i--) {
        const off = Math.sin(t * 12 - i * 0.8) * 5;
        ctx.fillStyle = `rgba(77,166,255,${0.15 + 0.06 * (8 - i)})`;
        circle(ctx, p.x - dx * i * 7 - dy * off, p.y - dy * i * 7 + dx * off, p.size * (1 - i * 0.07));
      }
      glowOrb(ctx, p.x, p.y, p.size * 1.2, p.color);
      ctx.fillStyle = '#fff';
      circle(ctx, p.x + dx * 4 - dy * 3, p.y + dy * 4 + dx * 3, 1.5);
      circle(ctx, p.x + dx * 4 + dy * 3, p.y + dy * 4 - dx * 3, 1.5);
      return;
    default:
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.25 * (4 - i) / 3;
        ctx.fillStyle = p.color;
        circle(ctx, p.x - dx * i * 5, p.y - dy * i * 5, p.size * (1 - i * 0.18));
      }
      ctx.globalAlpha = 1;
      glowOrb(ctx, p.x, p.y, p.size, p.color);
  }
}

function glowOrb(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, color);
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  circle(ctx, x, y, r * 1.8);
}
