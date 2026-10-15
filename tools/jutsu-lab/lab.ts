// Laboratório de jutsus (ferramenta de desenvolvimento, http://localhost:3011/lab): um campo limpo com um ninja e um
// boneco de treino. Cada botão solta um jutsu, golpe, técnica, arte de Ordem/Som/Sannin ou lâmina no boneco, usando o
// código real do jogo (combate, projéteis, efeitos e o renderer). "Duelo" deixa a IA lutar para ver o estilo de luta.
// O painel "Ajuste" (à direita, fxPanel.ts) muda sprite, partículas e números do jutsu escolhido ao vivo e grava.
import { drawContactDebug } from './contactDebug';
import { PROJECTILE_DEBUG } from '../../src/game/projectileCollision';
import { applyIcons, helpDialog, ico } from '../shared/ui';
import { initFxPanel, selectJutsu } from './fxPanel';
import { FX } from '../../src/data/jutsuFx';
import { DAY_LENGTH, SIM_DT, TILE } from '../../src/config';
import { Camera } from '../../src/core/camera';
import { BLADES, bladeItem, type BladeId } from '../../src/data/blades';
import { JUTSU_LIST, JUTSUS } from '../../src/data/jutsus';
import type { Nature } from '../../src/data/natures';
import { ORG_MEMBERS, type OrgMemberId } from '../../src/data/org';
import { SOUND_MEMBERS, type SoundId } from '../../src/data/sound';
import { castJutsu, engage, kageArt, spawnProjectile, trySupport } from '../../src/game/combat';
import { createAnimal, createNinja, createRogue, refreshDerived } from '../../src/game/entities';
import { Game } from '../../src/game/game';
import { createNewGame } from '../../src/game/newGame';
import { createOrgMember, orgArt } from '../../src/game/org';
import { sanninSurvive, sanninTick } from '../../src/game/sannin';
import { createSoundMember, soundArt } from '../../src/game/sound';
import { effectSystem } from '../../src/game/systems/effects';
import { projectileSystem } from '../../src/game/systems/projectiles';
import { statusSystem } from '../../src/game/systems/status';
import { techniqueSystem } from '../../src/game/systems/techniques';
import { shunshin, tryKawarimi } from '../../src/game/techniques';
import { enterMode, modeTick } from '../../src/game/modes';
import { BIJUU } from '../../src/data/bijuu';
import type { Unit } from '../../src/game/types';
import { CENTER_TX, CENTER_TY } from '../../src/game/world';
import { preloadArt } from '../../src/render/art';
import { Renderer } from '../../src/render/renderer';

// ------------------------------------------------------------------ o campo
const base = createNewGame([], 4242);
const s = base.state;
s.buildings = [];
s.nodes = [];
s.units = [];
s.sites = [];
s.explored = s.explored.map(() => -1); // tudo revelado
s.time = DAY_LENGTH * 0.3; // meio do dia
s.pace = 'fast';

/** Modo atual: golpes repetidos por um tempo, duelo IA × IA, ou parado. */
let mode: { kind: 'idle' | 'strike' | 'duel'; t: number } = { kind: 'idle', t: 0 };
let idle = 0;
let dist = 100;
let nature: Nature = 'katon';
let speed = 1;
let contactDebug = false;
let pauseOnContact = false;
/** Últimos dois jutsus escolhidos: o ninja os leva para o duelo. */
const picked: string[] = [];

