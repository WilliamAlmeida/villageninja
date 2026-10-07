import type { System } from '../game';
import { effectSystem } from './effects';
import { hostileSystem } from './hostiles';
import { bossSystem } from './bosses';
import { examSystem } from './exam';
import { exploreSystem } from './explore';
import { expeditionSystem } from './expeditions';
import { regionSystem } from './region';
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
  seasonSystem,
  natureSystem,
  gearSystem,
  automationSystem,
  orgSystem,
  legendsSystem,
  sceneRunSystem,
];

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
