// Expedições às minas: a equipe sai do mapa, desce andar por andar (eventos sorteados) e o jogador decide
// entre descer mais (mais risco, minérios raros) ou voltar com o que achou. O saque só entra no estoque na volta.
import { chance, rand, weightedPick } from '../core/rng';
import { MINE, MINE_EVENTS, MINE_MONSTERS, mineLoot } from '../data/expeditions';
import { ACTION_TIME, REGION } from '../data/region';
import { resolveRegion } from './region';
import { costLabel, RES_KEYS } from '../data/resources';
import { SITES } from '../data/sites';
import { sitePos } from './explore';
import { fx } from './fx';
import type { Game } from './game';
import { missionOfTeam } from './missions';
import { STAT_KEYS } from '../data/ninja';
import { gainXp } from './progression';
import { teamUnits } from './teams';
import type { Cost, Expedition, Unit } from './types';
import { doorPos } from './world';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Quantas expedições terminadas ficam no histórico. */
const KEEP_DONE = 4;

export const activeExpeditions = (g: Game) => g.state.expeditions.filter((e) => e.status !== 'done' && e.status !== 'lost');
export const expeditionOfTeam = (g: Game, teamId: number) => activeExpeditions(g).find((e) => e.teamId === teamId);
export const expeditionUnits = (g: Game, e: Expedition) => e.unitIds.map((id) => g.unit(id)).filter((u): u is Unit => !!u && !u.dead);

/** Força recomendada para o andar. */
export const floorPower = (floor: number) => MINE.power * floor;

/** A equipe pode partir agora (mina ou região)? (motivo quando não) */
export function teamBusy(g: Game, teamId: number): string | null {
  const tm = g.team(teamId);
  if (!tm) return 'Equipe não encontrada.';
  const us = teamUnits(g, tm);
  if (!us.length) return `${tm.name} não tem ninjas.`;
  if (expeditionOfTeam(g, teamId)) return `${tm.name} já está numa expedição.`;
  if (missionOfTeam(g, teamId)) return `${tm.name} está numa missão.`;
  if (us.some((u) => u.hp < u.maxHp * 0.5)) return `Há ninjas feridos em ${tm.name}: cure-os antes.`;
  return null;
}

/** Manda a equipe para a mina do local. */
export function startMine(g: Game, teamId: number, siteId: number): Result {
  const site = g.state.sites.find((s) => s.id === siteId && s.kind === 'cave' && s.found);
  if (!site) return fail('Mina não encontrada.');
  const why = teamBusy(g, teamId);
  if (why) return fail(why);
  const tm = g.team(teamId)!;
  const us = teamUnits(g, tm);
  const e: Expedition = {
    id: g.newId(), kind: 'mine', teamId, unitIds: us.map((u) => u.id), siteId, floor: 0, timer: MINE.travel,
    status: 'going', log: [`${tm.name} partiu para a mina.`], loot: {}, day: g.state.day,
  };
  g.state.expeditions.push(e);
  for (const u of us) leave(u, e.id);
  g.toast(`{pickaxe} ${tm.name} partiu em expedição para ${SITES.cave.name}.`, 'info', sitePos(site));
  return { ok: true };
}

function leave(u: Unit, expId: number) {
  u.away = expId;
  u.hidden = true;
  u.command = null;
  u.targetId = null;
  u.moving = false;
  u.hasGoal = false;
  u.state = 'away';
}

/** Escolha do jogador entre andares: descer mais ou voltar. */
export function chooseExpedition(g: Game, id: number, deeper: boolean): Result {
  const e = g.state.expeditions.find((x) => x.id === id);
  if (!e || e.status !== 'choice') return fail('Nada para decidir agora.');
  if (deeper && e.floor < MINE.floors) {
    e.status = 'explore';
    e.timer = MINE.floorTime;
    note(e, `Descendo ao andar ${e.floor + 1}…`);
  } else goBack(e, 'Voltando para a vila com o saque.');
  return { ok: true };
}

