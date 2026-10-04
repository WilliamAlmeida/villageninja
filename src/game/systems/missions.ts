// Execução das missões no mapa: a equipe designada recebe ordens automáticas
// (ir ao local, atacar alvos, coletar ervas, escoltar o mercador).
import { fx } from '../fx';
import type { Game } from '../game';
import { completeMission, failMission, generateOffers, spawnAmbush } from '../missions';
import { followPath, setDestination } from '../movement';
import { formationOffset, teamUnits } from '../teams';
import type { Command, Mission, Unit } from '../types';
import { doorPos, tileCenter } from '../world';

const ENGAGE_RANGE = 280;
/** Distância para colher uma erva (maior que a tolerância de reaproveitar ordens). */
const GATHER_RANGE = 46;
const SAME_POINT = 20;

export function missionSystem(g: Game, dt: number) {
  const s = g.state;
  // quadro renova a cada dia (se houver Mesa de Missões pronta)
  if (s.missionDay !== s.day && g.findBuilt('missions')) {
    const first = s.missionDay === 0;
    s.missionDay = s.day;
    generateOffers(g);
    if (!first) g.toast('{clipboard} Novas missões no quadro da Mesa de Missões.', 'info');
  }
  for (const m of s.missions) if (m.status === 'active') runMission(g, m, dt);
}

/** Dá uma ordem sem ficar repetindo a mesma (evita recalcular rotas toda hora). */
function command(u: Unit, c: Command) {
  const cur = u.command;
  if (cur?.kind === 'retreat') return; // o jogador mandou recuar: respeita
  if (c.kind === 'attack' && cur?.kind === 'attack' && cur.targetId === c.targetId) return;
  if (c.kind === 'move' && cur?.kind === 'move' && Math.hypot(cur.x - c.x, cur.y - c.y) < SAME_POINT) {
    cur.time = Math.max(cur.time, 30);
    return;
  }
  u.command = c;
  u.hidden = false;
  if (c.kind === 'move') {
    u.state = 'idle';
    u.hasGoal = false;
  }
}

const alive = (g: Game, ids: number[]) => ids.map((id) => g.unit(id)).filter((u): u is Unit => !!u && !u.dead);

function nearest(us: Unit[], x: number, y: number) {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of us) {
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return { u: best, d: bd };
}

/** Ataca o alvo mais próximo se estiver perto; senão vai até o ponto em formação. */
function fightOrGo(team: Unit[], targets: Unit[], x: number, y: number) {
  team.forEach((u, i) => {
    const t = nearest(targets.filter((e) => !e.hidden), u.x, u.y);
    if (t.u && t.d < ENGAGE_RANGE) command(u, { kind: 'attack', targetId: t.u.id });
    else {
      const o = i === 0 ? { x: 0, y: 0 } : formationOffset(i - 1);
      command(u, { kind: 'move', x: x + o.x, y: y + o.y, time: 60 });
    }
  });
}

function runMission(g: Game, m: Mission, dt: number) {
  const team = g.team(m.teamId);
  const members = team ? teamUnits(g, team) : [];
  if (!members.length) return failMission(g, m, 'A equipe foi derrotada');
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) return failMission(g, m, 'Tempo esgotado');

  switch (m.type) {
    case 'hunt':
    case 'camp':
    case 'wanted': {
      const targets = alive(g, m.targetIds);
      m.progress = m.goal - targets.length;
      if (!targets.length) return completeMission(g, m);
      const focus = nearest(targets, m.x, m.y).u!;
      fightOrGo(members, targets, focus.x, focus.y);
      break;
    }
    case 'herbs': {
      const herbs = m.nodeIds.map((id) => g.node(id)).filter((n) => !!n);
      m.progress = m.goal - herbs.length;
      if (!herbs.length) return completeMission(g, m);
      const lead = members[0]!;
      let herb = herbs[0]!;
      let hd = Infinity;
      for (const n of herbs) {
        const d = Math.hypot(tileCenter(n.tx) - lead.x, tileCenter(n.ty) - lead.y);
        if (d < hd) {
          hd = d;
          herb = n;
        }
      }
      const hx = tileCenter(herb.tx);
      const hy = tileCenter(herb.ty);
      const guards = g.state.units.filter((u) => !u.dead && u.missionId === m.id && u.faction !== 'village');
      fightOrGo(members, guards, hx, hy);
      // quem estiver ao lado da erva colhe
      if (members.some((u) => Math.hypot(u.x - hx, u.y - hy) < GATHER_RANGE)) {
        herb.amount -= dt;
        if (Math.random() < dt * 3) fx(g, 'chips', hx, hy, { color: '#7dff9a', life: 0.4 });
        if (herb.amount <= 0) {
          g.removeNode(herb.id);
          fx(g, 'heal', hx, hy, { r: 14, color: '#7dff9a', life: 0.7 });
        }
      }
      break;
    }
    case 'escort':
      runEscort(g, m, members, dt);
      break;
  }
}

function runEscort(g: Game, m: Mission, members: Unit[], dt: number) {
  const merchant = g.unit(m.targetIds[0]);
  if (!merchant || merchant.dead) return failMission(g, m, 'O mercador foi morto');
  const bandits = alive(g, m.targetIds.slice(1));
  const hk = g.hokage();
  if (!hk) return;

  if (m.phase === 'meet') {
    fightOrGo(members, bandits, merchant.x, merchant.y + 20);
    if (members.some((u) => Math.hypot(u.x - merchant.x, u.y - merchant.y) < 70)) {
      const p = doorPos(hk);
      if (setDestination(g, merchant, p.x, p.y + 10)) {
        m.phase = 'travel';
        m.goal = Math.max(1, merchant.path.length);
        merchant.state = 'escort';
        g.toast(`{cart} ${merchant.name}: "Obrigado! Vamos para a vila."`, 'info', merchant);
      }
    }
    return;
  }

  // viagem: o mercador para quando há bandidos por perto
  const danger = bandits.some((b) => Math.hypot(b.x - merchant.x, b.y - merchant.y) < 200);
  merchant.state = danger ? 'cower' : 'escort';
  if (!danger) {
    if (followPath(g, merchant, dt)) {
      merchant.dead = true; // entrou na vila e foi embora feliz
      return completeMission(g, m);
    }
  } else merchant.moving = false;
  m.progress = Math.min(m.goal, m.goal - merchant.path.length);
  if (m.phase === 'travel' && m.progress >= m.goal * 0.35) {
    m.phase = 'ambushed';
    spawnAmbush(g, m, merchant);
  }
  // a equipe acompanha o mercador e ataca quem chegar perto dele
  const threats = bandits.filter((b) => Math.hypot(b.x - merchant.x, b.y - merchant.y) < ENGAGE_RANGE + 60);
  fightOrGo(members, threats, merchant.x, merchant.y + 16);
}
