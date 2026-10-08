// Mapa da região: cada ação (comerciar, proteger, saquear, anexar, explorar ilha, posto avançado, treinar, contrato)
// é uma expedição — a equipe sai do mapa, faz o serviço e volta. Também cuida dos efeitos diários (tributos, postos,
// vingança dos saqueados, ninjas errantes atraídos pela honra).
import { chance, pick } from '../core/rng';
import { CONTRACTS } from '../data/contracts';
import { STAT_KEYS } from '../data/ninja';
import {
  ACTION_LABEL, ACTION_TIME, ANNEX_COST, FAME, OUTPOST_COST, REGION, REGION_NODES, REL, type RegionAction, type RegionNodeDef,
} from '../data/region';
import { costLabel, RES_KEYS } from '../data/resources';
import { ORG, ORG_LAIR } from '../data/org';
import { createNinja, createVillager } from './entities';
import { expeditionUnits, teamBusy, unitPower } from './expeditions';
import type { Game } from './game';
import { addStat, gainXp } from './progression';
import { spawnRaid } from './systems/spawner';
import { teamUnits } from './teams';
import type { Cost, Expedition, GameState, RegionState, Unit } from './types';
import { refreshDerived } from './entities';
import { grantBlade } from './blades';
import { rescueCaptive } from './sound';
import { edgePoint } from './systems/spawner';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Missão secreta da ANBU: bônus de furtividade e fração do saque que trazem. */
export const COVERT = { stealth: 1.6, loot: 0.5 };

export const newRegion = (): Record<string, RegionState> =>
  Object.fromEntries(REGION_NODES.map((n) => [n.id, { rel: 0, status: 'neutral' as const }]));

export const regionOf = (s: GameState, id: string): RegionState => (s.region[id] ??= { rel: 0, status: 'neutral' });

/** Bônus da honra nas trocas (até +30%) e da infâmia nos saques (até +50%). */
export const honorBonus = (s: GameState) => Math.min(0.3, s.honor / 100);
export const infamyBonus = (s: GameState) => Math.min(0.5, s.infamy / 60);

/** Força das defesas do lugar (vilarejo saqueado fica mais preparado). */
export const nodePower = (s: GameState, def: RegionNodeDef) => Math.round(def.power * (regionOf(s, def.id).status === 'hostile' ? 1.3 : 1));

/** Ações possíveis num lugar (mesmo as que ainda não dá para fazer, que o painel mostra com o motivo). */
export function nodeActions(def: RegionNodeDef): RegionAction[] {
  if (def.kind === 'village') return ['trade', 'protect', 'raid', 'annex'];
  if (def.kind === 'island') return def.id === 'templos' ? ['explore', 'outpost', 'train'] : ['explore', 'outpost'];
  if (def.kind === 'hideout') return def.id === 'som' ? ['rescue'] : ['assault'];
  return ['contract'];
}

/** Custo pago na hora de partir. */
export function actionCost(def: RegionNodeDef, action: RegionAction): Cost | undefined {
  if (action === 'trade') return def.trade?.give;
  if (action === 'outpost') return OUTPOST_COST;
  if (action === 'annex') return ANNEX_COST;
  return undefined;
}

/** Por que a ação não dá agora (null = pode). Não inclui a equipe. */
export function actionBlock(g: Game, nodeId: string, action: RegionAction): string | null {
  const def = REGION[nodeId];
  if (!def) return 'Lugar desconhecido.';
  const st = regionOf(g.state, nodeId);
  if (def.kind === 'hideout' && def.id === 'som') {
    if (!g.state.sound.captive) return 'Ninguém da vila está preso lá.';
    if (g.state.scene) return 'Já há um mapa de missão em andamento.';
    return null;
  }
  if (def.kind === 'hideout') {
    if (!g.state.org.lairKnown) return 'Ninguém sabe onde fica.';
    if (g.state.org.done) return 'A Ordem do Eclipse já foi destruída.';
    if (g.state.scene) return 'Já há um mapa de missão em andamento.';
    return null;
  }
  if (def.kind !== 'village' && !g.findBuilt('port')) return 'Precisa de um Porto para chegar às ilhas.';
  switch (action) {
    case 'trade':
      if (st.status === 'hostile') return 'O vilarejo está hostil depois do saque. Espere a raiva passar.';
      break;
    case 'protect':
      if (st.status === 'vassal') return 'Já é vassalo da vila (protegido para sempre).';
      if (st.status === 'hostile') return 'Eles não aceitam proteção de quem os saqueou.';
      break;
    case 'raid':
      if (st.status === 'vassal') return 'É vassalo da vila: saquear seria atacar a própria gente.';
      break;
    case 'annex':
      if (st.status === 'vassal') return 'Já foi anexado.';
      if (st.rel < REL.annexPeace && st.rel > REL.annexForce)
        return `Precisa de relação ${REL.annexPeace}+ (anexar em paz, protegendo e comerciando) ou ${REL.annexForce} ou menos (à força, saqueando).`;
      break;
    case 'outpost':
      if (!st.explored) return 'Explore a ilha primeiro.';
      if (st.outpost) return 'A ilha já tem um posto avançado.';
      break;
    case 'explore':
      if (st.explored) return 'A ilha já foi explorada.';
      break;
    case 'train':
      if (!st.explored) return 'Explore a ilha primeiro.';
      break;
  }
  return null;
}

