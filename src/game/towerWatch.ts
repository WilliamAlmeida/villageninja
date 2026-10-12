// Vigia da torre: um ninja da vila mandado para uma Torre de Vigia fica lá em cima arremessando kunais (no lugar do
// arremesso automático da torre, com dano e ritmo dele, e o XP do abate é dele). Fica fora das lutas comuns: só desce
// se for tirado, se a torre cair (vira obra), se estiver muito ferido (vai se tratar e volta) ou se não houver
// alternativa: inimigo colado na torre e nenhum outro ninja da vila lutando por perto. Lá em cima ele é alvo como
// qualquer um (a posição lógica é a porta da torre; o desenho fica na plataforma, entre as peças da arte).
import { STAT_INFO } from '../data/ninja';
import { spawnProjectile } from './combat';
import { canHit } from './factions';
import type { Game } from './game';
import { teamOf } from './teams';
import type { Building, Unit } from './types';
import { towerDamage, towerRange } from './upgrade';
import { doorPos } from './world';

type Result = { ok: true } | { ok: false; error: string };

export const WATCH = {
  /** Alcance e dano base da torre (os mesmos do arremesso automático em systems/towers.ts). */
  range: 190,
  damage: 7,
  /** Altura do arremesso (px acima do pé). */
  height: 30,
  /** Ritmo: 1,4 s menos 0,05 por ponto de Velocidade (mínimo 0,7). */
  cd: 1.4,
  /** Dano extra por ponto de Força e de Velocidade. */
  perStat: 0.6,
  /** Abaixo desta fração da vida desce para se tratar (e volta depois). */
  lowHp: 0.3,
  /** "Sem alternativa": inimigo a menos disto da porta e ninguém da vila lutando a menos de `help`. */
  close: 70,
  help: 240,
};

/** Quem vigia esta torre agora (vivo e ainda dela). */
export function towerGuard(g: Game, b: Building): Unit | undefined {
  const u = b.guardId != null ? g.unit(b.guardId) : undefined;
  return u && !u.dead && u.onTower === b.id ? u : undefined;
}

/** Motivo de não poder mandar este ninja vigiar, ou null. */
export function watchBlock(g: Game, u: Unit): string | null {
  const n = u.ninja;
  if (!n || u.faction !== 'village' || u.dead) return 'Só ninjas da vila.';
  if (n.rank === 'kage') return 'O Kage não vigia torre.';
  if (u.away != null) return 'Está fora da vila.';
  if (teamOf(g, u)) return 'Está numa equipe: tire da equipe primeiro.';
  if (n.learning) return 'Está estudando um jutsu.';
  if (u.onTower != null) return 'Já vigia uma torre.';
  return null;
}

/** Ninjas que dá para mandar a esta torre: os livres, primeiro os de melhor arremesso (Velocidade + Força) e nível. */
export function watchCandidates(g: Game): Unit[] {
  return g.state.units
    .filter((u) => u.kind === 'ninja' && !watchBlock(g, u))
    .sort((a, b) => score(b) - score(a));
}
const score = (u: Unit) => u.ninja!.stats.velocidade + u.ninja!.stats.forca + u.ninja!.level * 0.2;

export function assignWatch(g: Game, towerId: number, unitId: number): Result {
  const b = g.building(towerId);
  const u = g.unit(unitId);
  if (!b || b.type !== 'tower') return { ok: false, error: 'Não é uma Torre de Vigia.' };
  if (!b.built) return { ok: false, error: 'A torre ainda está em obra.' };
  if (!u) return { ok: false, error: 'Inválido.' };
  const why = watchBlock(g, u);
  if (why) return { ok: false, error: why };
  const old = towerGuard(g, b);
  if (old) old.onTower = undefined;
  b.guardId = u.id;
  u.onTower = b.id;
  u.command = null;
  u.ninja!.order = 'auto';
  u.state = 'idle';
  u.timer = 0;
  u.hidden = false;
  g.toast(`{tower} ${u.name} foi vigiar a torre.`, 'info', u);
  return { ok: true };
}

export function removeWatch(g: Game, towerId: number): Result {
  const b = g.building(towerId);
  if (!b) return { ok: false, error: 'Inválido.' };
  const u = towerGuard(g, b);
  b.guardId = undefined;
  if (u) {
    u.onTower = undefined;
    if (u.state === 'towerWatch' || u.state === 'toTower') u.state = 'idle';
    u.timer = 0;
    g.toast(`{tower} ${u.name} desceu da torre.`, 'info', u);
  }
  return { ok: true };
}

