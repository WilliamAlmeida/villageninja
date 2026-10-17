// Textos do site em pt-BR (raiz) e inglês (/en/...). O jogo em si ainda é só em português.
export type Lang = 'pt' | 'en';

export const T = {
  pt: {
    htmlLang: 'pt-BR',
    siteName: 'Ninja Cursed Fight',
    short: 'NCF RPG',
    tagline: 'Construa, treine e defenda a sua vila ninja.',
    metaDesc: 'Ninja Cursed Fight (NCF RPG): construa e defenda a sua vila ninja no navegador e no celular. Ninjas com patentes, missões, clãs, Kage e duelos on-line. Grátis.',
    navHome: 'Início',
    navRanking: 'Ranking',
    play: 'Jogar grátis',
    playShort: 'Jogar',
    loading: 'Abrindo o pergaminho…',
    login: 'Entrar',
    logout: 'Sair',
    staff: 'Painel',
    heroSub: 'Do primeiro Genin ao Kage: Exame Chunin, clãs com kekkei genkai, ANBU, Sannin, Bijuu e duelos on-line contra outras vilas. Roda no navegador, no PC e no celular.',
    heroNote: 'Sem download e sem cadastro para começar.',
    online: (n: number) => `${n} ${n === 1 ? 'ninja on-line' : 'ninjas on-line'}`,
    featuresTitle: 'O que você faz na vila',
    features: [
      ['Construa e melhore', 'Casas, campos, forja, biblioteca e torres. A vila cresce melhorando os prédios, não repetindo.'],
      ['Forme os seus ninjas', 'Do Genin ao Sannin: atributos, jutsus de cada natureza, equipamento e o Exame Chunin.'],
      ['Missões no mapa', 'Equipes saem pela região, exploram, voltam com recursos e às vezes não voltam inteiras.'],
      ['Clãs e kekkei genkai', 'Linhagens com jutsus próprios, Dōjutsu e técnicas como Shunshin, Kawarimi e Hiraishin.'],
      ['Defenda a vila', 'Invasões, renegados e chefes que crescem com a força da vila. O Kage entra quando precisa.'],
      ['Duelos on-line', 'Publique o seu campeão e enfrente o de outros jogadores. Ligas de Genin a Sannin.'],
    ],
    privacy: 'Privacidade',
    terms: 'Termos',
    eyebrow: 'RPG de vila ninja para fãs de Naruto · grátis no navegador',
    guestBtn: 'Continuar como convidado',
    loginChoose: 'Escolha como entrar para jogar.',
    guestNote: '<b>Convidado</b> é um login temporário: a conta vale só neste navegador e some se os dados forem apagados. Com <b>Discord</b> ou <b>Google</b> você entra em qualquer aparelho, o ranking fica com você e dá para aparecer no ranking do site.',
    guestUpgrade: 'Você está como convidado. Entre com Discord ou Google para guardar o progresso em qualquer aparelho: o que você já fez vem junto.',
    rankingLocked: 'Entre com uma conta (Discord ou Google) para ver o ranking. Conta de convidado não vê.',
    rankingLockedBtn: 'Entrar com conta',
    show: [
      ['village', 'Vila', 'Construa a sua vila oculta', 'Casas, campos, forja, biblioteca, torres e a residência do Kage. Cada prédio sobe de nível e muda de cara: a vila cresce melhorando, não repetindo. Esta é uma vila de verdade, no dia 575.'],
      ['battle', 'Defesa', 'Defenda a sua gente', 'Renegados, invasões de outras vilas e feras de caudas crescem junto com a sua força. Os ninjas lutam sozinhos com Katon, Suiton, Raiton, Doton e Fuuton, e você dá as ordens que decidem a luta.'],
      ['region', 'Região', 'Explore a região', 'Equipes saem em missão por ilhas, vilarejos, minas e templos. Funde colônias nas ilhas, faça aliados ou vassalos e volte com recursos e cicatrizes.'],
      ['arena', 'Arena', 'Duele com outros jogadores', 'A arena do Exame Chunin é a mesma dos duelos on-line: publique o seu campeão e enfrente o de outras vilas. Ligas de Genin a Sannin, revanche e o relatório de quem desafiou você.'],
    ],
    moreTitle: 'E ainda',
    navNews: 'Novidades',
    newsTitle: 'Novidades',
    newsSub: 'O que mudou no jogo e o que vem por aí.',
    newsEmpty: 'Nenhuma novidade publicada ainda.',
    newsAll: 'Todas as novidades',
    readMore: 'Ler',
    profile: {
      league: 'Liga', points: 'Pontos', position: 'Posição', attack: 'Ataques', defense: 'Defesas', champion: 'Campeão',
      noChampion: 'Ainda não publicou um campeão.', nature: 'Natureza', village: 'Vila', level: 'Nível', stats: 'Atributos',
      duels: 'Duelos recentes', noDuels: 'Nenhum duelo ainda.', attacked: 'atacou', defended: 'defendeu contra', won: 'vitória', lost: 'derrota',
      since: 'Na arena desde',
    },
    rankingTitle: 'Ranking de duelos',
    rankingSub: 'Os campeões com mais pontos na arena.',
    rankingEmpty: 'Ainda ninguém duelou. O primeiro lugar está livre.',
    rankingAll: 'Ver ranking completo',
    colPos: '#',
    colPlayer: 'Jogador',
    colChampion: 'Campeão',
    colLeague: 'Liga',
    colPoints: 'Pontos',
    colRecord: 'V/D',
    ctaTitle: 'A vila está esperando.',
    ctaSub: 'Abra no navegador e comece. Dá para instalar como app no celular.',
    footer: 'Ninja Cursed Fight · jogo independente em desenvolvimento',
    langOther: 'English',
    gameLangNote: '',
    loginTitle: 'Entrar',
    loginSub: 'Use a mesma conta no PC e no celular. O progresso de convidado deste navegador vem junto.',
    loginWith: (p: string) => `Entrar com ${p}`,
    loginNone: 'O login social ainda não está ligado no servidor.',
    loginError: 'Não deu para entrar. Tente de novo.',
    hello: (n: string) => `Olá, ${n}`,
    notFound: 'Página não encontrada.',
    back: 'Voltar ao início',
  },
  en: {
    htmlLang: 'en',
    siteName: 'Ninja Cursed Fight',
    short: 'NCF RPG',
    tagline: 'Build, train and defend your ninja village.',
    metaDesc: 'Ninja Cursed Fight (NCF RPG): build and defend your ninja village in the browser and on mobile. Ranked ninjas, missions, clans, Kage and online duels. Free to play.',
    navHome: 'Home',
    navRanking: 'Leaderboard',
    play: 'Play free',
    playShort: 'Play',
    loading: 'Unrolling the scroll…',
    login: 'Sign in',
    logout: 'Sign out',
    staff: 'Staff',
    heroSub: 'From your first Genin to Kage: the Chunin Exam, clans with kekkei genkai, ANBU, Sannin, tailed beasts and online duels against other villages. Runs in the browser, on PC and on mobile.',
    heroNote: 'No download and no sign-up to start.',
    online: (n: number) => `${n} ${n === 1 ? 'ninja online' : 'ninjas online'}`,
    featuresTitle: 'What you do in the village',
    features: [
      ['Build and upgrade', 'Houses, fields, forge, library and towers. The village grows by upgrading buildings, not by copying them.'],
      ['Raise your ninjas', 'From Genin to Sannin: stats, jutsu of every nature, gear and the Chunin Exam.'],
      ['Missions on the map', 'Teams head out across the region, explore and bring resources home, and sometimes not everyone comes back.'],
      ['Clans and kekkei genkai', 'Bloodlines with their own jutsu, Dōjutsu and techniques like Shunshin, Kawarimi and Hiraishin.'],
      ['Defend the village', 'Raids, rogue ninjas and bosses that scale with your strength. The Kage steps in when needed.'],
      ['Online duels', 'Publish your champion and face other players’ champions. Leagues from Genin to Sannin.'],
    ],
    privacy: 'Privacy',
    terms: 'Terms',
    eyebrow: 'Ninja village RPG for Naruto fans · free in your browser',
    guestBtn: 'Continue as guest',
    loginChoose: 'Choose how to sign in to play.',
    guestNote: '<b>Guest</b> is a temporary login: the account lives only in this browser and is lost if its data is cleared. With <b>Discord</b> or <b>Google</b> you sign in on any device, your rating stays with you and you can appear on the site leaderboard.',
    guestUpgrade: 'You are playing as a guest. Sign in with Discord or Google to keep your progress on any device: everything you did comes along.',
    rankingLocked: 'Sign in with an account (Discord or Google) to see the leaderboard. Guest accounts cannot.',
    rankingLockedBtn: 'Sign in',
    show: [
      ['village', 'Village', 'Build your hidden village', 'Houses, fields, forge, library, towers and the Kage residence. Every building levels up and changes its look: the village grows by upgrading, not by copying. This is a real village, on day 575.'],
      ['battle', 'Defense', 'Protect your people', 'Rogue ninjas, raids from other villages and tailed beasts grow with your strength. Ninjas fight on their own with Katon, Suiton, Raiton, Doton and Fuuton, and your orders decide the battle.'],
      ['region', 'Region', 'Explore the region', 'Teams head out to islands, villages, mines and temples. Found colonies on islands, make allies or vassals and come back with resources and scars.'],
      ['arena', 'Arena', 'Duel other players', 'The Chunin Exam arena is the same one used for online duels: publish your champion and face the champions of other villages. Leagues from Genin to Sannin, revenge matches and a report of who challenged you.'],
    ],
    moreTitle: 'And also',
    navNews: 'News',
    newsTitle: 'News',
    newsSub: 'What changed in the game and what is coming.',
    newsEmpty: 'No news published yet.',
    newsAll: 'All news',
    readMore: 'Read',
    profile: {
      league: 'League', points: 'Points', position: 'Rank', attack: 'Attacks', defense: 'Defenses', champion: 'Champion',
      noChampion: 'No champion published yet.', nature: 'Nature', village: 'Village', level: 'Level', stats: 'Stats',
      duels: 'Recent duels', noDuels: 'No duels yet.', attacked: 'attacked', defended: 'defended against', won: 'win', lost: 'loss',
      since: 'In the arena since',
    },
    rankingTitle: 'Duel leaderboard',
    rankingSub: 'The champions with the most arena points.',
    rankingEmpty: 'Nobody has dueled yet. First place is up for grabs.',
    rankingAll: 'Full leaderboard',
    colPos: '#',
    colPlayer: 'Player',
    colChampion: 'Champion',
    colLeague: 'League',
    colPoints: 'Points',
    colRecord: 'W/L',
    ctaTitle: 'The village is waiting.',
    ctaSub: 'Open it in your browser and start. You can install it as an app on your phone.',
    footer: 'Ninja Cursed Fight · independent game in development',
    langOther: 'Português',
    gameLangNote: 'The game is currently in Brazilian Portuguese; English is on the way.',
    loginTitle: 'Sign in',
    loginSub: 'Use the same account on PC and mobile. Your guest progress in this browser comes along.',
    loginWith: (p: string) => `Continue with ${p}`,
    loginNone: 'Social sign-in is not enabled on the server yet.',
    loginError: 'Sign-in failed. Please try again.',
    hello: (n: string) => `Hi, ${n}`,
    notFound: 'Page not found.',
    back: 'Back to home',
  },
} as const;