/** ANBU livres para uma missão secreta (na vila, sem lutar, com vida). */
export const covertAgents = (g: Game) =>
  g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.ninja?.anbu && u.away == null && !u.origin && u.combatTimer <= 0 && u.hp >= u.maxHp * 0.5);

/** Por que a missão secreta não dá agora (null = pode). */
export function covertBlock(g: Game, nodeId: string): string | null {
  const def = REGION[nodeId];
  if (!def || def.kind !== 'village') return 'Missão secreta só em vilarejos.';
  if (regionOf(g.state, nodeId).status === 'vassal') return 'É vassalo da vila.';
  if (g.state.expeditions.some((e) => e.action === 'covert' && e.status !== 'done' && e.status !== 'lost')) return 'A ANBU já está numa missão secreta.';
  if (!covertAgents(g).length) return 'Nenhum ANBU livre (fora de luta e com mais de meia vida).';
  return null;
}

/**
 * Missão secreta: os ANBU livres (até 4) se infiltram no vilarejo e trazem parte do que um saque traria, sem infâmia
 * e sem estragar a relação — se não forem descobertos (força contra as defesas, com bônus de furtividade).
 */
export function startCovert(g: Game, nodeId: string): Result {
  const why = covertBlock(g, nodeId);
  if (why) return fail(why);
  const def = REGION[nodeId]!;
  const us = covertAgents(g).slice(0, 4);
  const e: Expedition = {
    id: g.newId(), kind: 'region', node: nodeId, action: 'covert', teamId: -1, unitIds: us.map((u) => u.id), floor: 0,
    timer: ACTION_TIME.covert.travel, status: 'going', log: [`A ANBU partiu em segredo para ${def.name}.`], loot: {}, day: g.state.day,
  };
  g.state.expeditions.push(e);
  for (const u of us) {
    u.away = e.id;
    u.hidden = true;
    u.cloak = false;
    u.command = null;
    u.targetId = null;
    u.moving = false;
    u.hasGoal = false;
    u.state = 'away';
  }
  g.toast(`{eye} A ANBU (${us.length}) partiu em missão secreta para ${def.name}.`, 'info');
  return { ok: true };
}

/** Manda a equipe fazer a ação (paga o custo na hora). */
export function startRegion(g: Game, teamId: number, nodeId: string, action: RegionAction): Result {
  const def = REGION[nodeId];
  if (!def || !nodeActions(def).includes(action)) return fail('Ação inválida.');
  const why = actionBlock(g, nodeId, action) ?? teamBusy(g, teamId);
  if (why) return fail(why);
  const cost = actionCost(def, action);
  if (cost && !g.pay(cost)) return fail('Recursos insuficientes.');
  const tm = g.team(teamId)!;
  const us = teamUnits(g, tm);
  const e: Expedition = {
    id: g.newId(), kind: 'region', node: nodeId, action, teamId, unitIds: us.map((u) => u.id), floor: 0,
    timer: ACTION_TIME[action].travel, status: 'going', log: [`${tm.name} partiu: ${ACTION_LABEL[action]} em ${def.name}.`], loot: {}, day: g.state.day,
  };
  g.state.expeditions.push(e);
  for (const u of us) {
    u.away = e.id;
    u.hidden = true;
    u.command = null;
    u.targetId = null;
    u.moving = false;
    u.hasGoal = false;
    u.state = 'away';
  }
  g.toast(`{map} ${tm.name} partiu: ${ACTION_LABEL[action]} em ${def.name}.`, 'info');
  return { ok: true };
}

