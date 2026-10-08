// Estratégia de luta: deixa as batalhas grandes legíveis em vez de virar um bolo.
// - Papéis automáticos (pelo atributo e jutsus): tanque segura a linha, atacante entra, atirador luta de longe, suporte
//   cura/paralisa de trás. Cada um ganha um ícone pequeno.
// - Duelos: cada ninja prefere um inimigo que ninguém está enfrentando (o bolo se divide em lutas lado a lado); o
//   inimigo prefere o tanque que está por perto (provocação).
// - Táticas da equipe (`Team.tactic`): livre (duelos), focar o mais forte, segurar posição, flanquear.
// - Afastamento leve entre aliados colados (`flags.spread`, desligável no menu).
import { STAT_KEYS } from '../data/ninja';
import { JUTSUS } from '../data/jutsus';
import { canHit } from './factions';
import type { Game } from './game';
import type { Team, Unit } from './types';

export type Role = 'tank' | 'striker' | 'ranged' | 'support';
export type Tactic = 'free' | 'focus' | 'hold' | 'flank';

export const ROLE_INFO: Record<Role, { name: string; desc: string }> = {
  tank: { name: 'Tanque', desc: 'Força e Stamina: segura a linha e atrai os inimigos para si.' },
  striker: { name: 'Atacante', desc: 'Taijutsu e Velocidade: entra no corpo a corpo.' },
  ranged: { name: 'Atirador', desc: 'Ninjutsu e Selos: luta de longe e recua se encostarem nele.' },
  support: { name: 'Suporte', desc: 'Cura ou ilusões: fica atrás dos aliados.' },
};

export const TACTIC_INFO: Record<Tactic, { name: string; desc: string }> = {
  free: { name: 'Livre', desc: 'Cada um procura um adversário que ninguém está enfrentando (duelos lado a lado).' },
  focus: { name: 'Focar o mais forte', desc: 'A equipe toda ataca o inimigo mais forte por perto.' },
  hold: { name: 'Segurar posição', desc: 'Luta só perto de onde a equipe estava ao receber a ordem; não persegue.' },
  flank: { name: 'Flanquear', desc: 'Chega pelos lados do inimigo em vez de ir de frente.' },
};

export const TACTICS = {
  /** Custo extra (px) por aliado já enfrentando o alvo: maior = espalha mais em duelos. */
  duel: 70,
  /** Provocação: o inimigo prefere o tanque a até esta distância a mais. */
  taunt: 60,
  /** Segurar posição: raio em volta do ponto. */
  hold: 110,
  /** Afastamento: distância mínima entre aliados lutando e força do empurrão (px/s). */
  spread: 14,
  spreadSpeed: 26,
};

const sum = (u: Unit, ks: string[]) => ks.reduce((a, k) => a + (u.ninja!.stats as Record<string, number>)[k]!, 0);

/** Papel do ninja (pelo maior par de atributos; quem tem jutsu de cura é suporte). */
export function roleOf(u: Unit): Role | null {
  const n = u.ninja;
  if (!n) return null;
  const jutsus = n.jutsu.filter(Boolean).map((id) => JUTSUS[id!]!);
  if (jutsus.some((j) => j.effect === 'heal')) return 'support';
  const tank = sum(u, ['forca', 'stamina']);
  const striker = sum(u, ['taijutsu', 'velocidade']);
  const ranged = sum(u, ['ninjutsu', 'selos']) + (jutsus.some((j) => j.range >= 100) ? 2 : 0);
  const support = sum(u, ['genjutsu', 'inteligencia']) - 1;
  const best = Math.max(tank, striker, ranged, support);
  return best === ranged ? 'ranged' : best === striker ? 'striker' : best === tank ? 'tank' : 'support';
}

/** Força aproximada para "focar o mais forte". */
export function power(u: Unit) {
  if (u.ninja) return STAT_KEYS.reduce((a, k) => a + u.ninja!.stats[k], 0) + u.ninja.level * 0.5 + (u.boss ? 20 : 0);
  return u.maxHp / 10 + (u.boss ? 20 : 0);
}

/** Quantos da facção de `u` (fora ele) estão lutando com `t` agora. */
function attackers(g: Game, u: Unit, t: Unit) {
  const self = u.targetId === t.id && (u.state === 'fight' || u.combatTimer > 0) ? 1 : 0;
  return g.engagedOn(u.faction, t.id) - self;
}

/**
 * Escolhe o adversário: o mais perto, mas penalizando quem já está ocupado com aliados (duelos) e, para inimigos,
 * preferindo o tanque. `ok` filtra (raio, dentro da vila…). Tática "focar": o mais forte.
 */
