import type { JobType } from '../data/buildings';

export const STATE_LABEL: Record<string, string> = {
  idle: 'Parado', wander: 'Passeando', toField: 'Indo à fazenda', farming: 'Cultivando', toNode: 'Indo coletar',
  gather: 'Coletando', toDeposit: 'Levando recursos', toShop: 'Indo ao mercado', shop: 'Vendendo', toSite: 'Indo à obra',
  build: 'Construindo', flee: 'Fugindo!', shelter: 'Abrigado', toShelter: 'Indo se abrigar', goHome: 'Indo para casa', sleep: 'Dormindo',
  fight: 'Em combate!', toLearn: 'Indo à Academia', learn: 'Estudando jutsu', toRest: 'Indo descansar', rest: 'Descansando',
  toTrain: 'Indo treinar', train: 'Treinando', patrol: 'Patrulhando', scout: 'Explorando', investigate: 'Investigando', away: 'Em expedição', roam: 'Vagando', march: 'Marchando para a vila',
  escape: 'Fugindo com o saque', follow: 'Seguindo o líder', cmdMove: 'Indo ao ponto (ordem)', guard: 'Defendendo ponto',
  cmdRetreat: 'Recuando (ordem)', cmdRest: 'Abrigado se curando', escortWait: 'Esperando escolta', escort: 'Viajando com escolta',
  cower: 'Escondido (emboscada!)', toCraft: 'Indo à oficina', exam: 'No Exame Chunin', ceremony: 'Na cerimônia do Kage', rampage: 'Em fúria!', duel: 'Duelando na arena', ko: 'Nocauteado', craft: 'Fabricando', craftIdle: 'Esperando pedidos',
};

export const JOB_LABEL: Record<JobType, string> = {
  farmer: 'Fazendeiro(a)',
  lumber: 'Lenhador(a)',
  miner: 'Minerador(a)',
  merchant: 'Comerciante',
  ironminer: 'Mineiro(a) de ferro',
  gardener: 'Jardineiro(a)',
  crafter: 'Artesão(ã)',
};
