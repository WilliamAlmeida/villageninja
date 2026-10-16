// Cliente do servidor de duelos (server/): conta de convidado criada sozinha, retrato publicado, adversário sorteado,
// resultado enviado. Tudo o que vem da rede fica guardado aqui (a janela Duelos lê de forma síncrona); erro de rede
// nunca trava o jogo, só vira `error`/`offline`. O token fica no localStorage, nunca no save.
import type { Game } from '../game/game';
import type { DuelResult } from '../game/types';

const TOKEN_KEY = 'vn_arena_token';
const URL_KEY = 'vn_arena_url';
const PENDING_KEY = 'vn_arena_pending';

export interface ArenaAccount {
  id: string;
  displayName: string;
  username: string | null;
  email: string | null;
  isGuest: boolean;
  role?: 'player' | 'mod' | 'admin';
  avatarUrl?: string | null;
  /** Discord/Google ligados à conta; `password` quando tem apelido e senha. */
  logins?: string[];
}
/** Aviso da equipe (painel /staff). */
export interface Notice {
  id: number;
  kind: 'live' | 'inbox';
  tone: 'info' | 'good' | 'warn' | 'danger';
  titlePt: string;
  textPt: string;
  actionUrl: string | null;
  read: boolean;
}
export interface Provider {
  id: 'discord' | 'google';
  name: string;
}
export interface ArenaStats {
  rating: number;
  wins: number;
  losses: number;
  defWins: number;
  defLosses: number;
}
export interface NinjaBrief {
  name: string;
  rank: string;
  level: number;
  from?: string;
}
export interface Published {
  power: number;
  updatedAt: string;
  ninja: NinjaBrief;
}
export interface Opponent {
  opponentId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  power: number;
  code: string;
  ninja: NinjaBrief;
}
export interface RankRow {
  userId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  ninja: NinjaBrief | null;
}
export interface Defense {
  id: string;
  at: string;
  attacker: { id: string; name: string };
  attackerNinja: NinjaBrief | null;
  /** Retrato VN1 do ninja que atacou (para desenhar o boneco) e os pontos dele (liga). */
  attackerCode: string | null;
  attackerRating: number;
  held: boolean;
  left: boolean;
  defDelta: number | null;
  unseen: boolean;
  revenged: boolean;
}
export interface HistoryRow {
  id: string;
  at: string;
  defender: string;
  ninja: NinjaBrief;
  won: boolean | null;
  delta: number | null;
}

/** Códigos do servidor em português. */
const ERROR_TEXT: Record<string, string> = {
  UNAUTHORIZED: 'A sessão expirou. Entrando de novo como convidado.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas. Espere alguns minutos.',
  INVALID_NAME: 'Nome inválido: 2 a 24 letras, números, espaço, ponto, hífen ou sublinhado.',
  INVALID_USERNAME: 'Apelido inválido: 3 a 16 letras, números ou sublinhado.',
  INVALID_PASSWORD: 'Senha inválida: de 6 a 72 caracteres.',
  INVALID_EMAIL: 'E-mail inválido.',
  INVALID_CREDENTIALS: 'Apelido ou senha errados.',
  ALREADY_REGISTERED: 'Esta conta já tem apelido e senha.',
  USERNAME_TAKEN: 'Esse apelido já está em uso.',
  EMAIL_TAKEN: 'Esse e-mail já está em uso.',
  ACCOUNT_BANNED: 'Esta conta foi suspensa.',
  INVALID_SNAPSHOT: 'O servidor não aceitou o retrato.',
  DUEL_OPPONENT_UNAVAILABLE: 'Esse jogador não tem retrato publicado agora.',
  DUEL_SELF: 'Não dá para duelar contra o próprio retrato.',
  DUEL_NOT_FOUND: 'Duelo não encontrado.',
  DUEL_ALREADY_FINISHED: 'Esse duelo já foi encerrado.',
  TOO_MANY_DUELS: 'Muitos duelos na última hora. Descanse um pouco.',
  SERVER_ERROR: 'O servidor deu erro. Tente de novo.',
  NOT_FOUND: 'Rota não encontrada no servidor.',
  OFFLINE: 'Sem conexão com o servidor de duelos.',
  OAUTH_STATE: 'O login demorou demais. Tente de novo.',
  OAUTH_CANCELLED: 'Login cancelado.',
  OAUTH_FAILED: 'Não deu para entrar agora. Tente de novo.',
  OAUTH_TOKEN_FAILED: 'O provedor recusou o login. Tente de novo.',
  OAUTH_PROFILE_FAILED: 'Não deu para ler o seu perfil no provedor. Tente de novo.',
  PROVIDER_DISABLED: 'Esse jeito de entrar está desligado no servidor.',
  LAST_LOGIN: 'É o único jeito de entrar nesta conta: ligue outro antes de desligar este.',
  NOT_LINKED: 'Essa conta não está ligada a este provedor.',
  MAINTENANCE: 'Servidor em manutenção: os duelos voltam em instantes.',
};

