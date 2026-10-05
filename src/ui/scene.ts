// Barra da invasão (mapa de missão jogável): aparece no alto enquanto há um em andamento. Na vila: "Ver invasão".
// No mapa: objetivo, progresso e as ordens rápidas (Avançar, Recuar) e "Voltar à vila".
import type { App } from '../app';
import { advanceTarget, retreatScene, sceneFoes, sceneGame, sceneTeam } from '../game/scene';
import { orderMove } from '../game/teams';
import { chooseExpedition } from '../game/expeditions';
import { MINE } from '../data/expeditions';
import { el } from './dom';
import { rich } from './icons';

export class SceneBar {
  readonly root: HTMLElement;
  private last = '';

  constructor(private app: App) {
    this.root = el('div', { id: 'scenebar', hidden: '' });
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      const home = this.app.home;
      const sg = sceneGame(home);
      if (!a || !sg) return;
      if (a === 'view') this.app.setView(true);
      if (a === 'home') this.app.setView(false);
      if (a === 'retreat') retreatScene(home);
      if (a === 'deeper' || a === 'leave') chooseExpedition(home, sg.state.sceneInfo!.expId, a === 'deeper');
      if (a === 'advance') {
        const p = advanceTarget(sg);
        if (p) orderMove(sg, sceneTeam(sg).map((u) => u.id), p.x, p.y + 10);
      }
    });
  }

  update() {
    const home = this.app.home;
    const sg = sceneGame(home);
    const info = sg?.state.sceneInfo;
    if (!sg || !info) {
      this.root.hidden = true;
      this.last = '';
      return;
    }
    this.root.hidden = false;
    let html: string;
    if (!this.app.viewScene) {
      html = `<span class="sb-title">{swords} ${info.title}</span><span class="sb-goal">${sceneTeam(sg).length} ninja(s) lutando</span><button class="btn primary" data-act="view">{eye} Ver invasão</button>`;
    } else {
      const foes = sceneFoes(sg).length;
      const prog =
        info.action === 'raid' && info.loot > 0 ? ` · saque ${Math.min(100, Math.floor((info.loot / info.lootNeed) * 100))}%` : '';
      const choice = info.kind === 'mine' && info.result === 'win' && (info.floor ?? 0) < MINE.floors;
      const done = choice ? '' : info.result ? (info.result === 'win' ? ' · {check} Vitória! Voltando…' : ' · voltando…') : '';
      html = `<span class="sb-title">{swords} ${info.title}</span><span class="sb-goal">${info.goal} · inimigos ${foes}/${info.defenders} · equipe ${sceneTeam(sg).length}${prog}${done}</span>
        ${
          choice
            ? `<button class="btn primary" data-act="deeper">{pickaxe} Descer ao andar ${(info.floor ?? 0) + 1}</button><button class="btn" data-act="leave">{back} Voltar com o saque</button>`
            : `<button class="btn primary" data-act="advance" title="A equipe avança até o objetivo, lutando no caminho">{run} Avançar</button>
        <button class="btn danger" data-act="retreat" title="A equipe abandona e volta viva, sem o objetivo">{back} Recuar</button>`
        }
        <button class="btn" data-act="home">{castle} Ver a vila</button>`;
    }
    if (html !== this.last) {
      this.last = html;
      this.root.innerHTML = rich(html);
    }
  }
}
