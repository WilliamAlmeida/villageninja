// O Quinteto do Som (data/sound.ts): invasão para raptar o ninja mais talentoso, a IA de quem carrega e de quem dá
// cobertura, as técnicas de cada um, o resgate no esconderijo e o selo amaldiçoado de quem não foi resgatado a tempo.
import { rand, randi } from '../core/rng';
import { STAT_KEYS } from '../data/ninja';
import { costLabel } from '../data/resources';
import { SOUND, SOUND_MEMBERS, SOUND_RAIDERS, type SoundId } from '../data/sound';
import { applyDamage, engage, spawnProjectile } from './combat';
import { createRogue, refreshDerived } from './entities';
import { fx, fxText } from './fx';
import type { Game } from './game';
import { chase, followPath, setDestination } from './movement';
import { edgePoint } from './systems/spawner';
import type { Unit } from './types';
import { doorPos } from './world';

/** Fora do mapa com o Som (raptado à espera de resgate, ou do lado deles entre uma invasão e outra). */
export const WITH_SOUND = -1;

export const soundOnMap = (g: Game) => g.state.units.filter((u) => !u.dead && u.sound && !u.hidden);
const carrierOf = (g: Game) => g.state.units.find((u) => !u.dead && u.carrying != null);

/** Ninjas da vila que passaram para o lado do Som (selo amaldiçoado). */
export const cursedOnes = (g: Game) => g.state.units.filter((u) => !u.dead && u.cursed && u.faction === 'enemy');

/** O alvo do rapto: o ninja mais talentoso (kekkei genkai primeiro, depois nível e atributos); nunca Kage nem Sannin. */
export function soundTarget(g: Game): Unit | null {
  let best: Unit | null = null;
  let bs = -1;
  for (const u of g.state.units) {
    const n = u.ninja;
    if (u.dead || u.faction !== 'village' || u.kind !== 'ninja' || !n || u.away != null || u.origin != null) continue;
    if (n.rank === 'kage' || n.sannin) continue;
    const score = (n.kekkei ? 1000 : 0) + n.level * 10 + STAT_KEYS.reduce((a, k) => a + n.stats[k], 0);
    if (score > bs) [best, bs] = [u, score];
  }
  return best;
}

/** Cria um membro do Som. */
export function createSoundMember(g: Game, id: SoundId, x: number, y: number): Unit {
  const d = SOUND_MEMBERS[id];
  const u = createRogue(g, x, y, g.state.day, { rank: 'jounin', stats: SOUND.stats, hpMult: d.hpMult, jutsu: 1, name: `${d.name}, ${d.title}` });
  u.sound = id;
  u.boss = true;
  const n = u.ninja!;
  n.nature = d.nature;
  n.level = SOUND.level;
  u.look = { ...u.look, cloth: SOUND.cloth };
  for (const k of STAT_KEYS) n.stats[k] = Math.min(10, SOUND.attr + rand(0, 1.5));
  refreshDerived(u);
  const elite = g.state.units.filter((v) => !v.dead && v.faction === 'village' && v.ninja && (v.ninja.rank === 'jounin' || v.ninja.rank === 'kage')).length;
  u.maxHp = Math.round(u.maxHp * d.hpMult * Math.min(2.5, 1 + elite * 0.1));
  u.hp = u.maxHp;
  u.chakra = u.maxChakra;
  u.abilityCd = d.cd * 0.4;
  return u;
}

