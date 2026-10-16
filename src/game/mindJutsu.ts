// Jutsus que mexem com quem luta, não só com a vida: Kage Mane (a sombra prende e o ninja segura), Shintenshin (a mente
// entra no inimigo e ele luta pelo outro lado por uns segundos) e Edo Tensei (um ninja caído da vila volta por um tempo).
import { rand } from '../core/rng';
import type { JutsuDef } from '../data/jutsus';
import { refreshDerived, createRogue } from './entities';
import { fx, fxMoment, fxText } from './fx';
import type { Game } from './game';
import { interruptCast } from './techniques';
import type { Fallen, Unit } from './types';

/** Kage Mane: o alvo fica preso `hold` s e o lançador parado segurando a sombra (a sombra no chão segue os dois). */
export function shadowBind(g: Game, u: Unit, t: Unit, hold: number) {
  t.stun = Math.max(t.stun, hold);
  t.stunVfx = 'shadow';
  interruptCast(g, t);
  u.attackCd = Math.max(u.attackCd, hold);
  u.channel = hold;
  u.moving = false;
  u.hasGoal = false;
  fx(g, 'tether', u.x, u.y, { x2: t.x, y2: t.y, uid: u.id, tid: t.id, life: hold, color: '#140c1c' });
  fxText(g, t.x, t.y - 24, 'Preso na sombra!', '#b8a8d8');
}

/** Quem o Shintenshin pega: ninja renegado comum (chefe, organização, Som, espadachim, marionete e duelo não). */
export const possessable = (t: Unit) =>
  t.kind === 'rogue' && !t.boss && !t.org && !t.sound && !t.swordsman && !t.role && !t.edo && !t.charm && t.arenaSide == null;

/** Shintenshin: o alvo passa para o lado do lançador por `secs` s; o corpo do lançador fica parado nesse tempo. */
export function possess(g: Game, u: Unit, t: Unit, secs: number): boolean {
  if (!possessable(t)) {
    fxText(g, t.x, t.y - 24, 'Resistiu!', '#e0a0ff');
    return false;
  }
  t.charm = { t: secs, faction: t.faction, by: u.id };
  t.faction = u.faction;
  t.targetId = null;
  interruptCast(g, t);
  u.attackCd = Math.max(u.attackCd, secs);
  u.channel = secs;
  u.moving = false;
  u.hasGoal = false;
  fx(g, 'beam', u.x, u.y - 22, { x2: t.x, y2: t.y - 22, color: '#e0a0ff', life: 0.4, vfx: 'genjutsu' });
  fx(g, 'swirl', t.x, t.y - 26, { r: 12, color: '#e0a0ff', life: 0.8 });
  fxText(g, t.x, t.y - 30, 'Mente trocada!', '#e0a0ff', true);
  return true;
}

/** A mente volta: o alvo retoma o lado dele. */
export function endCharm(g: Game, t: Unit) {
  const c = t.charm;
  if (!c) return;
  t.faction = c.faction;
  t.charm = undefined;
  t.targetId = null;
  if (!t.dead) {
    fx(g, 'swirl', t.x, t.y - 26, { r: 10, color: '#e0a0ff', life: 0.5 });
    fxText(g, t.x, t.y - 24, 'Kai!', '#e0a0ff');
  }
}

/** A cada passo: o tempo da troca de mente corre (e acaba se quem a fez cair); o Edo Tensei se regenera. */
export function mindTick(g: Game, u: Unit, dt: number) {
  if (u.charm) {
    const by = g.unit(u.charm.by);
    if ((u.charm.t -= dt) <= 0 || !by || by.dead) endCharm(g, u);
  }
  if (u.edo) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * EDO.regen * dt); // corpo de pó: se refaz
}

export const EDO = {
  /** Fração da vida que o corpo do Edo Tensei refaz por segundo. */
  regen: 0.04,
  /** Cor da pele (cinza rachada). */
  skin: '#b9b2a6',
};

/** Quem dá para trazer de volta: os caídos da vila que não estão de pé agora (os de nível mais alto primeiro). */
export function reanimateOptions(g: Game): Fallen[] {
  const up = new Set(g.state.units.filter((o) => o.edo && !o.dead).map((o) => o.lookId));
  return (g.state.fallen ?? []).filter((f) => !up.has(f.id)).sort((a, b) => b.level - a.level);
}

/** Edo Tensei: o caído mais forte volta por `secs` s ao lado do lançador e se desfaz depois (ou se ele cair). */
export function reanimate(g: Game, u: Unit, def: JutsuDef, secs: number): Unit | null {
  const f = reanimateOptions(g)[0];
  if (!f) return null;
  const x = u.x + rand(-24, 24);
  const y = u.y + rand(10, 22);
  const p = g.world.walkablePx(x, y) ? { x, y } : { x: u.x, y: u.y };
  const rank = f.rank === 'genin' || f.rank === 'chunin' ? f.rank : 'jounin';
  const e = createRogue(g, p.x, p.y, g.state.day, { rank, jutsu: 0, name: `${f.name} (Edo Tensei)` });
  e.faction = u.faction;
  e.ownerId = u.id;
  e.life = secs;
  e.edo = true;
  e.lookId = f.id;
  e.look = { ...f.look, skin: EDO.skin };
  const n = e.ninja!;
  n.stats = { ...f.stats };
  n.level = f.level;
  n.nature = f.nature;
  n.jutsu = [...f.jutsu] as [string | null, string | null];
  n.cd = [0, 0];
  refreshDerived(e);
  e.hp = e.maxHp;
  e.chakra = e.maxChakra;
  const exit=Array.from({length:8},(_,i)=>({x:e.x+Math.cos(i*Math.PI/4)*24,y:e.y+Math.sin(i*Math.PI/4)*24})).find(p=>g.world.walkablePx(p.x,p.y)&&g.world.clearPx((p.x+e.x)/2,(p.y+e.y)/2))??{x:e.x,y:e.y};
  e.edoIntro={elapsed:0,x:e.x,y:e.y,exitX:exit.x,exitY:exit.y};
  e.hidden=true;e.facing=Math.atan2(exit.y-e.y,exit.x-e.x);
  fx(g,'chips',e.x,e.y,{r:12,life:.6,color:'#a18460'});
  fx(g, 'ring', e.x, e.y, { r: 26, color: def.color, life: 0.8 });
  fxText(g, e.x, e.y - 34, f.name, '#d8cfc0', true);
  fxMoment(g, e.x, e.y, `Edo Tensei: ${f.name}`, def.color);
  return e;
}

/** O corpo do Edo Tensei se desfaz em pó (fim do tempo, dono caído ou derrubado). */
export function dissolveEdo(g: Game, e: Unit) {
  e.dead = true;
  fx(g, 'smoke', e.x, e.y, { r: 20, life: 0.8, color: '#8a7f70' });
  fx(g, 'chips', e.x, e.y - 6, { r: 14, life: 0.6, color: '#b9b2a6' });
}
