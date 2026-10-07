// A Ordem do Eclipse: aparições em duplas, caça aos ninjas mais fortes, técnicas próprias de cada membro e o fim.
import { rand, randi } from '../core/rng';
import { STAT_KEYS } from '../data/ninja';
import { ORG, ORG_LAIR, ORG_MEMBERS, ORG_PAIRS, type OrgMemberId } from '../data/org';
import { costLabel } from '../data/resources';
import { applyDamage, areaDamage, engage } from './combat';
import { createAnimal, createRogue, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { chase, push, setDestination } from './movement';
import type { GameState, Unit } from './types';
import { edgePoint } from './systems/spawner';

export interface OrgState {
  /** Membros já derrotados (não voltam). */
  down: OrgMemberId[];
  /** Dia da próxima aparição (0 = ainda não agendada). */
  nextDay: number;
  /** O covil já apareceu no mapa da região. */
  lairKnown: boolean;
  /** A Ordem foi destruída. */
  done: boolean;
}

export const newOrg = (): OrgState => ({ down: [], nextDay: 0, lairKnown: false, done: false });

/** Próxima dupla com alguém de pé (null = as três já caíram). */
export const nextPair = (s: GameState) => ORG_PAIRS.find((p) => p.some((id) => !s.org.down.includes(id))) ?? null;
/** Membros da Ordem vivos no mapa agora. */
export const orgOnMap = (g: Game) => g.state.units.filter((u) => !u.dead && u.org);

/** Cria um membro da Ordem (renegado lendário com a técnica própria). */
export function createOrgMember(g: Game, id: OrgMemberId, x: number, y: number): Unit {
  const d = ORG_MEMBERS[id];
  const u = createRogue(g, x, y, g.state.day, { rank: 'jounin', stats: d.stats, hpMult: d.hpMult, jutsu: 2, name: `${d.name}, ${d.title}` });
  u.org = id;
  u.boss = true;
  u.ninja!.nature = d.nature;
  u.ninja!.jutsu = [...d.jutsu];
  u.ninja!.level = 30;
  u.look = { ...u.look, cloth: '#15151c' };
  u.abilityCd = d.cd * 0.5;
  // lendários: atributos quase no máximo e vida que cresce com a força da vila (quanto mais Jounins, mais duros)
  for (const k of STAT_KEYS) u.ninja!.stats[k] = Math.min(10, d.stats * 2.5 + rand(0, 1.5));
  refreshDerived(u);
  const elite = g.state.units.filter((o) => !o.dead && o.faction === 'village' && o.ninja && (o.ninja.rank === 'jounin' || o.ninja.rank === 'kage')).length;
  u.maxHp = Math.round(u.maxHp * d.hpMult * Math.min(3, 1 + elite * 0.12));
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  return u;
}

/** Na vila: agenda e manda a próxima dupla (Vila Oculta em diante). */
export function orgTick(g: Game) {
  const s = g.state;
  if (s.org.done || s.level < ORG.minVillage || s.sceneInfo) return;
  if (!s.org.nextDay) s.org.nextDay = s.day + 2;
  if (s.day < s.org.nextDay || orgOnMap(g).length) return;
  const pair = nextPair(s);
  if (!pair) return;
  s.org.nextDay = s.day + randi(ORG.every[0], ORG.every[1]);
  const p = edgePoint(g);
  const names: string[] = [];
  pair.forEach((id, i) => {
    if (s.org.down.includes(id)) return;
    const u = createOrgMember(g, id, p.x + i * 24, p.y);
    u.life = ORG.hunt; // tempo de caça (o `timer` é da marcha dos renegados)
    fx(g, 'smoke', u.x, u.y, { r: 20, life: 0.8, color: '#5a1a22' });
    names.push(ORG_MEMBERS[id].name);
  });
  s.flags.raidActive = true;
  g.toast(`{skull} A ${ORG.name} chegou: ${names.join(' e ')}! Eles caçam os seus ninjas mais fortes.`, 'danger', p);
}

/** Alvo da caça: o ninja da vila de nível mais alto à vista. */
function prey(g: Game): Unit | null {
  let best: Unit | null = null;
  for (const o of g.state.units) {
    if (o.dead || o.hidden || o.faction !== 'village' || o.kind !== 'ninja') continue;
    if (!best || o.ninja!.level > best.ninja!.level) best = o;
  }
  return best;
}

/**
 * IA de um membro da Ordem. Na vila: caça o ninja mais forte e, passado o tempo da caça, recua (volta mais tarde).
 * No covil: defende o lugar. A técnica própria sai quando a recarga permite. Retorna true se controlou a unidade.
 */
export function orgBrain(g: Game, u: Unit, dt: number): boolean {
  if (!u.org) return false;
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  if (u.state === 'escape') return false; // a fuga segue o caminho normal de quem escapa
  const inLair = !!g.state.sceneInfo;
  u.life = (u.life ?? ORG.hunt) - dt;
  if (!inLair && u.life <= 0) {
    u.state = 'escape';
    const p = edgePoint(g);
    setDestination(g, u, p.x, p.y);
    g.toast(`{run} ${ORG_MEMBERS[u.org].name} recuou… a ${ORG.name} vai voltar.`, 'warn', u);
    return true;
  }
  const near = g.nearestHostile(u, inLair ? 260 : 200);
  const t = near ?? (inLair ? null : prey(g));
  if (!t) return inLair; // no covil, espera; na vila, segue o comportamento de renegado
  if (u.abilityCd <= 0 && Math.hypot(t.x - u.x, t.y - u.y) < 180 && orgArt(g, u, t)) {
    u.abilityCd = ORG_MEMBERS[u.org].cd;
    return true;
  }
  if (near) engage(g, u, t, dt);
  else chase(g, u, t.x, t.y, dt, 40);
  return true;
}

/** Técnica do membro (exportada para o laboratório de jutsus). */
export function orgArt(g: Game, u: Unit, t: Unit): boolean {
  const id = u.org!;
  const d = ORG_MEMBERS[id];
  const shout = () => fxText(g, u.x, u.y - 34, `${d.art}!`, '#ff5a6a', true);
  switch (id) {
    case 'goen':
      shout();
      fx(g, 'beam', u.x, u.y - 12, { x2: t.x, y2: t.y - 6, color: '#ff8a2b', life: 0.3, vfx: 'fire' });
      fx(g, 'burst', t.x, t.y, { r: 60, color: '#ff6a2b', life: 0.6, vfx: 'fire' });
      areaDamage(g, u, u.faction, t.x, t.y, 60, 20, 'katon', 30);
      return true;
    case 'tetsuo':
      if (Math.hypot(t.x - u.x, t.y - u.y) > 40) return false;
      shout();
      fx(g, 'burst', t.x, t.y, { r: 26, color: '#9aa4b0', life: 0.4, vfx: 'metal' });
      fx(g, 'hit', t.x, t.y - 8, { r: 20, color: '#c8d0d8', life: 0.35, vfx: 'metal' });
      applyDamage(g, u, t, 38, null, { knock: 70, stun: 1 });
      return true;
    case 'mizuchi':
      shout();
      fx(g, 'burst', t.x, t.y - 8, { r: 22, color: '#4da6ff', life: 0.5, vfx: 'water' });
      t.stun = Math.max(t.stun, 3);
      t.stunVfx = 'water'; // bolha d'água em volta do preso
      t.chakra = Math.max(0, t.chakra * 0.5);
      return true;
    case 'raiga':
      shout();
      u.dash = { targetId: t.id, t: 1, power: 42, nature: 'raiton', color: '#9fd8ff', lx: u.x, ly: u.y, trail: 0, vfx: 'lightning' };
      return true;
    case 'kagero': {
      shout();
      fx(g, 'wave', u.x, u.y, { r: 150, color: '#b36bff', life: 0.9, vfx: 'genjutsu' }); // a miragem se espalha
      let n = 0;
      for (const o of g.state.units)
        if (!o.dead && !o.hidden && o.faction === 'village' && o.ninja && Math.hypot(o.x - u.x, o.y - u.y) < 150) {
          o.stun = Math.max(o.stun, 2);
          o.stunVfx = 'genjutsu';
          n++;
        }
      return n > 0;
    }
    case 'shiryo': {
      shout();
      for (let i = 0; i < 3; i++) {
        const m = createRogue(g, u.x + (i - 1) * 22, u.y + 18, g.state.day, { rank: 'chunin', stats: 1, jutsu: 0, name: 'Morto-vivo' });
        m.role = 'puppet'; // segue o necromante e desmorona se ele cair (como as marionetes)
        m.ownerId = u.id;
        m.look = { ...m.look, skin: '#9aa39a', cloth: '#3a3a3a' };
        fx(g, 'smoke', m.x, m.y, { r: 14, life: 0.6, color: '#6a6a6a' });
        fx(g, 'burst', m.x, m.y + 6, { r: 12, color: '#5a2a8a', life: 0.5, vfx: 'dark' });
      }
      return true;
    }
    case 'tsuchigumo':
      shout();
      for (const dx of [-26, 26]) {
        const sp = createAnimal(g, 'spider', u.x + dx, u.y + 16);
        sp.missionId = g.state.sceneInfo ? -1 : undefined;
        sp.homeX = sp.x;
        sp.homeY = sp.y;
        fx(g, 'burst', sp.x, sp.y, { r: 16, color: '#ffffff', life: 0.5, vfx: 'web' });
      }
      u.shield = 6;
      u.shieldVfx = 'web';
      return true;
    case 'yomi': {
      shout();
      fx(g, 'wave', u.x, u.y, { r: 160, color: '#c8a6ff', life: 0.7 }); // onda de choque
      fx(g, 'burst', u.x, u.y, { r: 30, color: '#c8a6ff', life: 0.4, vfx: 'storm' });
      for (const o of g.state.units) {
        if (o.dead || o.hidden || o.faction !== 'village') continue;
        const dd = Math.hypot(o.x - u.x, o.y - u.y);
        if (dd > 160 || dd < 1) continue;
        applyDamage(g, u, o, 26, null, {});
        push(g, o, ((o.x - u.x) / dd) * 90, ((o.y - u.y) / dd) * 90);
      }
      return true;
    }
  }
}

/** Membro caiu: não volta; recompensa; caídas as três duplas, o covil aparece no mapa da região. */
export function orgMemberDown(g: Game, u: Unit) {
  const s = g.state;
  const id = u.org!;
  if (!s.org.down.includes(id)) s.org.down.push(id);
  if (s.sceneInfo) return; // no covil o resultado vem pela invasão
  g.give(ORG.memberReward);
  g.toast(`{crown} ${ORG_MEMBERS[id].name} da ${ORG.name} caiu! +${costLabel(ORG.memberReward)}. Ele não volta mais.`, 'good', u);
  if (!nextPair(s) && !s.org.lairKnown) {
    s.org.lairKnown = true;
    g.toast(`{map} Seguindo o rastro das duplas, a vila descobriu o covil da ${ORG.name}! Veja no mapa da região (Mundo).`, 'good');
  }
}

/**
 * Preparar defesa (botão da Ordem na aba Kage): ninjas livres na vila (fora de missão, expedição e mapa de missão)
 * passam a patrulhar e os novatos se abrigam de inimigos fortes demais. Devolve quantos foram chamados.
 */
export function prepareDefense(g: Game): { ok: true; count: number } | { ok: false; error: string } {
  const onMission = new Set(g.state.missions.filter((m) => m.status === 'active').map((m) => m.teamId));
  let count = 0;
  for (const u of g.state.units) {
    if (u.dead || u.kind !== 'ninja' || u.faction !== 'village' || u.away != null || !u.ninja) continue;
    const team = g.state.teams.find((t) => t.memberIds.includes(u.id) || t.senseiId === u.id);
    if (team && onMission.has(team.id)) continue;
    u.ninja.order = 'patrol';
    if (u.state !== 'fight' && u.state !== 'learn' && u.state !== 'toLearn' && u.state !== 'rest') {
      u.state = 'idle';
      u.timer = 0;
      u.hidden = false;
    }
    count++;
  }
  if (!count) return { ok: false, error: 'Nenhum ninja livre na vila para patrulhar.' };
  g.state.flags.shelterRookies = true;
  g.toast(`{shield} Defesa preparada: ${count} ninja(s) patrulhando e novatos protegidos.`, 'good');
  return { ok: true, count };
}

/** Membros que guardam o covil (os que ainda estão de pé). */
export const lairGuards = (s: GameState) => ORG_LAIR.filter((id) => !s.org.down.includes(id));