/** Na vila: agenda e manda a invasão; acompanha o prazo do resgate e o fim da invasão. */
export function soundTick(g: Game, dt: number) {
  const s = g.state;
  const st = s.sound;
  if (s.sceneInfo) return;
  // prazo do resgate: passou, o raptado recebe o selo amaldiçoado e passa para o lado deles
  const rescuing = s.expeditions.some((e) => e.action === 'rescue' && e.status !== 'done' && e.status !== 'lost');
  if (st.captive && s.day > st.captive.until && !rescuing) curse(g);
  // invasão em andamento: acabou sem rapto = impedido
  if (st.raid) {
    st.raid.t += dt;
    if (!soundOnMap(g).length) endRaid(g);
    return;
  }
  if (s.level < SOUND.minVillage) return;
  if (!st.nextDay) st.nextDay = s.day + 4;
  if (s.day < st.nextDay || st.captive) return;
  if (s.units.some((u) => !u.dead && (u.org || u.swordsman))) return; // uma ameaça por vez
  const target = soundTarget(g);
  if (!target) return;
  st.nextDay = s.day + randi(SOUND.every[0], SOUND.every[1]);
  st.raid = { targetId: target.id, t: 0, taken: false };
  const p = edgePoint(g);
  SOUND_RAIDERS.forEach((id, i) => {
    const u = createSoundMember(g, id, p.x + (i % 2) * 24, p.y + Math.floor(i / 2) * 20);
    fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.8, color: '#9a6ac8' });
  });
  // quem passou para o lado deles vem junto
  for (const c of cursedOnes(g)) {
    c.away = undefined;
    c.hidden = false;
    c.x = p.x + rand(-20, 20);
    c.y = p.y + rand(10, 30);
    c.hp = c.maxHp;
    c.state = 'idle';
  }
  s.flags.raidActive = true;
  g.toast(`{skull} O ${SOUND.name} invadiu a vila atrás de ${target.name}! Não deixe que o levem.`, 'danger', p);
}

/** Invasão terminou: se ninguém foi levado, a vila impediu o rapto. */
function endRaid(g: Game) {
  const s = g.state;
  const st = s.sound;
  if (!st.raid) return;
  if (!st.raid.taken) {
    st.stopped++;
    g.give(SOUND.stopReward);
    s.honor += SOUND.stopHonor;
    const t = g.unit(st.raid.targetId);
    g.toast(`{shield} O rapto foi impedido${t ? `: ${t.name} ficou na vila` : ''}! +${costLabel(SOUND.stopReward)} e honra.`, 'good');
  }
  // quem estava do lado deles e não caiu volta para o esconderijo
  for (const c of cursedOnes(g)) if (c.away == null) hideWithSound(c);
  st.raid = null;
}

function hideWithSound(u: Unit) {
  u.away = WITH_SOUND;
  u.hidden = true;
  u.state = 'idle';
  u.targetId = null;
  u.moving = false;
  u.hasGoal = false;
}

/** Solta o raptado (quem carregava caiu ou foi atordoado de vez). */
export function dropCaptive(g: Game, carrier: Unit) {
  const t = carrier.carrying != null ? g.unit(carrier.carrying) : null;
  carrier.carrying = undefined;
  if (!t) return;
  t.captiveOf = undefined;
  t.stun = 0.5;
  fxText(g, t.x, t.y - 30, 'Livre!', '#7dff9a', true);
  g.toast(`{shield} ${t.name} foi solto(a)! Não deixe que peguem de novo.`, 'good', t);
}

/**
 * IA de um membro do Som na invasão. Sem ninguém carregando: vai atrás do alvo (até dentro de casa) e o pega; quem
 * carrega corre para a borda; os outros cobrem quem carrega. Retorna true se controlou a unidade.
 */
