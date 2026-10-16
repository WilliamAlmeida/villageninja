import type { System } from '../game';
import { effectSystem } from './effects';
import { hostileSystem } from './hostiles';
import { bossSystem } from './bosses';
import { examSystem } from './exam';
import { exploreSystem } from './explore';
import { expeditionSystem } from './expeditions';
import { regionSystem } from './region';
import { colonySystem } from './colonies';
import { cropSystem } from './crops';
import { seasonSystem } from './seasons';
import { natureSystem } from './nature';
import { gearSystem } from './gear';
import { automationSystem } from './automation';
import { sceneRunSystem, sceneSystem } from './scene';
import { orgSystem } from './org';
import { legendsSystem } from './legends';
import { kageSystem } from './kage';
import { missionSystem } from './missions';
import { ninjaSystem } from './ninjas';
import { populationSystem } from './population';
import { projectileSystem } from './projectiles';
import { techniqueSystem } from './techniques';
import { spreadSystem } from '../tactics';
import { spawnerSystem } from './spawner';
import { statusSystem } from './status';
import { teamSystem } from './teams';
import { timeSystem } from './time';
import { towerSystem } from './towers';
import { villageSystem } from './village';
import { villagerSystem } from './villagers';

/**
 * Ordem de execução por tick. Para adicionar uma mecânica nova
 * (ex.: missões, clima, comércio), crie um arquivo em systems/ e registre aqui.
 */
export const SYSTEMS: System[] = [
  timeSystem,
  statusSystem,
  spawnerSystem,
  populationSystem,
  teamSystem,
  missionSystem,
  examSystem,
  kageSystem,
  bossSystem,
  villagerSystem,
  cropSystem,
  ninjaSystem,
  hostileSystem,
  towerSystem,
  techniqueSystem,
  spreadSystem,
  projectileSystem,
  effectSystem,
  villageSystem,
  exploreSystem,
  expeditionSystem,
  regionSystem,
  colonySystem,
  seasonSystem,
  natureSystem,
  gearSystem,
  automationSystem,
  orgSystem,
  legendsSystem,
  sceneRunSystem,
];

/**
 * Nome de cada sistema para a medição (`Game.prof`): o build minificado troca os nomes das funções, então vão à parte.
 */
const LABELS: [System, string][] = [
  [timeSystem, 'tempo'],
  [statusSystem, 'status'],
  [spawnerSystem, 'surgimento'],
  [populationSystem, 'população'],
  [teamSystem, 'equipes'],
  [missionSystem, 'missões'],
  [examSystem, 'exame'],
  [kageSystem, 'kage'],
  [bossSystem, 'chefes'],
  [villagerSystem, 'moradores'],
  [cropSystem, 'plantações'],
  [ninjaSystem, 'ninjas'],
  [hostileSystem, 'inimigos'],
  [towerSystem, 'torres'],
  [techniqueSystem, 'técnicas'],
  [spreadSystem, 'espalhar'],
  [projectileSystem, 'projéteis'],
  [effectSystem, 'efeitos'],
  [villageSystem, 'vila'],
  [exploreSystem, 'exploração'],
  [expeditionSystem, 'expedições'],
  [regionSystem, 'região'],
  [colonySystem, 'colônias'],
  [seasonSystem, 'estações'],
  [natureSystem, 'natureza'],
  [gearSystem, 'equipamento'],
  [automationSystem, 'automação'],
  [orgSystem, 'organizações'],
  [legendsSystem, 'lendas'],
  [sceneRunSystem, 'cena (vila)'],
  [sceneSystem, 'cena'],
];
for (const [s, label] of LABELS) (s as System & { label?: string }).label = label;

/** Mapa de missão (vilarejo invadido…): só luta, IA, torres do inimigo e névoa; a vida da vila fica na vila. */
export const SCENE_SYSTEMS: System[] = [
  statusSystem,
  teamSystem,
  ninjaSystem,
  hostileSystem,
  towerSystem,
  techniqueSystem,
  spreadSystem,
  projectileSystem,
  effectSystem,
  exploreSystem,
  sceneSystem,
];

/** Mapa de uma colônia na tela (game/colonies.ts): a vida comum (moradores, população, natureza) e a luta, sem a vila. */
export const COLONY_SYSTEMS: System[] = [
  statusSystem,
  populationSystem,
  teamSystem,
  villagerSystem,
  cropSystem,
  ninjaSystem,
  hostileSystem,
  towerSystem,
  techniqueSystem,
  spreadSystem,
  projectileSystem,
  effectSystem,
  exploreSystem,
  natureSystem,
];
