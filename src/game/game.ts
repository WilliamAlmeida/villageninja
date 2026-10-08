import { bus, type ToastKind } from '../core/events';
import { dist2 } from '../core/math';
import type { BuildingType } from '../data/buildings';
import { RES_KEYS } from '../data/resources';
import type { Building, Cost, Faction, GameState, ResourceNode, Selection, Team, Unit } from './types';
import { canHit, isHostile } from './factions';
import { housingOf } from './upgrade';
import { levelDef } from '../data/villageLevels';
import { World } from './world';

export type System = (g: Game, dt: number) => void;


/**
 * Fachada da simulação: guarda o estado, índices auxiliares e helpers de consulta.
 * Não conhece DOM nem canvas — roda igual no browser e nos testes.
 */
export class Game {
  readonly world: World;
  readonly bus = bus;
  selected: Selection | null = null;
  /** Mapa de missão (não é a vila): avisos dele levam a câmera para lá. */
  isScene = false;
  private unitMap = new Map<number, Unit>();
  private buildingMap = new Map<number, Building>();
  private nodeMap = new Map<number, ResourceNode>();

  constructor(
    public state: GameState,
    private systems: System[] = [],
  ) {
    this.world = new World(state);
    this.reindex();
  }

  reindex() {
    this.unitMap.clear();
    this.buildingMap.clear();
    this.nodeMap.clear();
    for (const u of this.state.units) this.unitMap.set(u.id, u);
    for (const b of this.state.buildings) this.buildingMap.set(b.id, b);
    for (const n of this.state.nodes) this.nodeMap.set(n.id, n);
  }

  newId() {
    return this.state.nextId++;
  }

  step(dt: number) {
    this.foes.clear(); // listas de alvos refeitas a cada passo (unidades nascem, morrem, mudam de lado)
    this.engaged = null;
    for (const s of this.systems) s(this, dt);
    this.cleanup();
  }

  private foes = new Map<Faction, Unit[]>();
  private engaged: Map<string, number> | null = null;
  /**
   * Quantos da `faction` estão lutando com o alvo `targetId` (contado uma vez por passo; quem escolhe adversário
   * consultava todas as unidades para cada inimigo).
   */
  engagedOn(faction: Faction, targetId: number): number {
    if (!this.engaged) {
      const m = new Map<string, number>();
      for (const o of this.state.units)
        if (!o.dead && o.targetId != null && (o.state === 'fight' || o.combatTimer > 0)) {
          const k = `${o.faction}:${o.targetId}`;
          m.set(k, (m.get(k) ?? 0) + 1);
        }
      this.engaged = m;
    }
    return this.engaged.get(`${faction}:${targetId}`) ?? 0;
  }
  /**
   * Alguém de `faction` acabou de escolher `targetId` neste passo: conta já (a contagem é feita uma vez por passo, e
   * sem isso todos que decidem no mesmo passo veem zero e vão juntos).
   */
  noteEngaged(faction: Faction, targetId: number) {
    this.engagedOn(faction, targetId);
    const k = `${faction}:${targetId}`;
    this.engaged!.set(k, (this.engaged!.get(k) ?? 0) + 1);
  }
  /**
   * Quem `faction` pode atacar (só pela facção; quem chama ainda confere morto, escondido e `canHit`). Feita uma vez
   * por passo: a vila em paz procura inimigo entre poucos bichos em vez de varrer as centenas de moradores e ninjas.
   */
  foesOf(faction: Faction): Unit[] {
    let list = this.foes.get(faction);
    if (!list) {
      list = this.state.units.filter((o) => !o.dead && isHostile(faction, o.faction));
      this.foes.set(faction, list);
    }
    return list;
  }

  private cleanup() {
    const s = this.state;
    if (s.units.some((u) => u.dead)) {
      for (const u of s.units) if (u.dead) this.unitMap.delete(u.id);
      s.units = s.units.filter((u) => !u.dead);
      if (this.selected?.kind === 'unit' && !this.unitMap.has(this.selected.id)) this.select(null);
    }
    if (s.projectiles.some((p) => p.dead)) s.projectiles = s.projectiles.filter((p) => !p.dead);
  }