const add = (to: Cost, c: Cost | undefined, mult = 1) => {
  if (c) for (const k of RES_KEYS) if (c[k]) to[k] = (to[k] ?? 0) + Math.round(c[k]! * mult);
};
const hurtAll = (us: Unit[], frac: number) => {
  for (const u of us) u.hp = Math.max(1, u.hp - u.maxHp * frac);
};
const clampRel = (st: RegionState) => (st.rel = Math.max(-100, Math.min(100, st.rel)));

/** A equipe chegou e fez o serviço: aplica o resultado. Retorna o texto para o diário. */
export function resolveRegion(g: Game, e: Expedition, outcome?: 'win' | 'lose' | 'retreat'): string {
  const s = g.state;
  const def = REGION[e.node!]!;
  const st = regionOf(s, def.id);
  const us = expeditionUnits(g, e);
  const power = us.reduce((a, u) => a + unitPower(u), 0);
  const ratio = power / Math.max(1, nodePower(s, def));
  for (const u of us) gainXp(g, u, 12);
  // veio de um mapa jogável: o resultado é o da luta (os ferimentos já aconteceram lá)
  const played = outcome != null;
  const hurt = (list: Unit[], frac: number) => !played && hurtAll(list, frac);
  let text = '';
  switch (e.action) {
    case 'trade':
      add(e.loot, def.trade?.get, 1 + honorBonus(s));
      st.rel += 6;
      s.honor += 1;
      text = `Troca feita com ${def.name}: ${costLabel(e.loot)}.`;
      break;
    case 'protect':
      if (ratio >= 0.6) {
        hurt(us, 0.12);
        st.rel += 20;
        s.honor += 3;
        if (st.rel >= REL.protected && st.status === 'neutral') st.status = 'protected';
        text = `Defenderam ${def.name} de bandidos. Relação ${st.rel}.${st.status === 'protected' ? ' Agora é protegido e manda tributo todo dia.' : ''}`;
      } else {
        hurt(us, 0.35);
        st.rel += 5;
        text = `Os bandidos de ${def.name} eram fortes demais; a equipe recuou ferida.`;
      }
      break;
    case 'raid':
      if (played ? outcome === 'win' : ratio >= 1) {
        add(e.loot, def.loot, Math.min(1.3, ratio) * (1 + infamyBonus(s)));
        hurt(us, 0.15);
        st.rel -= 45;
        st.status = 'hostile';
        st.revengeDay = s.day + 1 + Math.floor(Math.random() * 2);
        s.infamy += 5;
        text = `Saquearam ${def.name}: ${costLabel(e.loot)}. Eles juraram vingança.`;
      } else {
        hurt(us, 0.4);
        st.rel -= 20;
        s.infamy += 2;
        text = outcome === 'retreat' ? `A equipe recuou de ${def.name} sem o saque.` : `O saque a ${def.name} fracassou: as defesas eram fortes demais.`;
      }
      break;
    case 'rescue':
      text = outcome === 'win' ? rescueCaptive(g) : outcome === 'retreat' ? 'A equipe recuou do esconderijo.' : 'O esconderijo resistiu. O raptado continua lá.';
      if (outcome === 'win') g.toast(`{crown} ${text}`, 'good');
      break;
    case 'covert':
      // furtividade da ANBU: conta 1,6× a força contra as defesas
      if (ratio * COVERT.stealth >= 1) {
        add(e.loot, def.loot, COVERT.loot);
        hurt(us, 0.08);
        for (const u of us) gainXp(g, u, 30);
        text = `Missão secreta em ${def.name}: ninguém viu nada. Trouxeram ${costLabel(e.loot)}.`;
      } else {
        hurt(us, 0.3);
        st.rel -= 25;
        s.infamy += 3;
        text = `A ANBU foi descoberta em ${def.name} e fugiu ferida. Eles desconfiam da vila agora.`;
      }
      break;
    case 'annex':
      if (st.rel >= REL.annexPeace) {
        st.status = 'vassal';
        s.honor += 6;
        text = `${def.name} aceitou se unir à vila! Tributo dobrado e novos moradores.`;
        immigrants(g, 2);
      } else if (played ? outcome === 'win' : ratio >= 1.2) {
        st.status = 'vassal';
        st.rel = Math.max(st.rel, -30);
        s.infamy += 6;
        hurt(us, 0.2);
        text = `${def.name} foi dominado à força e virou vassalo.`;
        immigrants(g, 1);
      } else {
        hurt(us, 0.4);
        text = `${def.name} resistiu à anexação.`;
      }
      break;
    case 'explore':
      if (played ? outcome === 'win' : ratio >= 0.8) {
        st.explored = true;
        add(e.loot, def.outpost, 3);
        hurt(us, 0.12);
        text = `Exploraram ${def.name} e trouxeram amostras: ${costLabel(e.loot)}. Já dá para montar um posto avançado.`;
        // nas crateras da Ilha Vulcânica: as sete espadas de um ferreiro eremita
        if (def.id === 'vulcao' && grantBlade(g, 'bee', `Nas crateras de ${def.name}`)) text += ' Nas crateras acharam as Sete espadas de um ferreiro eremita!';
      } else {
        hurt(us, 0.35);
        text = `${def.name} é perigosa demais para esta equipe.`;
      }
      break;
    case 'outpost':
      st.outpost = true;
      text = `Posto avançado montado em ${def.name}: produz ${costLabel(def.outpost ?? {})} por dia.`;
      break;
    case 'train':
      for (const u of us) {
        gainXp(g, u, 70);
        for (let i = 0; i < 2; i++) addStat(u, pick(STAT_KEYS), 0.4);
        refreshDerived(u);
      }
      text = 'Treinaram com os monges do templo: muita experiência e atributos.';
      break;
    case 'assault':
      if (outcome === 'win') {
        s.org.done = true;
        s.org.wins = (s.org.wins ?? 0) + 1;
        s.org.nextDay = s.day + ORG.restDays; // some por um tempo e depois se reergue
        for (const id of ORG_LAIR) if (!s.org.down.includes(id)) s.org.down.push(id);
        add(e.loot, ORG.finalReward);
        s.honor += 20;
        s.reputation += 30;
        text = `A ${ORG.name} foi destruída! O líder caiu e o covil foi saqueado: ${costLabel(e.loot)}.`;
        g.toast(`{crown} A ${ORG.name} foi destruída! A vila é lendária.`, 'good');
      } else text = outcome === 'retreat' ? 'A equipe recuou do covil.' : 'O covil resistiu. O líder ainda espera lá dentro.';
      break;
    case 'contract': {
      const kind = def.contract!;
      if (played ? outcome === 'win' : ratio >= 1) {
        const best = us.filter((u) => !u.ninja!.contract).sort((a, b) => unitPower(b) - unitPower(a))[0];
        hurt(us, 0.2);
        if (best) {
          best.ninja!.contract = kind;
          text = `${best.name} fez o contrato: ${CONTRACTS[kind].name}! Agora invoca em combate.`;
          g.toast(`{scroll} ${best.name} ganhou o contrato de invocação: ${CONTRACTS[kind].name}!`, 'good');
        } else text = 'Todos da equipe já têm contrato.';
      } else {
        hurt(us, 0.35);
        text = `Os guardiões de ${def.name} venceram o teste. Tentem com uma equipe mais forte.`;
      }
      break;
    }
  }
  clampRel(st);
  return text;
}

