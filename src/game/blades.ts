// Lâminas lendárias (data/blades.ts): quem pode usar, como a vila consegue cada uma, os efeitos em combate e a
// garantia de que uma lâmina conseguida nunca some (volta ao estoque se quem a carregava cair).
import { BLADE_FX, BLADES, bladeItem, type BladeId } from '../data/blades';
import { ITEMS } from '../data/items';
import { applyDamage, areaDamage } from './combat';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { interruptCast } from './techniques';
import type { Unit } from './types';

/** Lâmina que a unidade carrega (vila: arma equipada; espadachim: a dele). */
export function bladeOf(u: Unit | null | undefined): BladeId | undefined {
  if (!u) return undefined;
  if (u.swordsman) return u.swordsman;
  const w = u.ninja?.equip.weapon;
  return w ? ITEMS[w]?.blade : undefined;
}

/** Quem pode usar o item (Raijin: só o Kage). Motivo quando não pode. */
export function canWield(u: Unit, itemId: string): string | null {
  const d = ITEMS[itemId];
  if (d?.kageOnly && u.ninja?.rank !== 'kage') return 'Só o Kage pode usar esta espada.';
  return null;
}

/** A vila consegue a lâmina (uma vez só): entra no estoque. Retorna false se já tinha. */
export function grantBlade(g: Game, id: BladeId, how: string, at?: { x: number; y: number }) {
  const s = g.state;
  if (s.blades.includes(id)) return false;
  s.blades.push(id);
  const item = bladeItem(id);
  s.items[item] = (s.items[item] ?? 0) + 1;
  g.toast(`{swords} ${how}: a vila agora tem a ${BLADES[id].name}! (estoque de armas)`, 'good', at);
  return true;
}

/** Lâminas no estoque ou na mão de um ninja vivo da vila. */
function bladeHolders(g: Game) {
  const have = new Set<BladeId>();
  for (const id of g.state.blades) if ((g.state.items[bladeItem(id)] ?? 0) > 0) have.add(id);
  for (const u of g.state.units) {
    if (u.dead || u.faction !== 'village') continue;
    const b = bladeOf(u);
    if (b) have.add(b);
  }
  return have;
}

/** Lâmina sem dono (quem a carregava caiu, em qualquer lugar): volta para o estoque. */
export function recoverBlades(g: Game) {
  if (g.state.sceneInfo || !g.state.blades.length) return;
  const have = bladeHolders(g);
  for (const id of g.state.blades) {
    if (have.has(id)) continue;
    const item = bladeItem(id);
    g.state.items[item] = (g.state.items[item] ?? 0) + 1;
    for (const u of g.state.units) if (u.dead && u.ninja?.equip.weapon === item) u.ninja.equip.weapon = null;
    g.toast(`{swords} A ${BLADES[id].name} foi recuperada e voltou ao estoque.`, 'info');
  }
}

const ready = (g: Game, u: Unit) => (u.bladeAt ?? 0) <= g.state.time;

/** Quanto da defesa do alvo vale contra a lâmina (Kabutowari ignora, Kusanagi corta metade). */
export function bladeDefense(src: Unit | null) {
  const b = bladeOf(src);
  return b === 'kabutowari' ? 0 : b === 'kusanagi' ? BLADE_FX.pierce : 1;
}

/** Multiplicador do golpe corpo a corpo pela lâmina (antes da defesa). */
export function bladeMult(g: Game, src: Unit, t: Unit) {
  const b = bladeOf(src);
  if (b === 'kabutowari' && (t.boss || t.shield > 0 || t.org === 'tetsuo')) return BLADE_FX.breakBoss;
  if (b === 'asuma' && src.ninja?.nature === 'fuuton') return BLADE_FX.fuuton;
  if (b === 'hiramekarei' && ready(g, src)) return BLADE_FX.charge;
  return 1;
}

/** Alcance extra e ritmo do corpo a corpo. */
export const bladeReach = (u: Unit) => (bladeOf(u) === 'asuma' ? BLADE_FX.reach : 0);
export function bladeSpeed(u: Unit) {
  const b = bladeOf(u);
  return b === 'kusanagi' ? BLADE_FX.kusanagiSpeed : b === 'sakumo' ? BLADE_FX.flashSpeed : 1;
}
export const bladeMove = (u: Unit) => (bladeOf(u) === 'sakumo' ? BLADE_FX.flashMove : 1);

/** Inimigos de `src` perto de (x, y), menos `skip`. */
function foesNear(g: Game, src: Unit, x: number, y: number, r: number, skip: Unit) {
  return g.state.units.filter((o) => o !== skip && !o.dead && !o.hidden && !o.cloak && o.faction !== src.faction && o.faction !== 'guest' && Math.hypot(o.x - x, o.y - y) < r);
}