/** O ninja vigia (atribuído e a torre de pé)? */
export const watching = (g: Game, u: Unit) => {
  if (u.onTower == null) return undefined;
  const b = g.building(u.onTower);
  return b && b.built && b.guardId === u.id ? b : undefined;
};

/**
 * Turno do vigia no sistema dos ninjas. true = cuidou dele neste passo (o resto da IA não roda); false = segue a IA
 * comum (torre caída, muito ferido ou sem alternativa: luta embaixo e depois volta sozinho, a vaga continua dele).
 */
export function watchTick(g: Game, u: Unit, dt: number, follow: (g: Game, u: Unit, dt: number) => boolean, goTo: (g: Game, u: Unit, x: number, y: number) => boolean): boolean {
  // atribuição quebrada (torre demolida, outro no lugar) ou entrou numa equipe: solta
  if (u.onTower != null) {
    const b = g.building(u.onTower);
    if (!b || b.guardId !== u.id) u.onTower = undefined;
    else if (teamOf(g, u)) removeWatch(g, b.id);
  }
  const b = watching(g, u);
  if (!b) {
    if (u.state === 'towerWatch') u.state = 'idle';
    return false;
  }
  // ferido: desce e se trata até o fim (o descanso solta com 95%); mandado estudar: estuda e volta
  const treating = u.state === 'rest' || u.state === 'toRest' || u.state === 'cmdRest';
  if (u.hp < u.maxHp * WATCH.lowHp || treating || u.ninja!.learning) {
    if (u.state === 'towerWatch' || u.state === 'toTower') u.state = 'idle';
    return false;
  }
  const door = doorPos(b);
  if (noAlternative(g, u, door)) {
    if (u.state === 'towerWatch') u.state = 'idle';
    return false;
  }
  if (u.state === 'fight') return false; // termina a luta de agora; depois volta
  if (u.state !== 'towerWatch') {
    u.hidden = false;
    if (Math.hypot(u.x - door.x, u.y - door.y) > 6) {
      if (u.state !== 'toTower') {
        if (!goTo(g, u, door.x, door.y)) return false;
        u.state = 'toTower';
      }
      if (!follow(g, u, dt)) return true;
    }
    u.state = 'towerWatch';
    u.x = door.x;
    u.y = door.y;
    u.targetId = null;
    u.attackCd = Math.max(u.attackCd, 0.4);
  }
  u.moving = false;
  shoot(g, u, b, door, dt);
  return true;
}

/** Inimigo colado na porta e ninguém mais da vila lutando por perto: desce para lutar. */
function noAlternative(g: Game, u: Unit, door: { x: number; y: number }) {
  const foes = g.foesOf('village').filter((e) => !e.dead && !e.hidden && Math.hypot(e.x - door.x, e.y - door.y) < WATCH.close);
  if (!foes.length) return false;
  return !g.state.units.some(
    (o) => o !== u && !o.dead && o.kind === 'ninja' && o.faction === 'village' && o.onTower == null && o.state === 'fight' && Math.hypot(o.x - door.x, o.y - door.y) < WATCH.help,
  );
}

/** Arremesso de kunai do alto: no inimigo mais perto no alcance da torre. */
function shoot(g: Game, u: Unit, b: Building, door: { x: number; y: number }, dt: number) {
  void dt; // o attackCd já desce no statusSystem
  if (u.attackCd > 0) return;
  const range = towerRange(b, WATCH.range);
  let best: Unit | null = null;
  let bd = range;
  for (const e of g.foesOf('village')) {
    if (e.dead || e.hidden || !canHit('village', undefined, e)) continue;
    const d = Math.hypot(e.x - door.x, e.y - door.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return;
  const s = u.ninja!.stats;
  u.attackCd = Math.max(0.7, WATCH.cd - s.velocidade * 0.05);
  u.facing = Math.atan2(best.y - u.y, best.x - u.x);
  u.anim = 0.3;
  u.animKind = 'throw';
  spawnProjectile(g, u, 'village', door.x, door.y - WATCH.height, best.x, best.y - 6, {
    damage: towerDamage(b, WATCH.damage) + (s.forca + s.velocidade) * WATCH.perStat,
    radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 380, kind: 'kunai', stun: 0, range: range + 40,
  });
}

/** Rótulo curto do que o vigia rende (para o painel). */
export const watchStats = (u: Unit) =>
  `${STAT_INFO.velocidade.short} ${u.ninja!.stats.velocidade.toFixed(0)} · ${STAT_INFO.forca.short} ${u.ninja!.stats.forca.toFixed(0)}`;
