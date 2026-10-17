// Páginas públicas do site (HTML pronto do servidor). Dados vêm já agregados e guardados no cache (site/index.ts).
import { duels } from '../services/duels';
import { type NewsRow, renderBody } from '../services/news';
import { BADGE_ATLAS, href, type Lang, LEAGUES, leagueOf, NATURE_NAME, STAT_NAME, STAT_ORDER, T } from './i18n';
import { esc, page } from './layout';
import { assetUrl } from './static';

type Row = Awaited<ReturnType<typeof duels.publicTop>>[number];

const RANK_NAME: Record<string, { pt: string; en: string }> = {
  genin: { pt: 'Genin', en: 'Genin' },
  chunin: { pt: 'Chunin', en: 'Chunin' },
  jounin: { pt: 'Jounin', en: 'Jonin' },
  kage: { pt: 'Kage', en: 'Kage' },
};

/** Selo da liga, da mesma arte do jogo (atlas badge-ranks.png). */
export function leagueBadge(col: number, cls = 'lgb'): string {
  const x = (col / (BADGE_ATLAS.cols - 1)) * 100;
  return `<i class="${cls}" style="background-image:url('${assetUrl('ui/badge-ranks.png')}');background-size:${BADGE_ATLAS.cols * 100}% ${BADGE_ATLAS.rows * 100}%;background-position:${x.toFixed(2)}% 0%"></i>`;
}

/**
 * Ranking trancado: a página (igual para todos, em cache) mostra linhas de mentira embaçadas e o aviso; quem entrou com
 * conta recebe as linhas de verdade pelo site.js (GET /api/duel/ranking) no mesmo formato (`data-ranking`).
 */
function rankingTable(lang: Lang, n: number): string {
  const t = T[lang];
  const h = (p: string) => href(lang, p);
  const fake = Array.from({ length: n }, (_, i) => {
    const lg = LEAGUES[Math.max(0, 5 - Math.floor(i / 2))]!;
    return `<tr${i < 3 ? ` class="top${i + 1}"` : ''}><td class="pos">${i + 1}</td><td class="name">${'Ninja Oculto'}</td><td class="champ">Campeão <small>Nv ${40 - i * 3}</small></td><td><span class="lg lg-${lg.pt.toLowerCase()}">${leagueBadge(lg.col)}${lg[lang]}</span></td><td class="num">${1800 - i * 60}</td><td class="num rec">${20 - i}/${i + 2}</td></tr>`;
  }).join('');
  const cfg = JSON.stringify({ lang, n, leagues: LEAGUES, atlas: assetUrl('ui/badge-ranks.png'), cols: BADGE_ATLAS.cols, rows: BADGE_ATLAS.rows, profile: h('/jogador/'), empty: t.rankingEmpty, lv: lang === 'pt' ? 'Nv' : 'Lv', ranks: RANK_NAME });
  return `<div class="rank-wrap locked" data-ranking='${cfg.replace(/'/g, '&#39;')}'>
    <div class="table-wrap"><table class="rank"><thead><tr><th>${t.colPos}</th><th>${t.colPlayer}</th><th class="champ">${t.colChampion}</th><th>${t.colLeague}</th><th class="num">${t.colPoints}</th><th class="num rec">${t.colRecord}</th></tr></thead><tbody>${fake}</tbody></table></div>
    <div class="lock"><div class="lock-in">${leagueBadge(7, 'lgb big')}<p>${t.rankingLocked}</p><a class="btn play" href="${h('/login')}?next=${encodeURIComponent(lang === 'pt' ? '/ranking' : '/en/ranking')}" data-login>${t.rankingLockedBtn}</a></div></div>
  </div>`;
}

/** Partículas de chakra (CSS anima; posições diferentes por nth-child). */
const chakra = (n = 14) => `<div class="chakra" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;

export function homePage(lang: Lang, origin: string, _top: Row[], latest: NewsRow[] = []): string {
  const t = T[lang];
  const h = (p: string) => href(lang, p);
  const img = (k: string) => assetUrl(`img/${k}.webp`);
  const SIZES: Record<string, string> = { village: 'width="1920" height="910"', arena: 'width="960" height="720"', region: 'width="1800" height="1110"' };
  const show = t.show
    .map(([k, eyebrow, title, text], i) => `<article class="show reveal${i % 2 ? ' flip' : ''}"><figure class="frame"><img src="${img(k)}" alt="${esc(title)}" loading="lazy" ${SIZES[k] ?? 'width="1536" height="1024"'}></figure><div class="show-t"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${text}</p></div></article>`)
    .join('');
  const more = [t.features[1], t.features[3]]
    .map(([title, text]) => `<article class="feat reveal"><h3>${title}</h3><p>${text}</p></article>`)
    .join('');
  const body = `
