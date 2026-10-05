import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import { ACTION_TIME, REL } from '../src/data/region';
import { refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { createNewGame } from '../src/game/newGame';
import { actionBlock, regionDaily, regionOf, startRegion } from '../src/game/region';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import { teamUnits } from '../src/game/teams';

const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let t = 0; t < seconds; t += SIM_DT) {
    g.step(SIM_DT);
    if (until?.()) return;
  }
};

function setup(seed: number, lvl = 10) {
  const g = createNewGame(SYSTEMS, seed);
  Object.assign(g.state.res, { wood: 999, stone: 999, food: 999, ryo: 9999 });
  const team = g.state.teams[0]!;
  for (const u of teamUnits(g, team)) {
    const n = u.ninja!;
    n.rank = 'jounin';
    n.level = lvl;
    for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 8;
    refreshDerived(u);
    u.hp = u.maxHp;
  }
  return { g, team };
}

/** Faz a ação e espera a equipe voltar. */
function act(g: Game, teamId: number, node: string, action: Parameters<typeof startRegion>[3]) {
  const r = startRegion(g, teamId, node, action);
  if (!r.ok) return r;
  const e = g.state.expeditions.at(-1)!;
  const t = ACTION_TIME[action];
  run(g, t.travel * 2 + t.work + 3, () => e.status === 'done' || e.status === 'lost');
  for (const u of teamUnits(g, g.team(teamId)!)) u.hp = u.maxHp; // cura para a próxima ação
  return { ok: true as const, e };
}

describe('mapa da região', () => {
  test('comércio traz mercadoria e melhora a relação', () => {
    const { g, team } = setup(91);
    const food = g.state.res.food;
    const r = act(g, team.id, 'arroz', 'trade');
    expect(r.ok).toBe(true);
    expect(g.state.res.food).toBeGreaterThan(food + 40); // recebeu comida (menos o que a vila comeu)
    expect(regionOf(g.state, 'arroz').rel).toBeGreaterThan(0);
  });

  test('proteger até virar protegido paga tributo; anexar em paz traz moradores', () => {
    const { g, team } = setup(92);
    for (let i = 0; i < 5; i++) act(g, team.id, 'pesca', 'protect');
    const st = regionOf(g.state, 'pesca');
    expect(st.status).toBe('protected');
    const herbs = g.state.res.herbs;
    regionDaily(g);
    expect(g.state.res.herbs).toBeGreaterThan(herbs);
    st.rel = REL.annexPeace;
    const pop = g.population();
    act(g, team.id, 'pesca', 'annex');
    expect(st.status).toBe('vassal');
    expect(g.population()).toBeGreaterThan(pop);
    expect(g.state.honor).toBeGreaterThan(0);
  });

  test('saque dá recursos, infâmia e uma vingança', () => {
    const { g, team } = setup(93, 20);
    const ryo = g.state.res.ryo;
    act(g, team.id, 'arroz', 'raid');
    const st = regionOf(g.state, 'arroz');
    expect(st.status).toBe('hostile');
    expect(g.state.infamy).toBeGreaterThan(0);
    expect(g.state.res.ryo).toBeGreaterThan(ryo);
    expect(actionBlock(g, 'arroz', 'trade')).not.toBeNull();
    // no dia da vingança chegam invasores
    g.state.day = st.revengeDay!;
    const rogues = g.state.units.filter((u) => u.kind === 'rogue').length;
    regionDaily(g);
    expect(g.state.units.filter((u) => u.kind === 'rogue').length).toBeGreaterThan(rogues);
  });

  test('ilhas pedem Porto; explorar libera o posto avançado que produz todo dia', () => {
    const { g, team } = setup(94);
    expect(startRegion(g, team.id, 'nevoa', 'explore').ok).toBe(false);
    const hk = g.hokage()!;
    g.addBuilding({ id: g.newId(), type: 'port', tx: hk.tx + 8, ty: hk.ty + 6, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    act(g, team.id, 'nevoa', 'explore');
    expect(regionOf(g.state, 'nevoa').explored).toBe(true);
    act(g, team.id, 'nevoa', 'outpost');
    expect(regionOf(g.state, 'nevoa').outpost).toBe(true);
    const paper = g.state.res.paper;
    regionDaily(g);
    expect(g.state.res.paper).toBeGreaterThan(paper);
  });

  test('contrato de invocação vai para o ninja mais forte', () => {
    const { g, team } = setup(95, 25);
    const hk = g.hokage()!;
    g.addBuilding({ id: g.newId(), type: 'port', tx: hk.tx + 8, ty: hk.ty + 6, built: true, progress: 99, desired: 0, workers: [], cd: 0 });
    act(g, team.id, 'sapos', 'contract');
    expect(teamUnits(g, team).some((u) => u.ninja!.contract === 'toad')).toBe(true);
  });

  test('migra saves da versão 11 (região, honra e infâmia)', () => {
    const g = createNewGame(SYSTEMS, 96);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 11;
    delete old.region;
    delete old.regionDay;
    delete old.honor;
    delete old.infamy;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(regionOf(s, 'arroz').status).toBe('neutral');
    expect(s.honor).toBe(0);
  });
});
