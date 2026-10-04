// Textos do jogo marcam ícones como tokens `{nome}` (ex.: "30{wood} 10{stone}").
// A UI troca por SVG (ui/icons.ts); o canvas e atributos `title` usam a versão em texto puro.
export const TOKEN_RE = /\{([a-z0-9-]+)\}/g;

const WORDS: Record<string, string> = {
  wood: ' madeira', stone: ' pedra', food: ' comida', ryo: ' ryo', iron: ' ferro', herbs: ' ervas', paper: ' papel',
};

/** Remove os tokens; recursos viram palavra ("+3{ryo}" → "+3 ryo"). */
export const plainTokens = (text: string) => text.replace(TOKEN_RE, (_, k: string) => WORDS[k] ?? '').replace(/\s{2,}/g, ' ').trim();
