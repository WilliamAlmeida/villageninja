// Colônias nas ilhas (docs/gdd-escala-ilhas-pvp.md, seção 5): cada colônia é um `GameState` pequeno (48×48, molde das
// cenas) guardado em `state.colonies[ilha]` da vila. Na tela ela roda em detalhe (systems/colonies.ts, no mesmo relógio
// da vila); fora dela, um resumo por dia credita a produção, cobra a comida, termina as obras e sorteia uma ameaça.
// O tesouro é o da vila: `res` e `items` da colônia são o mesmo objeto (religados ao carregar o save).
import { DAY_LENGTH, FOOD_PER_DAY } from '../config';
import { chance, mulberry32, rand } from '../core/rng';
import { BUILDINGS, defOf } from '../data/buildings';
import { COLONY, COLONY_YIELD, ISLAND_THEME } from '../data/colonies';
import { REGION } from '../data/region';
import { costLabel, RES_KEYS } from '../data/resources';
import { createAnimal } from './entities';
import { unitPower } from './expeditions';
import type { Game } from './game';
import { Game as GameClass } from './game';
import { birthMult, foodMult } from './mood';
import { missionOfTeam } from './missions';
import { recordFallen } from './memorial';
import { baseState } from './newGame';
import { gainXp } from './progression';
import { actionBlock, nodePower, regionOf } from './region';
import { guard, ISLAND_FAUNA, placeBuilt, unstick } from './scene';
import { shoreSpot } from './commands';
import { COLONY_SYSTEMS } from './systems';
import { BIRTH_INTERVAL, births } from './systems/population';
import { completeBuilding } from './systems/villagers';
import { leaveTeam, teamOf } from './teams';
import type { Cost, Expedition, GameState, Unit } from './types';
import { marketYield, upgradeTime, workersOf, workUpgrade } from './upgrade';
import { fieldDailyYield } from './fields';
import { centerOf, doorPos, T, tileCenter } from './world';

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Quem o jogador escolheu mandar: quantos moradores (os sem emprego vão primeiro) e quais ninjas. */
export interface ColonyPicks {
  villagers: number;
  ninjaIds: number[];
}

const games = new WeakMap<GameState, Game>();

export const colonyIds = (s: GameState) => Object.keys(s.colonies ?? {});
export const colonyCount = (s: GameState) => colonyIds(s).length;
export const colonyState = (s: GameState, id: string): GameState | undefined => s.colonies?.[id];

/** Nome da ilha da colônia. */
export const colonyName = (id: string) => REGION[id]?.name ?? id;

/** Religa o tesouro da colônia ao da vila (o save guarda uma cópia; só a da vila vale). */
function link(home: Game, c: GameState) {
  if (c.res !== home.state.res) c.res = home.state.res;
  if (c.items !== home.state.items) c.items = home.state.items;
}

/** Jogo do mapa da colônia (criado sob demanda e guardado; o estado fica no save da vila). */
export function colonyGame(home: Game, id: string): Game | null {
  const c = colonyState(home.state, id);
  if (!c) return null;
  link(home, c);
  let g = games.get(c);
  if (!g) {
    g = new GameClass(c, COLONY_SYSTEMS);
    g.colonyId = id;
    games.set(c, g);
  }
  return g;
}

/** Gente viva da colônia (moradores e ninjas). */
export const colonyPeople = (c: GameState) => c.units.filter((u) => !u.dead && u.faction === 'village' && (u.kind === 'villager' || u.kind === 'ninja'));

// ------------------------------------------------------------------ fundar e mandar gente
/** Quem pode ir morar na colônia agora: moradores (os sem emprego primeiro) e ninjas livres. */
export function colonists(home: Game): { villagers: Unit[]; ninjas: Unit[] } {
  const s = home.state;
  const free = (u: Unit) => !u.dead && u.faction === 'village' && u.away == null && u.origin == null && u.missionId == null && u.arenaSide == null;
  const villagers = s.units.filter((u) => u.kind === 'villager' && free(u)).sort((a, b) => Number(a.jobId != null) - Number(b.jobId != null));
  const ninjas = s.units.filter((u) => {
    if (u.kind !== 'ninja' || !u.ninja || !free(u)) return false;
    if (u.id === s.kageId || u.ninja.anbu || u.ninja.sannin || u.onTower != null || u.cursed) return false;
    if (s.exam?.entrants.some((e) => e.id === u.id)) return false;
    if (s.units.some((d) => d.ownerId === u.id && !d.dead)) return false; // com cão: o ninken ficaria sem dono
    const tm = teamOf(home, u);
    return !tm || !missionOfTeam(home, tm.id);
  });
  return { villagers, ninjas };
}

