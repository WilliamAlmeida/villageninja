// Laboratório de jutsus (ferramenta de desenvolvimento, http://localhost:3011/lab): um campo limpo com um ninja e um
// boneco de treino. Cada botão solta um jutsu, golpe, técnica, arte de Ordem/Som/Sannin ou lâmina no boneco, usando o
// código real do jogo (combate, projéteis, efeitos e o renderer). "Duelo" deixa a IA lutar para ver o estilo de luta.
import { DAY_LENGTH, SIM_DT, TILE } from '../../src/config';
import { Camera } from '../../src/core/camera';
import { BLADES, bladeItem, type BladeId } from '../../src/data/blades';
import { JUTSU_LIST, JUTSUS } from '../../src/data/jutsus';
import type { Nature } from '../../src/data/natures';
import { ORG_MEMBERS, type OrgMemberId } from '../../src/data/org';
import { SOUND_MEMBERS, type SoundId } from '../../src/data/sound';
import { castJutsu, engage, kageArt, spawnProjectile, trySupport } from '../../src/game/combat';
import { createNinja, createRogue, refreshDerived } from '../../src/game/entities';
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
/** Últimos dois jutsus escolhidos: o ninja os leva para o duelo. */
const picked: string[] = [];

function labSystem(g: Game, dt: number) {
  for (const u of [dummy, ally, caster]) {
    if (u.hp < u.maxHp * 0.35) u.hp = u.maxHp;
    u.dead = false;
  }
  caster.chakra = caster.maxChakra;
  if (enemy) enemy.chakra = enemy.maxChakra;
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
  const busy = mode.kind !== 'idle' || g.state.projectiles.length > 0 || [caster, dummy, enemy].some((u) => u?.dash || u?.cast);
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

/** Volta todos para o lugar (o boneco e o aliado no mesmo ponto; só um aparece por vez). */
function place() {
  for (const u of [caster, dummy, ally, enemy]) {
    if (!u) continue;
    u.stun = 0;
    u.shield = 0;
    u.dash = undefined;
    u.cast = undefined;
    u.moving = false;
    u.hasGoal = false;
  }
  caster.x = cx - dist / 2;
  caster.y = cy;
  caster.facing = 0;
  for (const u of [dummy, ally]) {
    u.x = cx + dist / 2;
    u.y = cy;
    u.facing = Math.PI;
  }
  if (enemy) {
    enemy.x = cx - dist / 2;
    enemy.y = cy;
    enemy.facing = 0;
  }
}

/** Quem aparece: o ninja contra o boneco, ou um membro inimigo contra o aliado. */
function cast(who: 'ninja' | 'enemy') {
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
type Act = { label: string; color?: string; tip?: string; run: () => void };

const jutsuActs: Act[] = JUTSU_LIST.map((j) => ({
  label: j.name.replace(/^(Katon|Suiton|Fuuton|Doton|Raiton|Hyōton|Mokuton|Yōton|Ranton|Shakuton|Kinjutsu|Magen): /, ''),
  color: j.color,
  tip: `${j.name} — ${j.desc}`,
  run: () => {
    cast('ninja');
    place();
    picked.unshift(j.id);
    picked.splice(2);
    const n = caster.ninja!;
    n.jutsu = [j.id, null];
    n.cd = [0, 0];
    caster.attackCd = 0;
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
      spawnProjectile(g, caster, 'village', caster.x, caster.y - 4, dummy.x, dummy.y, { damage: 8, radius: 0, nature: null, color: '#cfd6dd', size: 4, speed: 360, kind: 'kunai', stun: 0, range: 220, vfx: 'metal' });
    },
  },
  {
    label: 'Papel-bomba',
    run: () => {
      cast('ninja');
      place();
      spawnProjectile(g, caster, 'village', caster.x, caster.y - 4, dummy.x, dummy.y, { damage: 30, radius: 50, nature: null, color: '#ff7a3b', size: 5, speed: 300, kind: 'kunai', stun: 0, range: 220, vfx: 'fire' });
    },
  },
];

function strike(blade: BladeId | null, t: number, d = dist) {
  cast('ninja');
  dist = d;
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
      dist = 160;
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
  ['Jutsus', jutsuActs, 'Ninja (Jounin, atributos 8) → boneco. A cura aparece num aliado ferido.'],
  ['Golpes', strikeActs],
  ['Lâminas lendárias', bladeActs, 'Equipa a lâmina e golpeia o boneco por uns segundos.'],
  ['Técnicas', techActs],
  ['Sannin', sanninActs],
  ['Ordem do Eclipse', orgActs, 'O membro usa a técnica num aliado da vila.'],
  ['Quinteto do Som', soundActs],
  ['Estilo de luta', duelActs],
];

const lists = document.getElementById('lists')!;
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
    if (a.tip) b.title = a.tip;
    b.onclick = () => {
      idle = 0;
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
  dist = Number(v);
  place();
});
seg('speed', (v) => (speed = Number(v)));
seg('nature', (v) => {
  nature = v as Nature;
  setupCaster();
});
document.getElementById('reset')!.onclick = () => {
  mode = { kind: 'idle', t: 0 };
  cast('ninja');
  place();
};
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
window.addEventListener('resize', resize);
resize();
camera.zoom = 2.4;
camera.jump(cx, cy);
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
    requestAnimationFrame(frame);
    return;
  }
  clock += dt * speed;
  acc += dt * speed;
  while (acc >= SIM_DT) {
    g.step(SIM_DT);
    acc -= SIM_DT;
  }
  renderer.render(g, camera, null, clock);
  requestAnimationFrame(frame);
}
preloadArt().then(() => requestAnimationFrame(frame));

/** Para depurar (console): pausa e avança a simulação quadro a quadro. `lab.act('Chidori')` aperta o botão. */
let paused = false;
Object.assign(window, {
  lab: {
    g,
    camera,
    pause: (p = true) => (paused = p),
    step(sec: number) {
      for (let t = 0; t < sec; t += SIM_DT) g.step(SIM_DT);
      clock += sec;
      renderer.render(g, camera, null, clock);
    },
    act(label: string) {
      const b = [...lists.querySelectorAll('button')].find((x) => x.textContent === label);
      b?.click();
      return !!b;
    },
  },
});