function labSystem(g: Game, dt: number) {
  for (const u of [dummy, ally, caster]) {
    if (u.hp < u.maxHp * 0.35) u.hp = u.maxHp;
    u.dead = false;
  }
  caster.chakra = caster.maxChakra;
  // manto da fera e os outros modos (no jogo roda no sistema dos ninjas, que o laboratório não usa)
  modeTick(g, caster, dt);
  if (enemy) enemy.chakra = enemy.maxChakra;
  // sempre "em combate": fora de combate o jogo larga os selos (status.ts) e o jutsu do ritmo tático nunca saía
  for (const u of [caster, dummy, ally, enemy]) if (u) u.combatTimer = Math.max(u.combatTimer, 3);
  if (mode.kind === 'strike') {
    mode.t -= dt;
    const who = enemy ?? caster;
    if (who.stun <= 0) engage(g, who, enemy ? ally : dummy, dt);
    if (mode.t <= 0) mode = { kind: 'idle', t: 0 };
  } else if (mode.kind === 'duel') {
    mode.t -= dt;
    if (caster.stun <= 0) engage(g, caster, dummy, dt);
    if (dummy.stun <= 0) engage(g, dummy, caster, dt);
    if (mode.t <= 0) mode = { kind: 'idle', t: 0 };
  }
  // parado um tempo: todo mundo volta para o lugar
  const busy = mode.kind !== 'idle' || g.state.projectiles.length > 0 || [caster, dummy, enemy].some((u) => u?.dash || u?.cast || u?.barrage);
  idle = busy ? 0 : idle + dt;
  if (idle > 2.5) {
    idle = -999;
    place();
  }
}

const g = new Game(s, [statusSystem, techniqueSystem, projectileSystem, effectSystem, labSystem]);
const cx = CENTER_TX * TILE + TILE / 2;
const cy = CENTER_TY * TILE + TILE / 2;

const caster = createNinja(g, cx - 50, cy, 'jounin', 0);
caster.name = 'Ninja de teste';
const dummy = createRogue(g, cx + 50, cy, 30, { rank: 'jounin', stats: 1, jutsu: 0, name: 'Boneco de treino' });
const ally = createNinja(g, cx + 50, cy, 'chunin', 0);
ally.name = 'Aliado (alvo da Ordem/Som e da cura)';
let enemy: Unit | null = null;
let labDog: Unit | null = null;
const ninkenToggle = document.getElementById('ninken') as HTMLInputElement;
function placeNinken() {
  if (!ninkenToggle.checked || caster.hidden) {
    if (labDog) { labDog.hidden = true; labDog.dash = undefined; labDog.moving = false; }
    return;
  }
  if (!labDog || labDog.dead) {
    labDog = createAnimal(g, 'dog', caster.x - 14, caster.y + 18);
    labDog.name = 'Ninken de teste';
    labDog.faction = caster.faction;
    labDog.ownerId = caster.id;
    labDog.life = 1e9;
    labDog.breed = 'shiba';
  }
  Object.assign(labDog, { hidden: false, x: caster.x - 14, y: caster.y + 18,
    facing: caster.facing, stun: 0, dash: undefined, moving: false, hasGoal: false });
}
ninkenToggle.onchange = placeNinken;

function setupCaster() {
  const n = caster.ninja!;
  for (const k of Object.keys(n.stats) as (keyof typeof n.stats)[]) n.stats[k] = 8;
  n.level = 30;
  n.nature = nature;
  refreshDerived(caster);
  caster.hp = caster.maxHp;
  dummy.maxHp = dummy.hp = 4000;
  dummy.ninja!.jutsu = [null, null];
  ally.maxHp = ally.hp = 4000;
}
setupCaster();

/** Lugar do ninja e do alvo (boneco/aliado). Arrastar no campo muda; a Distância mantém a direção entre os dois. */
const spot = { x: cx - 50, y: cy };
const target = { x: cx + 50, y: cy };

/** Põe o alvo a `d` do ninja, na direção atual entre os dois. */
function setDist(d: number) {
  dist = d;
  const a = Math.atan2(target.y - spot.y, target.x - spot.x);
  target.x = spot.x + Math.cos(a) * d;
  target.y = spot.y + Math.sin(a) * d;
}

/** Volta todos para o lugar (o boneco e o aliado no mesmo ponto; só um aparece por vez). */
function place() {
  for (const u of [caster, dummy, ally, enemy]) {
    if (!u) continue;
    u.stun = 0;
    u.shield = 0;
    u.dash = undefined;
    u.cast = undefined;
    u.barrage = undefined;
    u.moving = false;
    u.hasGoal = false;
  }
  const face = Math.atan2(target.y - spot.y, target.x - spot.x);
  caster.x = spot.x;
  caster.y = spot.y;
  caster.facing = face;
  for (const u of [dummy, ally]) {
    u.x = target.x;
    u.y = target.y;
    u.facing = face + Math.PI;
  }
  if (enemy) {
    enemy.x = spot.x;
    enemy.y = spot.y;
    enemy.facing = face;
  }
  placeNinken();
}

