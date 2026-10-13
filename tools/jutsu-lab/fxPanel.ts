// Painel "Ajuste" do Laboratório: mexe ao vivo no visual dos jutsus (data/jutsu-fx.json) e grava pelo servidor do
// 3011 (/api/fx). Três abas:
//  - Sprite: folha do jutsu (ou a Prisão d'Água), tamanho, âncora (clique na prévia), quadros, mistura, giro; o dragão
//    (Suiryuudan) tem ponto do mergulho, tamanho mínimo/máximo e inclinação em pé.
//  - Partículas: rastro e explosão por estilo, ou a exceção só deste jutsu; cada emissor com formato, cores e faixas.
//  - Projétil: velocidade, tamanho, raio, quantidade, alcance e leque (mexe na jogabilidade).
// Tudo muda o objeto vivo `FX` (e o JutsuDef, nos números), então o próximo disparo já sai com o ajuste.
import { applyIcons, ico } from '../shared/ui';
import { FX, PROJ_KEYS, SHAPES, type Emitter, type FxData, type JutsuFx, type ProjFx, type Shape, type SpriteFx } from '../../src/data/jutsuFx';
import { JUTSU_BASE, JUTSUS } from '../../src/data/jutsus';
import { jutsuVfx, type Vfx } from '../../src/data/vfx';
import { art, EFFECT_SHEETS } from '../../src/render/art';

const STYLE_LABEL: Record<string, string> = {
  fire: 'Fogo', water: 'Água', lightning: 'Raio', earth: 'Terra', wind: 'Vento', ice: 'Gelo', lava: 'Lava', heat: 'Calor',
  wood: 'Madeira', storm: 'Tempestade', dark: 'Trevas', blood: 'Sangue', needle: 'Agulha', leaf: 'Folha', genjutsu: 'Genjutsu',
  impact: 'Impacto', metal: 'Metal', gold: 'Ouro', sound: 'Som', bone: 'Osso', web: 'Teia', sand: 'Areia', shadow: 'Sombra', none: 'Sem estilo',
};
const SHAPE_LABEL: Record<Shape, string> = {
  flame: 'Chama', ember: 'Brasa', spark: 'Faísca', flash: 'Clarão', mote: 'Ponto', smoke: 'Fumaça', mist: 'Névoa', drop: 'Gota',
  dust: 'Poeira', chip: 'Lasca', shard: 'Cristal', streak: 'Risco', leaf: 'Folha', needle: 'Agulha', note: 'Nota',
};
const sheetLabel = (s: string) => s.replace(/^(projectile|effect)-/, '');

type Tab = 'sprite' | 'particles' | 'proj';
type Part = 'trail' | 'burst';

export interface FxPanelOpts {
  /** Solta de novo a técnica escolhida. */
  fire: () => void;
  /** Liga/desliga o disparo repetido (o laboratório solta de novo quando o campo fica parado). */
  setRepeat: (on: boolean) => void;
}

let opts: FxPanelOpts;
let root: HTMLElement;
let tab: Tab = 'sprite';
let jutsu: string | null = null;
let spriteTarget: 'jutsu' | 'water' = 'jutsu';
let scope: 'style' | 'jutsu' = 'style';
let style = 'fire';
let repeat = false;
let canSave = false;
/** Há ajuste não salvo; texto e cor do estado (o painel se redesenha, então guarda aqui). */
let dirty = false;
let statusText = '';
let statusKind: '' | 'ok' | 'err' | 'dirty' = '';
function showStatus(text: string, kind: typeof statusKind = '') {
  statusText = text;
  statusKind = kind;
  const s = root.querySelector('#status');
  if (s) {
    s.textContent = text;
    s.className = `status${kind ? ` ${kind}` : ''}`;
  }
  root.querySelector('#save')?.classList.toggle('dirty', dirty);
}
/** Cartões de emissor abertos (`parte:índice`). */
const open = new Set<string>();

