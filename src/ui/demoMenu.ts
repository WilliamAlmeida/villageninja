// Menu da vitrine (`?demo`, ver game/demo.ts): um botão no canto que lista todas as telas, drawers de prédio,
// ninjas em cada situação, equipes, locais, a construção (barra, detalhes, posicionar, mover), avisos, faixas e o
// menu de pausa, para abrir qualquer um num toque. `?demo&tela=<chave>` já abre (a chave aparece em cada botão:
// `crafts`, `b-forge`, `n-kage`, `i-port`…). Só de desenvolvimento.
import type { App } from '../app';
import { BUILDINGS, BUILDING_LIST, type BuildingType } from '../data/buildings';
import { emptyRes } from '../data/resources';
import { spawnBoss } from '../game/bosses';
import { startExam } from '../game/exam';
import { doorPos } from '../game/world';
import type { Unit } from '../game/types';
import type { BuildUI } from './build';
import { el } from './dom';
import type { Menu } from './menu';
import type { View } from './panel';
import { closeAlert, lackRows, showAlert } from './popup';

interface Entry {
  key: string;
  label: string;
  run: () => void;
}

export interface DemoUI {
  show: (v: View) => void;
  build: BuildUI;
  menu: Menu;
}

const WINDOWS: [View['kind'], string][] = [
  ['village', 'Vila'], ['kage', 'Kage'], ['bingo', 'Bingo Book'], ['stats', 'Estatísticas'], ['roster', 'Ninjas'],
  ['teams', 'Equipes'], ['clans', 'Clãs'], ['missions', 'Missões'], ['region', 'Região'], ['expeditions', 'Expedições'],
  ['crafts', 'Oficinas'],
];

/** Recursos da vitrine guardados ao "zerar" (para ver os avisos de falta). */
let saved: Record<string, number> | null = null;

