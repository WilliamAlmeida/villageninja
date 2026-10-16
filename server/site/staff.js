// Painel da equipe (/staff). A página abre na hora; cada quadro pede o seu dado à API sozinho (/api/admin/*) e mostra
// um esqueleto até chegar, então nada espera a consulta mais lenta. Entra com a mesma conta do jogo e do site (token
// `vn_arena_token`); precisa do papel mod ou admin. Toda ação vai para o registro (staff_actions) no servidor.
(() => {
  const TOKEN = 'vn_arena_token';
  let app = document.getElementById('app');
  const token = (() => { try { return localStorage.getItem(TOKEN); } catch { return null; } })();
  let me = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
  const fmtD = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const ago = (d) => {
    if (!d) return '—';
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 120) return 'agora';
    if (s < 3600) return `${Math.round(s / 60)} min`;
    if (s < 86400) return `${Math.round(s / 3600)} h`;
    return `${Math.round(s / 86400)} d`;
  };
  const flagOf = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) + ' ' + cc : cc === '??' ? 'sem país' : '—');
  const ERR = {
    FORBIDDEN: 'Sem permissão para isso.', REASON_REQUIRED: 'Escreva o motivo.', CONFIRM_NAME: 'Digite o nome exato da conta para confirmar.',
    INVALID_NAME: 'Nome inválido (2 a 24 letras, números, espaço, ponto, hífen ou _).', NOT_ON_SELF: 'Não dá para fazer isso com a própria conta.',
    OWN_ROLE: 'Você não pode tirar o próprio admin.', TITLE_REQUIRED: 'O título em português é obrigatório.', INVALID_DATE: 'Datas inválidas (o fim vem depois do início).',
    MAINTENANCE_NEEDS_END: 'Manutenção precisa de data de fim.', SLUG_TAKEN: 'Já existe uma novidade com esse endereço.', INVALID_SLUG: 'Endereço inválido.', INVALID_URL: 'O link começa com https:// ou /.', OFFLINE: 'Servidor fora do ar.',
  };

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    } catch {
      throw new Error(ERR.OFFLINE);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(ERR[data.error] || `Erro ${res.status} (${data.error || 'desconhecido'})`);
      e.status = res.status;
      throw e;
    }
    return data;
  }
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  /** Quadro que se preenche sozinho: esqueleto agora, conteúdo quando a API responder (ou o erro no lugar). */
  function card(cls, title, load, extra = '') {
    const el = document.createElement('section');
    el.className = `card ${cls}`;
    el.innerHTML = `<div class="card-h"><h2>${title}</h2>${extra}</div><div class="card-b"><div class="sk w80"></div><div class="sk w60"></div><div class="sk"></div></div>`;
    const body = el.querySelector('.card-b');
    const run = () => load().then((html) => (body.innerHTML = html)).catch((e) => (body.innerHTML = `<p class="err">${esc(e.message)}</p>`));
    run();
    el.reload = run;
    return el;
  }

  // ---------- gráfico de barras (uma métrica; dica ao passar o mouse) ----------
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) return (tip.hidden = true);
    tip.innerHTML = t.dataset.tip;
    tip.hidden = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!tip.hidden) {
      tip.style.left = `${Math.min(e.clientX + 12, innerWidth - 180)}px`;
      tip.style.top = `${e.clientY + 14}px`;
    }
  });

  function barChart(title, rows, key) {
    const W = 300, H = 110, n = rows.length, gap = 2;
    const max = Math.max(1, ...rows.map((r) => r[key]));
    const bw = Math.max(1, (W - gap * (n - 1)) / n);
    const total = rows.reduce((a, r) => a + r[key], 0);
    let bars = '';
    rows.forEach((r, i) => {
      const h = Math.max(r[key] ? 2 : 0, (r[key] / max) * (H - 4));
      const x = i * (bw + gap);
      const y = H - h;
      const rad = Math.min(4, bw / 2, h);
      const d = h ? `M${x},${H}V${y + rad}Q${x},${y} ${x + rad},${y}H${x + bw - rad}Q${x + bw},${y} ${x + bw},${y + rad}V${H}Z` : '';
      const label = `${new Date(r.day + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: <b>${fmtN(r[key])}</b>`;
      bars += `<rect class="hit" x="${x}" y="0" width="${bw + gap}" height="${H}" fill="transparent" data-tip="${esc(label)}"/>${d ? `<path class="bar" d="${d}" data-tip="${esc(label)}"/>` : ''}`;
    });
    const first = rows[0]?.day.slice(5).split('-').reverse().join('/') ?? '';
    const last = rows.at(-1)?.day.slice(5).split('-').reverse().join('/') ?? '';
    return `<div class="chart"><h3>${title}<b>${fmtN(total)}</b></h3><svg viewBox="0 0 ${W} ${H + 14}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">
      <line class="axis" x1="0" x2="${W}" y1="${H}" y2="${H}"/>${bars}
      <text class="lbl" x="0" y="${H + 12}">${first}</text><text class="lbl" x="${W}" y="${H + 12}" text-anchor="end">${last}</text></svg></div>`;
  }

  // ---------- telas ----------
  const PAGES = {
    '': overview,
    jogadores: players,
    jogador: player,
    suspeitos: suspicious,
    avisos: noticesPage,
    noticias: newsPage,
    registro: logPage,
  };

  function overview() {
    app.innerHTML = '<h1>Visão geral</h1>';
    const grid = document.createElement('div');
    grid.className = 'grid';
    app.appendChild(grid);
    grid.appendChild(card('w12', 'Agora', async () => {
      const k = await api('/api/admin/kpis');
      const t = (v, l, cls = '') => `<div class="tile ${cls}"><b>${fmtN(v)}</b><small>${l}</small></div>`;
      return `<div class="tiles">${t(k.online, 'on-line')}${t(k.active24h, 'ativos 24 h')}${t(k.active7d, 'ativos 7 dias')}${t(k.new24h, 'novos 24 h')}${t(k.total, 'contas')}${t(k.registered, 'cadastradas')}${t(k.snapshots, 'retratos')}${t(k.duels24h, 'duelos 24 h')}${t(k.openDuels, 'duelos abertos')}${t(k.flagged7d, 'suspeitos 7 dias', k.flagged7d ? 'alert' : '')}${t(k.banned, 'banidos')}</div>`;
    }));
    let days = 30;
    const daily = card('w12', 'Por dia', async () => {
      const d = await api(`/api/admin/daily?days=${days}`);
      if (!d.rows.length) return '<p class="muted">Sem dados ainda (o job enche a tabela a cada 5 min).</p>';
      const ret = d.rows.reduce((a, r) => a + r.returningD1, 0);
      const newU = d.rows.slice(0, -1).reduce((a, r) => a + r.newUsers, 0);
      return `<div class="charts">${barChart('Ativos por dia', d.rows, 'active')}${barChart('Contas novas', d.rows, 'newUsers')}${barChart('Duelos', d.rows, 'duels')}</div>
        <p class="muted" style="margin:0.6rem 0 0">Voltaram no dia seguinte: <b>${newU ? Math.round((ret / newU) * 100) : 0}%</b> das contas novas · cadastros no período: <b>${fmtN(d.rows.reduce((a, r) => a + r.newRegistered, 0))}</b> · duelos suspeitos: <b>${fmtN(d.rows.reduce((a, r) => a + r.duelsFlagged, 0))}</b></p>
        <details style="margin-top:0.6rem"><summary class="muted">Tabela</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dia</th><th class="num">Ativos</th><th class="num">Novas</th><th class="num">Cadastros</th><th class="num">Voltaram D1</th><th class="num">Duelos</th><th class="num">Suspeitos</th></tr></thead><tbody>${d.rows.slice().reverse().map((r) => `<tr><td>${r.day.split('-').reverse().join('/')}</td><td class="num">${r.active}</td><td class="num">${r.newUsers}</td><td class="num">${r.newRegistered}</td><td class="num">${r.returningD1}</td><td class="num">${r.duels}</td><td class="num">${r.duelsFlagged}</td></tr>`).join('')}</tbody></table></div></details>`;
    }, `<span class="chips" data-days>${[14, 30, 90].map((n) => `<button data-d="${n}" class="${n === 30 ? 'on' : ''}">${n} dias</button>`).join('')}</span>`);
    daily.querySelector('[data-days]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      days = Number(b.dataset.d);
      daily.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('on', x === b));
      daily.reload();
    });
    grid.appendChild(daily);
    grid.appendChild(card('', 'Público', async () => {
      const a = await api('/api/admin/audience');
      const max = Math.max(1, ...a.countries.map((c) => c.n));
      const LOGIN = { discord: 'Discord', google: 'Google', password: 'Apelido e senha', guest: 'Convidados' };
      return `<ul class="list">${a.countries.map((c) => `<li><span>${flagOf(c.country)}</span><span class="meter"><i style="width:${(c.n / max) * 100}%"></i></span><b>${fmtN(c.n)}</b></li>`).join('') || '<li class="muted">Sem país ainda (chega pela Cloudflare).</li>'}</ul>
        <h3 style="margin:1rem 0 0.3rem;font-size:0.85rem" class="muted">Jeitos de entrar</h3><ul class="list">${a.logins.map((l) => `<li><span>${LOGIN[l.provider] ?? l.provider}</span><b>${fmtN(l.n)}</b></li>`).join('')}</ul>
        <h3 style="margin:1rem 0 0.3rem;font-size:0.85rem" class="muted">De onde vieram</h3><ul class="list">${(a.sources ?? []).map((x) => `<li><span>${esc(x.source)}</span><b>${fmtN(x.n)}</b></li>`).join('')}</ul>`;
    }));
    grid.appendChild(card('', 'Suspeitos (7 dias)', async () => {
      const d = (await api('/api/admin/suspicious')).duels.slice(0, 6);
      if (!d.length) return '<p class="muted">Nenhum duelo suspeito.</p>';
      return `<ul class="list">${d.map((x) => `<li><a href="#/jogador/${x.attackerId}">${esc(x.attacker)}</a><span>${x.flags.map((f) => `<span class="pill bad">${esc(f)}</span>`).join('')}</span></li>`).join('')}</ul><p style="margin:0.5rem 0 0"><a href="#/suspeitos">Ver todos →</a></p>`;
    }));
    grid.appendChild(card('', 'Servidor', async () => {
      const h = await api('/api/admin/health');
      return `<dl class="kv"><dt>Cache</dt><dd>${h.cache === 'redis' ? '<span class="pill good">Redis</span>' : '<span class="pill warn">memória</span>'}</dd><dt>Banco</dt><dd>${h.dbMs} ms</dd><dt>No ar há</dt><dd>${Math.round(h.uptimeSec / 3600)} h ${Math.round((h.uptimeSec % 3600) / 60)} min</dd><dt>Memória</dt><dd>${h.memoryMb} MB</dd><dt>Números do dia</dt><dd>${ago(h.dailyUpdatedAt)}</dd><dt>Bun</dt><dd>${esc(h.bun)}</dd></dl>`;
    }));
    grid.appendChild(card('w12', 'Últimas ações da equipe', async () => logTable((await api('/api/admin/log')).actions.slice(0, 8))));
  }

  const ACT = { login: 'entrou', role: 'papel', rename: 'renomeou', note: 'anotou', ban: 'baniu', unban: 'desbaniu', kick: 'derrubou sessões', 'reset-rating': 'zerou pontos', test: 'conta de teste', delete: 'apagou', 'notice-create': 'criou aviso', 'notice-edit': 'editou aviso', 'notice-delete': 'apagou aviso', 'news-create': 'criou novidade', 'news-edit': 'editou novidade', 'news-delete': 'apagou novidade' };
  function logTable(rows) {
    if (!rows.length) return '<p class="muted">Nada registrado ainda.</p>';
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Em</th><th>Detalhe</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${fmtD(a.at)}</td><td>${esc(a.staffName ?? (a.detail?.via === 'terminal' ? 'terminal' : 'chave de emergência'))}</td><td>${esc(ACT[a.action] ?? a.action)}</td><td>${a.targetId ? `<a href="#/jogador/${a.targetId}">${esc(a.targetName)}</a>` : '—'}</td><td class="muted">${esc(a.detail ? JSON.stringify(a.detail) : '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function logPage() {
    app.innerHTML = '<h1>Registro da equipe</h1>';
    const g = document.createElement('div');
    g.className = 'grid';
    g.appendChild(card('w12', 'Últimas 100 ações', async () => logTable((await api('/api/admin/log')).actions)));
    app.appendChild(g);
  }

  function suspicious() {
    app.innerHTML = '<h1>Duelos suspeitos</h1><p class="muted">Sinais: <b>fast</b> = resultado em menos de 4 s; <b>weak-win</b> = venceu com menos de metade da força; <b>no-snapshot</b> = venceu sem retrato publicado. O resultado não é recusado, só marcado.</p>';
    const g = document.createElement('div');
    g.className = 'grid';
    g.appendChild(card('w12', 'Últimos 7 dias', async () => {
      const d = (await api('/api/admin/suspicious')).duels;
      if (!d.length) return '<p class="muted">Nenhum duelo suspeito.</p>';
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Atacante</th><th>Defensor</th><th>Resultado</th><th>Sinais</th><th class="num">Segundos</th><th class="num">Pontos</th></tr></thead><tbody>${d.map((x) => `<tr data-href="#/jogador/${x.attackerId}"><td>${fmtD(x.at)}</td><td>${esc(x.attacker)}</td><td>${esc(x.defender)}</td><td>${x.won == null ? '—' : x.won ? 'vitória' : 'derrota'}</td><td>${x.flags.map((f) => `<span class="pill bad">${esc(f)}</span>`).join('')}</td><td class="num">${x.seconds ?? '—'}</td><td class="num">${x.delta ?? '—'}</td></tr>`).join('')}</tbody></table></div>`;
    }));
    app.appendChild(g);
  }

  // ---------- jogadores ----------
  const state = { q: '', filter: 'all', sort: 'seen', page: 0 };
  function players() {
    const FILTERS = [['all', 'Todos'], ['active', 'Ativos 7 d'], ['registered', 'Cadastrados'], ['guests', 'Convidados'], ['banned', 'Banidos'], ['staff', 'Equipe'], ['test', 'Teste']];
    const SORTS = [['seen', 'Visto por último'], ['created', 'Mais novos'], ['rating', 'Pontos']];
    const chips = (list, cur, attr) => `<span class="chips">${list.map(([k, l]) => `<button data-${attr}="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</span>`;
    app.innerHTML = `<h1>Jogadores</h1><div class="bar-f"><input type="search" placeholder="Nome, apelido, e-mail ou id" value="${esc(state.q)}" data-q>${chips(FILTERS, state.filter, 'f')}${chips(SORTS, state.sort, 's')}</div><div class="grid" data-list></div>`;
    const list = app.querySelector('[data-list]');
    const load = () => {
      list.innerHTML = '';
      list.appendChild(card('w12', 'Contas', async () => {
        const q = new URLSearchParams({ q: state.q, filter: state.filter, sort: state.sort, page: String(state.page) });
        const r = await api(`/api/admin/players?${q}`);
        if (!r.players.length) return '<p class="muted">Ninguém com esse filtro.</p>';
        const rows = r.players.map((p) => `<tr data-href="#/jogador/${p.id}"><td><b>${esc(p.name)}</b> ${p.username ? `<small class="muted">@${esc(p.username)}</small>` : ''}</td>
          <td>${p.role !== 'player' ? `<span class="pill staff">${p.role}</span>` : ''}${p.banned ? '<span class="pill bad">banido</span>' : ''}${p.isTest ? '<span class="pill">teste</span>' : ''}${p.isGuest ? '<span class="pill">convidado</span>' : ''}${p.logins.map((l) => `<span class="pill">${l}</span>`).join('')}</td>
          <td class="muted">${esc(p.email ?? '')}</td><td>${flagOf(p.country)}</td><td class="num">${p.rating ?? '—'}</td><td>${ago(p.lastSeenAt)}</td><td class="muted">${fmtD(p.createdAt)}</td></tr>`).join('');
        return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Situação</th><th>E-mail</th><th>País</th><th class="num">Pontos</th><th>Visto</th><th>Criada</th></tr></thead><tbody>${rows}</tbody></table></div>
          <div class="pager"><span>${fmtN(r.total)} contas · página ${r.page + 1}</span><span class="acts"><button class="btn small" data-pg="-1" ${r.page ? '' : 'disabled'}>Anterior</button><button class="btn small" data-pg="1" ${r.more ? '' : 'disabled'}>Próxima</button></span></div>`;
      }));
    };
    let timer;
    app.querySelector('[data-q]').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = e.target.value.trim();
        state.page = 0;
        load();
      }, 300);
    });
    app.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]');
      const s = e.target.closest('[data-s]');
      const pg = e.target.closest('[data-pg]');
      if (f) state.filter = f.dataset.f;
      if (s) state.sort = s.dataset.s;
      if (f || s) {
        state.page = 0;
        app.querySelectorAll(f ? '[data-f]' : '[data-s]').forEach((b) => b.classList.toggle('on', b === (f || s)));
        load();
      }
      if (pg) {
        state.page = Math.max(0, state.page + Number(pg.dataset.pg));
        load();
      }
    });
    load();
  }

  /** Janela de formulário; `submit` recebe os valores e lança erro para mostrar ali mesmo. */
  function form(title, fields, submitLabel, submit, danger = false) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<form class="box"><h2 style="margin-bottom:0.9rem">${title}</h2>${fields}<p class="form-err" data-err></p><div class="acts" style="justify-content:flex-end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn ${danger ? 'danger' : 'play'}">${submitLabel}</button></div></form>`;
    document.body.appendChild(m);
    const f = m.querySelector('form');
    f.querySelector('input,textarea')?.focus();
    m.addEventListener('click', (e) => (e.target === m || e.target.closest('[data-x]')) && m.remove());
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(f));
      f.querySelectorAll('[data-chips]').forEach((c) => (vals[c.dataset.chips] = c.querySelector('.on')?.dataset.v));
      try {
        await submit(vals);
        m.remove();
      } catch (err) {
        f.querySelector('[data-err]').textContent = err.message;
      }
    });
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chips] button');
      if (!b) return;
      e.preventDefault();
      b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    return m;
  }
  const input = (name, label, value = '', type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const area = (name, label, value = '') => `<label class="field"><span>${label}</span><textarea name="${name}">${esc(value)}</textarea></label>`;
  const chipField = (name, label, list, cur) => `<div class="field"><span>${label}</span><span class="chips" data-chips="${name}">${list.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</span></div>`;

  async function player(id) {
    app.innerHTML = '<p><a href="#/jogadores">← Jogadores</a></p>';
    const g = document.createElement('div');
    g.className = 'grid';
    app.appendChild(g);
    let d;
    const head = card('w12', 'Conta', async () => {
      d = await api(`/api/admin/players/${id}`);
      const p = d.player;
      const isAdmin = !me || me.role === 'admin';
      return `<div class="who-h">${p.avatarUrl ? `<img src="${esc(p.avatarUrl)}" alt="">` : ''}<div><h1 style="margin:0">${esc(p.name)}</h1><span class="muted">${p.username ? `@${esc(p.username)} · ` : ''}${esc(p.id)}</span></div>
          <span>${p.role !== 'player' ? `<span class="pill staff">${p.role}</span>` : ''}${p.bannedAt ? `<span class="pill bad">banido: ${esc(p.banReason ?? '')}</span>` : ''}${p.isTest ? '<span class="pill">teste</span>' : ''}${p.isGuest ? '<span class="pill">convidado</span>' : ''}</span></div>
        <div class="grid" style="margin-top:1rem"><dl class="kv card w6" style="margin:0"><dt>E-mail</dt><dd>${esc(p.email ?? '—')}</dd><dt>País</dt><dd>${flagOf(p.country)}</dd><dt>Criada</dt><dd>${fmtD(p.createdAt)}</dd><dt>Cadastro</dt><dd>${fmtD(p.registeredAt)}</dd><dt>Visto</dt><dd>${fmtD(p.lastSeenAt)} (${ago(p.lastSeenAt)})</dd><dt>Dias jogados</dt><dd>${p.daysPlayed}</dd><dt>Sessões abertas</dt><dd>${p.sessions}</dd><dt>Entra com</dt><dd>${[...d.identities.map((i) => `${i.provider} (${esc(i.name ?? '')})`), p.hasPassword ? 'apelido e senha' : ''].filter(Boolean).join(', ') || 'só este navegador'}</dd><dt>Veio de</dt><dd>${esc([p.ref && `?ref=${p.ref}`, p.refHost].filter(Boolean).join(' · ') || 'direto')}</dd><dt>Nota</dt><dd>${esc(p.note ?? '—')}</dd></dl>
        <dl class="kv card w6" style="margin:0"><dt>Pontos</dt><dd>${d.stats ? `<b>${d.stats.rating}</b> · ataque ${d.stats.wins}V/${d.stats.losses}D · defesa ${d.stats.defWins}V/${d.stats.defLosses}D` : '—'}</dd><dt>Campeão</dt><dd>${d.snapshot ? `${esc(d.snapshot.ninja)} (${esc(d.snapshot.rank)} Nv ${d.snapshot.level}) · força ${fmtN(d.snapshot.power)} · ${fmtD(d.snapshot.updatedAt)}` : 'sem retrato'}</dd></dl></div>
        <div class="acts" style="margin-top:1rem"><button class="btn small" data-a="rename">Renomear</button><button class="btn small" data-a="note">Anotar</button>
          ${p.bannedAt ? '<button class="btn small" data-a="unban">Desbanir</button>' : '<button class="btn small danger" data-a="ban">Banir</button>'}
          <button class="btn small" data-a="kick">Derrubar sessões</button><button class="btn small" data-a="reset-rating">Zerar pontos</button>
          <button class="btn small" data-a="test">${p.isTest ? 'Tirar de teste' : 'Marcar como teste'}</button>
          ${isAdmin ? '<button class="btn small" data-a="role">Papel</button><button class="btn small danger" data-a="delete">Apagar conta</button>' : ''}</div>`;
    });
    g.appendChild(head);
    g.appendChild(card('w6', 'Duelos recentes', async () => {
      const r = d ?? (await api(`/api/admin/players/${id}`));
      if (!r.duels.length) return '<p class="muted">Nenhum duelo.</p>';
      return `<ul class="list">${r.duels.map((x) => `<li><span>${x.attacking ? 'atacou' : 'defendeu de'} <a href="#/jogador/${x.otherId}">${esc(x.other)}</a> <small>${fmtD(x.at)}</small></span><span>${x.won == null ? '<span class="pill">aberto</span>' : (x.won === x.attacking) ? '<span class="pill good">V</span>' : '<span class="pill bad">D</span>'}${(x.flags ?? []).map((f) => `<span class="pill bad">${esc(f)}</span>`).join('')}</span></li>`).join('')}</ul>`;
    }));
    g.appendChild(card('w6', 'Ações da equipe nesta conta', async () => {
      const r = d ?? (await api(`/api/admin/players/${id}`));
      if (!r.log.length) return '<p class="muted">Nenhuma.</p>';
      return `<ul class="list">${r.log.map((a) => `<li><span>${esc(ACT[a.action] ?? a.action)} <small>${esc(a.staffName ?? 'chave de emergência')}</small></span><small>${fmtD(a.at)}</small></li>`).join('')}</ul>`;
    }));
    const act = (a, body) => post(`/api/admin/players/${id}/${a}`, body).then((r) => {
      toast('Feito e registrado.');
      if (r.deleted) location.hash = '#/jogadores';
      else player(id);
    });
    head.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || !d) return;
      const p = d.player;
      switch (b.dataset.a) {
        case 'rename': return form('Renomear', input('name', 'Nome mostrado', p.name), 'Salvar', (v) => act('rename', { name: v.name }));
        case 'note': return form('Anotação da equipe', area('note', 'Só a equipe vê', p.note ?? ''), 'Salvar', (v) => act('note', { note: v.note }));
        case 'ban': return form(`Banir ${esc(p.name)}`, input('reason', 'Motivo (fica registrado)'), 'Banir', (v) => act('ban', { reason: v.reason }), true);
        case 'unban': return act('unban', {}).catch((err) => toast(err.message));
        case 'kick': return act('kick', {}).catch((err) => toast(err.message));
        case 'reset-rating': return form('Zerar pontos', '<p class="muted">Os pontos voltam para 1000. Vitórias e derrotas ficam.</p>', 'Zerar', () => act('reset-rating', {}), true);
        case 'test': return act('test', { on: !p.isTest }).catch((err) => toast(err.message));
        case 'role': return form('Papel', chipField('role', 'Papel', [['player', 'Jogador'], ['mod', 'Moderador'], ['admin', 'Admin']], p.role), 'Salvar', (v) => post('/api/admin/role', { userId: id, role: v.role }).then(() => player(id)));
        case 'delete': return form('Apagar conta', `<p class="muted">Apaga a conta, os duelos e o retrato. Não tem volta.</p>${input('confirm', `Digite <b>${esc(p.name)}</b> para confirmar`)}`, 'Apagar', (v) => act('delete', { confirm: v.confirm }), true);
      }
    });
  }

  // ---------- avisos ----------
  function noticesPage() {
    app.innerHTML = '<h1>Avisos</h1><p class="muted">O jogo busca os avisos ao abrir e a cada minuto, e mostra cada um uma vez. "Manutenção" impede duelos novos entre o início do bloqueio e o fim.</p><p><button class="btn play" data-new>Novo aviso</button></p>';
    const g = document.createElement('div');
    g.className = 'grid';
    app.appendChild(g);
    let list = [];
    const box = card('w12', 'Avisos', async () => {
      list = (await api('/api/admin/notices')).notices;
      if (!list.length) return '<p class="muted">Nenhum aviso ainda.</p>';
      const now = Date.now();
      const st = (n) => !n.active ? '<span class="pill">desligado</span>' : new Date(n.startsAt) > now ? '<span class="pill warn">agendado</span>' : n.endsAt && new Date(n.endsAt) < now ? '<span class="pill">encerrado</span>' : '<span class="pill good">no ar</span>';
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Aviso</th><th>Situação</th><th>Público</th><th>Período</th><th class="num">Entregue</th><th class="num">Lido</th><th class="num">Clicado</th><th></th></tr></thead><tbody>${list.map((n) => `<tr><td><b>${esc(n.titlePt)}</b><br><small class="muted">${n.kind === 'live' ? 'faixa' : 'janela'} · ${esc(n.tone)}${n.blockFrom ? ' · <span class="pill warn">manutenção</span>' : ''}</small></td><td>${st(n)}</td><td>${{ all: 'todos', registered: 'cadastrados', guests: 'convidados' }[n.audience]}</td><td class="muted">${fmtD(n.startsAt)}<br>${n.endsAt ? fmtD(n.endsAt) : 'sem fim'}</td><td class="num">${fmtN(n.delivered)}</td><td class="num">${fmtN(n.readCount)}</td><td class="num">${fmtN(n.clicked)}</td><td><span class="acts"><button class="btn small" data-edit="${n.id}">Editar</button><button class="btn small danger" data-del="${n.id}">Apagar</button></span></td></tr>`).join('')}</tbody></table></div>`;
    });
    g.appendChild(box);
    const local = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
    const iso = (v) => (v ? new Date(v).toISOString() : null);
    const edit = (n) => form(n ? 'Editar aviso' : 'Novo aviso',
      chipField('kind', 'Tipo', [['inbox', 'Janela'], ['live', 'Faixa']], n?.kind ?? 'inbox') +
      chipField('tone', 'Tom', [['info', 'Info'], ['good', 'Bom'], ['warn', 'Atenção'], ['danger', 'Grave']], n?.tone ?? 'info') +
      chipField('audience', 'Para quem', [['all', 'Todos'], ['registered', 'Cadastrados'], ['guests', 'Convidados']], n?.audience ?? 'all') +
      input('titlePt', 'Título (pt)', n?.titlePt ?? '', 'text', 'maxlength="120" required') + area('textPt', 'Texto (pt)', n?.textPt ?? '') +
      input('titleEn', 'Título (en, opcional)', n?.titleEn ?? '') + area('textEn', 'Texto (en, opcional)', n?.textEn ?? '') +
      input('actionUrl', 'Link do botão (https://… ou /…, opcional)', n?.actionUrl ?? '') +
      `<div class="row2">${input('startsAt', 'Começa', local(n?.startsAt) || local(new Date()), 'datetime-local')}${input('endsAt', 'Termina', local(n?.endsAt), 'datetime-local')}</div>` +
      input('blockFrom', 'Manutenção: bloquear duelos a partir de (opcional)', local(n?.blockFrom), 'datetime-local') +
      chipField('active', 'Ligado', [['1', 'Sim'], ['0', 'Não']], n && !n.active ? '0' : '1'),
      n ? 'Salvar' : 'Publicar',
      async (v) => {
        const body = { ...v, active: v.active !== '0', startsAt: iso(v.startsAt), endsAt: iso(v.endsAt), blockFrom: iso(v.blockFrom) };
        if (n) await api(`/api/admin/notices/${n.id}`, { method: 'PUT', body: JSON.stringify(body) });
        else await post('/api/admin/notices', body);
        toast('Aviso salvo.');
        box.reload();
      });
    app.addEventListener('click', async (e) => {
      if (e.target.closest('[data-new]')) return edit(null);
      const ed = e.target.closest('[data-edit]');
      if (ed) return edit(list.find((x) => x.id === Number(ed.dataset.edit)));
      const del = e.target.closest('[data-del]');
      if (del) form('Apagar aviso', '<p class="muted">Some do jogo e do painel, com os números de leitura.</p>', 'Apagar', async () => {
        await api(`/api/admin/notices/${del.dataset.del}`, { method: 'DELETE' });
        box.reload();
      }, true);
    });
  }

  // ---------- novidades do site ----------
  function newsPage() {
    app.innerHTML = `<h1>Novidades do site</h1><p class="muted">Aparecem em /novidades e as três mais novas no início. Texto: linha em branco separa parágrafos; <b>## </b> faz um título; <b>- </b> faz lista; <b>**negrito**</b>; <b>[texto](https://…)</b> faz link. Inglês é opcional (sem ele, o site em inglês mostra o português).</p><p><button class="btn play" data-new>Nova novidade</button></p>`;
    const g = document.createElement('div');
    g.className = 'grid';
    app.appendChild(g);
    let list = [];
    const box = card('w12', 'Publicadas e rascunhos', async () => {
      list = (await api('/api/admin/news')).news;
      if (!list.length) return '<p class="muted">Nenhuma ainda.</p>';
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Título</th><th>Situação</th><th>Endereço</th><th>Atualizada</th><th></th></tr></thead><tbody>${list.map((n) => `<tr><td><b>${esc(n.titlePt)}</b>${n.titleEn ? `<br><small class="muted">${esc(n.titleEn)}</small>` : ''}</td><td>${n.publishedAt ? `<span class="pill good">publicada</span> <small class="muted">${fmtD(n.publishedAt)}</small>` : '<span class="pill">rascunho</span>'}</td><td>${n.publishedAt ? `<a href="/novidades/${esc(n.slug)}" target="_blank">/novidades/${esc(n.slug)}</a>` : `<span class="muted">/novidades/${esc(n.slug)}</span>`}</td><td class="muted">${fmtD(n.updatedAt)}</td><td><span class="acts"><button class="btn small" data-edit="${n.id}">Editar</button><button class="btn small danger" data-del="${n.id}">Apagar</button></span></td></tr>`).join('')}</tbody></table></div>`;
    });
    g.appendChild(box);
    const edit = (n) => form(n ? 'Editar novidade' : 'Nova novidade',
      input('titlePt', 'Título (pt)', n?.titlePt ?? '', 'text', 'maxlength="140" required') +
      input('summaryPt', 'Resumo (pt, aparece no cartão)', n?.summaryPt ?? '', 'text', 'maxlength="300"') +
      area('bodyPt', 'Texto (pt)', n?.bodyPt ?? '') +
      input('titleEn', 'Title (en, opcional)', n?.titleEn ?? '', 'text', 'maxlength="140"') +
      input('summaryEn', 'Summary (en, opcional)', n?.summaryEn ?? '', 'text', 'maxlength="300"') +
      area('bodyEn', 'Text (en, opcional)', n?.bodyEn ?? '') +
      input('slug', 'Endereço (vazio = do título)', n?.slug ?? '') +
      chipField('published', 'Situação', [['1', 'Publicada'], ['0', 'Rascunho']], n?.publishedAt ? '1' : '0'),
      'Salvar',
      async (v) => {
        const body = { ...v, published: v.published === '1' };
        if (n) await api(`/api/admin/news/${n.id}`, { method: 'PUT', body: JSON.stringify(body) });
        else await post('/api/admin/news', body);
        toast('Novidade salva (o site mostra em até 1 min).');
        box.reload();
      });
    app.addEventListener('click', (e) => {
      if (e.target.closest('[data-new]')) return edit(null);
      const ed = e.target.closest('[data-edit]');
      if (ed) return edit(list.find((x) => x.id === Number(ed.dataset.edit)));
      const del = e.target.closest('[data-del]');
      if (del) form('Apagar novidade', '<p class="muted">Sai do site. Não tem volta.</p>', 'Apagar', async () => {
        await api(`/api/admin/news/${del.dataset.del}`, { method: 'DELETE' });
        box.reload();
      }, true);
    });
  }

  // ---------- navegação ----------
  function route() {
    const [, page = '', arg] = location.hash.replace(/^#/, '').split('/');
    document.querySelectorAll('[data-nav] a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#/${page === 'jogador' ? 'jogadores' : page}`));
    tip.hidden = true;
    const fresh = app.cloneNode(false); // troca o <main> para largar os ouvintes da tela anterior
    app.replaceWith(fresh);
    app = fresh;
    (PAGES[page] ?? overview)(arg);
  }
  document.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a,button')) location.hash = tr.dataset.href;
  });

  async function boot() {
    try {
      me = (await api('/api/admin/whoami')).actor;
    } catch (e) {
      app.innerHTML = `<div class="card login-card"><h1>Painel da equipe</h1><p class="sub">${e.status === 403 || e.status === 401 ? 'Entre com uma conta da equipe (moderador ou admin).' : esc(e.message)}</p><a class="btn play" href="/login?next=/staff">Entrar</a></div>`;
      return;
    }
    document.querySelector('[data-nav]').hidden = false;
    document.querySelector('[data-who]').innerHTML = me ? `${me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" alt="">` : ''}<span>${esc(me.displayName)} <span class="pill staff">${me.role}</span></span>` : 'chave de emergência';
    addEventListener('hashchange', route);
    route();
  }
  boot();
})();