// ------------------------------------------------------------------ montagem de DOM
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | false)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
}
function btn(label: string, run: () => void, attrs: Record<string, string> = {}) {
  const b = h('button', attrs);
  b.innerHTML = label;
  b.onclick = (e) => {
    e.stopPropagation();
    run();
  };
  return b;
}
/** Barra de escolha única (`.seg`): troca e redesenha. */
function seg<T extends string>(items: [T, string, string?][], cur: T, set: (v: T) => void, cls = 'seg sm') {
  const box = h('div', { class: cls });
  for (const [v, label, tip] of items) box.append(btn(label, () => set(v), { class: v === cur ? 'on' : '', ...(tip ? { 'data-tip': tip } : {}) }));
  return box;
}
function chips<T extends string>(items: [T, string, string?][], cur: T | null, set: (v: T) => void) {
  const box = h('div', { class: 'chips' });
  for (const [v, label, color] of items) {
    const b = btn(label, () => set(v), { class: v === cur ? 'on' : '' });
    if (color) b.style.borderLeft = `4px solid ${color}`;
    box.append(b);
  }
  return box;
}
function toggle(label: string, on: boolean, set: (v: boolean) => void, tip?: string, mark = true) {
  const l = h('label', { class: 'tog', ...(tip ? { 'data-tip': tip } : {}) });
  const i = h('input', { type: 'checkbox' });
  i.checked = on;
  i.onchange = () => {
    set(i.checked);
    if (mark) changed();
  };
  l.append(i, label);
  return l;
}
const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(4));
/** Controle deslizante com o número ao lado (o número aceita passar do limite da barra). */
function slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, tip?: string) {
  const row = h('div', { class: 'sl', ...(tip ? { 'data-tip': tip } : {}) });
  const r = h('input', { type: 'range', min: String(Math.min(min, value)), max: String(Math.max(max, value)), step: String(step) });
  const n = h('input', { type: 'number', step: String(step) });
  r.value = n.value = String(value);
  r.oninput = () => {
    n.value = r.value;
    set(round(Number(r.value), step));
    changed();
  };
  n.onchange = () => {
    const v = Number(n.value);
    if (!Number.isFinite(v)) return;
    if (v > Number(r.max)) r.max = String(v);
    if (v < Number(r.min)) r.min = String(v);
    r.value = String(v);
    set(v);
    changed();
  };
  row.append(h('label', {}, label), r, n);
  return row;
}
/** Faixa sorteada [mín, máx]: duas barras. */
function pair(label: string, value: [number, number] | undefined, min: number, max: number, step: number, set: (v: [number, number] | undefined) => void, tip?: string) {
  const v: [number, number] = value ? [value[0], value[1]] : [0, 0];
  const box = h('div', { class: 'pair', ...(tip ? { 'data-tip': tip } : {}) }, h('div', { class: 'pl' }, label));
  const put = () => set(v[0] === 0 && v[1] === 0 && !value ? undefined : [v[0], v[1]]);
  box.append(
    slider('mín', v[0], min, max, step, (x) => {
      v[0] = x;
      put();
    }),
    slider('máx', v[1], min, max, step, (x) => {
      v[1] = x;
      put();
    }),
  );
  return box;
}

// ------------------------------------------------------------------ estado e gravação
function changed() {
  dirty = true;
  showStatus('Ajuste não salvo', 'dirty');
}
function entry(id: string): JutsuFx {
  return (FX.jutsus[id] ??= {});
}
/** Tira o que ficou vazio (exceção sem nada, números iguais aos do jutsu) e ordena as faixas. */
function tidy(data: FxData) {
  const sortRanges = (list?: Emitter[]) =>
    list?.forEach((e) => {
      for (const k of ['life', 'size', 'speed', 'rise', 'jump'] as const) {
        const r = e[k];
        if (r && r[0] > r[1]) e[k] = [r[1], r[0]];
      }
    });
  for (const s of Object.values(data.styles)) {
    sortRanges(s.trail);
    sortRanges(s.burst);
  }
  for (const [id, j] of Object.entries(data.jutsus)) {
    sortRanges(j.trail);
    sortRanges(j.burst);
    if (j.proj && !Object.keys(j.proj).length) delete j.proj;
    if (!Object.keys(j).length) delete data.jutsus[id];
  }
}
async function save() {
  if (!canSave) return;
  tidy(FX);
  showStatus('Salvando…');
  try {
    const r = await fetch('/api/fx', { method: 'PUT', body: JSON.stringify(FX) });
    if (!r.ok) throw new Error(await r.text());
    dirty = false;
    showStatus('Salvo em src/data/jutsu-fx.json', 'ok');
  } catch (e) {
    showStatus(`Não salvou: ${(e as Error).message}`, 'err');
  }
}
/** Volta ao que está gravado (desfaz o que não foi salvo). */
async function revert() {
  try {
    const data = (await (await fetch('/api/fx', { cache: 'no-store' })).json()) as FxData;
    for (const [id, base] of Object.entries(JUTSU_BASE)) {
      const d = JUTSUS[id]!;
      for (const k of PROJ_KEYS) (d as unknown as Record<string, unknown>)[k] = base[k];
      d.vfx = base.vfx;
    }
    FX.styles = data.styles;
    FX.jutsus = data.jutsus;
    FX.status = data.status;
    for (const [id, f] of Object.entries(FX.jutsus)) {
      const d = JUTSUS[id];
      if (!d) continue;
      for (const k of PROJ_KEYS) if (f.proj?.[k] != null) d[k] = f.proj[k];
      if (f.vfx) d.vfx = f.vfx;
    }
    dirty = false;
    render();
    showStatus('Voltou ao que está salvo', 'ok');
  } catch {
    showStatus('Não deu para ler o arquivo', 'err');
  }
}