/** Moradores de um vilarejo anexado vêm morar na vila. */
function immigrants(g: Game, n: number) {
  const hk = g.hokage();
  if (!hk) return;
  for (let i = 0; i < n; i++) {
    const p = edgePoint(g);
    const v = createVillager(g, p.x, p.y);
    v.state = 'idle';
  }
  g.toast(`{users} ${n} morador(es) do vilarejo anexado chegaram à vila.`, 'good');
}

/** Virada do dia: tributos, postos avançados, vinganças e ninjas errantes. */
export function regionDaily(g: Game) {
  const s = g.state;
  const income: Cost = {};
  for (const def of REGION_NODES) {
    if (def.kind === 'hideout') continue;
    const st = regionOf(s, def.id);
    if (st.status === 'protected') add(income, def.tribute);
    if (st.status === 'vassal') add(income, def.tribute, 2);
    if (st.outpost) add(income, def.outpost);
    if (st.status === 'hostile') {
      if (st.revengeDay != null && s.day >= st.revengeDay) {
        st.revengeDay = undefined;
        spawnRaid(g, 2, `{swords} ${def.name} veio se vingar do saque!`);
      }
      st.rel += 6;
      if (st.rel > -20) st.status = 'neutral';
    }
    clampRel(st);
  }
  if (Object.keys(income).length) {
    g.give(income);
    g.toast(`{map} Tributos e postos avançados: ${costLabel(income)}.`, 'good');
  }
  // a honra atrai ninjas errantes que pedem para entrar na vila
  if (s.honor >= FAME.wanderer && chance(0.35) && g.population() < g.popCap()) {
    const p = edgePoint(g);
    const n = createNinja(g, p.x, p.y, chance(0.3) ? 'chunin' : 'genin');
    g.toast(`{ninja} A fama da vila atraiu um ninja errante: ${n.name} pediu para entrar e foi aceito!`, 'good', p);
  }
}
