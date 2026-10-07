// Raças de ninken (cão ninja do Canil). Cada uma tem arte própria (`dog` / `dog-<raça>` em src/art) e um jeito de ajudar.

export type DogBreed = 'shiba' | 'white' | 'pug' | 'bull';

export interface BreedDef {
  name: string;
  desc: string;
  /** Multiplicadores sobre o ninken base (data/animals.ts). */
  hp: number;
  damage: number;
  /** Alcance do faro (espiões invisíveis) e ervas achadas fora da vila. */
  sniff: number;
  herbs: number;
  /** Tamanho do desenho em relação ao shiba. */
  scale: number;
  /** Nível do Canil que libera a raça. */
  kennel: number;
  names: string[];
}

export const BREEDS: Record<DogBreed, BreedDef> = {
  shiba: {
    name: 'Shiba', desc: 'Equilibrado: luta bem e fareja bem.',
    hp: 1, damage: 1, sniff: 1, herbs: 1, scale: 1, kennel: 1, names: ['Shiba', 'Kibo', 'Riku', 'Sora', 'Hana'],
  },
  white: {
    name: 'Cão branco gigante', desc: 'Grande e forte: mais vida e a mordida mais pesada.',
    hp: 1.4, damage: 1.35, sniff: 1, herbs: 1, scale: 1.3, kennel: 2, names: ['Shiro', 'Yuki', 'Haku', 'Kumo', 'Akira'],
  },
  pug: {
    name: 'Pug farejador', desc: 'Fraco na luta, mas tem o melhor faro: descobre espiões de mais longe e acha mais ervas.',
    hp: 0.75, damage: 0.7, sniff: 1.6, herbs: 2, scale: 0.8, kennel: 1, names: ['Pakku', 'Mochi', 'Bun', 'Taro', 'Dango'],
  },
  bull: {
    name: 'Buldogue', desc: 'Um tanque: muita vida para segurar os inimigos longe do dono.',
    hp: 2, damage: 1.1, sniff: 0.8, herbs: 1, scale: 1.4, kennel: 3, names: ['Buru', 'Gonta', 'Iwa', 'Daigo', 'Kuromaru'],
  },
};

export const BREED_LIST = Object.keys(BREEDS) as DogBreed[];

/** Nome da arte de cada raça (o shiba é o `dog` original). */
export const breedArt = (b: DogBreed | undefined) => (!b || b === 'shiba' ? 'dog' : `dog-${b}`);
