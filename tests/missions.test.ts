import { describe, expect, test } from 'bun:test';
import { SAVE_VERSION, SIM_DT } from '../src/config';
import type { BuildingType } from '../src/data/buildings';
import { MISSION_TEMPLATES } from '../src/data/missions';
import { refreshDerived } from '../src/game/entities';
import type { Game } from '../src/game/game';
import { abandonMission, acceptMission, generateOffers, pickSite } from '../src/game/missions';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { SYSTEMS } from '../src/game/systems';
import type { Mission } from '../src/game/types';

const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += SIM_DT) g.step(SIM_DT);
};

function addBuilt(g: Game, type: BuildingType) {
  g.addBuilding({ id: g.newId(), type, tx: 1, ty: 1, built: true, progress: 999, desired: 0, workers: [], cd: 0 });
}

/** Vila com Mesa de Missões e o Time 1 fortalecido. */
function setup(seed: number, strong = true) {
  const g = createNewGame(SYSTEMS, seed);
  addBuilt(g, 'missions');
  const team = g.state.teams[0]!;
  if (strong)
    for (const id of team.memberIds) {
      const n = g.unit(id)!;
      const info = n.ninja!;
      info.rank = 'jounin';
      for (const k of Object.keys(info.stats) as (keyof typeof info.stats)[]) info.stats[k] = 8;
      info.jutsu = ['senpuu', null];
      refreshDerived(n);
      n.hp = n.maxHp;
    }
  return { g, team };
}

/** Força uma missão de um template específico no quadro (ou o de índice `ti`). */
function offer(g: Game, type: Mission['type'], rank: number, ti = MISSION_TEMPLATES.findIndex((t) => t.type === type && t.rank === rank)): Mission {
  const t = MISSION_TEMPLATES[ti]!;
  const site = pickSite(g, t.site)!;
  const m: Mission = {
    id: g.newId(), template: ti, type, rank, title: t.title, status: 'offered', teamId: null, x: site.x, y: site.y,
    targetIds: [], nodeIds: [], progress: 0, goal: 1, timeLeft: 0, phase: '',
  };
  g.state.missions.push(m);
  return m;
}

describe('missões', () => {
  test('o quadro oferece missões quando a Mesa de Missões existe', () => {
    const { g } = setup(1);
    run(g, 0.1);
    const offered = g.state.missions.filter((m) => m.status === 'offered');
    expect(offered.length).toBeGreaterThan(0);
    // aldeia: só ranks D e C
    expect(offered.every((m) => m.rank <= 1)).toBe(true);
    generateOffers(g);
    expect(g.state.missions.filter((m) => m.status === 'offered').length).toBeLessThanOrEqual(3);
  });

  test('aceitar cria os alvos no mapa e impede duas missões para a mesma equipe', () => {
    const { g, team } = setup(2);
    const m = offer(g, 'camp', 1);
    expect(acceptMission(g, m.id, team.id).ok).toBe(true);
    expect(m.status).toBe('active');
    expect(g.state.units.filter((u) => u.missionId === m.id).length).toBe(3);
    const m2 = offer(g, 'hunt', 0);
    expect(acceptMission(g, m2.id, team.id).ok).toBe(false);
  });

  test('coleta de ervas: equipe vai até a floresta e colhe tudo', () => {
    const { g, team } = setup(3);
    const m = offer(g, 'herbs', 0);
    const rep = g.state.reputation;
    acceptMission(g, m.id, team.id);
    expect(m.nodeIds.length).toBe(3);
    run(g, 150);
    expect(m.status).toBe('done');
    expect(g.state.reputation).toBeGreaterThan(rep);
    expect(g.state.stats.missionsDone).toBe(1);
    expect(g.state.nodes.some((n) => n.type === 'herb')).toBe(false);
  });

  test('caça: equipe forte elimina a fera', () => {
    const { g, team } = setup(4);
    const m = offer(g, 'hunt', 0);
    const ryo = g.state.res.ryo;
    acceptMission(g, m.id, team.id);
    run(g, 120);
    expect(m.status).toBe('done');
    expect(g.state.res.ryo).toBeGreaterThan(ryo);
    // ninjas voltam à IA normal
    expect(g.state.units.filter((u) => u.kind === 'ninja').every((u) => u.command === null)).toBe(true);
  });

  test('escolta: emboscada acontece e o mercador chega à vila', () => {
    const { g, team } = setup(5);
    const m = offer(g, 'escort', 1);
    acceptMission(g, m.id, team.id);
    let ambushed = false;
    for (let i = 0; i < 300 && m.status === 'active'; i++) {
      run(g, 1);
      if (m.phase === 'ambushed') ambushed = true;
    }
    expect(ambushed).toBe(true);
    expect(m.status).toBe('done');
  });

  test('falha por tempo esgotado e limpa os alvos', () => {
    const { g, team } = setup(6);
    const m = offer(g, 'wanted', 2);
    acceptMission(g, m.id, team.id);
    const rep = (g.state.reputation = 10);
    m.timeLeft = 0.05;
    run(g, 0.2);
    expect(m.status).toBe('failed');
    expect(g.state.reputation).toBeLessThan(rep);
    expect(g.state.units.some((u) => u.missionId === m.id)).toBe(false);
  });

  test('abandonar devolve a equipe', () => {
    const { g, team } = setup(7);
    const m = offer(g, 'camp', 1);
    acceptMission(g, m.id, team.id);
    run(g, 2);
    expect(abandonMission(g, m.id).ok).toBe(true);
    expect(m.status).toBe('failed');
  });

  test('migra saves da versão 3', () => {
    const g = createNewGame(SYSTEMS, 8);
    const old = JSON.parse(JSON.stringify(g.state));
    old.version = 3;
    delete old.missions;
    delete old.reputation;
    delete old.missionDay;
    delete old.stats.missionsDone;
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.missions).toEqual([]);
    expect(s.stats.missionsDone).toBe(0);
  });

  test('caças das feras novas: hidra com 3 cabeças e aranha que usa a teia', () => {
    const { g, team } = setup(61);
    const hi = MISSION_TEMPLATES.findIndex((t) => t.animals?.type === 'hydra');
    const si = MISSION_TEMPLATES.findIndex((t) => t.animals?.type === 'spider');
    expect(hi).toBeGreaterThan(0);
    const m = offer(g, 'hunt', 3, hi);
    expect(acceptMission(g, m.id, team.id).ok).toBe(true);
    const hydra = g.unit(m.targetIds[0])!;
    expect(hydra.animal).toBe('hydra');
    expect(hydra.heads).toBe(3);
    // aranha de missão (outro jogo: só uma missão por vez no começo): quem chega perto leva teia
    const s2 = setup(62);
    const m2 = offer(s2.g, 'hunt', 1, si);
    expect(acceptMission(s2.g, m2.id, s2.team.id).ok).toBe(true);
    const n = s2.g.unit(s2.team.memberIds[0])!;
    const spider = s2.g.unit(m2.targetIds[0])!;
    spider.abilityCd = 0;
    n.x = spider.x + 90;
    n.y = spider.y;
    let webbed = false;
    for (let t = 0; t < 4 && !webbed; t += SIM_DT) {
      s2.g.step(SIM_DT);
      webbed = s2.g.state.projectiles.some((p) => p.ownerId === spider.id) || n.stun > 1;
    }
    expect(webbed).toBe(true);
  });
});