// ------------------------------------------------------------------ abas
function styleOfJutsu(id: string) {
  const d = JUTSUS[id];
  return (d && jutsuVfx(d)) ?? 'none';
}
const styleItems = (): [string, string][] => Object.keys(FX.styles).map((k) => [k, STYLE_LABEL[k] ?? k]);

function defaultSprite(sheet: string): SpriteFx {
  return { sheet, cols: 4, rows: 2, frames: 8, fps: 16, size: 40, anchorX: 0.75, anchorY: 0.5, dy: 0, opacity: 1, blend: 'normal', rotate: true, flip: false };
}

/** Prévia da folha: grade, quadro atual, âncora (clique muda) e, no dragão, o ponto do mergulho (Shift+clique). */
let preview: { canvas: HTMLCanvasElement; sprite: SpriteFx } | null = null;
function drawPreview(t: number) {
  if (!preview?.canvas.isConnected) {
    preview = null;
    return;
  }
  const { canvas, sprite: s } = preview;
  const ctx = canvas.getContext('2d')!;
  const img = art(s.sheet);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!img) return;
  const k = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const w = img.naturalWidth * k, hh = img.naturalHeight * k;
  canvas.style.height = `${(hh / canvas.width) * canvas.clientWidth}px`;
  ctx.imageSmoothingEnabled = false;
  // xadrez para ver a transparência
  for (let y = 0; y < hh; y += 8) for (let x = 0; x < w; x += 8) {
    ctx.fillStyle = ((x + y) / 8) % 2 ? '#3a2a1c' : '#2c2016';
    ctx.fillRect(x, y, 8, 8);
  }
  ctx.drawImage(img, 0, 0, w, hh);
  const cols = Math.max(1, s.cols), rows = Math.max(1, s.rows);
  const cw = w / cols, ch = hh / rows;
  const frames = Math.max(1, Math.min(s.frames, cols * rows));
  const cur = s.motion === 'dragon' && !s.parts ? Math.floor(((t / 1000) % 1.2) / 1.2 * frames) : Math.floor((t / 1000) * s.fps) % frames;
  ctx.lineWidth = 1;
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.strokeStyle = i >= frames ? 'rgba(255,80,80,0.5)' : 'rgba(255,220,155,0.25)';
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    if (i >= frames) continue;
    // âncora (fonte) em cada quadro
    const ax = x + s.anchorX * cw, ay = y + s.anchorY * ch;
    ctx.strokeStyle = '#ff962e';
    ctx.beginPath();
    ctx.moveTo(ax - 4, ay);
    ctx.lineTo(ax + 4, ay);
    ctx.moveTo(ax, ay - 4);
    ctx.lineTo(ax, ay + 4);
    ctx.stroke();
    if (s.motion === 'dragon' && s.targetX != null) {
      ctx.strokeStyle = 'rgba(120,200,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(x + s.targetX * cw, ay - 5);
      ctx.lineTo(x + s.targetX * cw, ay + 5);
      ctx.stroke();
    }
  }
  const fx = (cur % cols) * cw, fy = Math.floor(cur / cols) * ch;
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 2;
  ctx.strokeRect(fx + 1, fy + 1, cw - 2, ch - 2);
}
function previewLoop(t: number) {
  if (preview) drawPreview(t);
  requestAnimationFrame(previewLoop);
}