export function soundBrain(g: Game, u: Unit, dt: number): boolean {
  if (!u.sound || g.state.sceneInfo) return false;
  const st = g.state.sound;
  u.abilityCd = (u.abilityCd ?? 0) - dt;
  if (u.state === 'escape') return false;
  // gêmeos: ferido, o irmão sai do corpo
  if (u.sound === 'sokon' && !u.split && u.hp < u.maxHp * 0.5) split(g, u);
  const near = g.nearestHostile(u, 160);
  if (near && u.abilityCd <= 0 && useArt(g, u, near)) {
    u.abilityCd = SOUND_MEMBERS[u.sound].cd;
    return true;
  }
  // quem carrega: foge para a borda com o raptado
  if (u.carrying != null) {
    const t = g.unit(u.carrying);
    if (!t || t.dead) {
      u.carrying = undefined;
      return false;
    }
    if (!u.hasGoal) {
      const p = edgePoint(g);
      setDestination(g, u, p.x, p.y);
    }
    const arrived = followPath(g, u, dt, SOUND.carrySpeed);
    // a vila corre atrás: ninjas por perto (sem ordem do jogador) perseguem quem carrega
    if (u.timer <= 0) {
      u.timer = 3; // o `timer` já desce no passo do renegado
      for (const o of g.state.units)
        if (!o.dead && !o.hidden && o.faction === 'village' && o.kind === 'ninja' && o.id !== t.id && !o.command && Math.hypot(o.x - u.x, o.y - u.y) < SOUND.chaseRange)
          o.command = { kind: 'attack', targetId: u.id };
    }
    t.x = u.x - Math.cos(u.facing) * 10;
    t.y = u.y - 2;
    t.stun = Math.max(t.stun, 0.5);
    t.hidden = false;
    if (arrived) taken(g, u, t);
    return true;
  }
  const carrier = carrierOf(g);
  const raid = st.raid;
  // desistiram (demorou demais ou o alvo sumiu): vão embora
  const target = raid ? g.unit(raid.targetId) : null;
  if (!carrier && (!raid || raid.t > SOUND.patience || !target || target.dead || target.away != null)) {
    u.state = 'escape';
    const p = edgePoint(g);
    setDestination(g, u, p.x, p.y);
    return true;
  }
  // cobertura: luta com quem chegar perto de quem carrega (ou de si mesmo)
  if (carrier) {
    const foe = g.nearestHostile(carrier, 150) ?? near;
    if (foe) engage(g, u, foe, dt);
    else chase(g, u, carrier.x, carrier.y, dt, 30);
    return true;
  }
  // vai atrás do alvo; em casa, arranca de lá
  const t = target!;
  const tp = t.hidden ? (g.building(t.homeId) ? doorPos(g.building(t.homeId)!) : { x: t.x, y: t.y }) : { x: t.x, y: t.y };
  const d = Math.hypot(tp.x - u.x, tp.y - u.y);
  if (d < 26) {
    grab(g, u, t);
    return true;
  }
  if (near && Math.hypot(near.x - u.x, near.y - u.y) < 50 && near !== t) engage(g, u, near, dt);
  else chase(g, u, tp.x, tp.y, dt, 10);
  return true;
}

export function grab(g: Game, u: Unit, t: Unit) {
  t.hidden = false;
  t.state = 'idle';
  t.command = null;
  t.cast = undefined;
  t.dash = undefined;
  t.captiveOf = u.id;
  t.stun = 1;
  u.carrying = t.id;
  u.hasGoal = false;
  fx(g, 'ring', t.x, t.y, { r: 24, color: '#9a6ac8', life: 0.7 });
  fxText(g, t.x, t.y - 32, 'Raptado!', '#c9a0ff', true);
  g.toast(`{alert} ${u.name.split(',')[0]} pegou ${t.name} e está fugindo! Derrube quem carrega.`, 'danger', t);
}

/** Chegou à borda com o raptado: ele fica com o Som até ser resgatado. */
export function taken(g: Game, carrier: Unit, t: Unit) {
  const s = g.state;
  carrier.carrying = undefined;
  carrier.dead = true; // saiu do mapa
  t.captiveOf = undefined;
  for (const tm of s.teams) {
    tm.memberIds = tm.memberIds.filter((id) => id !== t.id);
    if (tm.senseiId === t.id) tm.senseiId = null;
  }
  hideWithSound(t);
  s.sound.captive = { id: t.id, until: s.day + SOUND.rescueDays };
  s.sound.lost++;
  if (s.sound.raid) s.sound.raid.taken = true;
  // os outros vão embora
  for (const o of soundOnMap(g)) {
    o.state = 'escape';
    const p = edgePoint(g);
    setDestination(g, o, p.x, p.y);
  }
  g.toast(`{skull} ${t.name} foi levado(a) pelo ${SOUND.name}! O Esconderijo do Som apareceu na Região: ${SOUND.rescueDays} dias para o resgate.`, 'danger');
}