/**
 * Manda gente para a ilha: funda a colônia (paga o custo e cria o mapa na hora; quem vai chega depois da viagem) ou
 * reforça a que já existe. Quem embarca sai da lista da vila e viaja dentro da expedição (`Expedition.passengers`).
 */
export function sendColonists(home: Game, nodeId: string, picks: ColonyPicks): Result {
  const def = REGION[nodeId];
  if (!def || def.kind !== 'island') return fail('Só ilhas recebem colônias.');
  const s = home.state;
  const st = regionOf(s, nodeId);
  const founding = !st.colony;
  if (founding) {
    const why = actionBlock(home, nodeId, 'colony');
    if (why) return fail(why);
  } else if (!home.findBuilt('port')) return fail('Precisa de um Porto para chegar às ilhas.');
  const { villagers, ninjas } = colonists(home);
  const want = Math.max(0, Math.floor(picks.villagers));
  if (want > villagers.length) return fail(`Só ${villagers.length} morador(es) podem ir agora.`);
  const ns = picks.ninjaIds.map((id) => ninjas.find((u) => u.id === id)).filter((u): u is Unit => !!u);
  if (ns.length !== picks.ninjaIds.length) return fail('Algum ninja escolhido não pode ir agora (Kage, ANBU, Sannin, em missão, com cão ou de vigia).');
  const going = [...villagers.slice(0, want), ...ns];
  if (!going.length) return fail('Escolha quem vai para a colônia.');
  const already = founding ? 0 : colonyPeople(colonyState(s, nodeId)!).length + travelling(home, nodeId);
  if (already + going.length > COLONY.popLimit) return fail(`A colônia comporta até ${COLONY.popLimit} pessoas.`);
  if (founding && !home.pay(COLONY.cost)) return fail('Recursos insuficientes.');
  if (founding) {
    s.colonies[nodeId] = createColony(home, nodeId);
    st.colony = true;
  }
  const e: Expedition = {
    id: home.newId(), kind: 'colony', node: nodeId, action: 'colony', teamId: -1, unitIds: [], passengers: [], floor: 0,
    timer: COLONY.travel, status: 'going', loot: {}, day: s.day,
    log: [founding ? `Colonos partiram para fundar a colônia em ${def.name}.` : `Colonos partiram para ${def.name}.`],
  };
  for (const u of going) e.passengers!.push(takeFromHome(home, u));
  s.expeditions.push(e);
  home.toast(`{ship} ${going.length} pessoa(s) partiram para ${founding ? 'fundar a colônia em' : 'a colônia de'} ${def.name}.`, 'info');
  return { ok: true };
}

// ------------------------------------------------------------------ voltar para a vila
/** Quem pode se mudar da colônia para a vila agora: moradores (os sem emprego primeiro) e ninjas fora de luta. */
export function homecomers(cg: Game): { villagers: Unit[]; ninjas: Unit[] } {
  const free = (u: Unit) => !u.dead && u.faction === 'village' && u.combatTimer <= 0 && u.onTower == null;
  const villagers = cg.state.units.filter((u) => u.kind === 'villager' && free(u)).sort((a, b) => Number(a.jobId != null) - Number(b.jobId != null));
  const ninjas = cg.state.units.filter((u) => u.kind === 'ninja' && !!u.ninja && free(u));
  return { villagers, ninjas };
}

/** Gente a caminho da vila vindo das colônias: total e quantos são ninjas. */
export function comingHome(home: Game) {
  let people = 0;
  let ninjas = 0;
  for (const e of home.state.expeditions)
    if (e.kind === 'colony' && e.toHome && e.status === 'going')
      for (const u of e.passengers ?? []) {
        people++;
        if (u.ninja) ninjas++;
      }
  return { people, ninjas };
}