const note = (e: Expedition, text: string) => {
  e.log.push(text);
  if (e.log.length > 14) e.log.shift();
};

function goBack(e: Expedition, text: string, travel = MINE.travel) {
  e.status = 'return';
  e.timer = travel;
  note(e, text);
}

function addLoot(e: Expedition, c: Cost, mult = 1) {
  for (const k of RES_KEYS) if (c[k]) e.loot[k] = (e.loot[k] ?? 0) + Math.max(1, Math.round(c[k]! * mult));
}

/** Avança as expedições (chamado pelo sistema). */
export function tickExpeditions(g: Game, dt: number) {
  for (const e of g.state.expeditions) {
    if (e.status === 'done' || e.status === 'lost' || e.status === 'choice') continue;
    e.timer -= dt;
    if (e.timer > 0) continue;
    if (e.kind === 'region') {
      // região: ida → serviço → volta
      if (e.status === 'going') {
        e.status = 'explore';
        e.timer = ACTION_TIME[e.action!].work;
        note(e, `Chegaram a ${REGION[e.node!]!.name}.`);
      } else if (e.status === 'explore') {
        if (!expeditionUnits(g, e).length) lost(g, e);
        else goBack(e, resolveRegion(g, e), ACTION_TIME[e.action!].travel);
      } else if (e.status === 'return') finish(g, e);
      continue;
    }
    if (e.status === 'going') {
      e.floor = 1;
      e.status = 'explore';
      e.timer = MINE.floorTime;
      note(e, 'Chegaram à mina e entraram no andar 1.');
    } else if (e.status === 'explore') floorDone(g, e);
    else if (e.status === 'return') finish(g, e);
  }
  // histórico curto
  const ended = g.state.expeditions.filter((e) => e.status === 'done' || e.status === 'lost');
  if (ended.length > KEEP_DONE) {
    const drop = new Set(ended.slice(0, ended.length - KEEP_DONE).map((e) => e.id));
    g.state.expeditions = g.state.expeditions.filter((e) => !drop.has(e.id));
  }
}

/** Fim de um andar: sorteia o que aconteceu, aplica e pergunta se descem mais. */
function floorDone(g: Game, e: Expedition) {
  const us = expeditionUnits(g, e);
  if (!us.length) return lost(g, e);
  const f = e.floor;
  const power = us.reduce((a, u) => a + unitPower(u), 0);
  const ratio = power / floorPower(f);
  const ev = weightedPick(MINE_EVENTS, ([, w]) => w)![0];
  const hurt = (frac: number) => {
    for (const u of us) u.hp = Math.max(1, u.hp - u.maxHp * frac * rand(0.7, 1.3));
  };
  switch (ev) {
    case 'ore': {
      const c = mineLoot(f);
      addLoot(e, c, rand(0.8, 1.3));
      note(e, `Andar ${f}: acharam um veio rico (${costLabel(c)}).`);
      break;
    }
    case 'chest': {
      const c = { ...mineLoot(f), ryo: 40 * f };
      addLoot(e, c);
      note(e, `Andar ${f}: um baú de mineiros antigos (${costLabel(c)}).`);
      break;
    }
    case 'cavein': {
      hurt(0.15);
      for (const k of RES_KEYS) if (e.loot[k]) e.loot[k] = Math.round(e.loot[k]! * 0.75);
      note(e, `Andar ${f}: desabamento! Todos se feriram e parte do saque ficou soterrada.`);
      break;
    }
    case 'monster': {
      const name = MINE_MONSTERS[Math.min(f, MINE_MONSTERS.length) - 1]!;
      if (ratio >= 1) {
        hurt(0.1);
        addLoot(e, mineLoot(f));
        note(e, `Andar ${f}: ${name} atacaram, mas foram vencidos com facilidade.`);
      } else if (ratio >= 0.7) {
        hurt(0.3);
        addLoot(e, mineLoot(f), 0.7);
        note(e, `Andar ${f}: luta dura contra ${name}. Venceram, mas saíram machucados.`);
      } else {
        hurt(0.45);
        note(e, `Andar ${f}: ${name} eram fortes demais. A equipe fugiu ferida.`);
        if (f >= 3 && chance(0.35)) {
          const v = us[Math.floor(Math.random() * us.length)]!;
          v.dead = true;
          v.hp = 0;
          g.state.stats.lost++;
          note(e, `${v.name} não voltou…`);
          g.toast(`{skull} ${v.name} morreu na expedição.`, 'danger');
        }
      }
      for (const u of us) if (!u.dead) gainXp(g, u, 10 * f);
      break;
    }
    default: {
      const c = mineLoot(Math.max(1, f - 1));
      addLoot(e, c, 0.5);
      note(e, `Andar ${f}: túneis tranquilos, alguns minérios soltos.`);
    }
  }
  for (const u of us) if (!u.dead) gainXp(g, u, 4 * f);
  const alive = expeditionUnits(g, e);
  if (!alive.length) return lost(g, e);
  const avg = alive.reduce((a, u) => a + u.hp / u.maxHp, 0) / alive.length;
  if (avg < MINE.retreatHp) return goBack(e, 'Feridos demais: a equipe decidiu voltar.');
  if (f >= MINE.floors) return goBack(e, 'Chegaram ao fundo da mina! Voltando com tudo.');
  e.status = 'choice';
  const tm = g.team(e.teamId);
  g.toast(`{pickaxe} Expedição de ${tm?.name ?? 'equipe'}: andar ${f} concluído. Descer mais ou voltar? (janela Mundo)`, 'warn');
}