<section class="hero" style="--hero:url('${img('hero')}')">
  ${chakra()}
  <div class="hero-in">
    <span class="eyebrow rise">${t.eyebrow}</span>
    <h1 class="rise d1"><img class="hero-emblem" src="${assetUrl('img/emblem-256.png')}" alt="" width="96" height="96">${t.siteName}</h1>
    <p class="lead rise d2">${t.tagline} ${t.heroSub}</p>
    <div class="cta rise d3"><a class="btn play big glow" href="/play">${t.play}</a><a class="btn ghost big" href="${h('/login')}" data-login>${t.login}</a></div>
    <p class="note rise d4">${t.heroNote} <span class="live" data-online hidden></span></p>
    ${t.gameLangNote ? `<p class="note">${t.gameLangNote}</p>` : ''}
  </div>
</section>
<section class="sec shows">${show}</section>
${latest.length ? `<section class="sec reveal"><div class="sec-h"><div><h2 class="kunai">${t.newsTitle}</h2><p class="sub">${t.newsSub}</p></div><a class="more" href="${h('/novidades')}">${t.newsAll} →</a></div>${newsCards(lang, latest)}</section>` : ''}
<section class="sec">
  <h2 class="kunai reveal">${t.moreTitle}</h2>
  <div class="feats">${more}</div>
</section>
<section class="sec reveal">
  <div class="sec-h"><div><h2 class="kunai">${t.rankingTitle}</h2><p class="sub">${t.rankingSub}</p></div><a class="more" href="${h('/ranking')}" data-needs-account hidden>${t.rankingAll} →</a></div>
  ${rankingTable(lang, 10)}
</section>
<section class="sec final" style="--hero:url('${img('duel')}')">
  ${chakra(10)}
  <div class="reveal"><h2>${t.ctaTitle}</h2><p>${t.ctaSub}</p><a class="btn play big glow" href="/play">${t.play}</a></div>