function spriteTab(box: HTMLElement) {
  const d = jutsu ? JUTSUS[jutsu] : null;
  box.append(
    chips<'jutsu' | 'water'>([['jutsu', d ? d.name : 'Jutsu escolhido'], ['water', "Prisão d'Água (estado)"]], spriteTarget, (v) => {
      spriteTarget = v;
      render();
    }),
  );
  if (spriteTarget === 'jutsu' && !jutsu) {
    box.append(h('p', { class: 'hint' }, 'Toque num jutsu na lista à esquerda.'));
    return;
  }
  const cur = spriteTarget === 'water' ? FX.status.water : FX.jutsus[jutsu!]?.sprite;
  if (spriteTarget === 'jutsu') {
    box.append(h('h4', {}, 'Folha'));
    box.append(
      chips<string>([['', 'Sem sprite'], ...EFFECT_SHEETS.map((s): [string, string] => [s, sheetLabel(s)])], cur?.sheet ?? '', (v) => {
        const e = entry(jutsu!);
        if (!v) delete e.sprite;
        else e.sprite = cur ? { ...cur, sheet: v } : defaultSprite(v);
        changed();
        render();
      }),
    );
    if (d && d.effect !== 'projectile' && d.effect !== 'multi')
      box.append(h('p', { class: 'warn' }, 'Este jutsu não solta projétil: a sprite só aparece em projéteis.'));
  }
  if (!cur) {
    box.append(h('p', { class: 'hint' }, 'Sem sprite: o projétil é desenhado pelo código. Escolha uma folha para dar sprite a este jutsu (folha nova: PNG em src/art/effects registrado no art.ts).'));
    return;
  }
  const s = cur;
  const canvas = h('canvas', { class: 'sheet', width: '600', height: '300', 'data-tip': 'Clique: põe a âncora (laranja) naquele ponto do quadro. Shift+clique no dragão: ponto do mergulho (azul).' });
  canvas.onclick = (e) => {
    const r = canvas.getBoundingClientRect();
    const img = art(s.sheet);
    if (!img) return;
    const k = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const px = ((e.clientX - r.left) / r.width) * canvas.width / k / (img.naturalWidth / Math.max(1, s.cols));
    const py = ((e.clientY - r.top) / r.height) * canvas.height / k / (img.naturalHeight / Math.max(1, s.rows));
    const fx = round(px - Math.floor(px), 0.01), fy = round(py - Math.floor(py), 0.01);
    if (e.shiftKey && s.motion === 'dragon' && !s.parts) s.targetX = fx;
    else {
      s.anchorX = fx;
      s.anchorY = fy;
    }
    changed();
    render();
  };
  preview = { canvas, sprite: s };
  box.append(canvas);
  const dragon = s.motion === 'dragon' && !s.parts;
  if (spriteTarget === 'jutsu')
    box.append(
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Movimento'),
        seg<'loop' | 'dragon'>([['loop', 'Loop', 'Os quadros giram em loop sobre o projétil'], ['dragon', 'Bote', 'Dragão da fonte até o alvo']], s.motion === 'dragon' ? 'dragon' : 'loop', (v) => {
          if (v === 'dragon') Object.assign(s, { motion: 'dragon', targetX: s.targetX ?? 0.75, minSize: s.minSize ?? 56, maxSize: s.maxSize ?? 128, shear: s.shear ?? 0.6 });
          else delete s.motion;
          changed();
          render();
        })),
    );
  if (!dragon) box.append(slider('Tamanho', s.size, 4, 200, 1, (v) => (s.size = v), 'Largura desenhada (px do mundo; o ninja tem uns 24 de altura)'));
  if (s.parts && s.motion === 'dragon') {
    const parts = s.parts;
    box.append(
      h('p', { class: 'hint' }, 'Dragão em peças: a folha é a cabeça. Corpo e fonte acompanham a trajetória curva.'),
      slider('Espessura do corpo', parts.bodyWidth, 4, 40, 0.5, (v) => (parts.bodyWidth = v)),
      slider('Tamanho da fonte', parts.originSize, 12, 80, 1, (v) => (parts.originSize = v)),
      slider('Espaço entre juntas', parts.spacing, 3, 14, 0.5, (v) => (parts.spacing = v), 'Menor: mais juntas para curvas suaves'),
    );
  }
  // forma do bote (jogabilidade também: a cabeça só acerta ao descer); vale a partir do próximo disparo
  const flight = spriteTarget === 'jutsu' && jutsu ? FX.jutsus[jutsu]?.flight : undefined;
  if (flight)
    box.append(
      h('h4', {}, 'Trajetória do bote'),
      slider('Altura do arco', flight.lift, 0, 120, 1, (v) => (flight.lift = v), 'Quanto a cabeça sobe antes de mergulhar no alvo (px)'),
      slider('Curva lateral', flight.bend, -120, 120, 1, (v) => (flight.bend = v), 'Desvio para o lado no meio do caminho; 0 = reto no chão. Chega sempre de frente no alvo'),
    );
  box.append(
    slider('Âncora X', s.anchorX, 0, 1, 0.01, (v) => (s.anchorX = v), dragon ? 'Fonte do dragão na largura do quadro' : 'Ponto do quadro que fica sobre o projétil (0 = esquerda)'),
    slider('Âncora Y', s.anchorY, 0, 1, 0.01, (v) => (s.anchorY = v), dragon ? 'Linha do chão na altura do quadro' : 'Ponto do quadro que fica sobre o projétil (0 = topo)'),
    slider('Altura', s.dy, -40, 40, 0.5, (v) => (s.dy = v), 'Desloca na vertical (px; positivo desce)'),
  );
  if (dragon)
    box.append(
      slider('Mergulho X', s.targetX ?? 0.75, 0, 1, 0.01, (v) => (s.targetX = v), 'Onde o mergulho cai na largura do quadro'),
      slider('Tamanho mín', s.minSize ?? 56, 8, 256, 1, (v) => (s.minSize = v), 'Largura mínima do quadro (alvo perto)'),
      slider('Tamanho máx', s.maxSize ?? 128, 8, 400, 1, (v) => (s.maxSize = v), 'Largura máxima; mais longe que isso o dragão desliza até o alvo em vez de esticar'),
      slider('Em pé', s.shear ?? 0.6, 0, 2, 0.05, (v) => (s.shear = v), 'Quanto inclina sem girar (alvo acima/abaixo); 0 = só gira'),
    );
  else box.append(slider('Quadros/s', s.fps, 1, 40, 1, (v) => (s.fps = v)));
  box.append(
    slider('Opacidade', s.opacity, 0, 1, 0.01, (v) => (s.opacity = v)),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Mistura'),
      seg<'normal' | 'add'>([['normal', 'Normal'], ['add', 'Somar luz', 'Brilha sobre o fundo (bom para fogo e raio)']], s.blend, (v) => {
        s.blend = v;
        changed();
        render();
      })),
    h('div', { class: 'row' },
      !dragon && toggle('Girar com o voo', s.rotate, (v) => (s.rotate = v)),
      toggle('Espelhar à esquerda', s.flip, (v) => (s.flip = v), 'Indo para a esquerda, espelha a arte para não ficar de cabeça para baixo')),
    h('h4', {}, 'Grade da folha'),
    slider('Colunas', s.cols, 1, 8, 1, (v) => (s.cols = v)),
    slider('Linhas', s.rows, 1, 8, 1, (v) => (s.rows = v)),
    slider('Quadros', s.frames, 1, 64, 1, (v) => (s.frames = v), 'Quantos quadros usar (os de sobra ficam em vermelho)'),
  );
}

