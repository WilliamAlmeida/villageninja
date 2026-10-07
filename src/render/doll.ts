// Ninja em camadas: quais peças cada ninja veste (pela patente) e como cada camada é recolorida. Puro (sem DOM),
// usado pelo jogo (art.ts/sprites.ts) e pelo editor de sprites (tools/sprite-editor), para os dois montarem igual.

/** Uma peça da montagem: a arte (`ninja-body` ou `layer-*`), a cor da chave principal e a da segunda chave (amarelo). */
export interface DollPart {
  name: string;
  color?: string;
  color2?: string;
}

/** O que a montagem precisa saber do ninja. */
export interface DollWho {
  style: string;
  rank?: string;
  sannin?: string;
  nature?: string;
  /** Profissão: o espião da vila veste a ANBU. */
  spec?: string;
  /** Atributos: o maior escolhe o animal da máscara da ANBU. */
  stats?: Record<string, number>;
  /** Sorteia a espada quando a natureza tem várias (fixo por ninja). */
  id?: number;
  /** Força a espada (o editor de sprites escolhe à mão); null = nenhuma. */
  sword?: string | null;
  look: { hair: string; cloth: string; skin: string };
}

/** Penteados que já existem como camada (os outros seguem na folha antiga até ganharem a sua; o Kage, de chapéu, não). */
export const DOLL_HAIR: Partial<Record<string, string>> = {
  spiky: 'layer-hair-spiky', ponytail: 'layer-hair-ponytail', short: 'layer-hair-short', long: 'layer-hair-long', buns: 'layer-hair-buns', bald: '',
};
/** Colete por patente: arte e cor. */
export const VESTS: Partial<Record<string, [string, string]>> = { chunin: ['layer-vest-chunin', '#5f6b3a'], jounin: ['layer-vest-jounin', '#4e5a3a'] };
/** Sobretudo de cada caminho dos Sannin (cor do casaco, cor do debrum e do emblema). */
export const SANNIN_COAT: Record<string, [string, string]> = { toad: ['#8c2a22', '#d4a03a'], snake: ['#4a3a6a', '#c9b06a'], slug: ['#3f6a46', '#d4a03a'] };
/** Manto e chapéu do Kage (branco, chamas e painel vermelhos). */
export const KAGE_COLORS: [string, string] = ['#f0ece0', '#c8352a'];
/** Cabo da espada do Zabuza. */
export const SWORD_COLOR = '#3a2a20';
/** Espadas do anime: cor da chave magenta (bainha, cabo, escamas…) e da amarela (faixas, corda, raios…); o ciano é metal. */
export const SWORDS: Record<string, [string, string?]> = {
  zabuza: [SWORD_COLOR], samehada: ['#4a6a8a', '#e0dccc'], kiba: ['#2a2a30', '#bfe6ff'], hiramekarei: ['#e0dccc', '#3a2a20'],
  nuibari: ['#3a3040', '#c0c0c8'], kabutowari: ['#5a3a20', '#8a8a90'], shibuki: ['#3a2a20', '#e8dcb0'],
  kusanagi: ['#2a2a30', '#6a4a9a'], sakumo: ['#2a2a30', '#e8e8e8'], asuma: ['#3a2a20', '#2a2a30'], raijin: ['#2a2a40', '#bfe6ff'],
  bee: ['#2a2a30', '#e8e8e8'], tanto: ['#2a2a30', '#3a3a44'],
};
/** Espada do Jounin/Sannin por natureza (várias: uma por ninja); a Névoa fica com os Sete Espadachins. */
export const NATURE_SWORDS: Record<string, string[]> = {
  suiton: ['zabuza', 'samehada', 'hiramekarei', 'nuibari', 'shibuki'], raiton: ['kiba', 'bee', 'sakumo'],
  fuuton: ['asuma'], doton: ['kabutowari'], katon: ['kusanagi'],
};
/** ANBU (espião da vila): uniforme e máscara; o animal da máscara mostra o melhor atributo do ninja. */
export const ANBU_COLORS: [string, string] = ['#d8d4c8', '#2a2a30'];
export const MASK_COLORS: [string, string] = ['#f0ece0', '#c8352a'];
export const ANBU_MASKS: Record<string, string> = {
  ninjutsu: 'fox', taijutsu: 'tiger', genjutsu: 'crow', inteligencia: 'owl', forca: 'boar', velocidade: 'hawk', stamina: 'bear', selos: 'monkey',
};

const sword = (s: string): DollPart => ({ name: `layer-sword-${s}`, color: SWORDS[s]![0], color2: SWORDS[s]![1] });

/** Animal da máscara: o maior atributo (empate: o primeiro da lista). */
export function anbuMask(stats?: Record<string, number>) {
  let best = 'ninjutsu';
  if (stats) for (const k of Object.keys(ANBU_MASKS)) if ((stats[k] ?? 0) > (stats[best] ?? 0)) best = k;
  return ANBU_MASKS[best]!;
}