export type Dict = (typeof T)[Lang];

/** Ligas por pontos (iguais às do jogo, src/ui/arenaClient.ts). */
export const LEAGUES = [
  { min: 0, pt: 'Genin', en: 'Genin', col: 4 },
  { min: 1100, pt: 'Chunin', en: 'Chunin', col: 3 },
  { min: 1250, pt: 'Jounin', en: 'Jounin', col: 5 },
  { min: 1400, pt: 'ANBU', en: 'ANBU', col: 2 },
  { min: 1550, pt: 'Kage', en: 'Kage', col: 6 },
  { min: 1700, pt: 'Sannin', en: 'Sannin', col: 7 },
];
/** Atlas dos selos do jogo (`src/art/ui/badge-ranks.png`, 10 colunas × 2 linhas): a liga fica na linha 0, coluna `col`. */
export const BADGE_ATLAS = { cols: 10, rows: 2 };
export function leagueOf(rating: number) {
  let out = LEAGUES[0]!;
  for (const l of LEAGUES) if (rating >= l.min) out = l;
  return out;
}

/** Páginas com nome próprio em inglês (o resto usa o mesmo nome: /ranking ↔ /en/ranking). */
const EN_SLUG: Record<string, string> = { '/privacidade': '/privacy', '/termos': '/terms', '/novidades': '/news' };
const PT_SLUG = Object.fromEntries(Object.entries(EN_SLUG).map(([pt, en]) => [en, pt]));
/** Começos de caminho com nome próprio (`/jogador/<id>` ↔ `/player/<id>`). */
const EN_PREFIX: Array<[string, string]> = [['/jogador/', '/player/'], ['/novidades/', '/news/']];

