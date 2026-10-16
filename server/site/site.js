// Parte viva do site, carregada depois da página: língua automática, quem está logado, ninjas on-line e os botões de
// entrar. A conta é a mesma do jogo (token `vn_arena_token` no localStorage, mesma origem do /play).
(() => {
  const TOKEN = 'vn_arena_token';
  const LANG = 'vn_site_lang';
  const lang = document.body.dataset.lang;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // língua: na primeira visita, quem não usa português vai para /en (a escolha manual fica guardada)
  document.querySelectorAll('[data-lang-switch]').forEach((a) => a.addEventListener('click', () => store.set(LANG, a.dataset.langSwitch)));
  if (lang === 'pt' && !store.get(LANG) && !location.hash) {
    const pref = (navigator.languages && navigator.languages[0]) || navigator.language || 'pt';
    if (!/^pt/i.test(pref)) {
      const sw = document.querySelector('[data-lang-switch]');
      if (sw) { store.set(LANG, 'en'); location.replace(sw.getAttribute('href')); return; }
    }
  }

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

  const token = store.get(TOKEN);
  const api = (path, opts = {}) =>
    fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } })
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(d))));

  // on-line agora
  const online = document.querySelector('[data-online]');
  if (online) {
    fetch('/api/health').then((r) => r.json()).then((d) => {
      if (!d.online) return;
      online.textContent = lang === 'pt' ? `${d.online} ${d.online === 1 ? 'ninja on-line' : 'ninjas on-line'}` : `${d.online} ${d.online === 1 ? 'ninja online' : 'ninjas online'}`;
      online.hidden = false;
    }).catch(() => {});
  }

  // quem está logado (convidado não conta como logado no site)
  if (token) {
    api('/api/me').then(({ account: a }) => {
      if (!a || a.isGuest) return;
      const who = document.querySelector('[data-who]');
      who.innerHTML = `${a.avatarUrl ? `<img src="${esc(a.avatarUrl)}" alt="">` : ''}<span>${esc(a.displayName)}</span>${a.role === 'mod' || a.role === 'admin' ? ` · <a href="/staff">${lang === 'pt' ? 'Painel' : 'Staff'}</a>` : ''}`;
      who.hidden = false;
      document.querySelectorAll('.top [data-login]').forEach((el) => (el.hidden = true));
    }).catch(() => {});
  }

  // página Entrar: botões dos provedores ligados; com sessão de convidado, o login leva o progresso junto
  const box = document.querySelector('[data-providers]');
  if (box) {
    const ICONS = {
      discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 5.2A17 17 0 0 0 15.4 4l-.5 1.1a15.6 15.6 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.2C1.7 9.2 1 13.1 1.3 17a17 17 0 0 0 5.2 2.6l1.1-1.8c-.6-.2-1.2-.5-1.7-.8l.4-.3a12.1 12.1 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.5-.7-8.4-3.1-11.8zM8.7 14.6c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z"/></svg>',
      google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>',
    };
    const next = new URLSearchParams(location.search).get('next') || '/play';
    const err = sessionStorage.getItem('vn_login_error');
    sessionStorage.removeItem('vn_login_error');
    fetch('/api/auth/providers').then((r) => r.json()).then(({ providers }) => {
      if (!providers || !providers.length) { box.innerHTML = `<p class="sub">${esc(box.dataset.none)}</p>`; return; }
      box.innerHTML = (err ? `<p class="err">${esc(box.dataset.error)}</p>` : '') + providers
        .map((p) => `<button class="btn prov ${p.id}" data-go="${p.id}">${ICONS[p.id] || ''}${esc(box.dataset.with.replace('%s', p.name))}</button>`).join('');
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-go]');
        if (!b) return;
        b.disabled = true;
        const q = new URLSearchParams({ return: next.startsWith('/') && !next.startsWith('//') ? next : '/play' });
        const o = origin();
        if (o.ref) q.set('ref', o.ref);
        if (o.host) q.set('refHost', o.host);
        if (token) { try { q.set('ticket', (await api('/api/auth/link-ticket', { method: 'POST', body: '{}' })).ticket); } catch {} }
        location.href = `/api/auth/${b.dataset.go}/start?${q}`;
      });
    }).catch(() => { box.innerHTML = `<p class="err">${esc(box.dataset.error)}</p>`; });
  }
})();
