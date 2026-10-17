// Parte viva do site, carregada depois da página: língua automática, quem está logado, ninjas on-line, a tela de entrar
// (convidado, Discord ou Google), o ranking trancado para quem não tem conta, e as animações. A conta é a mesma do jogo
// (token `vn_arena_token` no localStorage, mesma origem do /play).
(() => {
  const TOKEN = 'vn_arena_token';
  const LANG = 'vn_site_lang';
  const lang = document.body.dataset.lang;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/play');

  // língua: a troca automática na primeira visita é feita no <head> (layout.ts); aqui só guarda a escolha manual
  document.querySelectorAll('[data-lang-switch]').forEach((a) => a.addEventListener('click', () => store.set(LANG, a.dataset.langSwitch)));

  // abertura: o pergaminho termina de desenrolar e, com a página carregada, se parte em dois e abre (uma vez por visita)
  (() => {
    const root = document.documentElement;
    const sp = document.querySelector('.sp');
    if (!sp || !root.classList.contains('splash')) { if (sp) sp.remove(); return; }
    const t0 = performance.now();
    const open = () => {
      const wait = Math.max(0, 900 - (performance.now() - t0)); // deixa o pergaminho terminar de desenrolar
      setTimeout(() => {
        sp.classList.add('open');
        try { sessionStorage.setItem('vn_splash', '1'); } catch {}
        setTimeout(() => { root.classList.remove('splash'); sp.remove(); }, 900);
      }, wait);
    };
    if (document.readyState === 'complete') open(); else addEventListener('load', open, { once: true });
  })();

  // origem da visita (?ref= e site anterior): o primeiro fica 30 dias e vai junto quando a conta nascer
  (() => {
    const KEY = 'vn_ref';
    try {
      const cur = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (cur && Date.now() - cur.at < 30 * 864e5) return;
      const ref = new URLSearchParams(location.search).get('ref');
      let host = '';
      try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch {}
      if (host === location.hostname) host = '';
      if (ref || host) localStorage.setItem(KEY, JSON.stringify({ ref: ref ? ref.slice(0, 40) : null, host: host || null, at: Date.now() }));
    } catch {}
  })();
  const origin = () => { try { return JSON.parse(localStorage.getItem('vn_ref') || 'null') || {}; } catch { return {}; } };

  // volta do login do Discord/Google com o token no fragmento
  if (location.hash.includes('vn_')) {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('vn_token')) store.set(TOKEN, h.get('vn_token'));
    if (h.get('vn_error')) sessionStorage.setItem('vn_login_error', h.get('vn_error'));
    history.replaceState(null, '', location.pathname + location.search);
  }

  let token = store.get(TOKEN);
  const api = (path, opts = {}) =>
    fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } })
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(d))));

  // ---------- animações ----------
  // seções aparecem ao entrar na tela
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  // cabeçalho encolhe e a barra de progresso anda com a rolagem
  const top = document.querySelector('[data-top]');
  const bar = document.querySelector('[data-progress]');
  const onScroll = () => {
    const y = scrollY;
    if (top) top.classList.toggle('scrolled', y > 24);
    if (bar) bar.style.width = `${Math.min(100, (y / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 100)}%`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- on-line agora ----------
  const online = document.querySelector('[data-online]');
  if (online) {
    fetch('/api/health').then((r) => r.json()).then((d) => {
      if (!d.online) return;
      online.textContent = lang === 'pt' ? `${d.online} ${d.online === 1 ? 'ninja on-line' : 'ninjas on-line'}` : `${d.online} ${d.online === 1 ? 'ninja online' : 'ninjas online'}`;
      online.hidden = false;
    }).catch(() => {});
  }

  // ---------- ranking (só para quem entrou com conta) ----------
  function fillRanking(wrap, rows) {
    const cfg = JSON.parse(wrap.dataset.ranking);
    const tbody = wrap.querySelector('tbody');
    const badge = (col) => `<i class="lgb" style="background-image:url('${cfg.atlas}');background-size:${cfg.cols * 100}% ${cfg.rows * 100}%;background-position:${((col / (cfg.cols - 1)) * 100).toFixed(2)}% 0%"></i>`;
    const league = (r) => { let out = cfg.leagues[0]; for (const l of cfg.leagues) if (r >= l.min) out = l; return out; };
    const list = rows.slice(0, cfg.n);
    tbody.innerHTML = list.length
      ? list.map((r, i) => {
          const lg = league(r.rating);
          const rank = r.ninja ? (cfg.ranks[r.ninja.rank] || {})[cfg.lang] || r.ninja.rank : '';
          const champ = r.ninja ? `${esc(r.ninja.name)} <small>${esc(rank)} · ${cfg.lv} ${r.ninja.level}</small>` : '<small>—</small>';
          return `<tr${i < 3 ? ` class="top${i + 1}"` : ''}><td class="pos">${i + 1}</td><td class="name"><a href="${cfg.profile}${r.userId}">${esc(r.name)}</a></td><td class="champ">${champ}</td><td><span class="lg lg-${lg.pt.toLowerCase()}">${badge(lg.col)}${lg[cfg.lang]}</span></td><td class="num">${r.rating}</td><td class="num rec">${r.wins}/${r.losses}</td></tr>`;
        }).join('')
      : `<tr><td colspan="6" class="empty-row">${esc(cfg.empty)}</td></tr>`;
    wrap.classList.remove('locked');
  }
  function unlockRanking() {
    const wraps = document.querySelectorAll('[data-ranking]');
    if (!wraps.length) return;
    api('/api/duel/ranking').then((d) => wraps.forEach((w) => fillRanking(w, d.top || []))).catch(() => {});
  }

  // ---------- quem está logado (convidado não conta como logado no site) ----------
  const ME = 'vn_site_me';
  const forget = () => { if (store.get(ME)) { store.set(ME, null); window.vnWho(null); } };
  let me = null;
  const whoReady = token
    ? api('/api/me').then(({ account: a }) => {
        me = a || null;
        if (!a || a.isGuest) { forget(); return; }
        // guarda para a próxima página já abrir com o nome no menu (vnWhoCached, layout.ts)
        store.set(ME, JSON.stringify({ k: token.slice(-16), displayName: a.displayName, avatarUrl: a.avatarUrl || null, role: a.role }));
        window.vnWho(a);
        unlockRanking();
      }).catch((e) => { if (e && !(e instanceof Error)) forget(); }) // resposta do servidor (token inválido); queda de rede mantém
    : Promise.resolve();

  // ---------- página Entrar: convidado (temporário), Discord ou Google ----------
  const box = document.querySelector('[data-providers]');
  if (box) {
    const ICONS = {
      discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 5.2A17 17 0 0 0 15.4 4l-.5 1.1a15.6 15.6 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.2C1.7 9.2 1 13.1 1.3 17a17 17 0 0 0 5.2 2.6l1.1-1.8c-.6-.2-1.2-.5-1.7-.8l.4-.3a12.1 12.1 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.5-.7-8.4-3.1-11.8zM8.7 14.6c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z"/></svg>',
      google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>',
      guest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    };
    const next = safeNext(new URLSearchParams(location.search).get('next'));
    const err = sessionStorage.getItem('vn_login_error');
    sessionStorage.removeItem('vn_login_error');
    whoReady.then(() => {
      // já entrou com conta: direto para o jogo (ou para onde ia)
      if (me && !me.isGuest) { location.replace(next); return; }
      const guest = !!(me && me.isGuest);
      if (guest) {
        document.querySelector('[data-guest-note]').hidden = true;
        document.querySelector('[data-guest-upgrade]').hidden = false;
      }
      fetch('/api/auth/providers').then((r) => r.json()).then(({ providers }) => {
        const list = providers || [];
        box.innerHTML = (err ? `<p class="err">${esc(box.dataset.error)}</p>` : '') +
          list.map((p) => `<button class="btn prov ${p.id}" data-go="${p.id}">${ICONS[p.id] || ''}${esc(box.dataset.with.replace('%s', p.name))}</button>`).join('') +
          (list.length ? `<div class="or"><span>${lang === 'pt' ? 'ou' : 'or'}</span></div>` : '') +
          `<button class="btn prov guest" data-guest>${ICONS.guest}${esc(guest ? (lang === 'pt' ? 'Continuar jogando como convidado' : 'Keep playing as guest') : box.dataset.guest)}</button>`;
        box.addEventListener('click', async (e) => {
          const g = e.target.closest('[data-guest]');
          if (g) {
            g.disabled = true;
            if (!token) {
              try {
                const o = origin();
                const r = await api('/api/auth/guest', { method: 'POST', body: JSON.stringify({ ref: o.ref || null, refHost: o.host || null }) });
                store.set(TOKEN, r.token);
                token = r.token;
              } catch {
                g.disabled = false;
                box.insertAdjacentHTML('afterbegin', `<p class="err">${esc(box.dataset.error)}</p>`);
                return;
              }
            }
            location.href = next;
            return;
          }
          const b = e.target.closest('[data-go]');
          if (!b) return;
          b.disabled = true;
          const q = new URLSearchParams({ return: next });
          const o = origin();
          if (o.ref) q.set('ref', o.ref);
          if (o.host) q.set('refHost', o.host);
          // com sessão de convidado, o login leva o progresso junto (bilhete de uso único)
          if (token) { try { q.set('ticket', (await api('/api/auth/link-ticket', { method: 'POST', body: '{}' })).ticket); } catch {} }
          location.href = `/api/auth/${b.dataset.go}/start?${q}`;
        });
      }).catch(() => { box.innerHTML = `<p class="err">${esc(box.dataset.error)}</p>`; });
    });
  }
})();
