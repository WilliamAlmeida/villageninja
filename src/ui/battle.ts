// Câmera de batalha: numa luta grande (6+ lutando) aparece o botão "Ver luta" no alto; tocar enquadra o centro da
// luta e segue o duelo principal (o ninja mais forte da vila que está lutando). Com "Câmera segue o ninja" ligado e
// nada selecionado, a câmera já vai sozinha para a luta quando ela começa (uma vez por luta).
import type { App } from '../app';
import type { Unit } from '../game/types';
import { power } from '../game/tactics';
import { el } from './dom';
import { rich } from './icons';
import { followCam } from './settings';

/** Quantos lutando contam como luta grande; abaixo de `end` a luta acabou. */
const BIG = 6;
const END = 3;

export class BattleCam {
  readonly root: HTMLElement;
  private acc = 0;
  private center: { x: number; y: number } | null = null;
  private lead: Unit | null = null;
  /** Já enquadrou esta luta sozinho. */
  private framed = false;
  private last = '';

  constructor(private app: App) {
    this.root = el('button', { id: 'battlebtn', class: 'btn', hidden: '' });
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', () => this.show());
  }

  /** Enquadra a luta e segue o duelo principal. */
  private show() {
    if (!this.center) return;
    // segue o duelo principal sem selecionar (o drawer não abre por cima da luta); arrastar o mapa solta
    if (this.lead) this.app.camera.trackId = this.lead.id;
    else this.app.camera.focus(this.center.x, this.center.y);
  }

  update(dt: number) {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    const g = this.app.game;
    const fighters = g.state.units.filter(
      (u) => !u.dead && !u.hidden && u.combatTimer > 0 && (u.kind === 'ninja' || u.kind === 'rogue' || u.boss) && u.away == null,
    );
    const village = fighters.filter((u) => u.faction === 'village');
    const foes = fighters.filter((u) => u.faction !== 'village');
    if (fighters.length < END || !village.length || !foes.length) {
      this.center = null;
      this.framed = false;
    } else {
      this.center = { x: fighters.reduce((a, u) => a + u.x, 0) / fighters.length, y: fighters.reduce((a, u) => a + u.y, 0) / fighters.length };
      this.lead = village.reduce((a, u) => (power(u) > power(a) ? u : a));
    }
    const big = !!this.center && fighters.length >= BIG;
    // começou uma luta grande: vai até ela uma vez (se a câmera segue e nada está selecionado)
    if (big && !this.framed && followCam() && !g.selected && !this.app.viewScene) {
      this.framed = true;
      this.app.camera.focus(this.center!.x, this.center!.y);
    }
    const html = big ? `{swords} Ver luta (${fighters.length})` : '';
    this.root.hidden = !big;
    if (html !== this.last) {
      this.last = html;
      this.root.innerHTML = rich(html);
      this.root.setAttribute('data-tip-title', 'Luta grande');
      this.root.setAttribute('data-tip', 'Enquadra a luta e segue o duelo principal (o ninja mais forte da vila que está lutando).');
    }
  }
}