function emitterCard(e: Emitter, part: Part, i: number, list: Emitter[]) {
  const key = `${part}:${i}`;
  const isOpen = open.has(key);
  const card = h('div', { class: `em${isOpen ? ' open' : ''}` });
  const sw = h('span', { class: 'sw' });
  for (const c of e.colors) sw.append(h('i', { style: `background:${c === '$' ? 'conic-gradient(#f55,#fd5,#5df,#d5f,#f55)' : c}` }));
  const head = h('div', { class: 'emh' }, h('b', {}, SHAPE_LABEL[e.shape]), sw, h('small', {}, part === 'trail' ? `${e.n}/s` : `${e.n}${e.nR ? ` +${e.nR}/px` : ''}`));
  head.append(
    btn(ico('stack'), () => {
      list.splice(i + 1, 0, JSON.parse(JSON.stringify(e)));
      changed();
      render();
    }, { class: 'ghost icon', 'data-tip': 'Duplicar' }),
    btn(ico('trash'), () => {
      list.splice(i, 1);
      open.delete(key);
      changed();
      render();
    }, { class: 'ghost icon danger', 'data-tip': 'Tirar' }),
  );
  head.onclick = () => {
    if (isOpen) open.delete(key);
    else open.add(key);
    render();
  };
  card.append(head);
  if (!isOpen) return card;
  const body = h('div', { class: 'emb' });
  body.append(chips<Shape>(SHAPES.map((s): [Shape, string] => [s, SHAPE_LABEL[s]]), e.shape, (v) => {
    e.shape = v;
    changed();
    render();
  }));
  // cores: uma caixa por cor, "$" = a cor do jutsu
  const cols = h('div', { class: 'cols-row' });
  e.colors.forEach((c, ci) => {
    const cell = h('span', { class: 'col' });
    if (c === '$') cell.append(h('span', { class: 'own', 'data-tip': 'A cor do jutsu/efeito' }, 'cor do jutsu'));
    else {
      const inp = h('input', { type: 'color' });
      inp.value = c;
      inp.oninput = () => {
        e.colors[ci] = inp.value;
        changed();
      };
      cell.append(inp);
    }
    if (e.colors.length > 1)
      cell.append(btn('×', () => {
        e.colors.splice(ci, 1);
        changed();
        render();
      }, { class: 'ghost x' }));
    cols.append(cell);
  });
  cols.append(
    btn(ico('plus'), () => {
      e.colors.push(e.colors.find((c) => c !== '$') ?? '#ffffff');
      changed();
      render();
    }, { class: 'ghost icon', 'data-tip': 'Mais uma cor' }),
  );
  if (!e.colors.includes('$'))
    cols.append(btn('+ cor do jutsu', () => {
      e.colors.push('$');
      changed();
      render();
    }, { class: 'ghost' }));
  body.append(cols);
  const set = <K extends keyof Emitter>(k: K) => (v: Emitter[K] | undefined) => {
    if (v === undefined || v === 0) delete e[k];
    else e[k] = v as Emitter[K];
  };
  const trail = part === 'trail';
  body.append(
    slider(trail ? 'Por segundo' : 'Quantidade', e.n, 0, trail ? 200 : 60, 1, (v) => (e.n = v), trail ? 'Partículas por segundo (projétil grande solta o dobro)' : 'Quantas nascem na explosão'),
  );
  if (!trail)
    body.append(
      slider('+ por px de raio', e.nR ?? 0, 0, 3, 0.05, set('nR'), 'Explosão maior solta mais'),
      slider('Teto', e.max ?? 0, 0, 120, 1, set('max'), 'Máximo de partículas (0 = sem teto)'),
    );
  body.append(
    pair('Vida (s)', e.life, 0, 3, 0.01, (v) => (e.life = v ?? [0, 0])),
    pair(e.scale ? 'Tamanho (× raio/proj.)' : 'Tamanho (px)', e.size, 0, e.scale ? 3 : 20, e.scale ? 0.05 : 0.1, (v) => (e.size = v ?? [0, 0])),
    h('div', { class: 'row' },
      toggle('Proporcional', !!e.scale, (v) => {
        if (v) e.scale = true;
        else delete e.scale;
        render();
      }, trail ? 'Tamanho × tamanho do projétil ÷ 5' : 'Tamanho × raio da explosão'),
      toggle('Atrás da sprite', !!e.under, (v) => {
        if (v) e.under = true;
        else delete e.under;
      }, 'Desenhado antes do projétil, sem somar luz (resíduo discreto)'),
    ),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Brilho'),
      seg<'auto' | 'on' | 'off'>([['auto', 'Pelo formato'], ['on', 'Soma luz'], ['off', 'Normal']], e.glow == null ? 'auto' : e.glow ? 'on' : 'off', (v) => {
        if (v === 'auto') delete e.glow;
        else e.glow = v === 'on';
        changed();
        render();
      })),
    pair('Velocidade', e.speed, 0, 300, 1, (v) => (e.speed = v ?? [0, 0]), trail ? 'Em direção sorteada' : 'Para fora (× raio ÷ 20)'),
    pair('Subida', e.rise, -150, 60, 1, set('rise'), 'Somada na vertical (negativo sobe)'),
    pair('Pulo', e.jump, 0, 200, 1, set('jump'), 'Sobe e cai com gravidade, quicando'),
    slider('Altura inicial', e.z ?? 0, 0, 30, 0.5, set('z')),
    slider('Espalhar', e.spread ?? 0, 0, 2, 0.05, set('spread'), trail ? 'Onde nasce: × tamanho do projétil' : 'Onde nasce: × raio'),
  );
  if (trail)
    body.append(
      slider('Atrás (px)', e.back ?? 0, 0, 80, 1, set('back'), 'Nasce tantos px atrás do projétil'),
      slider('Segue o voo', e.follow ?? 0, -1, 1, 0.01, set('follow'), 'Fração da velocidade do projétil (negativo = solta para trás)'),
    );
  else body.append(slider('Anel', e.ring ?? 0, 0, 1.5, 0.05, set('ring'), 'Nasce num anel em volta (× raio), igualmente espaçadas; 0 = no centro'));
  body.append(
    slider('Desloca Y', e.dy ?? 0, -40, 40, 0.5, set('dy')),
    slider('Opacidade', e.opacity ?? 1, 0, 1, 0.01, (v) => (v === 1 ? delete e.opacity : (e.opacity = v))),
    slider('Chance', e.chance ?? 1, 0, 1, 0.01, (v) => (v === 1 ? delete e.chance : (e.chance = v)), 'Chance de cada uma nascer'),
  );
  card.append(body);
  return card;
}