/** Prazo do resgate acabou: o raptado volta com o selo amaldiçoado, do lado deles. */
function curse(g: Game) {
  const s = g.state;
  const t = g.unit(s.sound.captive!.id);
  s.sound.captive = null;
  if (!t || t.dead) return;
  t.faction = 'enemy';
  t.kind = 'rogue';
  t.cursed = true;
  t.homeId = null;
  t.jobId = null;
  const n = t.ninja!;
  if (n.anbu) n.anbu = false;
  for (const k of STAT_KEYS) n.stats[k] = Math.min(10, n.stats[k] + SOUND.curse);
  refreshDerived(t);
  t.hp = t.maxHp;
  if (s.kageId === t.id) s.kageId = null;
  g.toast(`{skull} O prazo acabou: ${t.name} recebeu o selo amaldiçoado e agora luta pelo ${SOUND.name}. Derrote-o numa invasão para trazê-lo de volta.`, 'danger');
}

/** Ninja com o selo amaldiçoado derrotado: em vez de morrer, volta para a vila (com o poder do selo). */
export function cursedDefeated(g: Game, u: Unit): boolean {
  if (!u.cursed || u.faction !== 'enemy') return false;
  u.faction = 'village';
  u.kind = 'ninja';
  u.hp = Math.max(1, Math.round(u.maxHp * 0.2));
  u.state = 'idle';
  u.targetId = null;
  u.stun = 1.5;
  u.hasGoal = false;
  u.homeId = null;
  fx(g, 'ring', u.x, u.y, { r: 30, color: '#7dff9a', life: 1 });
  fxText(g, u.x, u.y - 34, 'De volta!', '#7dff9a', true);
  g.toast(`{crown} ${u.name} foi derrotado(a) e trazido(a) de volta para a vila! O selo amaldiçoado ficou: mais forte do que antes.`, 'good', u);
  return true;
}

/**
 * Ninja da vila derrubado pelo Som (ou pelos ogros e o gêmeo deles): os primeiros `SOUND.maxKills` da invasão morrem;
 * dali em diante ficam nocauteados (eles vieram raptar, não arrasar a vila).
 */
export function soundKnockout(g: Game, t: Unit, src: Unit | null): boolean {
  if (t.faction !== 'village' || t.kind !== 'ninja' || !src || g.state.sceneInfo) return false;
  const boss = src.sound ? src : src.ownerId != null ? g.unit(src.ownerId) : null;
  if (!boss?.sound) return false;
  const raid = g.state.sound.raid;
  if (raid && (raid.kills ?? 0) < SOUND.maxKills) {
    raid.kills = (raid.kills ?? 0) + 1;
    return false;
  }
  t.hp = 1;
  t.stun = Math.max(t.stun, SOUND.knockout);
  t.targetId = null;
  fxText(g, t.x, t.y - 30, 'Nocaute!', '#c9a0ff', true);
  return true;
}

/** Membro do Som caiu (eles voltam sempre): recompensa. Quem carregava solta o raptado. */
export function soundMemberDown(g: Game, u: Unit) {
  if (u.carrying != null) dropCaptive(g, u);
  if (g.state.sceneInfo) return;
  g.give(SOUND.memberReward);
  g.toast(`{swords} ${SOUND_MEMBERS[u.sound!].name} do ${SOUND.name} caiu! +${costLabel(SOUND.memberReward)}.`, 'good', u);
}