/** Por que não dá para trazer `n` pessoas (`ns` ninjas) para a vila agora (null = dá). */
export function homeBlock(home: Game, n: number, ns: number): string | null {
  const coming = comingHome(home);
  const room = home.popCap() - home.population() - coming.people;
  if (n > room) return room > 0 ? `A vila só tem ${room} vaga(s) de moradia agora.` : 'A vila não tem vaga de moradia: construa ou melhore casas.';
  const nroom = home.ninjaCap() - home.ninjaCount() - coming.ninjas;
  if (ns > nroom) return nroom > 0 ? `A vila só cabe mais ${nroom} ninja(s) neste nível.` : `A vila já está no teto de ${home.ninjaCap()} ninjas deste nível.`;
  return null;
}

/**
 * Muda gente da colônia para a vila (o caminho inverso de `sendColonists`): saem da colônia na hora, viajam dentro da
 * expedição e desembarcam no Porto da vila. Respeita as vagas de moradia e o teto de ninjas da vila.
 */
export function sendHome(home: Game, id: string, picks: ColonyPicks): Result {
  const cg = colonyGame(home, id);
  if (!cg) return fail('Essa colônia não existe.');
  if (!home.findBuilt('port')) return fail('A vila precisa de um Porto para receber quem vem das ilhas.');
  const { villagers, ninjas } = homecomers(cg);
  const want = Math.max(0, Math.floor(picks.villagers));
  if (want > villagers.length) return fail(`Só ${villagers.length} morador(es) podem vir agora.`);
  const ns = picks.ninjaIds.map((nid) => ninjas.find((u) => u.id === nid)).filter((u): u is Unit => !!u);
  if (ns.length !== picks.ninjaIds.length) return fail('Algum ninja escolhido não pode vir agora (em luta ou de vigia).');
  const going = [...villagers.slice(0, want), ...ns];
  if (!going.length) return fail('Escolha quem vem para a vila.');
  const why = homeBlock(home, going.length, ns.length);
  if (why) return fail(why);
  const name = colonyName(id);
  const e: Expedition = {
    id: home.newId(), kind: 'colony', node: id, action: 'colony', teamId: -1, unitIds: [], passengers: [], floor: 0, toHome: true,
    timer: COLONY.travel, status: 'going', loot: {}, day: home.state.day, log: [`Moradores de ${name} partiram para a vila.`],
  };
  for (const u of going) e.passengers!.push(takeFromHome(cg, u));
  home.state.expeditions.push(e);
  home.toast(`{ship} ${going.length} pessoa(s) partiram de ${name} para a vila.`, 'info');
  return { ok: true };
}

/** Gente a caminho desta colônia (ainda no barco). */
const travelling = (home: Game, nodeId: string) =>
  home.state.expeditions.reduce((n, e) => n + (e.kind === 'colony' && !e.toHome && e.node === nodeId && e.status === 'going' ? (e.passengers?.length ?? 0) : 0), 0);

/** Tira a unidade do mapa onde mora (equipe, emprego, casa) para viajar/morar noutro: vila ou colônia. */
function takeFromHome(home: Game, u: Unit): Unit {
  if (u.ninja) leaveTeam(home, u.id);
  for (const b of home.state.buildings) if (b.workers.includes(u.id)) b.workers = b.workers.filter((id) => id !== u.id);
  home.state.units = home.state.units.filter((x) => x !== u);
  home.reindex();
  if (home.selected?.kind === 'unit' && home.selected.id === u.id) home.select(null);
  return u;
}

/** Entram no mapa (ids novos), perto do Porto: o da colônia ao chegar lá, o da vila ao voltar. */
export function settle(cg: Game, units: Unit[]) {
  const port = cg.findBuilt('port') ?? cg.state.buildings[0];
  const c = centerOf(cg.state);
  const at = port ? doorPos(port) : { x: tileCenter(c.tx), y: tileCenter(c.ty) };
  units.forEach((u, i) => {
    u.id = cg.newId();
    Object.assign(u, {
      x: at.x + ((i % 4) - 1.5) * 18, y: at.y + 14 + Math.floor(i / 4) * 16, homeId: null, jobId: null, taskId: null, command: null, targetId: null,
      path: [], hasGoal: false, hidden: false, away: undefined, state: 'idle', moving: false, timer: 0, combatTimer: 0, carry: null,
      hitBy: undefined, mark: undefined, cast: undefined, dash: undefined, barrage: undefined, charm: undefined, strike: undefined,
      trainId: undefined, trainStat: undefined, trainLap: undefined, trainPost: undefined, trainLeg: undefined, onTower: undefined,
      anchor: undefined, tactic: undefined, cape: undefined, carrySack: undefined, earth: undefined, perch: undefined, arenaSide: undefined,
    });
    if (u.ninja) u.ninja.learning = null; // estudo é na Academia da vila
    cg.addUnit(u);
    unstick(cg, u);
  });
}

