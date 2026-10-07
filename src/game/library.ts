// Biblioteca de Jutsus: guarda os pergaminhos. Jutsus básicos (rank E/D) a Academia ensina direto; do rank C em diante
// o pergaminho precisa ser ABERTO aqui (com custo) antes de algum ninja poder estudá-lo. O nível da Biblioteca diz até
// que rank dá para abrir e acelera o estudo. Kekkei genkai (segredo do clã) e proibidos (pergaminho das ruínas) ficam à parte.
import { JUTSU_LIST, JUTSUS, type JutsuDef } from '../data/jutsus';
import { JUTSU_RANK_LABEL } from '../data/ninja';
import { costLabel } from '../data/resources';
import type { Game } from './game';
import type { Cost, GameState } from './types';
import { levelOf } from './upgrade';

type Result = { ok: true } | { ok: false; error: string };

export const LIBRARY = {
  /** Rank mais alto de jutsu que dá para abrir por nível da Biblioteca (1, 2, 3): C, B, A/S. */
  maxRank: [2, 3, 5],
  /** Estudo mais rápido por nível. */
  learn: [1.5, 1.75, 2],
  /** Até este rank o jutsu é básico: não precisa de pergaminho. */
  basic: 1,
};

/** Custo de abrir o pergaminho de um jutsu, pelo rank. */
export const SCROLL_COST: Record<number, Cost> = {
  2: { ryo: 120 },
  3: { ryo: 300, paper: 20 },
  4: { ryo: 700, paper: 50 },
  5: { ryo: 1200, paper: 80 },
};
export const scrollCost = (j: JutsuDef): Cost => SCROLL_COST[j.rank] ?? SCROLL_COST[5]!;

/** Jutsus que pedem pergaminho aberto na Biblioteca (os outros: básicos, de clã ou proibidos). */
export const needsScroll = (j: JutsuDef) => !j.forbidden && !j.kekkei && j.rank > LIBRARY.basic;
export const LIBRARY_JUTSUS = JUTSU_LIST.filter(needsScroll).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

/** Ids liberados para estudo: pergaminhos abertos na Biblioteca + proibidos achados nas ruínas. */
export const studyable = (s: Pick<GameState, 'scrolls' | 'jutsuOpen'>): string[] => [...s.scrolls, ...(s.jutsuOpen ?? [])];
export const isOpen = (s: Pick<GameState, 'jutsuOpen'>, id: string) => (s.jutsuOpen ?? []).includes(id);

export const libraryLevel = (g: Game) => {
  const b = g.findBuilt('library');
  return b ? levelOf(b) : 0;
};
/** Multiplicador de estudo (sem Biblioteca: 1). */
export const libraryLearnMult = (g: Game) => {
  const lv = libraryLevel(g);
  return lv ? LIBRARY.learn[lv - 1]! : 1;
};

/** Por que não dá para abrir este pergaminho agora (null = dá). */
export function openBlock(g: Game, id: string): string | null {
  const j = JUTSUS[id];
  if (!j || !needsScroll(j)) return 'Este jutsu não tem pergaminho na Biblioteca.';
  if (isOpen(g.state, id)) return 'Já está aberto.';
  const lv = libraryLevel(g);
  if (!lv) return 'Construa a Biblioteca de Jutsus.';
  if (j.rank > LIBRARY.maxRank[lv - 1]!) {
    const need = LIBRARY.maxRank.findIndex((r) => r >= j.rank) + 1;
    return `Rank ${JUTSU_RANK_LABEL[j.rank]}: precisa da Biblioteca no nível ${need}.`;
  }
  if (!g.canAfford(scrollCost(j))) return `Custa ${costLabel(scrollCost(j))}.`;
  return null;
}

/** Abre o pergaminho: o jutsu passa a aparecer para os ninjas estudarem. */
export function openScroll(g: Game, id: string): Result {
  const why = openBlock(g, id);
  if (why) return { ok: false, error: why };
  const j = JUTSUS[id]!;
  g.pay(scrollCost(j));
  (g.state.jutsuOpen ??= []).push(id);
  g.toast(`{scroll} Pergaminho aberto: ${j.name}. Já pode ser ensinado aos ninjas.`, 'good');
  return { ok: true };
}
