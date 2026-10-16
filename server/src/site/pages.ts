// Páginas públicas do site (HTML pronto do servidor). Dados vêm já agregados e guardados no cache (site/index.ts).
import { duels } from '../services/duels';
import { type NewsRow, renderBody } from '../services/news';
import { href, type Lang, leagueOf, NATURE_NAME, STAT_NAME, STAT_ORDER, T } from './i18n';
import { esc, page } from './layout';
import { assetUrl } from './static';

type Row = Awaited<ReturnType<typeof duels.publicTop>>[number];

const RANK_NAME: Record<string, { pt: string; en: string }> = {
  genin: { pt: 'Genin', en: 'Genin' },
  chunin: { pt: 'Chunin', en: 'Chunin' },
  jounin: { pt: 'Jounin', en: 'Jonin' },
  kage: { pt: 'Kage', en: 'Kage' },
};

function rankingTable(lang: Lang, rows: Row[]): string {
  const t = T[lang];
  if (!rows.length) return `<p class="empty">${t.rankingEmpty}</p>`;
  const body = rows
    .map((r, i) => {
      const lg = leagueOf(r.rating);
      const champ = r.ninja ? `${esc(r.ninja.name)} <small>${esc(RANK_NAME[r.ninja.rank]?.[lang] ?? r.ninja.rank)} · ${lang === 'pt' ? 'Nv' : 'Lv'} ${r.ninja.level}</small>` : '<small>—</small>';
      return `<tr${i < 3 ? ` class="top${i + 1}"` : ''}><td class="pos">${i + 1}</td><td class="name"><a href="${href(lang, `/jogador/${r.userId}`)}">${esc(r.name)}</a></td><td class="champ">${champ}</td><td><span class="lg lg-${lg.pt.toLowerCase()}">${lg[lang]}</span></td><td class="num">${r.rating}</td><td class="num rec">${r.wins}/${r.losses}</td></tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="rank"><thead><tr><th>${t.colPos}</th><th>${t.colPlayer}</th><th class="champ">${t.colChampion}</th><th>${t.colLeague}</th><th class="num">${t.colPoints}</th><th class="num rec">${t.colRecord}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function homePage(lang: Lang, origin: string, top: Row[], latest: NewsRow[] = []): string {
  const t = T[lang];
  const h = (p: string) => href(lang, p);
  const img = (k: string) => assetUrl(`img/${k}.webp`);
  const show = t.show
    .map(([k, eyebrow, title, text], i) => `<article class="show${i % 2 ? ' flip' : ''}"><figure><img src="${img(k)}" alt="${esc(title)}" loading="lazy" ${k === 'region' ? 'width="1800" height="1110"' : 'width="1536" height="1024"'}></figure><div class="show-t"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${text}</p></div></article>`)
    .join('');
  const more = [t.features[1], t.features[3]]
    .map(([title, text]) => `<article class="feat"><h3>${title}</h3><p>${text}</p></article>`)
    .join('');
  const body = `
<section class="hero" style="--hero:url('${img('hero')}')">
  <div class="hero-in">
    <span class="eyebrow">${t.eyebrow}</span>
    <h1><img class="hero-emblem" src="${assetUrl('img/emblem-256.png')}" alt="" width="96" height="96">${t.siteName}</h1>
    <p class="lead">${t.tagline} ${t.heroSub}</p>
    <div class="cta"><a class="btn play big" href="/play">${t.play}</a><a class="btn ghost big" href="${h('/entrar')}" data-login>${t.login}</a></div>
    <p class="note">${t.heroNote} <span class="live" data-online hidden></span></p>
    ${t.gameLangNote ? `<p class="note">${t.gameLangNote}</p>` : ''}
  </div>
</section>
<section class="sec shows">${show}</section>
${latest.length ? `<section class="sec"><div class="sec-h"><div><h2>${t.newsTitle}</h2><p class="sub">${t.newsSub}</p></div><a class="more" href="${h('/novidades')}">${t.newsAll} →</a></div>${newsCards(lang, latest)}</section>` : ''}
<section class="sec">
  <h2>${t.moreTitle}</h2>
  <div class="feats">${more}</div>
</section>
<section class="sec">
  <div class="sec-h"><div><h2>${t.rankingTitle}</h2><p class="sub">${t.rankingSub}</p></div><a class="more" href="${h('/ranking')}">${t.rankingAll} →</a></div>
  ${rankingTable(lang, top.slice(0, 10))}
</section>
<section class="sec final" style="--hero:url('${img('arena')}')">
  <h2>${t.ctaTitle}</h2><p>${t.ctaSub}</p><a class="btn play big" href="/play">${t.play}</a>
</section>`;
  return page({ lang, path: '/', nav: 'home', body, origin });
}

export function rankingPage(lang: Lang, origin: string, top: Row[]): string {
  const t = T[lang];
  const body = `<section class="sec page-h"><h1>${t.rankingTitle}</h1><p class="sub">${t.rankingSub}</p></section><section class="sec">${rankingTable(lang, top)}</section>`;
  return page({ lang, path: '/ranking', nav: 'ranking', title: t.rankingTitle, body, origin });
}

/** Entrar: os botões aparecem pelo site.js (pergunta os provedores ligados e leva o convidado junto). */
export function loginPage(lang: Lang, origin: string): string {
  const t = T[lang];
  const body = `<section class="sec login"><div class="card"><h1>${t.loginTitle}</h1><p class="sub">${t.loginSub}</p>
  <div class="providers" data-providers data-none="${esc(t.loginNone)}" data-with="${esc(t.loginWith('%s'))}" data-error="${esc(t.loginError)}"><span class="spin"></span></div></div></section>`;
  return page({ lang, path: '/entrar', title: t.loginTitle, body, origin });
}

type Profile = NonNullable<Awaited<ReturnType<typeof duels.publicProfile>>>;

export function profilePage(lang: Lang, origin: string, p: Profile): string {
  const t = T[lang];
  const pt = t.profile;
  const date = (d: Date | string) => new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const st = p.stats;
  const lg = st ? leagueOf(st.rating) : null;
  const c = p.champion;
  const tile = (v: unknown, l: string) => `<div class="ptile"><b>${v}</b><small>${l}</small></div>`;
  let champ = `<p class="sub">${pt.noChampion}</p>`;
  if (c) {
    const vals = Object.values(c.stats as Record<string, number>);
    const max = Math.max(1, ...vals);
    const nat = NATURE_NAME[c.nature];
    const cs = c.stats as Record<string, number>;
    const bars = STAT_ORDER.filter((k) => k in cs)
      .map((k) => [k, cs[k]!] as const)
      .map(([k, v]) => `<li><span>${STAT_NAME[k]?.[lang] ?? k}</span><span class="pbar"><i style="width:${(v / max) * 100}%;background:${STAT_NAME[k]?.color ?? 'var(--accent)'}"></i></span><b>${v}</b></li>`)
      .join('');
    champ = `<div class="champ-h"><h3>${esc(c.name)}</h3><span class="lg">${esc(RANK_NAME[c.rank]?.[lang] ?? c.rank)}</span>
      <span class="muted">${pt.level} ${c.level}${nat ? ` · ${pt.nature}: <b style="color:${nat.color}">${nat[lang]}</b>` : ''}${c.from ? ` · ${pt.village}: ${esc(c.from)}` : ''}</span></div>
      <h4 class="muted">${pt.stats}</h4><ul class="pstats">${bars}</ul>`;
  }
  const duelsHtml = p.recent.length
    ? `<ul class="plist">${p.recent.map((d) => `<li><span>${d.attacking ? pt.attacked : pt.defended} <a href="${href(lang, `/jogador/${d.otherId}`)}">${esc(d.other)}</a></span><span><span class="res ${d.won ? 'w' : 'l'}">${d.won ? pt.won : pt.lost}</span> <small class="muted">${date(d.at)}</small></span></li>`).join('')}</ul>`
    : `<p class="sub">${pt.noDuels}</p>`;
  const body = `<section class="sec page-h profile">
    <div class="ph">${p.avatarUrl ? `<img class="pav" src="${esc(p.avatarUrl)}" alt="" width="72" height="72">` : `<img class="pav" src="${assetUrl('img/emblem-256.png')}" alt="" width="72" height="72">`}
      <div><h1>${esc(p.name)}</h1><p class="sub">${pt.since} ${date(p.createdAt)}</p></div>${lg ? `<span class="lg lg-${lg.pt.toLowerCase()} big">${t.colLeague} ${lg[lang]}</span>` : ''}</div>
    <div class="ptiles">${tile(st?.rating ?? '—', pt.points)}${tile(p.position ? `#${p.position}` : '—', pt.position)}${tile(st ? `${st.wins}/${st.losses}` : '—', pt.attack)}${tile(st ? `${st.defWins}/${st.defLosses}` : '—', pt.defense)}</div>
    <div class="pgrid"><article class="pcard"><h2>${pt.champion}</h2>${champ}</article><article class="pcard"><h2>${pt.duels}</h2>${duelsHtml}</article></div>
  </section>`;
  return page({ lang, path: `/jogador/${p.id}`, nav: 'ranking', title: p.name, desc: `${p.name} · ${lg ? lg[lang] : ''} ${st?.rating ?? ''}`.trim(), body, origin });
}

const newsTitle = (lang: Lang, n: NewsRow) => (lang === 'en' && n.titleEn) || n.titlePt;
const newsSummary = (lang: Lang, n: NewsRow) => (lang === 'en' && n.summaryEn) || n.summaryPt;
const newsDate = (lang: Lang, d: Date | null) => (d ? new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : '');

/** Cartões de novidades (início e lista). */
export function newsCards(lang: Lang, rows: NewsRow[]): string {
  const t = T[lang];
  if (!rows.length) return `<p class="empty">${t.newsEmpty}</p>`;
  return `<div class="news">${rows
    .map((n) => `<a class="news-card" href="${href(lang, `/novidades/${n.slug}`)}"><time>${newsDate(lang, n.publishedAt)}</time><h3>${esc(newsTitle(lang, n))}</h3><p>${esc(newsSummary(lang, n))}</p><span class="more">${t.readMore} →</span></a>`)
    .join('')}</div>`;
}

export function newsListPage(lang: Lang, origin: string, rows: NewsRow[]): string {
  const t = T[lang];
  const body = `<section class="sec page-h"><h1>${t.newsTitle}</h1><p class="sub">${t.newsSub}</p></section><section class="sec">${newsCards(lang, rows)}</section>`;
  return page({ lang, path: '/novidades', nav: 'news', title: t.newsTitle, body, origin });
}

export function newsPage(lang: Lang, origin: string, n: NewsRow): string {
  const t = T[lang];
  const text = (lang === 'en' && n.bodyEn) || n.bodyPt;
  const body = `<section class="sec page-h legal article"><p><a href="${href(lang, '/novidades')}">← ${t.newsAll}</a></p><time class="muted">${newsDate(lang, n.publishedAt)}</time><h1>${esc(newsTitle(lang, n))}</h1>
    ${newsSummary(lang, n) ? `<p class="lead-s">${esc(newsSummary(lang, n))}</p>` : ''}${renderBody(text)}
    <p style="margin-top:2rem"><a class="btn play big" href="/play">${t.play}</a></p></section>`;
  return page({ lang, path: `/novidades/${n.slug}`, nav: 'news', title: newsTitle(lang, n), desc: newsSummary(lang, n) || undefined, body, origin });
}

export function notFoundPage(lang: Lang, origin: string): string {
  const t = T[lang];
  return page({ lang, path: '/', title: '404', body: `<section class="sec page-h"><h1>404</h1><p class="sub">${t.notFound}</p><p><a class="btn ghost" href="${href(lang, '/')}">${t.back}</a></p></section>`, origin });
}