export function pickFoe(g: Game, u: Unit, radius: number, ok?: (o: Unit, d: number) => boolean): Unit | null {
  let best: Unit | null = null;
  let bs = Infinity;
  const focus = u.tactic === 'focus';
  for (const o of g.foesOf(u.faction)) {
    if (o.dead || o.hidden || !canHit(u.faction, undefined, o)) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (ok ? !ok(o, d) : d > radius) continue;
    if (u.tactic === 'hold' && u.anchor && Math.hypot(o.x - u.anchor.x, o.y - u.anchor.y) > TACTICS.hold + 40) continue;
    let score: number;
    if (focus) score = -power(o) * 10 + d * 0.1;
    else {
      score = d + attackers(g, u, o) * TACTICS.duel;
      if (u.faction !== 'village' && o.ninja && roleOf(o) === 'tank') score -= TACTICS.taunt; // provocação
      // tanque protege: prefere quem está batendo num aliado
      if (u.faction === 'village' && roleOf(u) === 'tank') {
        const victim = g.unit(o.targetId);
        if (victim && victim !== u && victim.faction === u.faction) score -= 40;
      }
    }
    if (score < bs) {
      bs = score;
      best = o;
    }
  }
  return best;
}

/** Passo da equipe: copia a tática para os membros (e o ponto de "segurar posição"). */
export function applyTeamTactic(g: Game, t: Team, members: Unit[]) {
  const tactic = t.tactic ?? 'free';
  if (tactic === 'hold' && !t.anchor && members.length) {
    t.anchor = { x: members.reduce((a, u) => a + u.x, 0) / members.length, y: members.reduce((a, u) => a + u.y, 0) / members.length };
  }
  if (tactic !== 'hold') t.anchor = undefined;
  for (const u of members) {
    u.tactic = tactic === 'free' ? undefined : tactic;
    u.anchor = t.anchor;
  }
}

export function setTeamTactic(g: Game, teamId: number, tactic: Tactic): { ok: true } | { ok: false; error: string } {
  const t = g.team(teamId);
  if (!t) return { ok: false, error: 'Equipe não encontrada.' };
  t.tactic = tactic === 'free' ? undefined : tactic;
  t.anchor = undefined; // "segurar": o ponto é onde a equipe está agora
  return { ok: true };
}

/**
 * Ajuste do combate pelo papel e pela tática (chamado no `engage`): o ponto para onde correr (flanquear),
 * a distância preferida (suporte atrás, atirador mais longe) e se deve voltar ao ponto (segurar posição).
 */
export function engageAdjust(u: Unit, t: Unit, desired: number): { desired: number; chaseX: number; chaseY: number; back?: { x: number; y: number } } {
  let chaseX = t.x;
  let chaseY = t.y;
  const role = u.faction === 'village' ? roleOf(u) : null;
  // médico (tem jutsu de cura) fica atrás curando; quem é suporte só pelos atributos luta normal
  if (role === 'support' && u.ninja!.jutsu.some((id) => id && JUTSUS[id]?.effect === 'heal')) desired = Math.max(desired, 70);
  if (u.tactic === 'flank') {
    // chega pela lateral: ponto ao lado do alvo (o lado depende do id, para dividir a equipe)
    const a = Math.atan2(t.y - u.y, t.x - u.x) + (u.id % 2 ? 1 : -1) * Math.PI / 2;
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    if (d > desired + 30) {
      chaseX = t.x + Math.cos(a) * 45;
      chaseY = t.y + Math.sin(a) * 45;
    }
  }
  let back: { x: number; y: number } | undefined;
  if (u.tactic === 'hold' && u.anchor && Math.hypot(u.x - u.anchor.x, u.y - u.anchor.y) > TACTICS.hold) back = u.anchor;
  return { desired, chaseX, chaseY, back };
}

/** Afastamento leve: aliados lutando colados se afastam devagar (o bolo vira fileira). */
export function spreadSystem(g: Game, dt: number) {
  if (g.state.flags.spread === false) return;
  const fighters = g.state.units.filter((u) => !u.dead && !u.hidden && u.combatTimer > 0 && !u.dash && (u.kind === 'ninja' || u.kind === 'rogue'));
  const min = TACTICS.spread;
  for (let i = 0; i < fighters.length; i++)
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i]!;
      const b = fighters[j]!;
      if (a.faction !== b.faction) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d < 0.01) continue;
      const k = (TACTICS.spreadSpeed * dt) / 2;
      const nx = dx / d;
      const ny = dy / d;
      if (g.world.walkablePx(a.x - nx * k, a.y - ny * k)) {
        a.x -= nx * k;
        a.y -= ny * k;
      }
      if (g.world.walkablePx(b.x + nx * k, b.y + ny * k)) {
        b.x += nx * k;
        b.y += ny * k;
      }
    }
}

/** Formação ao mover a equipe: frente (tanque, atacante), atrás (atirador), no meio atrás (suporte). */
export function roleOffset(u: Unit, i: number, dirX: number, dirY: number) {
  const role = roleOf(u) ?? 'striker';
  const back = role === 'ranged' ? 34 : role === 'support' ? 20 : role === 'tank' ? -8 : 4;
  const side = ((i % 3) - 1) * 22;
  // dir = para onde a equipe vai; "atrás" é o contrário; "lado" é a perpendicular
  return { x: -dirX * back - dirY * side, y: -dirY * back + dirX * side };
}