/** Espada que o ninja carrega (ou nenhuma): Kage = Raijin; Sannin da serpente = Kusanagi; Jounin/Sannin pela natureza. */
export function dollSword(w: DollWho): string | null {
  if (w.sword !== undefined) return w.sword;
  if (w.rank === 'kage') return 'raijin';
  if (w.sannin === 'snake') return 'kusanagi';
  if (w.rank !== 'jounin' && !w.sannin) return null;
  const list = w.nature ? NATURE_SWORDS[w.nature] : undefined;
  return list ? list[Math.floor((w.id ?? 0) / 6) % list.length]! : null; // /6: o id % 6 já escolhe o penteado
}

/**
 * Peças de baixo para cima: corpo → roupa → colete da patente / sobretudo de Sannin / manto de Kage → espada → cabelo →
 * bandana; o Kage usa o chapéu no lugar de cabelo e bandana (base careca). O espião da vila (ANBU) troca roupa e colete
 * pelo uniforme, leva o tantō e usa a máscara no lugar da bandana. Penteado ainda sem camada: null (folha antiga).
 */
export function dollParts(w: DollWho): DollPart[] | null {
  const kage = w.rank === 'kage';
  const hair = DOLL_HAIR[w.style];
  if (hair === undefined && !kage) return null;
  if (w.spec === 'spy' && !kage && !w.sannin) {
    const parts: DollPart[] = [{ name: 'ninja-body' }, { name: 'layer-outfit-anbu', color: ANBU_COLORS[0], color2: ANBU_COLORS[1] }];
    const s = w.sword !== undefined ? w.sword : 'tanto';
    if (s) parts.push(s === 'zabuza' ? { name: 'layer-sword-zabuza', color: SWORD_COLOR } : sword(s));
    if (hair) parts.push({ name: hair, color: w.look.hair });
    parts.push({ name: `layer-mask-${anbuMask(w.stats)}`, color: MASK_COLORS[0], color2: MASK_COLORS[1] });
    return parts;
  }
  const parts: DollPart[] = [{ name: 'ninja-body' }, { name: 'layer-outfit-genin', color: w.look.cloth }];
  const vest = w.rank ? VESTS[w.rank] : undefined;
  if (kage) parts.push({ name: 'layer-cloak-kage', color: KAGE_COLORS[0], color2: KAGE_COLORS[1] });
  else if (w.sannin && SANNIN_COAT[w.sannin]) parts.push({ name: 'layer-coat-sannin', color: SANNIN_COAT[w.sannin]![0], color2: SANNIN_COAT[w.sannin]![1] });
  else if (vest) parts.push({ name: vest[0], color: vest[1] });
  const s = dollSword(w);
  if (s) parts.push(s === 'zabuza' ? { name: 'layer-sword-zabuza', color: SWORD_COLOR } : sword(s));
  if (kage) {
    parts.push({ name: 'layer-hat-kage', color: KAGE_COLORS[0], color2: KAGE_COLORS[1] });
    return parts;
  }
  if (hair) parts.push({ name: hair, color: w.look.hair });
  parts.push({ name: 'layer-headband', color: w.look.cloth });
  return parts;
}

export const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

export function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

const METAL: [number, number, number] = [150, 158, 172];

/**
 * Recolore os pixels de uma camada (RGBA) no lugar: no corpo (`body`) só a pele; nas peças o magenta (roupa) e o verde
 * (cabelo) viram a cor da peça, o amarelo a segunda cor e o ciano vira metal. Mantém o sombreado (brilho relativo ao
 * tom médio da cor-chave).
 */
export function tintPixels(px: Uint8ClampedArray, part: DollPart, body: boolean, skin: string) {
  const sk = hex(skin);
  const col = part.color ? hex(part.color) : null;
  const col2 = part.color2 ? hex(part.color2) : col;
  for (let j = 0; j < px.length; j += 4) {
    if (px[j + 3]! < 10) continue;
    const { h, s, v } = hsv(px[j]!, px[j + 1]!, px[j + 2]!);
    let to: [number, number, number] | null = null;
    let mid = 1;
    if (body) {
      if (h >= 10 && h <= 45 && s > 0.12 && s < 0.65 && v > 0.55) [to, mid] = [sk, 0.96];
    } else if (s > 0.35) {
      if (col && ((h >= 280 && h <= 330) || (h >= 85 && h <= 165))) [to, mid] = [col, h < 200 ? 0.8 : 1];
      else if (h >= 170 && h <= 200) to = METAL;
      else if (col2 && h >= 48 && h <= 72 && s > 0.5) to = col2;
    }
    if (!to) continue;
    const k = v / mid;
    for (let q = 0; q < 3; q++) px[j + q] = k <= 1 ? to[q]! * k : to[q]! + (255 - to[q]!) * Math.min(1, k - 1);
  }
}

/** Quadros das folhas: 4 colunas (ciclo de caminhada; parado = coluna 1) × 3 linhas (lado, frente, costas). */
export const DOLL_GRID = { cols: 4, rows: 3, idle: 1 };
/** O quadro do ninja em camadas tem folga em cima: a altura do corpo é 56 de 80. */
export const DOLL_FRAME_PAD = 80 / 56;