</section>`;
  return page({ lang, path: '/', nav: 'home', body, origin });
}

export function rankingPage(lang: Lang, origin: string, _top: Row[]): string {
  const t = T[lang];
  const body = `<section class="sec page-h"><h1>${t.rankingTitle}</h1><p class="sub">${t.rankingSub}</p></section><section class="sec">${rankingTable(lang, 20)}</section>`;
  return page({ lang, path: '/ranking', nav: 'ranking', title: t.rankingTitle, body, origin });
}

/** Entrar: os botões aparecem pelo site.js (pergunta os provedores ligados e leva o convidado junto). */
export function loginPage(lang: Lang, origin: string): string {
  const t = T[lang];
  const body = `<section class="sec login">${chakra(8)}<div class="card reveal in"><img class="login-emblem" src="${assetUrl('img/emblem-256.png')}" alt="" width="72" height="72"><h1>${t.loginTitle}</h1><p class="sub">${t.loginChoose} ${t.loginSub}</p>
  <div class="providers" data-providers data-none="${esc(t.loginNone)}" data-with="${esc(t.loginWith('%s'))}" data-error="${esc(t.loginError)}" data-guest="${esc(t.guestBtn)}"><span class="spin"></span></div>
  <p class="guest-note" data-guest-note>${t.guestNote}</p><p class="guest-note" data-guest-upgrade hidden>${t.guestUpgrade}</p></div></section>`;
  return page({ lang, path: '/login', title: t.loginTitle, body, origin });
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
    <div class="ph"><span class="shuriken-frame"><img class="pav" src="${p.avatarUrl ? esc(p.avatarUrl) : assetUrl('img/emblem-256.png')}" alt="" width="72" height="72" referrerpolicy="no-referrer" onerror="this.src='${assetUrl('img/emblem-256.png')}'"></span>
      <div><h1>${esc(p.name)}</h1><p class="sub">${pt.since} ${date(p.createdAt)}</p></div>${lg ? `<span class="lg lg-${lg.pt.toLowerCase()} big">${leagueBadge(lg.col)}${t.colLeague} ${lg[lang]}</span>` : ''}</div>
    <div class="ptiles">${tile(st?.rating ?? '—', pt.points)}${tile(p.position ? `#${p.position}` : '—', pt.position)}${tile(st ? `${st.wins}/${st.losses}` : '—', pt.attack)}${tile(st ? `${st.defWins}/${st.defLosses}` : '—', pt.defense)}</div>
    <div class="pgrid"><article class="pcard reveal in"><h2 class="kunai">${pt.champion}</h2>${champ}</article><article class="pcard reveal in"><h2 class="kunai">${pt.duels}</h2>${duelsHtml}</article></div>
  </section>`;
  return page({ lang, path: `/jogador/${p.id}`, nav: 'ranking', title: p.name, desc: `${p.name} · ${lg ? lg[lang] : ''} ${st?.rating ?? ''}`.trim(), body, origin });
}

const newsTitle = (lang: Lang, n: NewsRow) => (lang === 'en' && n.titleEn) || n.titlePt;
const newsSummary = (lang: Lang, n: NewsRow) => (lang === 'en' && n.summaryEn) || n.summaryPt;
const newsDate = (lang: Lang, d: Date | null) => (d ? new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : '');

/** Capa da novidade: uma das artes do site, sempre a mesma para a mesma notícia (a notícia não tem imagem própria). */
const COVERS = ['village', 'battle', 'arena', 'duel', 'region', 'night'];
const newsCover = (n: NewsRow) => assetUrl(`img/${COVERS[n.id % COVERS.length]}.webp`);
const newsText = (lang: Lang, n: NewsRow) => (lang === 'en' && n.bodyEn) || n.bodyPt;
const readMin = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
const isNew = (n: NewsRow) => !!n.publishedAt && Date.now() - new Date(n.publishedAt).getTime() < 7 * 864e5;

function newsCard(lang: Lang, n: NewsRow, big = false): string {
  const t = T[lang];
  return `<a class="news-card${big ? ' big' : ''} reveal" href="${href(lang, `/novidades/${n.slug}`)}">
    <span class="nc-img" style="background-image:url('${newsCover(n)}')">${isNew(n) ? `<b class="nc-new">${t.newsNew}</b>` : ''}</span>
    <span class="nc-in"><span class="nc-meta"><time>${newsDate(lang, n.publishedAt)}</time><span>${readMin(newsText(lang, n))} ${t.newsMin}</span></span>
    <h3>${esc(newsTitle(lang, n))}</h3>${newsSummary(lang, n) ? `<p>${esc(newsSummary(lang, n))}</p>` : ''}<span class="more">${t.readMore} →</span></span></a>`;
}

/** Cartões de novidades (início e lista); `lead` = a mais recente em destaque, na largura toda. */
export function newsCards(lang: Lang, rows: NewsRow[], lead = false): string {
  const t = T[lang];
  if (!rows.length) return `<p class="empty">${t.newsEmpty}</p>`;
  return `<div class="news">${rows.map((n, i) => newsCard(lang, n, lead && i === 0)).join('')}</div>`;
}

/** Faixa de topo com arte ao fundo (lista e notícia). */
const banner = (img: string, inner: string, cls = '') => `<section class="nbanner${cls}" style="--hero:url('${img}')"><div class="nbanner-in">${inner}</div></section>`;

export function newsListPage(lang: Lang, origin: string, rows: NewsRow[]): string {
  const t = T[lang];
  const head = banner(assetUrl('img/night.webp'), `<span class="eyebrow rise d1">${t.siteName}</span><h1 class="rise d2">${t.newsTitle}</h1><p class="lead rise d3">${t.newsSub}</p>`);
  const body = `${head}<section class="sec news-list">${newsCards(lang, rows, true)}</section>`;
  return page({ lang, path: '/novidades', nav: 'news', title: t.newsTitle, body, origin });
}

export function newsPage(lang: Lang, origin: string, n: NewsRow, more: NewsRow[] = []): string {
  const t = T[lang];
  const text = newsText(lang, n);
  const summary = newsSummary(lang, n);
  const head = banner(newsCover(n), `<a class="back rise d1" href="${href(lang, '/novidades')}">← ${t.newsAll}</a>
    <h1 class="rise d2">${esc(newsTitle(lang, n))}</h1>
    <p class="nc-meta rise d3"><time>${newsDate(lang, n.publishedAt)}</time><span>${readMin(text)} ${t.newsMin}</span></p>`, ' article-h');
  const others = more.filter((m) => m.id !== n.id).slice(0, 3);
  const body = `${head}<section class="sec article">
    ${summary ? `<p class="lead-s">${esc(summary)}</p>` : ''}<div class="prose">${renderBody(text)}</div>
    <div class="cta-card frame"><div><h2>${t.newsCta}</h2><p>${t.newsCtaSub}</p></div><a class="btn play big" href="/play">${t.play}</a></div>
  </section>${others.length ? `<section class="sec news-more"><div class="sec-h"><h2 class="kunai">${t.newsMore}</h2><a class="more" href="${href(lang, '/novidades')}">${t.newsAll} →</a></div>${newsCards(lang, others)}</section>` : ''}`;
  return page({ lang, path: `/novidades/${n.slug}`, nav: 'news', title: newsTitle(lang, n), desc: summary || undefined, image: newsCover(n), body, origin });
}

export function notFoundPage(lang: Lang, origin: string): string {
  const t = T[lang];
  return page({ lang, path: '/', title: '404', body: `<section class="sec page-h"><h1>404</h1><p class="sub">${t.notFound}</p><p><a class="btn ghost" href="${href(lang, '/')}">${t.back}</a></p></section>`, origin });
}
