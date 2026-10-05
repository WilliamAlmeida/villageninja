// Dica do mapa (desktop): parar o mouse sobre um prédio mostra o que ele é e como está, sem precisar clicar.
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';
import { MARKET_GOODS } from '../data/specialize';
import { STAT_INFO } from '../data/ninja';
import { CARE } from '../game/care';
import type { Game } from '../game/game';
import { recipesOf, stock, isWorkshop } from '../game/gear';
import { occupantsOf } from '../game/interior';
import { trainees, trainSlots } from '../game/specialize';
import { DEFENSES } from '../game/systems/towers';
import type { Building } from '../game/types';
import { housingOf, levelOf, towerDamage, upgradeTime, workersOf } from '../game/upgrade';
import { UPGRADES } from '../data/upgrades';
import { esc } from './dom';
import { rich } from './icons';

/** HTML da dica de um prédio: nome, nível, estado e o que importa naquele tipo. */
export function buildingTip(g: Game, b: Building): string {
  const d = BUILDINGS[b.type];
  const lines: string[] = [];
  const lvl = levelOf(b);
  if (!b.built) lines.push(`{hammer} Em obra: ${Math.floor((b.progress / Math.max(1, d.buildTime)) * 100)}%`);
  else if (b.upgrade != null) lines.push(`{up} Upgrade em obra: ${Math.floor((b.upgrade / upgradeTime(b)) * 100)}%`);
  if (b.built) {
    const people = g.villagers().filter((u) => u.homeId === b.id).length;
    if (housingOf(b)) lines.push(`{users} Moradores: ${people} / ${housingOf(b)}`);
    if (d.workers) lines.push(`{hammer} Trabalhando: ${b.workers.length} / ${b.desired} (máx. ${workersOf(b)})`);
    if (isWorkshop(b.type)) {
      const q = (b.queue?.length ?? 0) + (b.craft ? 1 : 0);
      lines.push(`{anvil} ${b.craft ? `Fazendo ${ITEMS[b.craft.itemId]!.name}` : 'Parada'}${q ? ` · fila ${q}` : ''}`);
      lines.push(recipesOf(b.type).map((r) => `${r.icon}${stock(g, r.id)}`).join(' '));
    }
    if (b.type === 'academy') {
      const studying = g.state.units.filter((u) => !u.dead && u.faction === 'village' && u.ninja?.learning).length;
      lines.push(`{scroll} Estudando: ${studying} · ensino automático ${g.state.flags.autoTeach ? 'ligado' : 'desligado'}`);
    }
    if (b.type === 'training') lines.push(`{users} Vagas: ${trainees(g, b)} / ${trainSlots(b)} · foco ${b.focus ? STAT_INFO[b.focus].label : 'livre'}`);
    if (b.type === 'market' && b.sells) lines.push(`{ryo} Vende ${MARKET_GOODS[b.sells].name.toLowerCase()} excedente`);
    if (b.type === 'hospital')
      lines.push(`{medic} Resgate: ${Math.round(Math.min(CARE.rescueMax, CARE.rescue + (lvl - 1) * CARE.rescuePerLevel) * 100)}% de quem cair`);
    const def = DEFENSES[b.type];
    if (def) lines.push(`{kunai} Dano ${towerDamage(b, def.damage)}`);
    const inside = occupantsOf(g, b).length;
    if (inside && !d.walkable) lines.push(`{house} Lá dentro: ${inside}`);
  }
  const lvlBadge = UPGRADES[b.type] || b.type === 'hokage' ? ` <small>Nv ${b.type === 'hokage' ? g.state.level + 1 : lvl}</small>` : '';
  return rich(`<b>${d.icon} ${esc(d.name)}${lvlBadge}</b><div class="mt-desc">${esc(d.desc)}</div>${lines.map((l) => `<div>${l}</div>`).join('')}<div class="mt-hint">Clique para abrir</div>`);
}