function groups(app: App, ui: DemoUI): [string, Entry[]][] {
  const g = app.game;
  const s = g.state;
  const ninjas = s.units.filter((u) => u.ninja && u.faction === 'village' && !u.dead);
  const away = (u: Unit) => s.expeditions.some((e) => e.unitIds.includes(u.id));
  const view = (key: string, label: string, v: () => View | null): Entry => ({
    key, label, run: () => {
      const x = v();
      if (x) ui.show(x);
    },
  });
  const unit = (key: string, label: string, find: (u: Unit) => boolean) => view(key, label, () => {
    const u = ninjas.find(find);
    return u ? { kind: 'unit', id: u.id } : null;
  });
  const rank = (u: Unit) => u.ninja!.rank;
  const buildable = BUILDING_LIST.filter((d) => d.buildable).map((d) => d.type);
  const hkb = g.hokage();
  const hk = hkb ? doorPos(hkb) : null;
  const clear = () => {
    s.flags.alert = false;
    s.pendingBoss = null;
    for (const u of s.units) if (u.boss) u.dead = true;
  };
  return [
    ['Janelas', WINDOWS.map(([kind, label]) => view(kind, label, () => ({ kind }) as View))],
    ['Ninjas', [
      unit('n-kage', 'Kage', (u) => u.id === s.kageId),
      unit('n-sapo', 'Sannin (sapo)', (u) => u.ninja!.sannin === 'toad'),
      unit('n-serpente', 'Sannin (serpente)', (u) => u.ninja!.sannin === 'snake'),
      unit('n-anbu', 'ANBU', (u) => !!u.ninja!.anbu),
      unit('n-jounin', 'Jounin', (u) => rank(u) === 'jounin' && !u.ninja!.sannin && !u.ninja!.anbu && !away(u)),
      unit('n-medico', 'Chunin médico', (u) => u.ninja!.spec === 'medic'),
      unit('n-cao', 'Chunin com cão', (u) => rank(u) === 'chunin' && s.units.some((d) => d.ownerId === u.id && !d.ninja)),
      unit('n-estudando', 'Genin estudando', (u) => !!u.ninja!.learning),
      unit('n-ferido', 'Ferido', (u) => u.hp < u.maxHp * 0.5),
      unit('n-fora', 'Em expedição', away),
      view('group', 'Grupo (seleção)', () => {
        app.group = ninjas.slice(0, 6).map((u) => u.id);
        return { kind: 'group' };
      }),
    ]],
    ['Prédios', [...new Set(s.buildings.map((b) => b.type))].map((t) =>
      view(`b-${t}`, BUILDINGS[t].name, () => ({ kind: 'building', id: s.buildings.find((b) => b.type === t)!.id })),
    )],
    ['Equipes e locais', [
      ...s.teams.slice(0, 3).map((t, i) => view(`t-${i + 1}`, t.name, () => ({ kind: 'team', id: t.id }))),
      ...[...new Set(s.sites.map((x) => x.kind))].map((k) => view(`s-${k}`, `Local: ${k}`, () => ({ kind: 'site', id: s.sites.find((x) => x.kind === k)!.id }))),
    ]],
    ['Construção', [
      { key: 'build', label: 'Barra de construção', run: () => ui.build.toggle(true) },
      { key: 'place-house', label: 'Posicionar casa', run: () => place(ui.build, 'house') },
      { key: 'place-tower', label: 'Posicionar torre', run: () => place(ui.build, 'tower') },
      { key: 'move-forge', label: 'Mover a Forja', run: () => ui.build.startMove(s.buildings.find((b) => b.type === 'forge')!.id) },
      { key: 'move-port', label: 'Mover o Porto', run: () => ui.build.startMove(s.buildings.find((b) => b.type === 'port')!.id) },
      ...buildable.map((t) => ({ key: `i-${t}`, label: `Detalhes: ${BUILDINGS[t].name}`, run: () => ui.build.info(t) })),
    ]],
    ['Avisos, faixas e diálogos', [
      {
        key: 'pobre', label: saved ? 'Devolver recursos' : 'Zerar recursos', run: () => {
          if (saved) {
            Object.assign(s.res, saved);
            saved = null;
          } else {
            saved = { ...s.res };
            Object.assign(s.res, emptyRes(), { wood: 12, food: 30, ryo: 40 });
          }
        },
      },
      {
        key: 'a-falta', label: 'Aviso: falta recurso', run: () =>
          showAlert({ title: 'Recursos insuficientes', rows: lackRows(g, { wood: 99999, stone: 99999, ryo: 99999 }) }),
      },
      {
        key: 'a-motivos', label: 'Aviso: ainda não dá', run: () =>
          showAlert({ title: 'Ainda não dá', rows: ['Requer nível {castle} Vila Oculta.', 'Precisa de um Jounin de nível 20+.', '{lock} Biblioteca nível 3'] }),
      },
      {
        key: 'a-info', label: 'Aviso: informação', run: () =>
          showAlert({ kind: 'info', title: BUILDINGS.port.name, text: 'Construa o {ship} Porto (menu Construir) para abrir a janela Mundo.' }),
      },
      {
        key: 'a-acao', label: 'Aviso com ação', run: () =>
          showAlert({
            kind: 'info', title: 'Oficinas indisponíveis', text: 'Construa ao menos uma oficina para abrir esta janela.',
            rows: [`${BUILDINGS.forge.icon} ${BUILDINGS.forge.name}`, `${BUILDINGS.pharmacy.icon} ${BUILDINGS.pharmacy.name}`, `${BUILDINGS.sealshop.icon} ${BUILDINGS.sealshop.name}`],
            action: { label: '{hammer} Construir', run: () => ui.build.toggle(true) },
          }),
      },
      { key: 'a-fechar', label: 'Fechar aviso', run: closeAlert },
      {
        key: 'toasts', label: 'Notificações', run: () => {
          g.toast('{save} Jogo salvo!', 'good');
          g.toast('Um mercador chegou à vila.', 'info');
          g.toast('A comida está acabando!', 'warn');
          g.toast('{skull} Um ninja caiu em combate.', 'danger', hk ? { x: hk.x, y: hk.y } : undefined);
        },
      },
      { key: 'f-inimigos', label: 'Faixa: inimigos', run: () => (s.flags.alert = true) },
      { key: 'f-chefe-vem', label: 'Faixa: chefe chegando', run: () => (s.pendingBoss = { kind: 'titan', x: 40, y: 40, t: 45 }) },
      { key: 'f-chefe', label: 'Faixa: chefe', run: () => void (hk && spawnBoss(g, 'hydra', hk.x + 400, hk.y + 300)) },
      {
        key: 'f-exame', label: 'Faixa: Exame Chunin', run: () => {
          s.examNextDay = 0; // a vitrine segura o exame para não começar sozinho
          const r = startExam(g);
          if (!r.ok) g.toast(r.error, 'warn');
        },
      },
      { key: 'f-limpar', label: 'Tirar faixas', run: clear },
      { key: 'menu', label: 'Menu de pausa', run: () => ui.menu.open() },
    ]],
  ];
}

/** Posicionar um prédio como pelo cartão da barra (o mesmo caminho do jogador). */
function place(build: BuildUI, type: BuildingType) {
  build.toggle(true);
  build.bar.querySelector<HTMLElement>(`[data-type="${type}"]`)?.click();
}

export function demoMenu(app: App, ui: DemoUI) {
  const btn = el('button', { class: 'btn primary', id: 'demobtn' }, 'Vitrine');
  const box = el('div', { id: 'demomenu', hidden: '' });
  const open = (e: Entry) => {
    box.hidden = true;
    e.run();
  };
  btn.onclick = () => {
    box.hidden = !box.hidden;
    if (box.hidden) return;
    box.innerHTML = '';
    for (const [title, list] of groups(app, ui)) {
      box.append(el('h5', {}, title));
      const row = el('div', { class: 'demorow' });
      for (const e of list) {
        const b = el('button', { class: 'btn' }, `${e.label} <small>${e.key}</small>`);
        b.onclick = () => open(e);
        row.append(b);
      }
      box.append(row);
    }
  };
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.append(btn, box);
  const want = new URLSearchParams(location.search).get('tela');
  if (want) {
    const e = groups(app, ui).flatMap(([, l]) => l).find((x) => x.key === want);
    if (e) setTimeout(() => open(e), 400); // depois do primeiro quadro (que fecha painéis soltos)
  }
}
