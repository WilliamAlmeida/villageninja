import { fx } from '../fx';
import type { Game } from '../game';
import { crownKage } from '../kage';
import { followPath, setDestination } from '../movement';
import { doorPos } from '../world';

const FIREWORKS = ['#ffd34d', '#ff5a5a', '#4da6ff', '#7ddc6b', '#e05ad1'];

/** Cerimônia de posse (todos vão à praça) e sucessão quando o Kage cai. */
export function kageSystem(g: Game, dt: number) {
  const s = g.state;
  if (s.kageId != null) {
    const k = g.unit(s.kageId);
    if (!k || k.dead) {
      s.kageId = null;
      g.toast('{candle} O Kage caiu. A vila precisa eleger um novo Kage.', 'danger');
    }
  }
  const c = s.ceremony;
  if (!c) return;
  const hk = g.hokage();
  if (!hk) return;
  const plaza = doorPos(hk);
  c.timer -= dt;
  let i = 0;
  for (const u of s.units) {
    if (u.dead || u.hidden || u.faction !== 'village' || (u.kind !== 'villager' && u.kind !== 'ninja')) continue;
    if (u.command || u.arenaSide != null || u.missionId != null || u.state === 'fight' || u.state === 'flee') continue;
    // o candidato fica na frente da porta; o povo em semicírculo
    const isCandidate = u.id === c.candidateId;
    const a = Math.PI * (0.15 + 0.7 * ((i++ * 0.618) % 1));
    const tx = isCandidate ? plaza.x : plaza.x + Math.cos(a) * (60 + (i % 3) * 16);
    const ty = isCandidate ? plaza.y + 6 : plaza.y + Math.sin(a) * (40 + (i % 3) * 12);
    if (u.state !== 'ceremony') {
      u.state = 'ceremony';
      setDestination(g, u, tx, ty);
    }
    followPath(g, u, dt);
    if (!u.moving) u.facing = Math.atan2(plaza.y - u.y, plaza.x - u.x);
  }
  if (Math.random() < dt * 3) {
    const x = plaza.x + rand(-90, 90);
    const y = plaza.y - 60 + rand(-40, 20);
    fx(g, 'burst', x, y, { r: 22, color: FIREWORKS[Math.floor(Math.random() * FIREWORKS.length)]!, life: 0.6 });
  }
  if (c.timer <= 0) {
    crownKage(g);
    for (const u of s.units) if (u.state === 'ceremony') u.state = 'idle';
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
