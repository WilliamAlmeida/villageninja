// Textos do jogo marcam ícones como tokens `{nome}` (ex.: "{wood} 30 {stone} 10").
// A UI troca por SVG (ui/icons.ts); o canvas e atributos `title` usam a versão em texto puro.
export const TOKEN_RE = /\{([a-z0-9-]+)\}/g;

const WORDS: Record<string, string> = {
  wood: ' madeira', stone: ' pedra', food: ' comida', ryo: ' ryo', iron: ' ferro', herbs: ' ervas', paper: ' papel',
};

/** Remove os tokens e mantém a ordem natural do texto puro ("{ryo} +3" → "+3 ryo"). */
const RESOURCE_AMOUNT_RE = /\{(wood|stone|food|ryo|iron|herbs|paper|crystal|gold|darksteel)\}\s*([+-]?\d+(?:[.,]\d+)?)/g;
export const plainTokens = (text: string) =>
  text
    .replace(RESOURCE_AMOUNT_RE, (_, k: string, amount: string) => `${amount} ${WORDS[k]!.trim()}`)
    .replace(TOKEN_RE, (_, k: string) => WORDS[k] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
