// Ajuste fino das construções e do cenário, feito no Editor de cenário (http://localhost:3011/cenario) e salvo em
// layout.json. O jogo lê daqui:
// - por ARTE (`arts[nome]`, ex.: "arena", "house-2", "ruin", "tree0"): escala e deslocamento do desenho, e as PEÇAS
//   pintadas (máscara): cada peça é desenhada na profundidade da sua âncora (o ponto em que ela toca o chão), então
//   um muro da frente fica na frente de quem está dentro e um poste fica na frente só de quem passa atrás dele. O resto
//   (o que não foi pintado) vai no chão (`ground`) ou em pé como um prédio comum. `fade`: área que fica
//   semitransparente quando tapa alguém (sem: o contorno da peça).
// - por TIPO (`types[tipo]`, ex.: "arena", "ruin"): tamanho do terreno em tiles, quais tiles são muro/portão e pontos
//   especiais (porta, lugares do Exame, guarda da torre, chaminé).
import RAW from './layout.json';

/** Retângulo 0–1 da imagem. */
export type Rect01 = [number, number, number, number];

export interface LayoutPiece {
  name: string;
  /** Âncora (onde a peça toca o chão), 0–1 da imagem. */
  ax: number;
  ay: number;
  fade?: Rect01;
}

export interface ArtLayout {
  /** Multiplica o tamanho padrão do desenho. */
  scale?: number;
  /** Deslocamento do desenho (px da cena no tamanho 1×). */
  dx?: number;
  dy?: number;
  /** O que não foi pintado vai no chão (sob todo mundo). Padrão: sim nos prédios andáveis, não nos outros. */
  ground?: boolean;
  fade?: Rect01;
  pieces?: LayoutPiece[];
  /** Marcas na arte (px da cena no tamanho 1×, a partir do meio da base): guarda da torre, chaminé. */
  marks?: Record<string, [number, number]>;
  /** Máscara das peças (0 = resto, 1… = peça), do tamanho da imagem, comprimida em RLE (`encodeMask`). */
  mask?: string;
  maskW?: number;
  maskH?: number;
}

export interface TypeLayout {
  /** Tamanho do terreno em tiles (sobrepõe o do prédio). */
  w?: number;
  h?: number;
  /** Uma linha por fileira de tiles: "." livre, "#" muro (bloqueia), "g" portão (livre, por onde se entra). */
  tiles?: string[];
  /** Locais (ruína…): tile do local dentro da grade (padrão: o meio). */
  origin?: [number, number];
  /** Pontos especiais em px de mundo a partir do canto do terreno (ex.: door, left, right, stands, guard, chimney). */
  points?: Record<string, [number, number]>;
}

export interface Layout {
  arts: Record<string, ArtLayout>;
  types: Record<string, TypeLayout>;
}

let LAYOUT: Layout = RAW as Layout;
/** Muda a cada edição (o renderer refaz as peças em cache). */
export let layoutVersion = 0;

export const layout = () => LAYOUT;
export const artLayout = (name: string): ArtLayout | undefined => LAYOUT.arts[name];
export const typeLayout = (type: string): TypeLayout | undefined => LAYOUT.types[type];
/** Ponto especial do tipo (px de mundo a partir do canto), ou undefined. */
export const layoutPoint = (type: string, name: string) => LAYOUT.types[type]?.points?.[name];

/** Editor: troca o layout inteiro (ou avisa que mudou por dentro). */
export function setLayout(l: Layout) {
  LAYOUT = l;
  layoutVersion++;
}
export const touchLayout = () => layoutVersion++;

/** Tile (x, y) do terreno: "." livre, "#" muro, "g" portão; undefined = sem ajuste (regra padrão do prédio). */
export function tileOf(type: string, x: number, y: number): string | undefined {
  const t = LAYOUT.types[type]?.tiles;
  if (!t) return undefined;
  return t[y]?.[x] ?? '.';
}

// ------------------------------------------------------------------ máscara (RLE)
/** Comprime a máscara: "valor*quantidade" separados por vírgula, linha após linha. */
export function encodeMask(m: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < m.length) {
    const v = m[i]!;
    let n = 1;
    while (i + n < m.length && m[i + n] === v) n++;
    out.push(n === 1 ? `${v}` : `${v}*${n}`);
    i += n;
  }
  return out.join(',');
}

export function decodeMask(s: string, size: number): Uint8Array {
  const m = new Uint8Array(size);
  let i = 0;
  for (const part of s.split(',')) {
    if (!part) continue;
    const [v, n] = part.split('*');
    const val = Number(v);
    const count = n ? Number(n) : 1;
    m.fill(val, i, Math.min(size, i + count));
    i += count;
  }
  return m;
}