function particlesTab(box: HTMLElement) {
  if (jutsu) {
    const cur = styleOfJutsu(jutsu);
    box.append(h('h4', {}, `Estilo de ${JUTSUS[jutsu]!.name}`));
    box.append(
      chips<string>(styleItems(), cur, (v) => {
        const d = JUTSUS[jutsu!]!;
        const e = entry(jutsu!);
        d.vfx = v === 'none' ? undefined : (v as Vfx);
        if (d.vfx === JUTSU_BASE[jutsu!]?.vfx) delete e.vfx;
        else if (d.vfx) e.vfx = d.vfx;
        style = v;
        changed();
        render();
      }),
    );
    box.append(
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Editar'),
        seg<'style' | 'jutsu'>([['style', `O estilo (${STYLE_LABEL[style] ?? style})`, 'Muda todos os jutsus deste estilo'], ['jutsu', 'Só este jutsu', 'Exceção: partículas próprias, no lugar das do estilo']], scope, (v) => {
          scope = v;
          open.clear();
          render();
        })),
    );
  } else scope = 'style';
  if (scope === 'style') {
    box.append(h('h4', {}, 'Estilo'));
    box.append(chips<string>(styleItems(), style, (v) => {
      style = v;
      open.clear();
      render();
    }));
  }
  for (const part of ['trail', 'burst'] as Part[]) {
    box.append(h('h3', {}, part === 'trail' ? 'Rastro do projétil' : 'Explosão / impacto'));
    let list: Emitter[] | undefined;
    if (scope === 'jutsu') {
      const e = entry(jutsu!);
      list = e[part];
      if (!list) {
        box.append(
          h('p', { class: 'hint' }, `Usa o do estilo ${STYLE_LABEL[style] ?? style}.`),
          btn(`${ico('plus')} Criar exceção (copia do estilo)`, () => {
            e[part] = JSON.parse(JSON.stringify(FX.styles[style]?.[part] ?? []));
            changed();
            render();
          }),
        );
        continue;
      }
    } else list = FX.styles[style]?.[part];
    if (!list) continue;
    const l = list;
    if (!l.length) box.append(h('p', { class: 'hint' }, part === 'trail' && scope === 'style' ? 'Sem rastro: usa o da natureza ou do tipo do projétil.' : 'Nenhum emissor.'));
    l.forEach((e, i) => box.append(emitterCard(e, part, i, l)));
    const row = h('div', { class: 'row' },
      btn(`${ico('plus')} Emissor`, () => {
        l.push({ shape: 'spark', colors: ['$'], n: part === 'trail' ? 30 : 10, life: [0.2, 0.4], size: [2, 4], speed: part === 'trail' ? [0, 20] : [30, 90] });
        open.add(`${part}:${l.length - 1}`);
        changed();
        render();
      }),
    );
    if (scope === 'jutsu')
      row.append(btn(`${ico('trash')} Tirar exceção`, () => {
        delete entry(jutsu!)[part];
        changed();
        render();
      }, { class: 'danger' }));
    box.append(row);
  }
}