/** Quem aparece: o ninja contra o boneco, ou um membro inimigo contra o aliado. */
function cast(who: 'ninja' | 'enemy') {
  // cada técnica começa do ninja comum: o Hiraishin o fazia Kage e os botões dos Sannin, Sannin, para sempre
  const n = caster.ninja!;
  n.rank = 'jounin';
  n.sannin = undefined;
  n.kageArt = undefined;
  n.bijuu = undefined;
  n.kekkei = null;
  caster.eyeOn = undefined;
  caster.mirror = undefined;
  caster.mode = undefined;
  caster.sage = 0;
  caster.mark = undefined;
  caster.hidden = who === 'enemy';
  dummy.hidden = who === 'enemy';
  ally.hidden = who !== 'enemy';
  if (who === 'ninja' && enemy) {
    enemy.dead = true;
    enemy = null;
  }
}

function useEnemy(make: () => Unit) {
  if (enemy) enemy.dead = true;
  enemy = make();
  enemy.maxHp = enemy.hp = 4000;
  enemy.abilityCd = 0;
  cast('enemy');
  place();
}

// ------------------------------------------------------------------ ações
/** `jutsu`: o painel "Ajuste" passa a mexer nele. */
type Act = { label: string; color?: string; tip?: string; jutsu?: string; run: () => void };

const jutsuActs: Act[] = JUTSU_LIST.map((j) => ({
  label: j.name.replace(/^(Katon|Suiton|Fuuton|Doton|Raiton|Hyōton|Mokuton|Yōton|Ranton|Shakuton|Kinjutsu|Magen): /, ''),
  color: j.color,
  tip: `${j.name} — ${j.desc}`,
  jutsu: j.id,
  run: () => {
    cast('ninja');
    place();
    picked.unshift(j.id);
    picked.splice(2);
    const n = caster.ninja!;
    n.jutsu = [j.id, null];
    n.cd = [0, 0];
    n.kekkei = j.kekkei ?? null; // jutsu de clã: o ninja tem a kekkei genkai (olhos acesos no Sharingan/Byakugan)
    caster.attackCd = 0;
    if (j.effect === 'reanimate' && !s.fallen.length) {
      // Edo Tensei precisa de um caído: o aliado entra na Pedra Memorial (só no laboratório)
      const an = ally.ninja!;
      s.fallen.push({ id: ally.id, name: 'Aliado caído', rank: an.rank, level: 20, day: 1, nature: an.nature, stats: { ...an.stats }, jutsu: ['goukakyuu', null], look: { ...ally.look } });
    }
    if (j.effect === 'heal') {
      // cura: o aliado ferido aparece ao lado
      ally.hidden = false;
      dummy.hidden = true;
      ally.hp = ally.maxHp * 0.4;
      ally.x = caster.x + 60;
      trySupport(g, caster);
      return;
    }
    castJutsu(g, caster, 0, dummy);
  },
}));

const strikeActs: Act[] = [
  { label: 'Golpe comum', run: () => strike(null, 2.5, 30) },
  {
    label: 'Kunai',
    run: () => {
      cast('ninja');
      place();
      throwPose();
      spawnProjectile(g, caster, 'village', caster.x, caster.y - 4, dummy.x, dummy.y, { damage: 8, radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 360, kind: 'kunai', stun: 0, range: 220, vfx: 'metal' });
    },
  },
  {
    label: 'Papel-bomba',
    run: () => {
      cast('ninja');
      place();
      throwPose();
      spawnProjectile(g, caster, 'village', caster.x, caster.y - 4, dummy.x, dummy.y, { damage: 30, radius: 50, nature: null, color: '#ff7a3b', size: 5, speed: 300, kind: 'kunai', stun: 0, range: 220, vfx: 'fire' });
    },
  },
];

