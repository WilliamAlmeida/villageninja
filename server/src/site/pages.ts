// Páginas públicas do site (HTML pronto do servidor). Dados vêm já agregados e guardados no cache (site/index.ts).
import { duels } from '../services/duels';
import { base, type Lang, leagueOf, T } from './i18n';
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
      return `<tr${i < 3 ? ` class="top${i + 1}"` : ''}><td class="pos">${i + 1}</td><td class="name">${esc(r.name)}</td><td class="champ">${champ}</td><td><span class="lg lg-${lg.pt.toLowerCase()}">${lg[lang]}</span></td><td class="num">${r.rating}</td><td class="num rec">${r.wins}/${r.losses}</td></tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="rank"><thead><tr><th>${t.colPos}</th><th>${t.colPlayer}</th><th class="champ">${t.colChampion}</th><th>${t.colLeague}</th><th class="num">${t.colPoints}</th><th class="num rec">${t.colRecord}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function homePage(lang: Lang, origin: string, top: Row[]): string {
  const t = T[lang];
  const b = base(lang);
  const features = t.features
    .map(([h, p], i) => `<article class="feat"><span class="feat-n">${String(i + 1).padStart(2, '0')}</span><h3>${h}</h3><p>${p}</p></article>`)
    .join('');
  const body = `
<section class="hero" style="--hero:url('${assetUrl('art/scene-village.png')}')">
  <div class="hero-in">
    <h1>${t.tagline}</h1>
    <p class="lead">${t.heroSub}</p>
    <div class="cta"><a class="btn play big" href="/play">${t.play}</a><a class="btn ghost big" href="${b}/entrar" data-login>${t.login}</a></div>
    <p class="note">${t.heroNote} <span class="live" data-online hidden></span></p>
    ${t.gameLangNote ? `<p class="note">${t.gameLangNote}</p>` : ''}
  </div>
</section>
<section class="sec">
  <h2>${t.featuresTitle}</h2>
  <div class="feats">${features}</div>
</section>
<section class="sec">
  <div class="sec-h"><div><h2>${t.rankingTitle}</h2><p class="sub">${t.rankingSub}</p></div><a class="more" href="${b}/ranking">${t.rankingAll} →</a></div>
  ${rankingTable(lang, top.slice(0, 10))}
</section>
<section class="sec final" style="--hero:url('${assetUrl('art/duel-arena-bg.png')}')">
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

export function notFoundPage(lang: Lang, origin: string): string {
  const t = T[lang];
  return page({ lang, path: '/', title: '404', body: `<section class="sec page-h"><h1>404</h1><p class="sub">${t.notFound}</p><p><a class="btn ghost" href="${base(lang) || '/'}">${t.back}</a></p></section>`, origin });
}
