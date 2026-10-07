// Barra da invasão (mapa de missão jogável): aparece no alto enquanto há um em andamento. Na vila: "Ver invasão".
// No mapa: objetivo, progresso e as ordens rápidas (Avançar, Recuar) e "Voltar à vila".
import { morph } from './morph';
import type { App } from '../app';
import { advanceTarget, retreatScene, sceneFoes, sceneGame, sceneTeam } from '../game/scene';
import { orderMove } from '../game/teams';
import { chooseExpedition } from '../game/expeditions';
import { MINE } from '../data/expeditions';
import { el } from './dom';
import { rich } from './icons';
import { tipAttr } from './popup';

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
    const mine = info.kind === 'mine';
    const floor = info.floor ?? 0;
    // título: na mina o nome e uma marca por andar (feitos, o atual, os que faltam)
    const title = mine
      ? `<span class="sb-title">{pickaxe} Mina <span class="sb-floors" ${tipAttr('Andares', `Andar ${floor} de ${MINE.floors}.`, true)}>${Array.from({ length: MINE.floors }, (_, i) => `<i class="${i + 1 < floor ? 'done' : i + 1 === floor ? 'on' : ''}"></i>`).join('')}</span><small>${floor}/${MINE.floors}</small></span>`
      : `<span class="sb-title">{swords} ${info.title}</span>`;
    const team = sceneTeam(sg).length;
    let html: string;
    this.root.classList.toggle('mini', !this.app.viewScene);
    if (!this.app.viewScene) {
      html = `${title}<span class="sb-chip">{users} ${team} lutando</span><button class="btn primary" data-act="view">{eye} Ver</button>`;
    } else {
      const foes = sceneFoes(sg).length;
      const choice = mine && info.result === 'win' && floor < MINE.floors;
      const chips = [
        `<span class="sb-chip ${foes ? 'bad' : 'good'}" ${tipAttr('Inimigos', `${foes} de ${info.defenders} ainda de pé.`, true)}>{skull} ${foes}/${info.defenders}</span>`,
        `<span class="sb-chip" ${tipAttr('Equipe', `${team} ninja(s) no mapa.`, true)}>{users} ${team}</span>`,
        info.action === 'raid' && info.loot > 0 ? `<span class="sb-chip good">{ryo} ${Math.min(100, Math.floor((info.loot / info.lootNeed) * 100))}%</span>` : '',
      ].join('');
      const state = choice
        ? `<span class="sb-goal good">{check} Andar vencido! Descer ou voltar?</span>`
        : info.result
          ? `<span class="sb-goal ${info.result === 'win' ? 'good' : ''}">${info.result === 'win' ? '{check} Vitória! Voltando…' : 'Voltando…'}</span>`
          : `<span class="sb-goal">{target} ${info.goal}</span>`;
      const acts = info.result && !choice
        ? '' // acabou: a equipe já está voltando
        : choice
        ? `<button class="btn primary" data-act="deeper" ${tipAttr('Descer', 'Mais risco e minérios melhores.')}>{pickaxe} Descer ao ${floor + 1}</button><button class="btn" data-act="leave" ${tipAttr('Voltar', 'A equipe volta para a vila com o saque.')}>{back} Voltar com saque</button>`
        : `<button class="btn primary" data-act="advance" ${tipAttr('Avançar', 'A equipe avança até o objetivo, lutando no caminho.')}>{run} Avançar</button><button class="btn danger" data-act="retreat" ${tipAttr('Recuar', 'A equipe abandona e volta viva, sem o objetivo.')}>{back} Recuar</button>`;
      html = `<div class="sb-top">${title}<span class="sb-chips">${chips}</span><span class="sb-acts">${acts}<button class="btn icon" data-act="home" ${tipAttr('Ver a vila', 'Volta a câmera para a vila; a missão continua.')}>{castle}</button></span></div>${state}`;
    }
    if (html !== this.last) {
      this.last = html;
      // só o que mudou (os botões continuam os mesmos: o contador de inimigos muda sem estragar um clique)
      morph(this.root, rich(html));
    }
  }
}