/** Força de um ninja na mesma escala do poder de equipe das missões, pesada pela vida atual. */
export function unitPower(u: Unit) {
  const n = u.ninja!;
  const avg = STAT_KEYS.reduce((a, k) => a + n.stats[k], 0) / STAT_KEYS.length;
  const rankBonus = ['genin', 'chunin', 'jounin', 'kage'].indexOf(n.rank) * 4;
  return (n.level * 1.5 + avg * 4 + n.jutsu.filter(Boolean).length * 3 + rankBonus) * (0.4 + 0.6 * (u.hp / u.maxHp));
}

function finish(g: Game, e: Expedition) {
  e.status = 'done';
  const hk = g.hokage();
  const p = hk ? doorPos(hk) : { x: 0, y: 0 };
  const us = expeditionUnits(g, e);
  us.forEach((u, i) => {
    u.away = undefined;
    u.hidden = false;
    u.state = 'idle';
    u.timer = 0;
    u.x = p.x + (i - us.length / 2) * 16;
    u.y = p.y + 22;
  });
  g.give(e.loot);
  fx(g, 'ring', p.x, p.y + 20, { r: 30, color: '#7fd8ff', life: 0.8 });
  const got = Object.keys(e.loot).length ? costLabel(e.loot) : 'nada';
  note(e, `De volta à vila! Trouxeram: ${got}.`);
  const tm = g.team(e.teamId);
  g.toast(`${e.kind === 'mine' ? '{pickaxe}' : '{map}'} ${tm?.name ?? 'A equipe'} voltou${e.kind === 'mine' ? ' da mina' : ''} com ${got}.`, 'good', p);
}

function lost(g: Game, e: Expedition) {
  e.status = 'lost';
  note(e, 'Ninguém voltou da mina.');
  g.toast('{skull} Uma expedição se perdeu na mina.', 'danger');
}

/** Usado pela força recomendada no painel: força atual da equipe. */
export const teamMinePower = (g: Game, teamId: number) => {
  const tm = g.team(teamId);
  return tm ? Math.round(teamUnits(g, tm).reduce((a, u) => a + unitPower(u), 0)) : 0;
};

/** Mesmo bloqueio para a mina (nome antigo usado pelo painel). */
export const mineBlock = teamBusy;
