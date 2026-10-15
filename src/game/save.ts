import { SAVE_KEY, SAVE_VERSION, SUB, TILE, VILLAGE_H, VILLAGE_W } from '../config';
import { Game, type System } from './game';
import type { GameState } from './types';
import { JUTSUS } from '../data/jutsus';
import { needsScroll } from './library';
import { emptyExplored, generateSites, isExplored, revealStart } from './explore';
import { emptyRoads } from './roads';
import { newRegion } from './region';
import { generateMap, T } from './world';
import { newOrg } from './org';
import { BUILDINGS, type BuildingType, defOf } from '../data/buildings';

// Até a v34 todo mapa era 72×48 (a vila e os de missão): save sem tamanho é desse tamanho (`migrate` põe).
const LEGACY_W = 72;
const LEGACY_H = 48;

/**
 * Migrações de save: cada entrada transforma a versão N na N+1.
 * Assim saves antigos continuam funcionando quando o estado ganha campos novos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MIGRATIONS: Record<number, (s: any) => void> = {
  1: (s) => {
    s.teams = [];
    for (const u of s.units) u.command = null;
  },
  2: (s) => {
    s.level = 0;
  },
  3: (s) => {
    s.missions = [];
    s.reputation = 0;
    s.missionDay = 0;
    s.stats.missionsDone = 0;
  },
  4: (s) => {
    s.res.iron = 0;
    s.res.herbs = 0;
    s.res.paper = 0;
    s.items = {};
    for (const u of s.units) if (u.ninja) u.ninja.equip = { weapon: null, armor: null, item: null, itemReady: false };
    // parte das rochas longe do centro vira veio de minério de ferro
    let i = 0;
    for (const n of s.nodes) if (n.type === 'rock' && i++ % 4 === 0) n.type = 'ore';
  },
  5: (s) => {
    s.exam = null;
    s.examNextDay = 0;
    s.lastExam = null;
  },
  6: (s) => {
    s.clans = [];
    for (const u of s.units) if (u.ninja) u.ninja.kekkei = null;
  },
  7: (s) => {
    const kage = s.units.find((u: { ninja?: { rank: string }; faction: string }) => u.ninja?.rank === 'kage' && u.faction === 'village');
    s.kageId = kage ? kage.id : null;
    s.kageHistory = kage ? [{ name: kage.name, day: s.day }] : [];
    s.ceremony = null;
    s.bossTimer = 180 * 6;
    s.pendingBoss = null;
    s.stats.bossesDefeated = 0;
  },
  8: (s) => {
    for (const b of s.buildings) {
      b.level = 1;
      b.upgrade = null;
    }
  },
  9: (s) => {
    // névoa e locais especiais: revela os arredores da vila e o que os ninjas já andaram (território atual)
    s.explored = emptyExplored(s);
    s.sites = [];
    s.scrolls = [];
    revealStart(s);
    let next = s.nextId;
    s.sites = generateSites(s, () => next++);
    s.nextId = next;
    for (const site of s.sites) if (isExplored(s, site.tx, site.ty)) site.found = true;
  },
  10: (s) => {
    // minas: recursos raros e expedições
    s.res.crystal = 0;
    s.res.gold = 0;
    s.res.darksteel = 0;
    s.expeditions = [];
  },
  11: (s) => {
    // mapa da região, honra e infâmia
    s.region = newRegion();
    s.regionDay = s.day;
    s.honor = 0;
    s.infamy = 0;
  },
  12: (s) => {
    // estações, clima, felicidade e festivais
    s.weather = 'clear';
    s.happiness = 60;
    s.grief = 0;
    s.moodDay = s.day;
    s.festivalDay = 0;
    s.festivalUntil = 0;
  },
  13: (s) => {
    // recursos agora crescem de volta: o que já tinha sumido do mapa volta como toco / rocha rachada
    let next = s.nextId;
    const { nodes } = generateMap(s.seed, () => next++, s.mapW, s.mapH);
    const taken = new Set(s.nodes.map((n: { tx: number; ty: number }) => `${n.tx},${n.ty}`));
    const under = (tx: number, ty: number) =>
      s.buildings.some((b: { type: BuildingType; tx: number; ty: number }) => {
        const d = defOf(b);
        return tx >= b.tx - 1 && tx <= b.tx + d.w && ty >= b.ty - 1 && ty <= b.ty + d.h;
      });
    for (const n of nodes) {
      if (n.type === 'herb' || taken.has(`${n.tx},${n.ty}`) || under(n.tx, n.ty)) continue;
      s.nodes.push({ ...n, amount: 0, regrow: 30 + Math.random() * 300 });
    }
    s.nextId = next;
    s.flags.autoGear = false;
  },
  14: (s) => {
    // ritmo do combate (menu) e a arte do Kage atual
    s.pace = 'fast';
    const k = s.units.find((u: { id: number }) => u.id === s.kageId);
    if (k?.ninja && !k.ninja.kageArt) k.ninja.kageArt = 'hiraishin';
  },
  15: (s) => {
    s.snow = 0; // neve acumulada no chão
  },
  16: (s) => {
    s.flags.shelterRookies = true; // novatos se abrigam de inimigos fortes demais
  },
  17: (s) => {
    s.clouds = []; // nuvens de chuva no mapa (surgem no próximo tick se for dia de chuva)
  },
  18: (s) => {
    s.flags.autoTeach = false; // Academia ensina sozinha (o jogador liga)
    s.flags.autoSensei = true; // equipes sem sensei recebem um
  },
  19: (s) => {
    s.org = newOrg(); // a Ordem do Eclipse
    s.region.covil = { rel: 0, status: 'neutral' };
  },
  20: (s) => {
    // lâminas lendárias e os Espadachins da Névoa (a ANBU é um campo opcional do ninja)
    s.blades = [];
    s.swordsmen = { nextDay: 0, taken: false, done: false };
    if (s.scene) {
      s.scene.blades = [];
      s.scene.swordsmen = { nextDay: 0, taken: false, done: false };
    }
  },
  21: (s) => {
    // o Quinteto do Som e o Esconderijo do Som na Região
    s.sound = { nextDay: 0, raid: null, captive: null, stopped: 0, lost: 0 };
    if (s.scene) s.scene.sound = { nextDay: 0, raid: null, captive: null, stopped: 0, lost: 0 };
    s.region.som = { rel: 0, status: 'neutral' };
  },
  22: (s) => {
    // Biblioteca: jutsus rank C+ pedem pergaminho aberto. Os que a vila já usa (sabidos ou em estudo) ficam abertos.
    const open = new Set<string>();
    for (const st of [s, s.scene].filter(Boolean))
      for (const u of st.units ?? [])
        if (u.faction === 'village' && u.ninja) {
          for (const id of u.ninja.jutsu ?? []) if (id) open.add(id);
          if (u.ninja.learning) open.add(u.ninja.learning.jutsuId);
        }
    s.jutsuOpen = [...open].filter((id) => JUTSUS[id] && needsScroll(JUTSUS[id]));
    if (s.scene) s.scene.jutsuOpen = [...s.jutsuOpen];
  },
  23: (s) => {
    // a arena cresceu (4×4 → 6×6, redonda): se encostar noutro prédio, procura um lugar livre ao lado
    const W = BUILDINGS.arena.w;
    for (const a of s.buildings ?? []) {
      if (a.type !== 'arena') continue;
      const free = (tx: number, ty: number) => {
        if (tx < 1 || ty < 1 || tx + W > s.mapW - 1 || ty + W > s.mapH - 1) return false;
        for (let y = ty; y < ty + W; y++) for (let x = tx; x < tx + W; x++) if (s.tiles[y * s.mapW + x] === T.WATER) return false;
        return !s.buildings.some((o: { id: number; type: BuildingType; tx: number; ty: number }) => {
          if (o === a) return false;
          const d = defOf(o);
          return tx < o.tx + d.w + 1 && tx + W + 1 > o.tx && ty < o.ty + d.h + 1 && ty + W + 1 > o.ty;
        });
      };
      if (free(a.tx, a.ty)) continue;
      search: for (let r = 1; r <= 8; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(a.tx + dx, a.ty + dy)) continue;
            a.tx += dx;
            a.ty += dy;
            break search;
          }
    }
  },
  24: (s) => {
    // a arena virou cercado (muro com portão): árvore/rocha que ficou dentro dela (cresceu ou foi deslocada) sai
    const W = BUILDINGS.arena.w;
    for (const a of s.buildings ?? [])
      if (a.type === 'arena')
        s.nodes = (s.nodes ?? []).filter((n: { tx: number; ty: number }) => n.tx < a.tx || n.tx >= a.tx + W || n.ty < a.ty || n.ty >= a.ty + W);
  },
  25: () => {
    // landT e strike (golpe com o dano no auge do avanço) são opcionais: nada a converter
  },
  26: (s) => {
    // colisão e caminhos passaram a meio tile: rotas guardadas (em tiles) são refeitas; perch (plateia do Exame) é opcional
    const clear = (st: any) => {
      for (const u of st?.units ?? []) {
        u.path = [];
        u.hasGoal = false;
      }
    };
    clear(s);
    clear(s.scene);
  },
  27: (s) => {
    const cleanDogNames = (st: any) => {
      for (const u of st?.units ?? [])
        if (typeof u.name === 'string') u.name = u.name.replace(/ \(ninken\)$/, '');
    };
    cleanDogNames(s);
    cleanDogNames(s.scene);
  },
  // Bestas com cauda: o jarro das feras vencidas esperando um Jinchuuriki
  28: (s) => {
    s.bijuu = { jar: [] };
    if (s.scene) s.scene.bijuu = { jar: [] };
  },
  29: (s) => {
    s.fallen = [];
    if (s.scene) s.scene.fallen = [];
  },
  30: (s) => {
    s.roads = emptyRoads(s);
    if (s.scene) s.scene.roads = emptyRoads(s.scene);
  },
  // v32: vigia da torre (Building.guardId, Unit.onTower; game/towerWatch.ts). Nenhuma torre começa vigiada; o
  // guarda desenhado de antes (Building.shot/aim) saiu.
  31: (s) => {
    for (const st of [s, s.scene].filter(Boolean))
      for (const b of st.buildings ?? []) {
        delete b.shot;
        delete b.aim;
      }
  },
  // v33: a Torre de Vigia passou de 1×1 para 2×2 (cabe o vigia lá dentro): cresce no lugar ou vai para o lugar livre
  // mais perto (como a arena na v24); árvore/rocha que ficou embaixo sai
  32: (s) => {
    for (const st of [s, s.scene].filter(Boolean)) growBuildings(st, 'tower', BUILDINGS.tower.w, BUILDINGS.tower.h);
  },
  // v34: a casa nível 3 passou a ocupar 3×3 (BuildingDef.sizes): as que já são nível 3 crescem no lugar ou mudam
  33: (s) => {
    const [W, H] = BUILDINGS.house.sizes![3]!;
    for (const st of [s, s.scene].filter(Boolean)) growBuildings(st, 'house', W, H, 3);
  },
  // v35: o mapa da vila cresceu de 72×48 para 102×68 (os prédios ficaram maiores com o padrão novo da arte): a vila
  // vai para o meio do mapa novo e o terreno em volta é gerado; os mapas de missão continuam 72×48
  34: (s) => {
    growMap(s, VILLAGE_W, VILLAGE_H); // direto para o tamanho atual: uma emenda só no terreno
  },
  // v36: a vila cresceu de novo, para 112×112 (quadrada preenche o losango da vista isométrica; o chão em blocos não
  // tem mais limite de tamanho). Um save que ficou em 102×68 (v35) cresce agora; o que já veio da v34 não muda.
  35: (s) => {
    growMap(s, VILLAGE_W, VILLAGE_H, 0x2b1);
  },
  // v37: a Residência do Hokage guarda o nível (o da vila + 1) e o terreno cresce com ele (Vila Oculta 4×4, Grande Vila
  // Oculta 5×5): cresce no lugar ou muda para o espaço livre mais perto
  36: (s) => {
    for (const st of [s, s.scene].filter(Boolean)) {
      for (const b of st.buildings ?? []) if (b.type === 'hokage') b.level = (s.level ?? 0) + 1;
      for (const [lv, size] of Object.entries(BUILDINGS.hokage.sizes ?? {})) growBuildings(st, 'hokage', size![0], size![1], Number(lv));
    }
  },
  // v38: o nível 3 de mercado, academia, hospital, biblioteca, forja, farmácia, selos, lenhador e pedreira ficou maior
  // (padrão novo da arte): cresce no lugar, muda para o espaço livre mais perto ou, sem nenhum, volta ao nível 2 com a
  // obra pronta esperando espaço
  // v39: limpar área (ResourceNode.clear/cleared, campos opcionais: nada a converter)
  38: () => {},
  // v47: duelos por retrato (stats.duelsWon/duelsLost; lastDuel, flags.duelistId e Exam.duel opcionais)
  46: (s) => {
    if (!s.stats) return; // saves mínimos dos testes de migração
    s.stats.duelsWon ??= 0;
    s.stats.duelsLost ??= 0;
  },
  // v46: vínculo opcional do Gatsūga do ninken e posição/fonte de texto auxiliar.
  45: () => {},
  // v45: sequência do Sekizō e origem dos canhões, opcionais; saves anteriores continuam sem sequência.
  44: () => {},
  // v44: altura de saída da fonte no bote do dragão (DragonFlight.z0, opcional: nada a converter)
  43: () => {},
  // v43: curva opcional do Suiryuudan modular; projéteis antigos terminam o voo anterior.
  42: () => {},
  // v42: projétil e efeito sabem de que jutsu vieram (Projectile.fx / Effect.fx, opcionais: nada a converter)
  41: () => {},
  // v41: árvores pegando fogo na luta (ResourceNode.burn, opcional: nada a converter)
  40: () => {},
  // v40: aterrar e cavar (state.earthworks)
  39: (s) => {
    for (const st of [s, s.scene].filter(Boolean)) st.earthworks ??= [];
  },
  37: (s) => {
    const types: BuildingType[] = ['market', 'academy', 'hospital', 'library', 'forge', 'pharmacy', 'sealshop', 'lumber', 'quarry'];
    for (const st of [s, s.scene].filter(Boolean))
      for (const t of types) {
        const size = BUILDINGS[t].sizes?.[3];
        if (size) growBuildings(st, t, size[0], size[1], 3);
      }
  },
};

/**
 * Aumenta o mapa da vila para W×H com o mapa de antes no meio: tudo que tem posição anda junto (prédios, recursos,
 * locais, unidades e as rotas delas, equipes, missões, nuvens, névoa e ruas); o terreno de fora vem de um mapa novo
 * gerado pela seed, com a costura suavizada (lago cortado na beira de antes continua 2 tiles; água nova colada
 * nela vira grama). Efeitos e projéteis no ar somem.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function growMap(s: any, W: number, H: number, salt = 0) {
  const ow: number = s.mapW;
  const oh: number = s.mapH;
  if ((W <= ow && H <= oh) || !s.tiles?.length) return; // save de teste sem mapa: nada a mover
  const ox = Math.floor((W - ow) / 2);
  const oy = Math.floor((H - oh) / 2);
  const dx = ox * TILE;
  const dy = oy * TILE;
  const fresh = generateMap(s.seed ^ 0x6a11e ^ salt, () => s.nextId++, W, H);
  const old = s.tiles as number[];
  const inOld = (x: number, y: number) => x >= ox && y >= oy && x < ox + ow && y < oy + oh;
  const tiles = new Array<number>(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inOld(x, y)) {
        tiles[y * W + x] = old[(y - oy) * ow + x - ox]!;
        continue;
      }
      // costura: perto da beira de antes, a água continua a de antes (2 tiles) e a nova não encosta
      const ex = Math.max(ox, Math.min(ox + ow - 1, x));
      const ey = Math.max(oy, Math.min(oy + oh - 1, y));
      const near = Math.max(Math.abs(x - ex), Math.abs(y - ey)) <= 2;
      const edge = old[(ey - oy) * ow + ex - ox]!;
      let t = fresh.tiles[y * W + x]!;
      if (near) t = edge === T.WATER ? T.WATER : t === T.WATER || t === T.SAND ? T.GRASS : t;
      tiles[y * W + x] = t;
    }
  // areia de novo só fora do mapa de antes: terra colada na água vira areia, areia sem água ao lado vira grama
  const wet = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && tiles[y * W + x] === T.WATER;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (inOld(x, y) || tiles[i] === T.WATER) continue;
      const shore = wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1);
      if (shore) tiles[i] = T.SAND;
      else if (tiles[i] === T.SAND) tiles[i] = T.GRASS;
    }

  // bitsets (névoa, ruas): o de antes no meio, o resto apagado
  const regrid = (bits: number[] | undefined) => {
    const out = new Array<number>(Math.ceil((W * H) / 32)).fill(0);
    if (!bits) return out;
    for (let i = 0; i < ow * oh; i++) {
      if (!((bits[i >> 5]! >>> (i & 31)) & 1)) continue;
      const j = (Math.floor(i / ow) + oy) * W + (i % ow) + ox;
      out[j >> 5] |= 1 << (j & 31);
    }
    return out;
  };
  s.explored = regrid(s.explored);
  s.roads = regrid(s.roads);

  // posições
  const pt = (p: { x: number; y: number } | null | undefined) => {
    if (p) (p.x += dx), (p.y += dy);
  };
  const tl = (p: { tx: number; ty: number }) => ((p.tx += ox), (p.ty += oy));
  for (const b of s.buildings ?? []) tl(b);
  for (const n of s.nodes ?? []) tl(n);
  for (const site of s.sites ?? []) tl(site);
  const taken = new Set((s.nodes ?? []).map((n: { tx: number; ty: number }) => `${n.tx},${n.ty}`));
  for (const n of fresh.nodes) if (!inOld(n.tx, n.ty) && tiles[n.ty * W + n.tx] !== T.WATER && !taken.has(`${n.tx},${n.ty}`)) s.nodes.push(n);
  // rotas: índices de célula de colisão (meio tile) na grade de antes → na nova
  const ofw = ow * SUB;
  const fw = W * SUB;
  const cell = (i: number) => (Math.floor(i / ofw) + oy * SUB) * fw + (i % ofw) + ox * SUB;
  for (const u of s.units ?? []) {
    u.x += dx;
    u.y += dy;
    u.goalX += dx;
    u.goalY += dy;
    if (u.homeX != null) u.homeX += dx;
    if (u.homeY != null) u.homeY += dy;
    pt(u.anchor);
    if (u.dash) (u.dash.lx += dx), (u.dash.ly += dy);
    if (u.trainLap) (u.trainLap.cx += dx), (u.trainLap.cy += dy);
    if (u.command?.kind === 'move') pt(u.command);
    u.path = (u.path ?? []).map(cell);
  }
  for (const t of s.teams ?? []) pt(t.anchor);
  for (const m of s.missions ?? []) pt(m);
  for (const c of s.clouds ?? []) pt(c);
  pt(s.pendingBoss);
  s.effects = [];
  s.projectiles = [];
  s.tiles = tiles;
  s.mapW = W;
  s.mapH = H;
}

/**
 * Prédios do `type` (só os do nível `level`, se dado) que cresceram para w×h: ficam no lugar se couber, senão no lugar
 * livre mais perto (até 8 tiles). Os outros prédios contam pelo tamanho do nível deles (`defOf`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function growBuildings(s: any, type: BuildingType, W: number, H: number, level?: number) {
  for (const a of s.buildings ?? []) {
    if (a.type !== type || (level != null && (a.level ?? 1) !== level)) continue;
    const free = (tx: number, ty: number) => {
      if (tx < 1 || ty < 1 || tx + W > s.mapW - 1 || ty + H > s.mapH - 1) return false;
      for (let y = ty; y < ty + H; y++) for (let x = tx; x < tx + W; x++) if (s.tiles[y * s.mapW + x] === T.WATER || s.tiles[y * s.mapW + x] === T.ROCK) return false;
      return !s.buildings.some((o: { id: number; type: BuildingType; tx: number; ty: number }) => {
        if (o === a) return false;
        const d = defOf(o);
        return tx < o.tx + d.w && tx + W > o.tx && ty < o.ty + d.h && ty + H > o.ty;
      });
    };
    let ok = free(a.tx, a.ty);
    if (!ok)
      search: for (let r = 1; r <= 12; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(a.tx + dx, a.ty + dy)) continue;
            a.tx += dx;
            a.ty += dy;
            ok = true;
            break search;
          }
    if (!ok && level != null && level > 1 && a.type !== 'hokage') {
      // nenhum lugar livre por perto: fica no nível de antes, com a obra do upgrade pronta esperando o espaço
      // (workUpgrade/growRoom: cresce quando liberarem)
      a.level = level - 1;
      a.upgrade = 1e9;
      a.waitRoom = true;
      continue;
    }
    s.nodes = (s.nodes ?? []).filter((n: { tx: number; ty: number }) => n.tx < a.tx || n.tx >= a.tx + W || n.ty < a.ty || n.ty >= a.ty + H);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(s: any): GameState | null {
  if (typeof s?.version !== 'number') return null;
  // saves de antes da v35 não guardam o tamanho: era 72×48 (a vila e o mapa de missão)
  for (const st of [s, s.scene].filter(Boolean)) {
    st.mapW ??= LEGACY_W;
    st.mapH ??= LEGACY_H;
  }
  while (s.version < SAVE_VERSION) {
    const m = MIGRATIONS[s.version];
    if (!m) return null;
    m(s);
    s.version++;
  }
  return s.version === SAVE_VERSION ? (s as GameState) : null;
}

/** Salva o estado no localStorage (o jogo é local por enquanto). */
export function saveGame(g: Game): boolean {
  try {
    const sc = g.state.scene;
    const data: GameState = { ...g.state, effects: [], projectiles: [], scene: sc ? { ...sc, effects: [], projectiles: [] } : sc };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(systems: System[]): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = migrate(JSON.parse(raw));
    return state ? new Game(state, systems) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