  // ---------- lookup ----------
  unit(id: number | null | undefined) {
    return id == null ? undefined : this.unitMap.get(id);
  }
  building(id: number | null | undefined) {
    return id == null ? undefined : this.buildingMap.get(id);
  }
  node(id: number | null | undefined) {
    return id == null ? undefined : this.nodeMap.get(id);
  }
  team(id: number | null | undefined): Team | undefined {
    return id == null ? undefined : this.state.teams.find((t) => t.id === id);
  }

  addUnit(u: Unit) {
    this.state.units.push(u);
    this.unitMap.set(u.id, u);
    this.foes.clear(); // quem nasceu já entra nas listas de alvo
    return u;
  }
  addBuilding(b: Building) {
    this.state.buildings.push(b);
    this.buildingMap.set(b.id, b);
    this.world.rebuild();
    return b;
  }
  removeBuilding(id: number) {
    this.state.buildings = this.state.buildings.filter((b) => b.id !== id);
    this.buildingMap.delete(id);
    for (const u of this.state.units) {
      if (u.jobId === id) u.jobId = null;
      if (u.homeId === id) u.homeId = null;
      if (u.taskId === id) u.taskId = null;
    }
    if (this.selected?.kind === 'building' && this.selected.id === id) this.select(null);
    this.world.rebuild();
  }
  removeNode(id: number) {
    this.state.nodes = this.state.nodes.filter((n) => n.id !== id);
    this.nodeMap.delete(id);
  }

  select(sel: Selection | null) {
    this.selected = sel;
    this.bus.emit('select', sel);
  }

  // ---------- consultas ----------
  findBuilt(type: BuildingType) {
    return this.state.buildings.find((b) => b.type === type && b.built);
  }
  builtOf(type: BuildingType) {
    return this.state.buildings.filter((b) => b.type === type && b.built);
  }
  hokage() {
    return this.state.buildings.find((b) => b.type === 'hokage');
  }
  villagers() {
    return this.state.units.filter((u) => !u.dead && u.faction === 'village' && (u.kind === 'villager' || u.kind === 'ninja'));
  }
  population() {
    let n = 0;
    for (const u of this.state.units) if (!u.dead && u.faction === 'village' && (u.kind === 'villager' || u.kind === 'ninja')) n++;
    return n;
  }
  /** Vagas: as casas, até o teto do nível da vila (`popLimit`). */
  popCap() {
    return Math.min(this.housingCap(), levelDef(this.state.level).popLimit);
  }
  /** Vagas nas casas (sem o teto do nível). */
  housingCap() {
    let n = 0;
    for (const b of this.state.buildings) if (b.built) n += housingOf(b);
    return n;
  }
  /**
   * Onde a câmera olha (px de mundo, raio da tela), posto pelo main a cada quadro; fora da simulação (não é salvo).
   * Quem está longe disso e sem urgência refaz caminho com menos frequência.
   */
  view: { x: number; y: number; r: number } | null = null;

  /** Inimigo mais próximo de `u` (visível) dentro do raio. */
  nearestHostile(u: Unit, radius: number): Unit | null {
    return this.nearestHostileAt(u.faction, u.x, u.y, radius);
  }

  /** Inimigo visível mais próximo de um ponto, do ponto de vista de uma facção. */
  nearestHostileAt(faction: Faction, x: number, y: number, radius: number): Unit | null {
    let best: Unit | null = null;
    let bd = radius * radius;
    for (const o of this.foesOf(faction)) {
      if (o.dead || o.hidden || !canHit(faction, undefined, o)) continue;
      const d = dist2(x, y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // ---------- recursos ----------
  canAfford(cost: Cost) {
    return RES_KEYS.every((k) => (this.state.res[k] ?? 0) >= (cost[k] ?? 0));
  }
  pay(cost: Cost) {
    if (!this.canAfford(cost)) return false;
    for (const k of RES_KEYS) this.state.res[k] -= cost[k] ?? 0;
    return true;
  }
  give(cost: Cost, mult = 1) {
    for (const k of RES_KEYS) this.state.res[k] += Math.round((cost[k] ?? 0) * mult);
  }

  toast(text: string, kind: ToastKind = 'info', at?: { x: number; y: number }) {
    this.bus.emit('toast', { text, kind, x: at?.x, y: at?.y, scene: this.isScene });
  }
}