/** Leva gente da vila direto para a colônia (vitrine e testes; o jogo normal viaja pela expedição). */
export function moveToColony(home: Game, id: string, units: Unit[]) {
  const cg = colonyGame(home, id);
  if (!cg) return;
  settle(cg, units.map((u) => takeFromHome(home, u)));
}

/** A viagem chegou (chamado por tickExpeditions): os passageiros entram na colônia. */
export function arriveColony(home: Game, e: Expedition) {
  const cg = e.node ? colonyGame(home, e.node) : null;
  const people = e.passengers ?? [];
  e.passengers = [];
  e.status = 'done';
  if (e.toHome || !cg) {
    // de volta à vila (ou a colônia não existe mais): desembarcam no Porto da vila
    settle(home, people);
    const text = e.toHome ? `${people.length} pessoa(s) chegaram da colônia de ${colonyName(e.node!)} à vila.` : 'A colônia não existia mais: todos voltaram.';
    e.log.push(text);
    if (e.toHome) {
      if (cg) logColony(cg.state, `${people.length} pessoa(s) se mudaram para a vila.`);
      home.toast(`{ship} ${text}`, 'good');
    }
    return;
  }
  settle(cg, people);
  const def = REGION[e.node!]!;
  const text = `${people.length} pessoa(s) chegaram à colônia de ${def.name}.`;
  e.log.push(text);
  logColony(cg.state, text);
  home.toast(`{ship} ${text}`, 'good');
}

function logColony(c: GameState, text: string) {
  const log = c.colony!.log;
  log.push(text);
  while (log.length > 8) log.shift();
}

// ------------------------------------------------------------------ o mapa
const hashId = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Cria o mapa da colônia (sem gente): ilha cercada de mar com praia, no tema da ilha, com o Porto na praia do sul e
 * uma casa (duas se já havia posto avançado). Tudo explorado; alguns bichos da ilha guardam o interior.
 */