function projTab(box: HTMLElement) {
  if (!jutsu) {
    box.append(h('p', { class: 'hint' }, 'Toque num jutsu na lista à esquerda.'));
    return;
  }
  const d = JUTSUS[jutsu]!;
  const base = JUTSU_BASE[jutsu] ?? {};
  box.append(h('p', { class: 'warn' }, 'Mexe na jogabilidade (alcance, área, quantos acertam): rode as réguas de .perf/ depois.'));
  const multi = d.effect === 'multi';
  const proj = d.effect === 'projectile';
  // o que o combate usa quando o jutsu não diz (combat.ts → releaseJutsu)
  const fallback: Required<ProjFx> = { projSpeed: multi ? 260 : 250, projSize: multi ? 5 : d.radius ? 9 : 6, radius: d.effect === 'aoe' ? 50 : 0, count: 3, range: d.range, spread: 0.6 };
  const fields: [keyof ProjFx, string, number, number, number, string][] = [];
  if (proj || multi) fields.push(['projSpeed', 'Velocidade', 40, 700, 5, 'px/s']);
  if (proj || multi) fields.push(['projSize', 'Tamanho', 1, 24, 0.5, 'Do projétil (o rastro proporcional segue)']);
  if (proj || d.effect === 'aoe') fields.push(['radius', 'Raio da área', 0, 150, 1, 'Explosão (0 = só acerta o alvo)']);
  if (multi) fields.push(['count', 'Quantidade', 1, 16, 1, 'Projéteis no leque']);
  if (multi) fields.push(['spread', 'Leque', 0, 3, 0.05, 'Abertura total (rad)']);
  fields.push(['range', 'Alcance', 20, 320, 5, 'Distância em que solta o jutsu']);
  for (const [k, label, min, max, step, tip] of fields) {
    const cur = (d[k] as number | undefined) ?? fallback[k];
    const orig = base[k] ?? fallback[k];
    const row = slider(label, cur, min, max, step, (v) => {
      (d as unknown as Record<string, number>)[k] = v;
      const e = entry(jutsu!);
      e.proj ??= {};
      if (v === orig) delete e.proj[k];
      else e.proj[k] = v;
    }, `${tip}. Original: ${orig}`);
    row.append(btn(ico('refresh'), () => {
      (d as unknown as Record<string, number | undefined>)[k] = base[k];
      const e = entry(jutsu!);
      if (e.proj) delete e.proj[k];
      changed();
      render();
    }, { class: `ghost icon${cur === orig ? ' same' : ''}`, 'data-tip': `Voltar ao original (${orig})` }));
    box.append(row);
  }
}

