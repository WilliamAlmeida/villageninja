import type { App } from '../app';
import { levelDef } from '../data/villageLevels';
import { el } from './dom';
import { canFullscreen, canInstall, install, IOS_HINT, isFullscreen, isIOS, isStandalone, toggleFullscreen } from './fullscreen';
import { rich } from './icons';
import { artOn, FONT_SIZES, fontSize, setArtOn, setFontSize, setWeatherFxLight, weatherFxLight, type FontSize } from './settings';

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
        this.app.game.toast(ok ? '{save} Jogo salvo!' : 'Não foi possível salvar.', ok ? 'good' : 'warn');
      }
      if (a === 'full') {
        if (isIOS() && !canFullscreen()) this.app.game.toast(IOS_HINT, 'info');
        else toggleFullscreen();
      }
      if (a === 'install') install().then(() => this.render());
      if (a === 'art') {
        setArtOn((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === '1');
        this.render();
      }
      if (a === 'wfx') {
        setWeatherFxLight((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === 'light');
        this.render();
      }
      if (a === 'pace') {
        this.app.game.state.pace = (e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === 'tactical' ? 'tactical' : 'fast';
        this.render();
      }
      if (a === 'font') {
        setFontSize((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg as FontSize);
        this.render();
      }
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
    const fs = fontSize();
    this.root.innerHTML = rich(`<div class="box">
      <h2>{leaf} Vila Ninja <small style="color:var(--muted);font-weight:400">— protótipo</small></h2>
      <div class="col">
        <button class="btn primary" data-act="resume">{play} Continuar</button>
        <button class="btn" data-act="save">{save} Salvar agora</button>
        ${isStandalone() ? '' : `<button class="btn" data-act="full">{fullscreen} ${isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia'}</button>`}
        ${canInstall() ? `<button class="btn" data-act="install">{phone} Instalar como app (sem barra do navegador)</button>` : ''}
        ${!isStandalone() && isIOS() ? `<p class="hint">${IOS_HINT}</p>` : ''}
        <div class="setrow">{text} Texto<div class="seg">${FONT_SIZES.map((f) => `<button data-act="font" data-arg="${f.id}" class="${f.id === fs ? 'on' : ''}">${f.label}</button>`).join('')}</div></div>
        <div class="setrow">{swords} Combate<div class="seg"><button data-act="pace" data-arg="fast" class="${s.pace === 'tactical' ? '' : 'on'}">Rápido</button><button data-act="pace" data-arg="tactical" class="${s.pace === 'tactical' ? 'on' : ''}">Tático</button></div></div>
        <p class="hint">${s.pace === 'tactical' ? 'Tático: antes de cada jutsu o ninja faz os selos (mais rápido com o atributo Selos). Um golpe forte nessa hora interrompe e o chakra se perde. Taijutsu sai na hora.' : 'Rápido: os jutsus saem na hora, sem selos.'}</p>
        <div class="setrow">{snow} Clima<div class="seg"><button data-act="wfx" data-arg="full" class="${weatherFxLight() ? '' : 'on'}">Completo</button><button data-act="wfx" data-arg="light" class="${weatherFxLight() ? 'on' : ''}">Leve</button></div></div>
        <div class="setrow">{eye} Arte<div class="seg"><button data-act="art" data-arg="1" class="${artOn() ? 'on' : ''}">Pixel art</button><button data-act="art" data-arg="0" class="${artOn() ? '' : 'on'}">Antiga</button></div></div>
        <button class="btn danger" data-act="new">${this.armedNew ? 'Toque de novo: apagar e recomeçar' : '{refresh} Novo jogo'}</button>
        <p class="hint">${levelDef(s.level).icon} ${levelDef(s.level).name} · Dia ${s.day} · Abates ${s.stats.kills} · Invasões repelidas ${s.stats.raidsRepelled} · Chefes ${s.stats.bossesDefeated} · Missões ${s.stats.missionsDone} · Perdas ${s.stats.lost}</p>
      </div>
      <div class="col">
        <ul>
          <li><b>Arraste</b> para mover, <b>pinça</b>/roda do mouse para zoom, <b>toque</b> para selecionar.</li>
          <li><b>Selecionar</b> (ou Shift + arrastar): marque vários ninjas com uma caixa. <b>Botão direito</b> no mapa manda mover ou atacar.</li>
          <li>Moradores trabalham sozinhos. Sem emprego, eles constroem as obras.</li>
          <li>Construa <b>Lenhador</b> perto de árvores e <b>Pedreira</b> perto de rochas.</li>
          <li><b>Academia</b>: recrute ninjas e ensine jutsus (cada ninja tem 2 slots).</li>
          <li><b>Campo de Treino</b>: ninjas ganham atributos e XP; promova-os a Chunin/Jounin/Kage.</li>
          <li>Natureza: 火 Fogo › 風 Vento › 雷 Raio › 土 Terra › 水 Água › 火 Fogo (1,5× de dano).</li>
          <li>A partir do dia 3, ninjas renegados invadem a vila. Animais surgem nas florestas.</li>
          <li>A partir de Vila surgem <b>ameaças chefes</b> (com aviso prévio). Em Vila Oculta, eleja um <b>Kage</b>.</li>
          <li><b>{castle} Vila</b>: cumpra os requisitos e evolua de Aldeia até Grande Vila Oculta (mais território e prédios).</li>
          <li>O jogo salva sozinho a cada 20 s.</li>
        </ul>
      </div>
    </div>`);
  }

}