export function createColony(home: Game, nodeId: string): GameState {
  const seed = (home.state.seed ^ hashId(nodeId)) >>> 0;
  const s = baseState(seed, { w: COLONY.w, h: COLONY.h });
  const rnd = mulberry32(seed ^ 0xc01);
  const W = s.mapW;
  const H = s.mapH;
  const { tx: cx, ty: cy } = centerOf(s);
  s.time = home.state.time;
  s.day = home.state.day;
  s.level = home.state.level;
  s.flags = { ...s.flags, shelterRookies: false };
  s.timers = { ...s.timers, animal: 1e9, raid: 1e9 };
  s.bossTimer = 1e9;
  // máscara da ilha: raio com ondulação; fora dela é mar, com uma faixa de areia na beira
  const R = Math.min(W, H) * 0.42;
  const wob = Array.from({ length: 12 }, () => 0.78 + rnd() * 0.3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / 1.1;
      const dy = y - cy;
      const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * wob.length;
      const k = wob[Math.floor(a) % wob.length]! * (1 - (a % 1)) + wob[Math.ceil(a) % wob.length]! * (a % 1);
      const r = Math.hypot(dx, dy);
      const i = y * W + x;
      if (r > R * k) s.tiles[i] = T.WATER;
      else if (r > R * k - 2) s.tiles[i] = T.SAND;
      else if (s.tiles[i] === T.ROCK) s.tiles[i] = T.GRASS;
    }
  s.nodes = s.nodes.filter((n) => s.tiles[n.ty * W + n.tx] !== T.WATER && s.tiles[n.ty * W + n.tx] !== T.SAND);
  s.explored.fill(-1);
  s.colony = { node: nodeId, theme: ISLAND_THEME[nodeId], founded: home.state.day, day: home.state.day, log: [`Colônia fundada no dia ${home.state.day}.`] };
  const g = new GameClass(s, COLONY_SYSTEMS);
  g.colonyId = nodeId;
  // Porto na praia do sul (o lugar de margem válido mais perto, varrendo de baixo para cima)
  let port: { tx: number; ty: number } | null = null;
  for (let ty = H - 3; ty > cy && !port; ty--)
    for (const dx of [0, -2, 2, -4, 4, -6, 6]) {
      const sp = shoreSpot(g, 'port', cx + dx, ty, undefined, 2);
      if (!sp) continue;
      g.addBuilding({ id: g.newId(), type: 'port', tx: sp.tx, ty: sp.ty, flip: sp.flip || undefined, built: true, progress: 1, desired: 0, workers: [], cd: 0 });
      port = sp;
      break;
    }
  const base = port ? { tx: port.tx, ty: port.ty - 5 } : { tx: cx, ty: cy + 4 };
  placeBuilt(g, 'house', base.tx - 4, base.ty);
  if (regionOf(home.state, nodeId).outpost) placeBuilt(g, 'house', base.tx + 4, base.ty); // o posto avançado vira o começo da colônia
  g.world.rebuild();
  // bichos da ilha no interior, longe do Porto
  const fauna = ISLAND_FAUNA[nodeId] ?? ['boar', 'wolf'];
  const far = { x: tileCenter(base.tx), y: tileCenter(base.ty) };
  const land: [number, number][] = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (g.world.walkable(x, y) && Math.hypot(tileCenter(x) - far.x, tileCenter(y) - far.y) > 11 * 32) land.push([x, y]);
  for (let k = 0; k < 3 && land.length; k++) {
    const [tx, ty] = land.splice(Math.floor(rnd() * land.length), 1)[0]!;
    guard(createAnimal(g, fauna[k % fauna.length]!, tileCenter(tx), tileCenter(ty)));
  }
  link(home, s);
  games.set(s, g);
  return s;
}

// ------------------------------------------------------------------ resumo por dia (fora da tela)
/** Produção por dia fora da tela: o que os trabalhadores renderiam (fórmula fechada), mais o recurso próprio da ilha. */
export function colonyIncome(home: Game, c: GameState): Cost {
  const income: Cost = {};
  const add = (k: keyof Cost, v: number) => {
    if (v > 0) income[k] = (income[k] ?? 0) + v;
  };
  let free = c.units.filter((u) => !u.dead && u.kind === 'villager').length;
  const hasNode = (type: string) => c.nodes.some((n) => n.type === type && n.amount > 0);
  for (const b of c.buildings) {
    if (!b.built) continue;
    const d = defOf(b);
    const y = d.job ? COLONY_YIELD[d.job] : undefined;
    if (!y) continue;
    // lenhador, pedreira e mina precisam do recurso no mapa
    if ((d.job === 'lumber' && !hasNode('tree')) || (d.job === 'miner' && !hasNode('rock')) || (d.job === 'ironminer' && !hasNode('ore'))) continue;
    const n = Math.min(workersOf(b), b.desired, free);
    if (n <= 0) continue;
    free -= n;
    let per = y.perDay;
    if (d.job === 'merchant') per = (y.perDay * marketYield(b)) / 3;
    add(y.res, Math.round(per * n));
  }
  // campos cercados: os fazendeiros pedidos (até os moradores livres) cuidam dos canteiros
  const cg = colonyGame(home, c.colony?.node ?? '');
  if (cg)
    for (const f of c.fields ?? []) {
      const n = Math.min(f.desired, free);
      if (n <= 0) continue;
      free -= n;
      const y = fieldDailyYield(cg, f, n);
      for (const k of RES_KEYS) add(k, y[k] ?? 0);
    }
  const def = REGION[c.colony?.node ?? ''];
  if (def?.outpost) for (const k of RES_KEYS) add(k, def.outpost[k] ?? 0);
  return income;
}

/**
 * Um dia inteiro fora da tela: credita a produção, cobra a comida, termina as obras e sorteia uma ameaça resolvida
 * como nas expedições (perdas em fração, sem simular a luta). `day` é o dia que está sendo contado.
 */