// ------------------------------------------------------------------ painel
function render() {
  const scrollTop = root.querySelector('.fxbody')?.scrollTop ?? 0;
  root.innerHTML = '';
  const head = h('div', { class: 'fxhead' },
    h('b', { class: 'title', html: `${ico('gear')} Ajuste` }),
    h('span', { class: 'grow' }),
    btn(ico('refresh'), () => void revert(), { class: 'ghost icon', 'data-tip': 'Desfazer o que não foi salvo', ...(canSave ? {} : { hidden: '' }) }),
    btn(`${ico('save')} Salvar`, () => void save(), { id: 'save', class: 'primary', 'data-tip': canSave ? 'Grava src/data/jutsu-fx.json (Ctrl+S)' : 'Só no localhost:3011 (o laboratório pelo túnel não grava)', ...(canSave ? {} : { disabled: '' }) }),
  );
  const target = h('div', { class: 'row' },
    h('span', { class: 'now' }, jutsu ? JUTSUS[jutsu]!.name : 'Nenhum jutsu escolhido'),
    h('span', { class: 'grow' }),
    btn(`${ico('play')} Soltar`, () => opts.fire(), { class: 'ghost', 'data-tip': 'Solta de novo a técnica escolhida' }),
    toggle('Repetir', repeat, (v) => {
      repeat = v;
      opts.setRepeat(v);
    }, 'Solta de novo sozinho sempre que o campo fica parado', false),
  );
  const status = h('div', { id: 'status', class: 'status' });
  const tabs = seg<Tab>([['sprite', 'Sprite'], ['particles', 'Partículas'], ['proj', 'Projétil']], tab, (v) => {
    tab = v;
    render();
  }, 'seg tabs');
  const body = h('div', { class: 'fxbody' });
  preview = null;
  if (tab === 'sprite') spriteTab(body);
  else if (tab === 'particles') particlesTab(body);
  else projTab(body);
  root.append(head, status, target, tabs, body);
  applyIcons(root);
  body.scrollTop = scrollTop;
  showStatus(statusText, statusKind);
}

/** Jutsu escolhido na lista (null = técnica que não é jutsu: só os estilos dá para ajustar). */
export function selectJutsu(id: string | null) {
  jutsu = id;
  spriteTarget = 'jutsu';
  open.clear();
  if (id) {
    style = styleOfJutsu(id);
    const e = FX.jutsus[id];
    scope = e?.trail || e?.burst ? 'jutsu' : 'style';
  }
  render();
}

export function initFxPanel(el: HTMLElement, o: FxPanelOpts) {
  root = el;
  opts = o;
  render();
  requestAnimationFrame(previewLoop);
  // grava só pelo servidor do 3011 (o /lab do túnel é só leitura)
  fetch('/api/fx', { method: 'GET', cache: 'no-store' })
    .then((r) => {
      canSave = r.ok && (r.headers.get('content-type') ?? '').includes('json');
      render();
    })
    .catch(() => {});
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });
}