/** Arremesso (kunai, papel-bomba): a mesma pose que o jogo usa ao lançar (combat.ts → throwKunai). */
function throwPose() {
  caster.facing = Math.atan2(dummy.y - caster.y, dummy.x - caster.x);
  caster.anim = 0.3;
  caster.animKind = 'throw';
}

function strike(blade: BladeId | null, t: number, d = dist) {
  cast('ninja');
  setDist(d);
  place();
  const n = caster.ninja!;
  n.jutsu = [null, null];
  n.equip.weapon = blade ? bladeItem(blade) : null;
  refreshDerived(caster);
  mode = { kind: 'strike', t };
}

const bladeActs: Act[] = (Object.keys(BLADES) as BladeId[]).map((b) => ({ label: BLADES[b].name, color: BLADES[b].color, tip: BLADES[b].effect, run: () => strike(b, 4, 30) }));

const techActs: Act[] = [
  {
    label: 'Shunshin',
    run: () => {
      cast('ninja');
      place();
      caster.flickerCd = 0;
      shunshin(g, caster, dummy.x + 30, dummy.y + 20);
    },
  },
  {
    label: 'Kawarimi',
    run: () => {
      cast('ninja');
      place();
      caster.x = dummy.x - 24;
      for (let i = 0; i < 40; i++) {
        caster.kawaCd = 0;
        if (tryKawarimi(g, caster, dummy, caster.maxHp)) break;
      }
    },
  },
  {
    label: 'Hiraishin (Kage)',
    run: () => {
      strike(null, 6, 160);
      caster.ninja!.rank = 'kage';
      caster.ninja!.kageArt = 'hiraishin';
      caster.artCd = 0;
      kageArt(g, caster, dummy, dist);
    },
  },
];

const sanninActs: Act[] = [
  {
    label: 'Modo Sábio',
    run: () => {
      cast('ninja');
      place();
      caster.ninja!.sannin = 'toad';
      caster.sanninCd = 0;
      caster.sage = 0;
      caster.combatTimer = 2;
      sanninTick(g, caster);
    },
  },
  {
    label: 'Selo da Força de Cem',
    run: () => {
      cast('ninja');
      place();
      ally.hidden = false;
      dummy.hidden = true;
      ally.hp = ally.maxHp * 0.4;
      ally.x = caster.x + 70;
      caster.ninja!.sannin = 'slug';
      caster.sanninCd = 0;
      caster.hp = caster.maxHp * 0.4;
      sanninTick(g, caster);
    },
  },
  {
    label: 'Troca de Pele',
    run: () => {
      cast('ninja');
      place();
      caster.ninja!.sannin = 'snake';
      caster.sanninCd = 0;
      sanninSurvive(g, caster);
    },
  },
];

/** Manto da fera do Jinchuuriki: o ninja guarda a fera de tantas caudas e veste o manto (o normal e o descontrolado). */
const bijuuActs: Act[] = [...BIJUU.map((b) => ({ b, wild: false })), { b: BIJUU[8]!, wild: true }].map(({ b, wild }) => ({
  label: wild ? `${b.name} descontrolado` : `${b.tails} · ${b.name}`,
  color: b.color,
  tip: `Manto de chakra de ${b.name} (${b.tails} ${b.tails > 1 ? 'caudas' : 'cauda'})${b.tails >= 4 ? ': solta ondas de chakra em volta' : ''}${wild ? '; descontrolado, as ondas pegam os aliados' : ''}.`,
  run: () => {
    strike(null, 6, 30); // limpa o ninja (cast) e golpeia o boneco por uns segundos
    caster.ninja!.bijuu = b.tails;
    enterMode(g, caster, 'bijuu', b.tails);
    caster.mode!.wild = wild;
    caster.mode!.t = 12;
  },
}));

/** Dōjutsu: o boneco solta um Goukakyuu no ninja do Sharingan, que copia e devolve; o Byakugan golpeia com o Punho
 *  Gentil (cada golpe tira chakra do alvo). Amaterasu, Susano'o, Kanashibari e os golpes Hyuga estão em Jutsus. */