export function colonyDay(home: Game, id: string, day: number) {
  const cg = colonyGame(home, id);
  if (!cg) return;
  const c = cg.state;
  const info = c.colony!;
  const def = REGION[info.node]!;
  const income = colonyIncome(home, c);
  home.give(income);
  const people = colonyPeople(c);
  const eat = Math.round(people.length * FOOD_PER_DAY * foodMult(home.state));
  home.state.res.food = Math.max(0, home.state.res.food - eat);
  // nascimentos: a mesma regra da tela (casal numa casa, vaga e comida), na metade do ritmo — quem não olha paga um pouco
  let born = 0;
  const tries = Math.round((DAY_LENGTH / BIRTH_INTERVAL) * birthMult(home.state) * 0.5);
  for (let k = 0; k < tries && births(cg, true); k++) born++;
  // obras: um dia fora da tela termina o que estava em andamento
  for (const b of c.buildings) {
    if (!b.built) {
      b.progress = defOf(b).buildTime;
      completeBuilding(cg, b);
    } else if (b.upgrade != null) {
      b.upgrade = upgradeTime(b);
      workUpgrade(cg, b, 0);
    }
  }
  // ameaça
  let threat = '';
  let bad = false;
  if (people.length && chance(COLONY.threatChance)) {
    const strength = nodePower(home.state, def) * rand(0.7, 1.3);
    const ninjas = people.filter((u) => u.ninja);
    const villagers = people.filter((u) => !u.ninja);
    const defense = ninjas.reduce((a, u) => a + unitPower(u), 0) + cg.builtOf('tower').length * COLONY.towerPower + villagers.length * 1.5;
    const ratio = defense / Math.max(1, strength);
    const foe = def.id === 'recife' ? 'Piratas' : 'Feras da ilha';
    const hurt = (list: Unit[], frac: number) => {
      for (const u of list) u.hp = Math.max(1, u.hp - u.maxHp * frac);
    };
    if (ratio >= 1) {
      hurt(ninjas, 0.1);
      for (const u of ninjas) gainXp(cg, u, 8);
      threat = `${foe} atacaram e foram repelidos.`;
    } else {
      bad = true;
      hurt(people, 0.3);
      for (const k of RES_KEYS) if (income[k]) home.state.res[k] = Math.max(0, home.state.res[k] - Math.round(income[k]! * 0.5));
      threat = `${foe} saquearam a colônia: metade da produção se perdeu.`;
      if (ratio < 0.5 && villagers.length && chance(0.3)) {
        const v = villagers[Math.floor(Math.random() * villagers.length)]!;
        v.dead = true;
        v.hp = 0;
        home.state.stats.lost++;
        if (v.ninja) recordFallen(home.state, v);
        c.units = c.units.filter((u) => u !== v);
        cg.reindex();
        threat += ` ${v.name} morreu.`;
      }
    }
  }
  const got = Object.keys(income).length ? costLabel(income) : 'nada';
  logColony(c, `Dia ${day}: produziu ${got}${eat ? `, comeu {food} ${eat}` : ''}.${born ? ` {baby} ${born} nasceram.` : ''}${threat ? ` ${threat}` : ''}`);
  home.toast(`{ship} ${def.name}: ${got}.${threat ? ` ${threat}` : ''}`, bad ? 'warn' : 'good');
}

/** Resumo para a interface: gente, prédios e o que rende por dia. */
export function colonySummary(home: Game, id: string) {
  const c = colonyState(home.state, id);
  if (!c) return null;
  const people = colonyPeople(c);
  return {
    villagers: people.filter((u) => !u.ninja).length,
    ninjas: people.filter((u) => u.ninja).length,
    buildings: c.buildings.filter((b) => b.built && !BUILDINGS[b.type].deco).length,
    building: c.buildings.filter((b) => !b.built || b.upgrade != null).length,
    income: colonyIncome(home, c),
    travelling: travelling(home, id),
    log: c.colony?.log ?? [],
    day: c.colony?.founded ?? 0,
  };
}

/** Segundos de um dia (para a interface mostrar "próximo resumo"). */
export const COLONY_DAY = DAY_LENGTH;
