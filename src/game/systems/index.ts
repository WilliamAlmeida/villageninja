import type { System } from '../game';
import { effectSystem } from './effects';
import { hostileSystem } from './hostiles';
import { bossSystem } from './bosses';
import { examSystem } from './exam';
import { exploreSystem } from './explore';
import { expeditionSystem } from './expeditions';
import { kageSystem } from './kage';
import { missionSystem } from './missions';
import { ninjaSystem } from './ninjas';
import { populationSystem } from './population';
import { projectileSystem } from './projectiles';
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
  projectileSystem,
  effectSystem,
  villageSystem,
  exploreSystem,
  expeditionSystem,
];