const eyeActs: Act[] = [
  {
    label: 'Sharingan: copiar',
    color: '#e0202a',
    tip: 'O boneco solta um Goukakyuu; o Sharingan copia e devolve o mesmo jutsu.',
    run: () => {
      strike(null, 5, 140);
      caster.ninja!.kekkei = 'sharingan';
      const d = dummy.ninja!;
      d.jutsu = ['goukakyuu', null];
      d.cd = [0, 0];
      dummy.chakra = dummy.maxChakra;
      castJutsu(g, dummy, 0, caster);
      d.jutsu = [null, null];
    },
  },
  {
    label: 'Byakugan: Punho Gentil',
    color: '#cfc8ff',
    tip: 'Golpes corpo a corpo com o Byakugan: cada um fecha pontos de chakra do alvo.',
    run: () => {
      strike(null, 5, 30);
      caster.ninja!.kekkei = 'byakugan';
    },
  },
];

const orgActs: Act[] = (Object.keys(ORG_MEMBERS) as OrgMemberId[]).map((id) => ({
  label: ORG_MEMBERS[id].art,
  tip: `${ORG_MEMBERS[id].name}, ${ORG_MEMBERS[id].title}`,
  run: () => {
    useEnemy(() => createOrgMember(g, id, cx, cy));
    if (id === 'tetsuo') {
      enemy!.x = ally.x - 30;
    }
    orgArt(g, enemy!, ally);
  },
}));

const soundActs: Act[] = (Object.keys(SOUND_MEMBERS) as SoundId[]).map((id) => ({
  label: SOUND_MEMBERS[id].art,
  tip: `${SOUND_MEMBERS[id].name}, ${SOUND_MEMBERS[id].title}`,
  run: () => {
    useEnemy(() => createSoundMember(g, id, cx, cy));
    if (id === 'iwao' || id === 'hakkotsu') enemy!.x = ally.x - 36;
    soundArt(g, enemy!, ally);
  },
}));

const duelActs: Act[] = [
  {
    label: 'Duelo IA × IA (30 s)',
    tip: 'O ninja (com os 2 últimos jutsus escolhidos) luta contra um oponente com 2 jutsus sorteados.',
    run: () => {
      cast('ninja');
      setDist(160);
      place();
      const n = caster.ninja!;
      n.jutsu = [picked[0] ?? null, picked[1] ?? null];
      n.cd = [0, 0];
      n.equip.weapon = null;
      const pool = JUTSU_LIST.filter((j) => j.effect !== 'heal' && j.effect !== 'clone');
      dummy.ninja!.jutsu = [pool[(Math.random() * pool.length) | 0]!.id, pool[(Math.random() * pool.length) | 0]!.id];
      dummy.ninja!.cd = [0, 0];
      refreshDerived(caster);
      mode = { kind: 'duel', t: 30 };
    },
  },
];

const GROUPS: [string, Act[], string?][] = [
  ['Técnicas', techActs],
  ['Jutsus', jutsuActs, 'Ninja (Jounin, atributos 8) → boneco. A cura aparece num aliado ferido.'],
  ['Golpes', strikeActs],
  ['Lâminas lendárias', bladeActs, 'Equipa a lâmina e golpeia o boneco por uns segundos.'],
  ['Sannin', sanninActs],
  ['Dōjutsu', eyeActs, "Sharingan e Byakugan. Os jutsus de cada olho (Amaterasu, Susano'o, golpes Hyuga) estão em Jutsus."],
  ['Bestas com cauda (manto)', bijuuActs, 'O ninja vira Jinchuuriki e veste o manto da fera; golpeia o boneco por uns segundos.'],
  ['Ordem do Eclipse', orgActs, 'O membro usa a técnica num aliado da vila.'],
  ['Quinteto do Som', soundActs],
  ['Estilo de luta', duelActs],
];

