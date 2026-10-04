// Criação das ameaças chefes (o agendamento fica em systems/bosses.ts).
import { rand } from '../core/rng';
import { BOSSES, type BossKind } from '../data/bosses';
import { randomGiven } from '../data/names';
import { createAnimal, createRogue } from './entities';
import { fx } from './fx';
import type { Game } from './game';
import type { Unit } from './types';

export function spawnBoss(g: Game, kind: BossKind, x: number, y: number): Unit[] {
  const lvl = g.state.level;
  const day = g.state.day;
  const out: Unit[] = [];
  const at = () => ({ x: x + rand(-20, 20), y: y + rand(-20, 20) });
  switch (kind) {
    case 'titan': {
      const u = createAnimal(g, 'titan', x, y);
      u.maxHp = u.hp = Math.round(u.maxHp * (1 + 0.5 * lvl));
      u.boss = true;
      u.life = 1e9; // não vai embora sozinha
      u.state = 'rampage';
      out.push(u);
      break;
    }
    case 'order':
      for (let i = 0; i < 2; i++) {
        const p = at();
        const u = createRogue(g, p.x, p.y, day, {
          rank: 'jounin', stats: 3 + lvl * 0.5, hpMult: 3, jutsu: 2, name: `☾ ${randomGiven()} da Lua Vermelha`,
        });
        u.boss = true;
        u.look = { ...u.look, cloth: '#1a1a24' };
        out.push(u);
      }
      break;
    case 'war': {
      const p = at();
      const cmd = createRogue(g, p.x, p.y, day, { rank: 'jounin', stats: 3.5, hpMult: 3.5, jutsu: 2, name: `★ Comandante ${randomGiven()}` });
      cmd.boss = true;
      out.push(cmd);
      for (let i = 0; i < 6; i++) {
        const q = at();
        out.push(createRogue(g, q.x, q.y, day, { rank: i < 2 ? 'jounin' : 'chunin', stats: 1.5 + lvl * 0.3, jutsu: 2, name: `Ninja da Rocha Negra ${randomGiven()}` }));
      }
      for (const u of out) u.look = { ...u.look, cloth: '#4a3a2a' };
      break;
    }
  }
  for (const u of out) fx(g, 'smoke', u.x, u.y, { r: 18, life: 0.7, color: '#bbb' });
  g.state.flags.raidActive = g.state.flags.raidActive || kind !== 'titan';
  g.toast(`${BOSSES[kind].icon} ${BOSSES[kind].name} chegou! ${BOSSES[kind].desc}`, 'danger', { x, y });
  return out;
}

/** Recompensa extra ao derrotar um chefe. */
export function bossDefeated(g: Game, u: Unit) {
  const lvl = g.state.level;
  const ryo = u.animal ? 0 : 250 * (1 + lvl); // a fera já tem recompensa própria
  g.state.res.ryo += ryo;
  g.state.reputation += 5;
  g.state.stats.bossesDefeated++;
  fx(g, 'ring', u.x, u.y, { r: 50, color: '#ffd34d', life: 1 });
  g.toast(`🏆 ${u.name} foi derrotado(a)!${ryo ? ` +${ryo}💰` : ''} +5 reputação`, 'good', u);
}
