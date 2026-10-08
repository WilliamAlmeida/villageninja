import type { App } from '../app';
import { el } from './dom';
import { canFullscreen, canInstall, install, IOS_HINT, isFullscreen, isIOS, isStandalone, toggleFullscreen } from './fullscreen';
import { rich } from './icons';
import { FONT_SIZES, followCam, fontSize, QUALITIES, quality, setFollowCam, setFontSize, setQuality, setShowFps, setWeatherFxLight, showFps, weatherFxLight, type FontSize, type Quality } from './settings';
import { bus } from '../core/events';

/** Menu de pausa: salvar, novo jogo, tela cheia e ajuda. */
export class Menu {
  readonly root: HTMLElement;
  private armedNew = false;
  /** Mostrando o guia (como jogar) no lugar das configurações. */
  private guide = false;
  private prevSpeed = 1;

  constructor(private app: App) {
    this.root = el('div', { id: 'modal', hidden: '' });
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) return this.close();
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'resume') this.close();
      if (a === 'save') {
        const ok = this.app.save();
        this.app.home.toast(ok ? '{save} Jogo salvo!' : 'Não foi possível salvar.', ok ? 'good' : 'warn');
      }
      if (a === 'full') {
        if (isIOS() && !canFullscreen()) this.app.home.toast(IOS_HINT, 'info');
        else toggleFullscreen();
      }
      if (a === 'install') install().then(() => this.render());
      if (a === 'spread') {
        // aliados colados na luta se afastam devagar (game/tactics.ts); fica no save da vila
        this.app.home.state.flags.spread = (e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === '1';
        this.render();
      }
      if (a === 'quality') {
        setQuality((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg as Quality);
        bus.emit('quality', undefined);
        this.render();
      }
      if (a === 'fps') {
        setShowFps((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === '1');
        bus.emit('fps', undefined);
        this.render();
      }
      if (a === 'follow') {
        setFollowCam((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === '1');
        this.render();
      }
      if (a === 'guide') {
        this.guide = !this.guide;
        this.render();
      }
      if (a === 'wfx') {
        setWeatherFxLight((e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === 'light');
        this.render();
      }
      if (a === 'pace') {
        this.app.home.state.pace = (e.target as HTMLElement).closest<HTMLElement>('[data-arg]')!.dataset.arg === 'tactical' ? 'tactical' : 'fast';
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
    this.guide = false;
    this.prevSpeed = this.app.home.state.speed || 1;
    this.app.home.state.speed = 0;
    this.render();
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
    this.app.home.state.speed = this.prevSpeed;
  }

  private render() {
    const s = this.app.home.state;
    const fs = fontSize();
    const seg = (act: string, opts: [string, string, boolean][]) => `<div class="seg">${opts.map(([arg, label, on]) => `<button data-act="${act}" data-arg="${arg}" class="${on ? 'on' : ''}">${label}</button>`).join('')}</div>`;
    if (this.guide) {
      this.root.innerHTML = rich(`<div class="box menu1">
        <h2>{books} Guia</h2>
        <ul class="guide">
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
        <button class="btn primary" data-act="guide">{back} Voltar</button>
      </div>`);
      return;
    }
    this.root.innerHTML = rich(`<div class="box menu1">
      <h2>{leaf} Vila Ninja</h2>
      <div class="mgrid">
        <button class="btn primary" data-act="resume">{play} Continuar</button>
        <button class="btn" data-act="save">{save} Salvar agora</button>
        ${isStandalone() ? '' : `<button class="btn" data-act="full">{fullscreen} ${isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia'}</button>`}
        <button class="btn" data-act="guide">{books} Guia</button>
        ${canInstall() ? `<button class="btn wide" data-act="install">{phone} Instalar como app</button>` : ''}
      </div>
      ${!isStandalone() && isIOS() ? `<p class="hint">${IOS_HINT}</p>` : ''}
      <h4>{gear} Configurações</h4>
      <div class="setrow"><span class="sl">{text} Texto</span>${seg('font', FONT_SIZES.map((f) => [f.id, f.label, f.id === fs]))}</div>
      <div class="setrow"><span class="sl">{swords} Combate</span>${seg('pace', [['fast', 'Rápido', s.pace !== 'tactical'], ['tactical', 'Tático', s.pace === 'tactical']])}</div>
      <p class="hint">${s.pace === 'tactical' ? 'Tático: antes de cada jutsu o ninja faz os selos; um golpe forte nessa hora interrompe.' : 'Rápido: os jutsus saem na hora, sem selos.'}</p>
      <div class="setrow"><span class="sl">{eye} Câmera segue o ninja</span>${seg('follow', [['1', 'Sim', followCam()], ['0', 'Não', !followCam()]])}</div>
      <div class="setrow"><span class="sl">{users} Afastar aliados na luta</span>${seg('spread', [['1', 'Sim', s.flags.spread !== false], ['0', 'Não', s.flags.spread === false]])}</div>
      <div class="setrow"><span class="sl">{snow} Clima</span>${seg('wfx', [['full', 'Completo', !weatherFxLight()], ['light', 'Leve', weatherFxLight()]])}</div>
      <div class="setrow"><span class="sl">{gear} Qualidade</span>${seg('quality', QUALITIES.map((q) => [q.id, q.label, q.id === quality()]))}</div>
      <p class="hint">${quality() === 'light' ? 'Leve: resolução menor, menos partículas, clima leve e até 30 quadros por segundo (para celular fraco).' : quality() === 'balanced' ? 'Equilibrada: resolução um pouco menor e menos partículas.' : 'Alta: resolução máxima da tela.'}</p>
      <div class="setrow"><span class="sl">{chart} Medidor de FPS</span>${seg('fps', [['1', 'Mostrar', showFps()], ['0', 'Esconder', !showFps()]])}</div>
      <button class="btn danger" data-act="new">${this.armedNew ? 'Toque de novo: apagar e recomeçar' : '{refresh} Novo jogo'}</button>
    </div>`);
  }
}