const lists = document.getElementById('lists')!;
/** Último botão apertado: "Soltar" e "Repetir" do painel apertam de novo. */
let lastBtn: HTMLButtonElement | null = null;
/** Repetir: solta de novo sozinho quando o campo fica parado. */
let repeat = false;
const now = document.getElementById('now')!;
for (const [title, acts, hint] of GROUPS) {
  const box = document.createElement('div');
  box.className = 'grp';
  box.innerHTML = `<h3>${title}</h3>${hint ? `<small>${hint}</small>` : ''}<div class="items"></div>`;
  const items = box.querySelector('.items')!;
  for (const a of acts) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.color) b.style.setProperty('--c', a.color);
    if (a.tip) b.dataset.tip = a.tip;
    b.onclick = () => {
      idle = 0;
      PROJECTILE_DEBUG.hits.length = 0;
      if (lastBtn !== b) selectJutsu(a.jutsu ?? null);
      lastBtn = b;
      a.run();
      now.textContent = a.label;
      lists.querySelectorAll('button.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    items.appendChild(b);
  }
  lists.appendChild(box);
}

function seg(id: string, on: (v: string) => void) {
  const el = document.getElementById(id)!;
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    on(b.dataset.v!);
  };
}
seg('pace', (v) => (s.pace = v as 'fast' | 'tactical'));
seg('dist', (v) => {
  setDist(Number(v));
  place();
});
seg('speed', (v) => (speed = Number(v)));
seg('nature', (v) => {
  nature = v as Nature;
  setupCaster();
});
document.getElementById('reset')!.onclick = () => {
  mode = { kind: 'idle', t: 0 };
  // limpa o campo: projéteis, efeitos (muralha, ossos…), invocações e clones; vida, chakra e recargas cheias
  s.projectiles = [];
  s.effects = [];
  for (const u of s.units) if (u !== caster && u !== dummy && u !== ally && u !== enemy) u.dead = true;
  for (const u of [caster, dummy, ally, enemy]) {
    if (!u) continue;
    u.hp = u.maxHp;
    u.attackCd = 0;
    u.knockT = 0;
    u.burn = undefined;
    if (u.ninja) u.ninja.cd = [0, 0];
  }
  cast('ninja');
  spot.x = cx - dist / 2;
  spot.y = cy;
  target.x = cx + dist / 2;
  target.y = cy;
  place();
  now.textContent = 'Toque numa técnica';
  lists.querySelectorAll('button.on').forEach((x) => x.classList.remove('on'));
};
// busca nos botões (esconde grupo sem resultado)
const labFilter = document.getElementById('labFilter') as HTMLInputElement;
labFilter.addEventListener('input', () => {
  const q = labFilter.value.trim().toLowerCase();
  for (const grp of lists.querySelectorAll<HTMLElement>('.grp')) {
    let any = false;
    for (const b of grp.querySelectorAll<HTMLElement>('button')) {
      const hit = !q || (b.textContent ?? '').toLowerCase().includes(q);
      b.hidden = !hit;
      any ||= hit;
    }
    grp.hidden = !any;
  }
});
void JUTSUS;

