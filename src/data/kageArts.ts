// Técnicas exclusivas do Kage. Cada Kage domina uma; a lista cresce com o tempo (outras artes de Kage no futuro).

export type KageArtId = 'hiraishin';

export interface KageArtDef {
  id: KageArtId;
  name: string;
  shout: string;
  desc: string;
  color: string;
  chakra: number;
  /** Recarga (s) entre usos. */
  cooldown: number;
  /** Poder do golpe (escala com Ninjutsu, como os jutsus). */
  power: number;
  /** Quanto tempo (s) dura a marca da fórmula num alvo. */
  markLife: number;
}

export const KAGE_ARTS: Record<KageArtId, KageArtDef> = {
  hiraishin: {
    id: 'hiraishin', name: 'Hiraishin no Jutsu', shout: 'Hiraishin!', color: '#ffd34d', chakra: 18, cooldown: 6, power: 34, markLife: 25,
    desc: 'Arremessa kunais marcadas com a fórmula. Aparece num clarão amarelo junto de quem foi marcado e golpeia. Ferido, volta na hora para a Residência do Hokage, onde a fórmula está gravada.',
  },
};

/** Arte que o Kage recebe ao ser coroado (por enquanto só existe uma). */
export const DEFAULT_KAGE_ART: KageArtId = 'hiraishin';
