// Tamanho e sombra das folhas de personagem e bicho (puro, sem DOM): usado pelo jogo (sprites.ts) e pelo editor de
// sprites para mostrar a sombra padrão. O ajuste fino de cada arte (altura do corpo, origem, sombra) fica no
// layout.json (`arts[nome].body/foot/shadow`, ver data/layout.ts).
import { ANIMALS } from '../data/animals';

/** Altura do desenho do bicho em múltiplos do `size` dele (padrão 2.6). */
export const ART_SIZE: Record<string, number> = { snake: 3.8, crow: 3.4, monkey: 3, spider: 2.4, tiger: 2.6, rhino: 2.6, hydra: 3.6, golem: 3.2 };
/** Altura no mundo de quem não é bicho: parado/andando e nas folhas de ação (a ferramenta erguida ocupa o alto). */
export const PERSON_H = 30;
export const ACTION_H = 37;

/** Altura no mundo (px no zoom 1) em que a arte é desenhada: bicho pelo `size`, gente 30 px (ação 37). */
export function worldHeight(name: string): number {
  const animal = name.startsWith('dog') ? 'dog' : name;
  const a = ANIMALS[animal as keyof typeof ANIMALS];
  if (a) return a.size * (ART_SIZE[animal] ?? 2.6);
  return name.startsWith('villager-') || name === 'tower-guard' ? ACTION_H : PERSON_H;
}

/**
 * Sombra padrão de uma arte, em fração da altura desenhada: [meia largura, meia altura]. Bicho: 1,2 × 0,4 do `size`;
 * gente: 8 × 3,5 px num boneco de 30 px.
 */
export function shadowFrac(name: string): [number, number] {
  const animal = name.startsWith('dog') ? 'dog' : name;
  const a = ANIMALS[animal as keyof typeof ANIMALS];
  if (a) {
    const h = ART_SIZE[animal] ?? 2.6;
    return [1.2 / h, 0.4 / h];
  }
  const h = name.startsWith('villager-') || name === 'tower-guard' ? ACTION_H : PERSON_H;
  return [8 / h, 3.5 / h];
}
