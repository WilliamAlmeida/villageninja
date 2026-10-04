import type { Game } from '../game';

const alive = (g: Game, id: number | null) => {
  const u = g.unit(id);
  return !!u && !u.dead && u.kind === 'ninja' && u.faction === 'village';
};

/** Remove das equipes ninjas mortos (o sensei vira vaga aberta). */
export function teamSystem(g: Game, _dt: number) {
  for (const t of g.state.teams) {
    if (t.senseiId != null && !alive(g, t.senseiId)) {
      g.toast(`${t.name} perdeu seu sensei.`, 'warn');
      t.senseiId = null;
    }
    if (t.memberIds.some((id) => !alive(g, id))) t.memberIds = t.memberIds.filter((id) => alive(g, id));
  }
}