// ------------------------------------------------------------------ desenho
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const camera = new Camera();
function resize() {
  const r = canvas.parentElement!.getBoundingClientRect();
  renderer.resize(r.width, r.height);
  camera.resize(r.width, r.height);
}
new ResizeObserver(resize).observe(canvas.parentElement!);
resize();
camera.zoom = 2.4;
camera.jump(cx, cy);
// toque e mouse: arrastar o ninja ou o alvo muda o lugar deles; no chão, move a câmera; pinça (dois dedos) dá zoom
const touches = new Map<number, { x: number; y: number }>();
/** Quem está sendo arrastado: o ponto do ninja (`spot`) ou o do alvo (`target`). */
let drag: { pt: { x: number; y: number }; dx: number; dy: number } | null = null;
/** Unidade sob o ponto da tela (mira um pouco acima dos pés, onde fica o corpo). */
function unitAt(sx: number, sy: number) {
  let best: Unit | null = null;
  let bd = 16 * Math.max(1, camera.zoom);
  for (const u of [caster, dummy, ally, enemy]) {
    if (!u || u.hidden || u.dead) continue;
    const p = camera.worldToScreen(u.x, u.y);
    const d = Math.hypot(p.x - sx, p.y - 10 * camera.zoom - sy);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
canvas.style.touchAction = 'none';
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  drag = null;
  if (touches.size !== 1) return;
  const u = unitAt(e.offsetX, e.offsetY);
  if (!u) return;
  const w = camera.screenToWorld(e.offsetX, e.offsetY);
  const pt = u === dummy || u === ally ? target : spot;
  drag = { pt, dx: u.x - w.x, dy: u.y - w.y };
});
canvas.addEventListener('pointermove', (e) => {
  const hover = !drag && touches.size === 0 && unitAt(e.offsetX, e.offsetY);
  canvas.style.cursor = drag ? 'grabbing' : hover ? 'grab' : '';
  const p = touches.get(e.pointerId);
  if (!p) return;
  if (drag && touches.size === 1) {
    const w = camera.screenToWorld(e.offsetX, e.offsetY);
    drag.pt.x = w.x + drag.dx;
    drag.pt.y = w.y + drag.dy;
    dist = Math.round(Math.hypot(target.x - spot.x, target.y - spot.y));
    document.querySelectorAll('#dist button').forEach((x) => x.classList.toggle('on', Number((x as HTMLElement).dataset.v) === dist));
    // larga o que estava fazendo e vai para o lugar novo na hora
    mode = { kind: 'idle', t: 0 };
    place();
  } else if (touches.size === 1) camera.pan(e.offsetX - p.x, e.offsetY - p.y);
  else if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    const other = a === p ? b! : a!;
    const before = Math.hypot(p.x - other.x, p.y - other.y);
    const after = Math.hypot(e.offsetX - other.x, e.offsetY - other.y);
    if (before > 0) camera.zoomAt(after / before, (e.offsetX + other.x) / 2, (e.offsetY + other.y) / 2);
  }
  touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
});
for (const ev of ['pointerup', 'pointercancel'] as const)
  canvas.addEventListener(ev, (e) => {
    touches.delete(e.pointerId);
    drag = null;
  });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.offsetX, e.offsetY);
}, { passive: false });

cast('ninja');
place();
let last = performance.now();
let acc = 0;
let clock = 0;
function frame(t: number) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  if (paused) {
    renderer.render(g, camera, null, clock);
  drawContactDebug(canvas,camera,g,contactDebug,clock);
    requestAnimationFrame(frame);
    return;
  }
  clock += dt * speed;
  acc += dt * speed;
  while (acc >= SIM_DT) {
    const lastHit = PROJECTILE_DEBUG.hits.at(-1);
    g.step(SIM_DT);
    acc -= SIM_DT;
    if (pauseOnContact && PROJECTILE_DEBUG.hits.at(-1) !== lastHit) { setPaused(true); acc=0; break; }
  }
  if (repeat && lastBtn && idle > 0.8) lastBtn.click();
  renderer.render(g, camera, null, clock);
  drawContactDebug(canvas,camera,g,contactDebug,clock);
  requestAnimationFrame(frame);
}
preloadArt().then(() => {
  // Link reproduzível para inspecionar um jutsu pausado no mesmo instante.
  const params=new URLSearchParams(location.search),id=params.get('jutsu');
  if(id && JUTSUS[id]){
    caster.ninja!.jutsu=[id,null];caster.ninja!.kekkei=JUTSUS[id]!.kekkei??null;caster.combatTimer=3;selectJutsu(id);
    // A prévia de golpes de contato começa ao alcance dos punhos.
    if(JUTSUS[id]!.effect==='melee'){
      const dx=dummy.x-caster.x,dy=dummy.y-caster.y,d=Math.hypot(dx,dy)||1;
      caster.x=dummy.x-dx/d*24;caster.y=dummy.y-dy/d*24;
    }
    ninkenToggle.checked=params.get('ninken')==='1';placeNinken();
    castJutsu(g,caster,0,dummy);
    const seconds=Math.max(0,Math.min(3,Number(params.get('at')??0)||0));
    for(let elapsed=0;elapsed<seconds;elapsed+=SIM_DT)g.step(SIM_DT);
    clock=seconds;setPaused(true);now.textContent=JUTSUS[id]!.name;
  }
  requestAnimationFrame(frame);
});