function toEn(pt: string): string {
  if (EN_SLUG[pt]) return EN_SLUG[pt]!;
  for (const [a, b] of EN_PREFIX) if (pt.startsWith(a)) return b + pt.slice(a.length);
  return pt;
}

/** Caminho em português a partir do caminho em inglês sem o /en (`/privacy` → `/privacidade`). */
export function ptOf(enPath: string): string {
  if (PT_SLUG[enPath]) return PT_SLUG[enPath]!;
  for (const [a, b] of EN_PREFIX) if (enPath.startsWith(b)) return a + enPath.slice(b.length);
  return enPath;
}

/** Caminho da página na outra língua: de `pt` vai para o /en (e vice-versa), sempre a partir do caminho em português. */
export function altPath(lang: Lang, path: string): string {
  if (lang === 'en') return path;
  const en = toEn(path);
  return en === '/' ? '/en' : `/en${en}`;
}

/** Link interno para a página (caminho em português) na língua da página. */
export const href = (lang: Lang, ptPath: string) => (lang === 'pt' ? ptPath : altPath('pt', ptPath));

/** Prefixo dos links internos da língua. */
export const base = (lang: Lang) => (lang === 'en' ? '/en' : '');

/** Natureza e atributos em cada língua (o site não mostra nomes de jutsus: são do anime). */
export const NATURE_NAME: Record<string, { pt: string; en: string; color: string }> = {
  katon: { pt: 'Fogo', en: 'Fire', color: '#ff6a2b' },
  fuuton: { pt: 'Vento', en: 'Wind', color: '#7fe0a0' },
  raiton: { pt: 'Raio', en: 'Lightning', color: '#ffe14d' },
  doton: { pt: 'Terra', en: 'Earth', color: '#c39257' },
  suiton: { pt: 'Água', en: 'Water', color: '#4da6ff' },
};
export const STAT_NAME: Record<string, { pt: string; en: string; color: string }> = {
  ninjutsu: { pt: 'Ninjutsu', en: 'Ninjutsu', color: '#4da6ff' },
  taijutsu: { pt: 'Taijutsu', en: 'Taijutsu', color: '#ff8a3d' },
  genjutsu: { pt: 'Genjutsu', en: 'Genjutsu', color: '#b36bff' },
  inteligencia: { pt: 'Inteligência', en: 'Intelligence', color: '#5ad1c8' },
  forca: { pt: 'Força', en: 'Strength', color: '#ff5a5a' },
  velocidade: { pt: 'Velocidade', en: 'Speed', color: '#ffe14d' },
  stamina: { pt: 'Stamina', en: 'Stamina', color: '#7ddc6b' },
  selos: { pt: 'Selos', en: 'Hand seals', color: '#d9d9d9' },
};
/** Ordem dos atributos no perfil (a mesma do jogo, src/data/ninja.ts). */
export const STAT_ORDER = ['ninjutsu', 'taijutsu', 'genjutsu', 'inteligencia', 'forca', 'velocidade', 'stamina', 'selos'];
