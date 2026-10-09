// Os Três Sannin: nomeação e as técnicas lendárias (Modo Sábio, Troca de Pele, Selo da Força de Cem).
import { RANKS } from '../data/ninja';
import { costLabel } from '../data/resources';
import { HUNDRED, SAGE, SANNIN, SANNIN_PATHS, type SanninPath } from '../data/sannin';
import { levelDef } from '../data/villageLevels';
import { fx, fxMoment, fxText } from './fx';
import { grantBlade } from './blades';
import type { Game } from './game';
import { leaveTeam } from './teams';
import { dogOf, releaseDog } from './ninken';
import type { NinjaInfo, Unit } from './types';

type Result = { ok: true } | { ok: false; error: string };

/** Teto de atributo do ninja (Sannin sobe para 10, como o Kage). */
export const statCapOf = (n: NinjaInfo) => (n.sannin ? Math.max(RANKS[n.rank].statCap, SANNIN.statCap) : RANKS[n.rank].statCap);

/** Sannin vivos da vila. */
export const sannins = (g: Game) => g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.ninja?.sannin);
export const sanninOf = (g: Game, path: SanninPath) => sannins(g).find((u) => u.ninja!.sannin === path);

/** Jounins que podem ser nomeados (nível alto, sem título). */
export const sanninCandidates = (g: Game) =>
  g.state.units
    .filter((u) => !u.dead && u.kind === 'ninja' && u.faction === 'village' && u.ninja?.rank === 'jounin' && !u.ninja.sannin && u.ninja.level >= SANNIN.minLevel)
    .sort((a, b) => b.ninja!.level - a.ninja!.level);

export function sanninBlock(g: Game, u: Unit | undefined, path: SanninPath): string | null {
  if (g.state.level < SANNIN.minVillage) return `Requer ${levelDef(SANNIN.minVillage).name}.`;
  if (sanninOf(g, path)) return `Já existe o ${SANNIN_PATHS[path].title}.`;
  if (sannins(g).length >= SANNIN.max) return 'A vila já tem os três Sannin.';
  if (!u) return `Precisa de um Jounin de nível ${SANNIN.minLevel}+.`;
  if (u.ninja?.rank !== 'jounin') return 'Só um Jounin pode virar Sannin.';
  if (u.ninja.sannin) return 'Já é Sannin.';
  if (u.ninja.level < SANNIN.minLevel) return `Precisa de nível ${SANNIN.minLevel}.`;
  if (!g.canAfford(SANNIN.cost)) return `Custa ${costLabel(SANNIN.cost)}.`;
  return null;
}

/** Nomeia o Jounin como Sannin do caminho: título, contrato do animal e a técnica lendária. */
export function nameSannin(g: Game, unitId: number, path: SanninPath): Result {
  const u = g.unit(unitId);
  const why = sanninBlock(g, u, path);
  if (why) return { ok: false, error: why };
  g.pay(SANNIN.cost);
  const n = u!.ninja!;
  n.sannin = path;
  n.contract = path;
  leaveTeam(g, u!.id); // Sannin só forma equipe com Sannin
  if (dogOf(g, u!)) releaseDog(g, u!.id); // Sannin tem a invocação: o ninken volta para o Canil
  const d = SANNIN_PATHS[path];
  fx(g, 'ring', u!.x, u!.y, { r: 46, color: d.color, life: 1.2 });
  fxText(g, u!.x, u!.y - 36, d.title, d.color, true);
  g.toast(`{crown} ${u!.name} agora é o ${d.title}! Técnica lendária: ${d.art}.`, 'good', u);
  if (path === 'snake') grantBlade(g, 'kusanagi', 'O caminho das serpentes', u); // a Kusanagi vem com o título
  return { ok: true };
}

// ------------------------------------------------------------------ técnicas lendárias
/** Em combate: Modo Sábio (sapo) e Selo da Força de Cem (lesma). A Troca de Pele fica em `sanninSurvive`. */
export function sanninTick(g: Game, u: Unit) {
  const path = u.ninja?.sannin;
  if (!path || (u.sanninCd ?? 0) > 0 || u.stun > 0) return;
  const d = SANNIN_PATHS[path];
  if (path === 'toad' && u.combatTimer > 0 && !u.sage) {
    u.sage = SAGE.time;
    u.sanninCd = d.cooldown;
    fx(g, 'ring', u.x, u.y, { r: 30, color: d.color, life: 0.8 });
    fx(g, 'burst', u.x, u.y - 6, { r: 26, color: d.color, life: 0.6, vfx: 'heat' }); // energia natural entrando
    fxText(g, u.x, u.y - 32, d.shout, d.color, true);
    fxMoment(g, u.x, u.y, d.art, d.color);
  } else if (path === 'slug' && u.hp < u.maxHp * 0.5) {
    u.sanninCd = d.cooldown;
    for (const o of g.state.units) {
      if (o.dead || o.hidden || o.faction !== 'village' || Math.hypot(o.x - u.x, o.y - u.y) > HUNDRED.range) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * HUNDRED.heal);
      // cada aliado curado: cruzes verdes e o fio de chakra da Sannin até ele
      if (o !== u) {
        fx(g, 'heal', o.x, o.y, { r: 14, color: d.color, life: 0.9 });
        fx(g, 'beam', u.x, u.y - 12, { x2: o.x, y2: o.y - 12, color: d.color, life: 0.5 });
      }
    }
    fx(g, 'heal', u.x, u.y, { r: 24, color: d.color, life: 1 });
    fx(g, 'wave', u.x, u.y, { r: HUNDRED.range, color: d.color, life: 0.9 });
    fxMoment(g, u.x, u.y, d.art, d.color);
    fx(g, 'ring', u.x, u.y, { r: HUNDRED.range, color: d.color, life: 0.8 });
    fxText(g, u.x, u.y - 32, d.shout, d.color, true);
  }
}

/** Golpe fatal num Sannin das Serpentes pronto: troca de pele e volta com a vida cheia. Retorna true se sobreviveu. */
export function sanninSurvive(g: Game, u: Unit): boolean {
  if (u.ninja?.sannin !== 'snake' || (u.sanninCd ?? 0) > 0) return false;
  const d = SANNIN_PATHS.snake;
  u.sanninCd = d.cooldown;
  u.hp = u.maxHp;
  u.stun = 0;
  fx(g, 'smoke', u.x, u.y - 4, { r: 20, life: 0.8, color: '#b9a0e8' });
  fx(g, 'log', u.x - 6, u.y + 2, { life: 1.6, color: '#c8b6e8' }); // a pele velha fica no chão
  fxText(g, u.x, u.y - 32, d.shout, d.color, true);
  fxMoment(g, u.x, u.y, d.art, d.color);
  return true;
}

/** Bônus de dano e de velocidade do Modo Sábio. */
export const sageDamage = (u: Unit | null | undefined) => (u?.sage ? SAGE.damage : 1);
export const sageSpeed = (u: Unit) => (u.sage ? SAGE.speed : 1);
