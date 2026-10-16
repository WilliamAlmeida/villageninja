// Variantes de arte dos prédios repetidos (docs/gdd-escala-ilhas-pvp.md, seção 4): a casa tem três desenhos por nível
// (`house`, `house-b`, `house-c`; `house-b-2`, `house-c-3`…) e lenhador, pedreira e fazenda dois (`<tipo>`, `<tipo>-b`).
// A escolha é só no desenho, pelo id do prédio (nada muda no save): `id % 3` na casa, `id % 2` na produção. Sem a arte
// da variante (ainda não gerada, ou ainda carregando), fica a arte base do nível. Puro, sem DOM (roda nos testes).
import type { BuildingType } from '../data/buildings';

/** Letras das variantes por tipo; '' é a arte base. A ordem fixa o `id % n`. */
export const VARIANTS: Partial<Record<BuildingType, readonly string[]>> = {
  house: ['', 'b', 'c'],
  lumber: ['', 'b'],
  quarry: ['', 'b'],
  farm: ['', 'b'],
};

/** Nomes de todas as artes de variante que o jogo espera, por tipo e nível (para registrar e para o teste conferir). */
export function variantNames(type: BuildingType, levels: readonly string[]): string[] {
  const out: string[] = [];
  for (const letter of VARIANTS[type] ?? []) if (letter) for (const lv of levels) out.push(withLetter(`${type}${lv}`, letter));
  return out;
}

/** `house-2` + `b` → `house-b-2` (a letra entra antes do nível). */
export function withLetter(artName: string, letter: string): string {
  const m = /^(.*?)(-\d+)?$/.exec(artName)!;
  return `${m[1]}-${letter}${m[2] ?? ''}`;
}

/**
 * Arte do prédio `type` de id `id` a partir da arte base do nível (`house`, `house-2`…): a variante escolhida pelo id,
 * quando existe (`has`), ou a própria base. Determinística: o mesmo prédio sempre sai com o mesmo desenho.
 */
export function variantArt(type: BuildingType, id: number, artName: string, has: (name: string) => boolean): string {
  const list = VARIANTS[type];
  if (!list) return artName;
  const letter = list[Math.abs(Math.trunc(id)) % list.length] ?? '';
  if (!letter) return artName;
  const name = withLetter(artName, letter);
  return has(name) ? name : artName;
}
