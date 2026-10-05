// Profissões e invocações dos ninjas da vila em combate: médico cura, espião marca e revela, marionetista monta um
// boneco, e quem tem contrato invoca sapo / serpente / lesma. Chamado pelo sistema dos ninjas a cada tick.
import { ANIMALS } from '../data/animals';
import { CONTRACTS } from '../data/contracts';
import { SPEC, SPECS, type SpecKind } from '../data/specs';
import { BUILDINGS } from '../data/buildings';
import { createAnimal, createClone } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { levelOf } from './upgrade';
import type { Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Por que o ninja não pode aprender a profissão agora (null = pode, sem contar o custo). */
export function specBlock(g: Game, u: Unit, kind: SpecKind): string | null {
  const n = u.ninja;
  if (!n || u.faction !== 'village' || u.kind !== 'ninja') return 'Inválido.';
  if (n.spec === kind) return 'Já tem esta profissão.';
  if (n.rank === 'genin') return 'Só Chunin ou superior se especializa.';
  const def = SPECS[kind];
  const b = g.state.buildings.find((x) => x.type === def.building && x.built && levelOf(x) >= (def.buildingLevel ?? 1));
  if (!b) return `Precisa de ${BUILDINGS[def.building].name}${def.buildingLevel ? ` no nível ${def.buildingLevel}` : ''}.`;
  return null;
}

export function learnSpec(g: Game, unitId: number, kind: SpecKind): Result {
  const u = g.unit(unitId);
  if (!u) return fail('Ninja não encontrado.');
  const why = specBlock(g, u, kind);
  if (why) return fail(why);
  if (!g.pay(SPECS[kind].cost)) return fail('Recursos insuficientes.');
  u.ninja!.spec = kind;
  fxText(g, u.x, u.y - 30, SPECS[kind].name, '#ffd34d', true);
  g.toast(`{medal} ${u.name} agora é ${SPECS[kind].name}.`, 'good', u);
  return { ok: true };
}

/** Habilidades automáticas em combate (profissão e contrato). */
export function specTick(g: Game, u: Unit, dt: number) {
  const n = u.ninja!;
  if (n.spec || n.contract) u.abilityCd = (u.abilityCd ?? 0) - dt;
  u.summonCd = (u.summonCd ?? 0) - dt;
  const inCombat = u.combatTimer > 0 && !u.hidden;
  if (n.spec === 'medic' && (u.abilityCd ?? 0) <= 0) {
    const hurt = g.state.units
      .filter((o) => !o.dead && !o.hidden && o.faction === 'village' && o.kind !== 'villager' && o.hp < o.maxHp * 0.7 && Math.hypot(o.x - u.x, o.y - u.y) < SPEC.healRange)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      u.abilityCd = SPEC.healCd;
      const amount = Math.round(hurt.maxHp * SPEC.healAmount);
      hurt.hp = Math.min(hurt.maxHp, hurt.hp + amount);
      fx(g, 'heal', hurt.x, hurt.y, { r: 18, color: '#7dff9a', life: 0.7 });
      fxText(g, hurt.x, hurt.y - 26, `+${amount}`, '#7dff9a');
    }
  }
  if (n.spec === 'puppeteer' && inCombat && (u.abilityCd ?? 0) <= 0) {
    const has = g.state.units.some((o) => !o.dead && o.role === 'puppet' && o.ownerId === u.id);
    if (!has) {
      u.abilityCd = SPEC.puppetCd;
      const p = createClone(g, u, u.x + 18, u.y + 6, SPEC.puppetLife);
      p.role = 'puppet';
      p.name = `Marionete de ${u.name.split(' ').pop()}`;
      p.maxHp = p.hp = Math.round(u.maxHp * SPEC.puppetHp);
      fx(g, 'smoke', p.x, p.y, { r: 16, life: 0.6, color: '#c8a26a' });
      fxText(g, u.x, u.y - 30, 'Marionete!', '#c8a26a', true);
    }
  }
  if (n.contract && inCombat && (u.summonCd ?? 0) <= 0) {
    const c = CONTRACTS[n.contract];
    const mine = g.state.units.some((o) => !o.dead && o.ownerId === u.id && o.animal === c.animal);
    if (!mine && u.chakra >= c.chakra) {
      u.chakra -= c.chakra;
      u.summonCd = c.cd;
      const a = createAnimal(g, c.animal, u.x + 22, u.y + 10);
      a.faction = 'village';
      a.ownerId = u.id;
      a.life = c.life;
      a.name = `${ANIMALS[c.animal].name} de ${u.name.split(' ').pop()}`;
      fx(g, 'swirl', a.x, a.y, { r: 30, life: 0.8, color: '#ffd34d' });
      fxText(g, u.x, u.y - 30, 'Kuchiyose!', '#ffd34d', true);
    }
  }
}

/** Espiões da vila revelam espiões inimigos de longe. */
export const spyNinjaNear = (g: Game, x: number, y: number, r: number) =>
  g.state.units.some((o) => !o.dead && !o.hidden && o.faction === 'village' && o.ninja?.spec === 'spy' && Math.hypot(o.x - x, o.y - y) < r);
