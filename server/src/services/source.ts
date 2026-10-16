// De onde a conta veio: `?ref=` do link (campanhas: ?ref=tiktok, ?ref=discord-servidor) e o site anterior
// (document.referrer). O navegador guarda o primeiro por 30 dias (site.js e o jogo) e manda ao criar a conta.

/** Hosts parecidos viram um só (m.facebook.com → facebook.com, youtu.be → youtube.com…). */
const ALIASES: Array<[RegExp, string]> = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/, 'facebook.com'],
  [/(^|\.)instagram\.com$/, 'instagram.com'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube.com'],
  [/(^|\.)tiktok\.com$/, 'tiktok.com'],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, 'x.com'],
  [/(^|\.)discord(app)?\.(com|gg)$/, 'discord.com'],
  [/(^|\.)reddit\.com$/, 'reddit.com'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing.com'],
  [/(^|\.)itch\.(io|zone)$/, 'itch.io'],
  [/(^|\.)whatsapp\.(com|net)$|^wa\.me$/, 'whatsapp'],
];

export function normalizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const r = raw.trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9][a-z0-9_.-]*$/.test(r) ? r : null;
}

export function normalizeHost(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  let host = raw.trim().toLowerCase().replace(/^www\./, '').slice(0, 80);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) && host !== 'google' && host !== 'whatsapp') return null;
  for (const [re, name] of ALIASES) if (re.test(host)) return name;
  return host;
}
