// Menu da vitrine (`?demo`, ver game/demo.ts): um botão no canto que lista todas as telas, drawers de prédio,
// ninjas em cada situação, equipes e locais, para abrir qualquer um num toque. `?demo&tela=<chave>` já abre a tela
// (a chave aparece em cada botão: `crafts`, `b-forge`, `n-kage`…). Só de desenvolvimento.
import type { App } from '../app';
import { BUILDINGS } from '../data/buildings';
import type { Unit } from '../game/types';
import { el } from './dom';
import type { View } from './panel';

interface Entry {
  key: string;
  label: string;
  view: () => View | null;
}

const WINDOWS: [View['kind'], string][] = [
  ['village', 'Vila'], ['kage', 'Kage'], ['bingo', 'Bingo Book'], ['stats', 'Estatísticas'], ['roster', 'Ninjas'],
  ['teams', 'Equipes'], ['clans', 'Clãs'], ['missions', 'Missões'], ['region', 'Região'], ['expeditions', 'Expedições'],
  ['crafts', 'Oficinas'],
];

function groups(app: App): [string, Entry[]][] {
  const s = app.game.state;
  const ninjas = s.units.filter((u) => u.ninja && u.faction === 'village' && !u.dead);
  const away = (u: Unit) => s.expeditions.some((e) => e.unitIds.includes(u.id));
  const unit = (key: string, label: string, find: (u: Unit) => boolean): Entry => ({
    key, label, view: () => {
      const u = ninjas.find(find);
      return u ? { kind: 'unit', id: u.id } : null;
    },
  });
  const rank = (u: Unit) => u.ninja!.rank;
  return [
    ['Janelas', WINDOWS.map(([kind, label]) => ({ key: kind, label, view: () => ({ kind }) as View }))],
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
      { key: 'group', label: 'Grupo (seleção)', view: () => {
        app.group = ninjas.slice(0, 6).map((u) => u.id);
        return { kind: 'group' };
      } },
    ]],
    ['Prédios', [...new Set(s.buildings.map((b) => b.type))].map((t) => ({
      key: `b-${t}`, label: BUILDINGS[t].name, view: () => ({ kind: 'building', id: s.buildings.find((b) => b.type === t)!.id }) as View,
    }))],
    ['Equipes e locais', [
      ...s.teams.slice(0, 3).map((t, i) => ({ key: `t-${i + 1}`, label: t.name, view: () => ({ kind: 'team', id: t.id }) as View })),
      ...[...new Set(s.sites.map((x) => x.kind))].map((k) => ({
        key: `s-${k}`, label: `Local: ${k}`, view: () => ({ kind: 'site', id: s.sites.find((x) => x.kind === k)!.id }) as View,
      })),
    ]],
  ];
}

export function demoMenu(app: App, show: (v: View) => void) {
  const btn = el('button', { class: 'btn primary', id: 'demobtn' }, 'Vitrine');
  const box = el('div', { id: 'demomenu', hidden: '' });
  const open = (e: Entry) => {
    const v = e.view();
    if (v) show(v);
    box.hidden = true;
  };
  btn.onclick = () => {
    box.hidden = !box.hidden;
    if (box.hidden) return;
    box.innerHTML = '';
    for (const [title, list] of groups(app)) {
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
  document.body.append(btn, box);
  const want = new URLSearchParams(location.search).get('tela');
  if (want) {
    const e = groups(app).flatMap(([, l]) => l).find((x) => x.key === want);
    if (e) setTimeout(() => open(e), 400); // depois do primeiro quadro (que fecha painéis soltos)
  }
}
