// Contratos de invocação (lugares sagrados do mapa da região). O ninja com contrato invoca o animal em combate.
import type { AnimalType } from './animals';
import type { ContractKind } from './region';

export interface ContractDef {
  name: string;
  /** Animal invocado (usa a folha de sprite dele). */
  animal: AnimalType;
  desc: string;
  /** Recarga (s) e duração (s) da invocação, e quanto chakra custa. */
  cd: number;
  life: number;
  chakra: number;
}

export const CONTRACTS: Record<ContractKind, ContractDef> = {
  toad: { name: 'Sapos guerreiros', animal: 'toad', cd: 30, life: 22, chakra: 30, desc: 'Invoca um sapo enorme que aguenta muito e esmaga os inimigos com a língua.' },
  snake: { name: 'Serpentes', animal: 'snake', cd: 26, life: 20, chakra: 26, desc: 'Invoca uma serpente venenosa que causa muito dano.' },
  slug: { name: 'Lesmas curandeiras', animal: 'slug', cd: 34, life: 24, chakra: 28, desc: 'Invoca uma lesma que cura os aliados por perto.' },
};
