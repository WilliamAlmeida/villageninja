import { SIGHT } from '../../data/sites';
import { bumpFog, discover, isExplored, revealCircle } from '../explore';
import type { Game } from '../game';
import { toTile } from '../world';

const EVERY = 0.25;
let acc = 0;

/** Névoa: moradores, ninjas e torres da vila revelam os arredores; locais que saem da névoa são descobertos. */
export function exploreSystem(g: Game, dt: number) {
  acc += dt;
  if (acc < EVERY) return;
  acc = 0;
  const s = g.state;
  let added = 0;
  for (const u of s.units) {
    if (u.dead || u.hidden || u.faction !== 'village') continue;
    added += revealCircle(s, toTile(u.x), toTile(u.y), SIGHT.unit);
  }
  for (const b of s.buildings) if (b.type === 'tower' && b.built) added += revealCircle(s, b.tx + 1, b.ty + 1, SIGHT.tower);
  if (!added) return;
  bumpFog();
  for (const site of s.sites) if (!site.found && isExplored(s, site.tx, site.ty)) discover(g, site);
}
