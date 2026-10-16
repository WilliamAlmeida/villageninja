// Cache e contadores curtos: Redis quando `REDIS_URL` está no .env (VPS e o container `redis` do WSL), memória do
// processo quando não está ou quando o Redis cai (tenta de novo a cada 30 s). Guarda só coisa que pode sumir: páginas e
// números prontos, limites de tentativas, o estado do login do Discord/Google e o "quem está on-line".
import { RedisClient } from 'bun';
import { config } from './config';

const RETRY_MS = 30_000;
const mem = new Map<string, { value: string; expiresAt: number }>();
let client: RedisClient | null = null;
let downUntil = 0;
let warned = false;

let connecting: Promise<void> | null = null;

async function redis(): Promise<RedisClient | null> {
  if (!config.redisUrl || Date.now() < downUntil) return null;
  client ??= new RedisClient(config.redisUrl, { connectionTimeout: 1500, autoReconnect: false, maxRetries: 0, enableOfflineQueue: false });
  if (!client.connected) await (connecting ??= client.connect().finally(() => (connecting = null)));
  return client;
}

/** Roda no Redis; se ele falhar, marca como fora do ar e devolve `undefined` (quem chamou usa a memória). */
async function tryRedis<T>(fn: (r: RedisClient) => Promise<T>): Promise<T | undefined> {
  try {
    const r = await redis();
    if (!r) return undefined;
    return await fn(r);
  } catch (e) {
    if (!warned) console.warn('[cache] Redis indisponível, usando a memória:', (e as Error).message);
    warned = true;
    connecting = null;
    downUntil = Date.now() + RETRY_MS;
    try {
      client?.close();
    } catch {
      /* já fechado */
    }
    client = null;
    return undefined;
  }
}

const k = (key: string) => config.redisPrefix + key;

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

export const cache = {
  async get(key: string): Promise<string | null> {
    const v = await tryRedis((r) => r.get(k(key)));
    return v === undefined ? memGet(key) : v;
  },

  async set(key: string, value: string, ttlSec: number): Promise<void> {
    const ok = await tryRedis((r) => r.set(k(key), value, 'EX', ttlSec));
    if (ok === undefined) mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  },

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) mem.delete(key);
    await tryRedis((r) => r.del(...keys.map(k)));
  },

  /** Lê e apaga (uso único: estado do login, bilhete de vínculo). */
  async take(key: string): Promise<string | null> {
    const v = await tryRedis((r) => r.getdel(k(key)));
    if (v !== undefined) return v;
    const m = memGet(key);
    mem.delete(key);
    return m;
  },

  async getJson<T>(key: string): Promise<T | null> {
    const v = await this.get(key);
    return v == null ? null : (JSON.parse(v) as T);
  },

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSec);
  },

  /** Valor pronto ou calcula, guarda por `ttlSec` e devolve (números do painel, ranking, páginas). */
  async remember<T>(key: string, ttlSec: number, compute: () => Promise<T>): Promise<T> {
    const hit = await this.getJson<T>(key);
    if (hit != null) return hit;
    const value = await compute();
    await this.setJson(key, value, ttlSec);
    return value;
  },

  /** Conta mais um na janela de `windowSec` e devolve o total (a janela começa no primeiro). */
  async hit(key: string, windowSec: number): Promise<number> {
    const n = await tryRedis(async (r) => {
      const count = await r.incr(k(key));
      if (count === 1) await r.expire(k(key), windowSec);
      return count;
    });
    if (n !== undefined) return n;
    const cur = memGet(key);
    const count = (cur ? Number(cur) : 0) + 1;
    const e = mem.get(key);
    mem.set(key, { value: String(count), expiresAt: e && cur ? e.expiresAt : Date.now() + windowSec * 1000 });
    return count;
  },

  /** Redis no ar? (para a saúde do servidor no painel) */
  async backend(): Promise<'redis' | 'memory'> {
    const pong = await tryRedis((r) => r.ping());
    return pong === undefined ? 'memory' : 'redis';
  },

  /** Só para os testes. */
  async clear(): Promise<void> {
    mem.clear();
    await tryRedis(async (r) => {
      const keys = await r.send('KEYS', [k('*')]);
      if (Array.isArray(keys) && keys.length) await r.del(...(keys as string[]));
    });
  },
};