/** Depois de um golpe corpo a corpo que acertou (`dmg` = dano causado): o efeito da lâmina. */
export function bladeHit(g: Game, src: Unit, t: Unit, dmg: number) {
  const b = bladeOf(src);
  if (!b) return;
  const f = BLADE_FX;
  const color = BLADES[b].color;
  switch (b) {
    case 'zabuza':
      src.hp = Math.min(src.maxHp, src.hp + Math.round(dmg * f.blood));
      fx(g, 'beam', t.x, t.y - 10, { x2: src.x, y2: src.y - 10, color: '#c0182b', life: 0.35 }); // o sangue volta para a lâmina
      fx(g, 'hit', t.x, t.y - 8, { r: 10, color: '#c0182b', life: 0.25, vfx: 'blood' });
      break;
    case 'samehada': {
      const took = Math.min(t.chakra ?? 0, f.drain);
      if (took > 0) {
        t.chakra -= took;
        src.chakra = Math.min(src.maxChakra, src.chakra + took);
      }
      src.hp = Math.min(src.maxHp, src.hp + Math.round(dmg * f.drainHeal));
      fx(g, 'beam', t.x, t.y - 10, { x2: src.x, y2: src.y - 10, color: '#4da6ff', life: 0.4 }); // devora o chakra
      break;
    }
    case 'kiba': {
      const o = foesNear(g, src, t.x, t.y, f.chainRange, t)[0];
      if (o) {
        fx(g, 'bolt', t.x, t.y - 10, { x2: o.x, y2: o.y - 10, color, life: 0.25 });
        applyDamage(g, src, o, dmg * f.chain, 'raiton', {});
      }
      break;
    }
    case 'hiramekarei':
      if (!ready(g, src)) break;
      src.bladeAt = g.state.time + f.chargeCd;
      fx(g, 'ring', t.x, t.y, { r: f.chargeRadius, color, life: 0.5 });
      fx(g, 'wave', t.x, t.y, { r: f.chargeRadius, color: '#e0dccc', life: 0.5 });
      fxText(g, src.x, src.y - 30, 'Hiramekarei!', color, true);
      for (const o of foesNear(g, src, t.x, t.y, f.chargeRadius, t)) applyDamage(g, src, o, dmg * 0.6, null, {});
      break;
    case 'nuibari':
      if (!ready(g, src)) break;
      src.bladeAt = g.state.time + f.stitchCd;
      t.stun = Math.max(t.stun, f.stitchStun);
      t.stunVfx = undefined;
      fx(g, 'burst', t.x, t.y - 8, { r: 10, color, life: 0.3, vfx: 'needle' });
      for (const o of foesNear(g, src, t.x, t.y, f.stitchRange, t)) {
        applyDamage(g, src, o, dmg * f.stitch, null, { stun: f.stitchStun });
        fx(g, 'bolt', t.x, t.y - 8, { x2: o.x, y2: o.y - 8, color, life: 0.3 });
      }
      break;
    case 'shibuki':
      if (!ready(g, src)) break;
      src.bladeAt = g.state.time + f.blastCd;
      fx(g, 'burst', t.x, t.y, { r: f.blastRadius, color: '#ff7a3b', life: 0.5, vfx: 'fire' });
      areaDamage(g, src, src.faction, t.x, t.y, f.blastRadius, f.blast, 'katon', 20);
      break;
    case 'sakumo':
      if (t.cast) {
        interruptCast(g, t);
        fx(g, 'ring', t.x, t.y - 8, { r: 18, color: '#ffffff', life: 0.35 }); // chakra branco corta os selos
      }
      break;
    case 'bee':
      if (!t.dead) {
        // as sete espadas: riscos cruzados
        fx(g, 'slash', t.x - 4, t.y - 4, { r: 18, color: '#e8e8e8', life: 0.25 });
        fx(g, 'slash', t.x + 4, t.y - 10, { r: 14, color: '#e8e8e8', life: 0.3 });
        applyDamage(g, src, t, dmg * f.flurry, null, {});
      }
      break;
  }
}

/** Raijin no Ken: a cada poucos segundos um raio atinge o alvo de longe (chamado no passo do ninja). */
export function bladeTick(g: Game, u: Unit) {
  if (bladeOf(u) !== 'raijin' || u.combatTimer <= 0 || u.stun > 0 || !ready(g, u)) return;
  const t = u.targetId != null ? g.unit(u.targetId) : null;
  if (!t || t.dead || t.cloak || Math.hypot(t.x - u.x, t.y - u.y) > BLADE_FX.thunderRange) return;
  u.bladeAt = g.state.time + BLADE_FX.thunderCd;
  fx(g, 'bolt', u.x, u.y - 20, { x2: t.x, y2: t.y - 10, color: BLADES.raijin.color, life: 0.3 });
  fxText(g, u.x, u.y - 32, 'Raijin!', BLADES.raijin.color, true);
  applyDamage(g, u, t, BLADE_FX.thunder, 'raiton', { stun: 0.4 });
}