/** Para depurar (console): pausa e avança a simulação quadro a quadro. `lab.act('Chidori')` aperta o botão. */
let paused = false;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
function setPaused(p: boolean) {
  paused = p;
  pauseBtn.innerHTML = `${ico(p ? 'play' : 'pause')} ${p ? 'Continuar' : 'Pausar'}`;
  pauseBtn.classList.toggle('on', p);
  (document.getElementById('step') as HTMLButtonElement).disabled = !p;
}
pauseBtn.onclick = () => setPaused(!paused);
document.getElementById('step')!.onclick = () => {
  g.step(SIM_DT);
  clock += SIM_DT;
  renderer.render(g, camera, null, clock);
  drawContactDebug(canvas,camera,g,contactDebug,clock);
};
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key === ' ') {
    e.preventDefault();
    setPaused(!paused);
  } else if (e.key === '.' && paused) document.getElementById('step')!.click();
  else if (e.key.toLowerCase() === 'r') document.getElementById('reset')!.click();
  else if (e.key === '/') {
    e.preventDefault();
    labFilter.focus();
  }
});
// painel "Ajuste": aberto no desktop largo; a escolha fica guardada neste navegador
const cols = document.getElementById('cols')!;
const fxToggle = document.getElementById('fxToggle')!;
function showFx(on: boolean) {
  cols.classList.toggle('nofx', !on);
  fxToggle.classList.toggle('on', on);
  try {
    localStorage.setItem('lab-fx', on ? '1' : '0');
  } catch {}
}
let fxSaved: string | null = null;
try {
  fxSaved = localStorage.getItem('lab-fx');
} catch {}
showFx(fxSaved ? fxSaved === '1' : window.innerWidth >= 1100);
fxToggle.onclick = () => showFx(cols.classList.contains('nofx'));
initFxPanel(document.getElementById('fx')!, {
  fire: () => lastBtn?.click(),
  setRepeat: (on) => (repeat = on),
  setContactDebug: on=>{contactDebug=on;PROJECTILE_DEBUG.enabled=on||pauseOnContact},
  setPauseOnContact: on=>{pauseOnContact=on;PROJECTILE_DEBUG.enabled=on||contactDebug},
});
applyIcons();
setPaused(false);
helpDialog('Laboratório: atalhos', [
  ['Simulação', [['Espaço', 'Pausar / continuar'], ['.', 'Avança um quadro de simulação (pausado)'], ['R', 'Reiniciar (volta o ninja e o boneco ao lugar)'], ['Roda', 'Zoom']]],
  ['Campo', [['Arrastar ninja/boneco', 'Muda a posição (a Distância mantém a direção)'], ['Arrastar o chão', 'Move a câmera']]],
  ['Lista', [['/', 'Buscar jutsu, golpe ou técnica'], ['Clique', 'Solta a técnica no boneco'], ['?', 'Esta ajuda']]],
  ['Ajuste (painel à direita)', [['Ctrl+S', 'Grava src/data/jutsu-fx.json (só no localhost:3011)'], ['Clique na folha', 'Põe a âncora da sprite'], ['Shift+clique', 'Ponto do mergulho (dragão)'], ['Repetir', 'Solta de novo sozinho para ver o ajuste']]],
  ['Console', [['lab.pause()', 'Pausa'], ['lab.step(s)', 'Avança s segundos'], ["lab.act('Chidori')", 'Aperta o botão pelo nome']]],
]);
Object.assign(window, {
  lab: {
    g,
    camera,
    /** Visual dos jutsus em memória (o que o painel "Ajuste" mexe; data/jutsu-fx.json). */
    fx: FX,
    pause: (p = true) => (paused = p),
    step(sec: number) {
      for (let t = 0; t < sec; t += SIM_DT) g.step(SIM_DT);
      clock += sec;
      renderer.render(g, camera, null, clock);
  drawContactDebug(canvas,camera,g,contactDebug,clock);
    },
    act(label: string) {
      const b = [...lists.querySelectorAll('button')].find((x) => x.textContent === label);
      b?.click();
      return !!b;
    },
  },
});