/** Ligas por pontuação, com os nomes das patentes ninja (pedido do autor); emblemas `league-*` no atlas dos selos. */
export const LEAGUES: { min: number; name: string; emblem: string }[] = [
  { min: 0, name: 'Liga Genin', emblem: 'league-genin' },
  { min: 1100, name: 'Liga Chunin', emblem: 'league-chunin' },
  { min: 1250, name: 'Liga Jounin', emblem: 'league-jounin' },
  { min: 1400, name: 'Liga ANBU', emblem: 'league-anbu' },
  { min: 1550, name: 'Liga Kage', emblem: 'league-kage' },
  { min: 1700, name: 'Liga Sannin', emblem: 'league-sannin' },
];
export function leagueOf(rating: number) {
  let out = LEAGUES[0]!;
  for (const l of LEAGUES) if (rating >= l.min) out = l;
  return out;
}
/** Pontos que faltam para a próxima liga (null na última). */
export function nextLeague(rating: number) {
  return LEAGUES.find((l) => l.min > rating) ?? null;
}

export class ArenaError extends Error {
  constructor(public code: string) {
    super(ERROR_TEXT[code] ?? `Erro do servidor (${code}).`);
  }
}

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* sem armazenamento (vitrine, janela privada) */
    }
  },
};

export class ArenaClient {
  /** Origem do servidor ('' = a mesma do jogo, pelo proxy /api). `?arena=http://host:3012` troca e guarda. */
  base = '';
  token: string | null = null;
  account: ArenaAccount | null = null;
  stats: ArenaStats | null = null;
  /** Retrato publicado (null = nenhum). */
  published: Published | null = null;
  online = 0;
  /** Adversário sorteado, à espera do "Lutar". */
  opponent: Opponent | null = null;
  ranking: { top: RankRow[]; me: ArenaStats & { position: number | null } } | null = null;
  defenses: { defenses: Defense[]; unseen: number } | null = null;
  history: HistoryRow[] | null = null;
  /** Duelo on-line em andamento no jogo: ao acabar (`state.lastDuel` muda), o resultado vai para o servidor. */
  pending: { duelId: string; opponent: Opponent } | null = null;
  /** Último resultado on-line (mostrado na janela). */
  lastOnline: { won: boolean; delta: number; opponent: Opponent } | null = null;
  status: 'idle' | 'loading' | 'ok' | 'offline' = 'idle';
  /** Último erro em português (some na próxima chamada que der certo). */
  error: string | null = null;
  busy = false;
  /** Jeitos de entrar ligados no servidor (Discord/Google); null = ainda não perguntou. */
  providers: Provider[] | null = null;
  /** Acabou de voltar do Discord/Google (a interface abre a aba Conta e avisa). */
  socialReturn: { ok: boolean; linked: boolean } | null = null;
  /** Avisa a interface que algo mudou. */
  onChange: () => void = () => {};
  /** Aviso novo da equipe para mostrar (a interface abre a janela e marca como lido). */
  onNotice: (n: Notice) => void = () => {};
  /** Manutenção marcada (até quando), vinda junto com os avisos. */
  maintenance: { until: string } | null = null;
  private shownNotices = new Set<number>();
  private lastDuelSeen: DuelResult | null | undefined;

