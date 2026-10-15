// Pedaços visuais dos duelos usados pela janela Duelos (panel.ts) e pelo aviso "Enquanto você estava fora" (index.ts):
// boneco de um retrato recebido, emblema da liga e o relatório das defesas.
import { RANKS, type Rank } from '../data/ninja';
import type { Game } from '../game/game';
import { decodeSnapshot, unitFromSnapshot } from '../game/snapshot';
import type { Unit } from '../game/types';
import { unitPortrait } from '../render/sprites';
import { type Defense, leagueOf } from './arenaClient';
import { esc } from './dom';
import { atlasCell } from './icons';
import { tipAttr } from './popup';
import { BADGE_RANKS } from './pxicons';

/** "Jogo" mínimo para criar a unidade do retrato sem mexer na vila (createNinja só usa newId e addUnit). */
const portraitGame = { newId: () => -1, addUnit: (u: Unit) => u } as unknown as Game;
const portraits = new Map<string, string>();

/** Retrato (corpo inteiro) do ninja de um retrato recebido; null enquanto a arte monta (não vai para o cache). */
export function snapshotPortrait(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = portraits.get(code);
  if (hit) return hit;
  const snap = decodeSnapshot(code);
  if (!snap) return null;
  const u = unitFromSnapshot(portraitGame, snap, 0, 0);
  // o penteado sai do id: um id estável pelo nome (ids negativos quebrariam o módulo)
  u.id = [...snap.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const url = unitPortrait(u, true);
  if (url) portraits.set(code, url);
  return url;
}

/** Emblema da liga pela pontuação (atlas dos selos; sem a arte, só o nome). */
export function leagueBadge(rating: number, cls = 'dl-lg') {
  const l = leagueOf(rating);
  return atlasCell(BADGE_RANKS, l.emblem, cls, tipAttr(l.name, `${rating} pontos`, true)) ?? `<span class="mchip" ${tipAttr(l.name, `${rating} pontos`, true)}>${esc(l.name)}</span>`;
}

/** Imagem com esqueleto enquanto carrega (igual ao `pimg` do painel). */
export const pimg = (url: string | null | undefined, cls = '') =>
  url ? `<img class="${cls} pim" src="${url}" alt="" draggable="false" decoding="async" loading="lazy" onload="this.classList.add('ok')">` : `<span class="${cls} skel"></span>`;

export function when(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Resumo em números das defesas listadas: desafios, seguradas, perdidas e saldo de pontos. */
export function defenseStats(list: Defense[]) {
  const held = list.filter((x) => x.held).length;
  const delta = list.reduce((s, x) => s + (x.defDelta ?? 0), 0);
  return `<div class="dl-dstats"><div><b>${list.length}</b><small>desafio(s)</small></div><div class="ok"><b>${held}</b><small>segurou</small></div><div class="bad"><b>${list.length - held}</b><small>perdeu</small></div><div class="${delta >= 0 ? 'ok' : 'bad'}"><b>${delta >= 0 ? '+' : ''}${delta}</b><small>pontos</small></div></div>`;
}

/** Uma defesa: boneco e liga de quem atacou, nome, ninja, resultado, delta, hora e a revanche (se couber). */
export function defenseRow(x: Defense, revenge = true) {
  const pill = x.left ? `<span class="mpill info">Desistiu</span>` : x.held ? `<span class="mpill safe">Segurou</span>` : `<span class="mpill danger">Perdeu</span>`;
  const ninja = x.attackerNinja ? `${esc(x.attackerNinja.name)} · ${esc(RANKS[x.attackerNinja.rank as Rank]?.name ?? x.attackerNinja.rank)} Nv ${x.attackerNinja.level}` : '';
  return `<li class="dl-def ${x.unseen ? 'new' : ''} ${x.held ? 'held' : 'lost'}"><span class="dl-face sm">${pimg(snapshotPortrait(x.attackerCode))}</span>
    <span class="dl-name"><b>${leagueBadge(x.attackerRating, 'dl-lg sm')} ${esc(x.attacker.name)}</b><small>${ninja}</small></span>
    ${pill}<span class="dl-delta ${x.defDelta != null && x.defDelta < 0 ? 'bad' : ''}">${x.defDelta == null ? '' : `${x.defDelta >= 0 ? '+' : ''}${x.defDelta}`}</span><small class="dl-when">${when(x.at)}</small>
    ${revenge && !x.held && !x.revenged ? `<button class="btn mini" data-act="arena-revenge" data-arg="${x.attacker.id}">{swords} Revanche</button>` : ''}</li>`;
}