/** Resgate vencido no esconderijo: o raptado volta para a vila. */
export function rescueCaptive(g: Game): string {
  const s = g.state;
  const t = s.sound.captive ? g.unit(s.sound.captive.id) : null;
  s.sound.captive = null;
  if (!t || t.dead) return 'O raptado não estava mais lá.';
  t.away = undefined;
  t.hidden = false;
  t.hp = Math.max(1, Math.round(t.maxHp * 0.5));
  const hk = g.hokage();
  if (hk) {
    const p = doorPos(hk);
    t.x = p.x;
    t.y = p.y + 10;
  }
  t.state = 'idle';
  s.honor += 5;
  return `${t.name} foi resgatado(a) do Esconderijo do Som e voltou para a vila!`;
}

function split(g: Game, u: Unit) {
  u.split = true;
  const twin = createRogue(g, u.x + 18, u.y, g.state.day, { rank: 'jounin', stats: SOUND.stats * 0.8, jutsu: 1, name: 'O irmão gêmeo' });
  twin.role = 'puppet'; // segue o irmão e some se ele cair (como as marionetes)
  twin.ownerId = u.id;
  twin.look = { ...u.look };
  twin.maxHp = twin.hp = Math.round(u.maxHp * 0.4);
  fx(g, 'smoke', twin.x, twin.y, { r: 18, life: 0.7, color: '#c9a0ff' });
  fxText(g, u.x, u.y - 34, 'Separação!', '#c9a0ff', true);
}

function useArt(g: Game, u: Unit, t: Unit): boolean {
  const id = u.sound!;
  const d = SOUND_MEMBERS[id];
  const dist = Math.hypot(t.x - u.x, t.y - u.y);
  const shout = () => fxText(g, u.x, u.y - 34, `${d.art}!`, '#c9a0ff', true);
  switch (id) {
    case 'iwao':
      if (dist > 90) return false;
      shout();
      fx(g, 'ring', t.x, t.y, { r: 34, color: '#a0703a', life: 3 });
      t.stun = Math.max(t.stun, 3);
      t.chakra = Math.max(0, t.chakra * 0.6);
      return true;
    case 'kumomaru':
      if (dist > 220) return false;
      shout();
      spawnProjectile(g, u, u.faction, u.x, u.y - 6, t.x, t.y - 6, {
        damage: 40, radius: 0, nature: null, color: '#ffd34d', size: 6, speed: 420, kind: 'kunai', stun: 1.2, range: 240,
      });
      return true;
    case 'kanade': {
      if (dist > 140) return false;
      shout();
      fx(g, 'ring', u.x, u.y, { r: 140, color: '#c9a0ff', life: 0.8 });
      for (const o of g.state.units)
        if (!o.dead && !o.hidden && o.faction === 'village' && o.ninja && Math.hypot(o.x - u.x, o.y - u.y) < 140) {
          o.stun = Math.max(o.stun, 2);
          fx(g, 'swirl', o.x, o.y - 8, { r: 16, color: '#c9a0ff', life: 2 });
        }
      for (const dx of [-24, 24]) {
        const m = createRogue(g, u.x + dx, u.y + 16, g.state.day, { rank: 'chunin', stats: 1.4, jutsu: 0, name: 'Ogro da flauta' });
        m.role = 'puppet';
        m.ownerId = u.id;
        m.maxHp = m.hp = Math.round(m.maxHp * 1.8);
        m.look = { ...m.look, skin: '#8a7a9a', cloth: '#3a2a3a' };
        fx(g, 'smoke', m.x, m.y, { r: 14, life: 0.6, color: '#8a6a9a' });
      }
      return true;
    }
    case 'hakkotsu':
      if (dist > 50) return false;
      shout();
      u.shield = 5;
      fx(g, 'slash', t.x, t.y, { r: 28, color: '#f0ece0', life: 0.4 });
      applyDamage(g, u, t, 45, null, { knock: 30 });
      return true;
    default:
      return false;
  }
}