  constructor() {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('arena') : null;
    if (q != null) store.set(URL_KEY, q || null);
    this.base = (store.get(URL_KEY) ?? '').replace(/\/+$/, '');
    this.token = store.get(TOKEN_KEY);
    this.readSocialReturn();
    const p = store.get(PENDING_KEY);
    if (p) {
      try {
        this.pending = JSON.parse(p);
      } catch {
        store.set(PENDING_KEY, null);
      }
    }
  }

  /**
   * Volta do login do Discord/Google: o servidor manda o token (ou o erro) no fragmento do endereço (`#vn_token=…`),
   * que não vai para servidor nem para o histórico depois que limpamos aqui.
   */
  private readSocialReturn() {
    if (typeof location === 'undefined' || !location.hash.includes('vn_')) return;
    const h = new URLSearchParams(location.hash.slice(1));
    const token = h.get('vn_token');
    const err = h.get('vn_error');
    if (token) {
      this.token = token;
      store.set(TOKEN_KEY, token);
      this.socialReturn = { ok: true, linked: h.get('vn_linked') === '1' };
    } else if (err) {
      this.error = new ArenaError(err).message;
      this.socialReturn = { ok: false, linked: false };
    }
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* sem history (testes) */
    }
  }

  get offline() {
    return this.status === 'offline';
  }

  /** Defesas que o jogador ainda não viu (bolinha no botão Duelos). */
  get unseen() {
    return this.defenses?.unseen ?? 0;
  }

  /**
   * Ao abrir o jogo: só quem já entrou na arena alguma vez (tem token) é reconectado, para contar as defesas novas;
   * quem nunca abriu a janela não vira convidado à toa.
   */
  async boot(): Promise<boolean> {
    if (!this.token) return false;
    const me = await this.refreshMe();
    if (!me) return false;
    // avisos da equipe: agora e a cada minuto (só quem tem conta na arena; não cria convidado à toa)
    void this.pollNotices();
    setInterval(() => void this.pollNotices(), 60_000);
    await this.loadDefenses(false);
    return this.unseen > 0;
  }

  /** Busca os avisos valendo; cada um não lido aparece uma vez (marca lido ao mostrar). */
  async pollNotices() {
    if (!this.token || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      const r = await this.call<{ notices: Notice[]; maintenance: { until: string } | null }>('GET', '/api/notices', undefined, { retry: false });
      this.maintenance = r.maintenance;
      for (const n of r.notices) {
        if (n.read || this.shownNotices.has(n.id)) continue;
        this.shownNotices.add(n.id);
        this.onNotice(n);
        void this.call('POST', `/api/notices/${n.id}/read`, {}).catch(() => undefined);
      }
    } catch {
      /* sem rede: tenta no próximo minuto */
    }
  }

  /** O jogador tocou no botão do aviso. */
  noticeClicked(id: number) {
    void this.call('POST', `/api/notices/${id}/click`, {}).catch(() => undefined);
  }

  private changed() {
    this.onChange();
  }

  /** Chamada à API; sem token cria o convidado primeiro (menos para as rotas de entrada). */
  private async call<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean; retry?: boolean } = {}): Promise<T> {
    const auth = opts.auth ?? true;
    if (auth && !this.token) await this.guest();
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(auth && this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      this.status = 'offline';
      throw new ArenaError('OFFLINE');
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = typeof data.error === 'string' ? data.error : 'SERVER_ERROR';
      // sessão apagada no servidor: vira convidado de novo e tenta uma vez
      if (code === 'UNAUTHORIZED' && auth && opts.retry !== false) {
        this.token = null;
        store.set(TOKEN_KEY, null);
        await this.guest();
        return this.call<T>(method, path, body, { ...opts, retry: false });
      }
      throw new ArenaError(code);
    }
    this.status = 'ok';
    this.error = null;
    return data as T;
  }

  /** Envolve uma ação da interface: marca ocupado, guarda o erro em português e avisa a janela. */
  private async run<T>(fn: () => Promise<T>): Promise<T | null> {
    this.busy = true;
    this.changed();
    try {
      return await fn();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  private async guest() {
    const r = await this.call<{ token: string; account: ArenaAccount }>('POST', '/api/auth/guest', {}, { auth: false });
    this.token = r.token;
    this.account = r.account;
    store.set(TOKEN_KEY, r.token);
  }

  /** Entra (convidado automático) e carrega a conta, o placar e o retrato publicado. */
  refreshMe() {
    return this.run(async () => {
      this.status = this.status === 'ok' ? 'ok' : 'loading';
      const r = await this.call<{ account: ArenaAccount; stats: ArenaStats; snapshot: Published | null; online: number }>('GET', '/api/me');
      this.account = r.account;
      this.stats = r.stats;
      this.published = r.snapshot;
      this.online = r.online;
      return r;
    });
  }

  publish(code: string) {
    return this.run(async () => {
      const r = await this.call<Published>('PUT', '/api/snapshot', { code });
      this.published = r;
      return r;
    });
  }

  findOpponent() {
    return this.run(async () => {
      const not = this.opponent?.opponentId;
      const r = await this.call<{ opponent: Opponent | null }>('GET', `/api/duel/opponent${not ? `?not=${not}` : ''}`);
      this.opponent = r.opponent;
      if (!r.opponent) this.error = 'Nenhum adversário com retrato publicado nos últimos 30 dias. Volte mais tarde.';
      return r.opponent;
    });
  }

  /** Retrato atual de um jogador (revanche). */
  fetchOpponent(id: string) {
    return this.run(async () => {
      const r = await this.call<{ opponent: Opponent }>('GET', `/api/duel/opponent/${id}`);
      this.opponent = r.opponent;
      return r.opponent;
    });
  }

  /** Abre o duelo no servidor; devolve o retrato para o jogo lutar. `onStart` monta a luta; se falhar, o duelo é cancelado. */
  startOnline(opponent: Opponent, onStart: (code: string) => { ok: true } | { ok: false; error: string }) {
    return this.run(async () => {
      const r = await this.call<{ duelId: string; code: string }>('POST', '/api/duel/start', { opponentId: opponent.opponentId });
      const started = onStart(r.code);
      if (!started.ok) {
        await this.call('POST', '/api/duel/cancel', { duelId: r.duelId }).catch(() => undefined);
        throw new Error(started.error);
      }
      this.pending = { duelId: r.duelId, opponent };
      store.set(PENDING_KEY, JSON.stringify(this.pending));
      this.opponent = null;
      return r;
    });
  }

  private async finish(won: boolean, summary: Record<string, unknown>) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    store.set(PENDING_KEY, null);
    await this.run(async () => {
      const r = await this.call<{ rating: number; delta: number; defDelta: number }>('POST', '/api/duel/finish', { duelId: p.duelId, won, summary });
      this.lastOnline = { won, delta: r.delta, opponent: p.opponent };
      if (this.stats) this.stats = { ...this.stats, rating: r.rating, wins: this.stats.wins + (won ? 1 : 0), losses: this.stats.losses + (won ? 0 : 1) };
      return r;
    });
    // histórico e ranking mudaram: busca de novo (a janela pede os dois só de 30 em 30 s)
    void this.loadHistory();
    this.ranking = null;
  }

  /** Chamado a cada ciclo da interface: quando o duelo on-line acaba no jogo, manda o resultado. */
  tick(g: Game) {
    const ld = g.state.lastDuel ?? null;
    if (this.lastDuelSeen === undefined) {
      this.lastDuelSeen = ld;
      return;
    }
    if (ld === this.lastDuelSeen) return;
    this.lastDuelSeen = ld;
    if (this.pending && ld && !this.busy) void this.finish(ld.won, { day: ld.day, mine: ld.mine, foe: ld.foe });
  }

  loadRanking() {
    return this.run(async () => (this.ranking = await this.call('GET', '/api/duel/ranking')));
  }

  loadDefenses(markSeen = false) {
    return this.run(async () => {
      this.defenses = await this.call('GET', '/api/duel/defenses');
      if (markSeen && this.defenses?.unseen) {
        await this.call('POST', '/api/duel/defenses/seen', {});
        this.defenses = { ...this.defenses, unseen: 0, defenses: this.defenses.defenses.map((d) => ({ ...d, unseen: false })) };
      }
      return this.defenses;
    });
  }

  loadHistory() {
    return this.run(async () => (this.history = (await this.call<{ duels: HistoryRow[] }>('GET', '/api/duel/history')).duels));
  }

  register(username: string, password: string, email: string) {
    return this.run(async () => {
      const r = await this.call<{ account: ArenaAccount }>('POST', '/api/auth/register', { username, password, email: email || undefined });
      this.account = r.account;
      return r.account;
    });
  }

  /** Quais provedores o servidor tem ligados (uma vez por sessão do jogo). */
  loadProviders() {
    this.providersReq ??= this.call<{ providers: Provider[] }>('GET', '/api/auth/providers', undefined, { auth: false })
      .then((r) => (this.providers = r.providers))
      .catch(() => (this.providers = []))
      .finally(() => this.changed());
    return this.providersReq;
  }
  private providersReq: Promise<Provider[]> | null = null;

  /**
   * Entrar com Discord/Google: com sessão aberta (convidado ou conta), o provedor é ligado a ela (bilhete de uso
   * único, porque a navegação não leva o token); o navegador vai ao provedor e volta para esta mesma página.
   */
  social(provider: Provider['id']) {
    return this.run(async () => {
      const ticket = this.token ? (await this.call<{ ticket: string }>('POST', '/api/auth/link-ticket', {})).ticket : null;
      const q = new URLSearchParams({ return: location.pathname + location.search });
      if (ticket) q.set('ticket', ticket);
      location.href = `${this.base}/api/auth/${provider}/start?${q}`;
      return true;
    });
  }

  unlink(provider: string) {
    return this.run(async () => {
      const r = await this.call<{ account: ArenaAccount }>('POST', '/api/me/unlink', { provider });
      this.account = r.account;
      return r.account;
    });
  }

  /** Entrar numa conta cadastrada (de outro aparelho): a sessão de convidado atual é trocada pela da conta. */
  login(login: string, password: string) {
    return this.run(async () => {
      const r = await this.call<{ token: string; account: ArenaAccount }>('POST', '/api/auth/login', { login, password }, { auth: false });
      this.token = r.token;
      store.set(TOKEN_KEY, r.token);
      this.account = r.account;
      this.forget();
      await this.refreshMe();
      return r.account;
    });
  }

  logout() {
    return this.run(async () => {
      await this.call('POST', '/api/auth/logout', {}).catch(() => undefined);
      this.token = null;
      store.set(TOKEN_KEY, null);
      this.account = null;
      this.forget();
      await this.refreshMe(); // volta como convidado novo
      return true;
    });
  }

  rename(name: string) {
    return this.run(async () => {
      const r = await this.call<{ name: string }>('POST', '/api/me/name', { name });
      if (this.account) this.account = { ...this.account, displayName: r.name };
      return r.name;
    });
  }

  private forget() {
    this.stats = null;
    this.published = null;
    this.opponent = null;
    this.ranking = null;
    this.defenses = null;
    this.history = null;
    this.lastOnline = null;
  }
}

export const arena = new ArenaClient();
