// Textos do site em pt-BR (raiz) e inglês (/en/...). O jogo em si ainda é só em português.
export type Lang = 'pt' | 'en';

export const T = {
  pt: {
    htmlLang: 'pt-BR',
    siteName: 'Vila Ninja',
    tagline: 'Construa, treine e defenda a sua vila ninja.',
    metaDesc: 'Jogo de construção de vila ninja no navegador e no celular: ninjas com patentes, missões, clãs, Kage e duelos on-line. Grátis.',
    navHome: 'Início',
    navRanking: 'Ranking',
    play: 'Jogar grátis',
    playShort: 'Jogar',
    login: 'Entrar',
    logout: 'Sair',
    staff: 'Painel',
    heroSub: 'Do primeiro Genin ao Kage: cada casa, cada missão e cada duelo é escolha sua. Roda no navegador, no PC e no celular.',
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
    footer: 'Vila Ninja · jogo independente em desenvolvimento',
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
    siteName: 'Ninja Village',
    tagline: 'Build, train and defend your ninja village.',
    metaDesc: 'Ninja village building game for browser and mobile: ranked ninjas, missions, clans, Kage and online duels. Free to play.',
    navHome: 'Home',
    navRanking: 'Leaderboard',
    play: 'Play free',
    playShort: 'Play',
    login: 'Sign in',
    logout: 'Sign out',
    staff: 'Staff',
    heroSub: 'From your first Genin to Kage: every house, mission and duel is your call. Runs in the browser, on PC and on mobile.',
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
    footer: 'Ninja Village · independent game in development',
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
  { min: 0, pt: 'Genin', en: 'Genin' },
  { min: 1100, pt: 'Chunin', en: 'Chunin' },
  { min: 1250, pt: 'Jounin', en: 'Jounin' },
  { min: 1400, pt: 'ANBU', en: 'ANBU' },
  { min: 1550, pt: 'Kage', en: 'Kage' },
  { min: 1700, pt: 'Sannin', en: 'Sannin' },
];
export function leagueOf(rating: number) {
  let out = LEAGUES[0]!;
  for (const l of LEAGUES) if (rating >= l.min) out = l;
  return out;
}

/** Caminho na outra língua: `/ranking` ↔ `/en/ranking`. */
export function altPath(lang: Lang, path: string): string {
  if (lang === 'en') return path.replace(/^\/en(?=\/|$)/, '') || '/';
  return path === '/' ? '/en' : `/en${path}`;
}

/** Prefixo dos links internos da língua. */
export const base = (lang: Lang) => (lang === 'en' ? '/en' : '');
