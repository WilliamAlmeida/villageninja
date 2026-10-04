import type { App } from '../app';
import { levelDef } from '../data/villageLevels';
import { el } from './dom';

/** Menu de pausa: salvar, novo jogo, tela cheia e ajuda. */
export class Menu {
  readonly root: HTMLElement;
  private armedNew = false;
  private prevSpeed = 1;

  constructor(private app: App) {
    this.root = el('div', { id: 'modal', hidden: '' });
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) return this.close();
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'resume') this.close();
      if (a === 'save') {
        const ok = this.app.save();
        this.app.game.toast(ok ? '💾 Jogo salvo!' : 'Não foi possível salvar.', ok ? 'good' : 'warn');
      }
      if (a === 'full') this.fullscreen();
      if (a === 'new') {
        if (!this.armedNew) {
          this.armedNew = true;
          this.render();
          return;
        }
        this.app.newGame();
        this.close();
      }
    });
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  open() {
    this.armedNew = false;
    this.prevSpeed = this.app.game.state.speed || 1;
    this.app.game.state.speed = 0;
    this.render();
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
    this.app.game.state.speed = this.prevSpeed;
  }

  private render() {
    const s = this.app.game.state;
    this.root.innerHTML = `<div class="box">
      <h2>🍃 Vila Ninja <small style="color:var(--muted);font-weight:400">— protótipo</small></h2>
      <div class="col">
        <button class="btn primary" data-act="resume">▶ Continuar</button>
        <button class="btn" data-act="save">💾 Salvar agora</button>
        <button class="btn" data-act="full">⛶ Tela cheia</button>
        <button class="btn danger" data-act="new">${this.armedNew ? 'Toque de novo: apagar e recomeçar' : '🔄 Novo jogo'}</button>
        <p class="hint">${levelDef(s.level).icon} ${levelDef(s.level).name} · Dia ${s.day} · Abates ${s.stats.kills} · Invasões repelidas ${s.stats.raidsRepelled} · Chefes ${s.stats.bossesDefeated} · Missões ${s.stats.missionsDone} · Perdas ${s.stats.lost}</p>
      </div>
      <div class="col">
        <ul>
          <li><b>Arraste</b> para mover, <b>pinça</b> para zoom, <b>toque</b> para selecionar.</li>
          <li>Moradores trabalham sozinhos. Sem emprego, eles constroem as obras.</li>
          <li>Construa <b>Lenhador</b> perto de árvores e <b>Pedreira</b> perto de rochas.</li>
          <li><b>Academia</b>: recrute ninjas e ensine jutsus (cada ninja tem 2 slots).</li>
          <li><b>Campo de Treino</b>: ninjas ganham atributos e XP; promova-os a Chunin/Jounin/Kage.</li>
          <li>Natureza: 火 Fogo › 風 Vento › 雷 Raio › 土 Terra › 水 Água › 火 Fogo (1,5× de dano).</li>
          <li>A partir do dia 3, ninjas renegados invadem a vila. Animais surgem nas florestas.</li>
          <li>A partir de Vila surgem <b>ameaças chefes</b> (com aviso prévio). Em Vila Oculta, eleja um <b>Kage</b>.</li>
          <li><b>🏯 Vila</b>: cumpra os requisitos e evolua de Aldeia até Grande Vila Oculta (mais território e prédios).</li>
          <li>O jogo salva sozinho a cada 20 s.</li>
        </ul>
      </div>
    </div>`;
  }

  private async fullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o.lock?.('landscape');
    } catch {
      /* nem todo navegador permite */
    }
  }
}
