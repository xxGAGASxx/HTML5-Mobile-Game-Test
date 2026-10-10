/** Node types on a region map (GDD 04). Survivors arrive with the story (M6). */
export type NodeKind = 'camp' | 'encounter' | 'elite' | 'ruin' | 'resource' | 'boss';

/** What the map itself needs to know about a node: the rest (enemies, loot, art) is content. */
export interface MapNodeDef {
  readonly id: string;
  readonly kind: NodeKind;
  /** Nodes joined to this one by a path. Paths go both ways; listing them on one side is enough. */
  readonly links: readonly string[];
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/**
 * How long a cleared node stays clear before its enemies return (GDD 04: 2 h, elites 8 h).
 * `null` never returns: the camp, a secured resource site and a beaten boss stay as they are.
 */
export const RESPAWN_MS: Readonly<Record<NodeKind, number | null>> = {
  camp: null,
  encounter: 2 * HOUR_MS,
  elite: 8 * HOUR_MS,
  ruin: 8 * HOUR_MS,
  resource: null,
  boss: null,
};

export type NodeStatus =
  /** Under the fog: no neighbour has been cleared yet. */
  | { readonly kind: 'hidden' }
  | { readonly kind: 'camp' }
  /** Enemies are here and can be fought. `firstClear` is true until the node has been cleared once. */
  | { readonly kind: 'open'; readonly firstClear: boolean }
  /** Cleared; the enemies come back at `respawnAt`. */
  | { readonly kind: 'respawning'; readonly respawnAt: number }
  /** Cleared for good. */
  | { readonly kind: 'secured' };

/**
 * IslandMap aggregate: one region's nodes, the paths between them, fog of war and respawns.
 * Fog lifts around a node once it has been cleared the first time; respawns never bring fog back.
 */
export class IslandMap {
  private readonly defs = new Map<string, MapNodeDef>();
  private readonly adjacent = new Map<string, Set<string>>();
  private readonly everCleared = new Set<string>();
  private readonly clearedAt = new Map<string, number>();
  private readonly harvestedAt = new Map<string, number>();

  constructor(nodes: readonly MapNodeDef[]) {
    for (const node of nodes) {
      if (this.defs.has(node.id)) throw new Error(`Duplicate map node: ${node.id}`);
      this.defs.set(node.id, node);
      this.adjacent.set(node.id, new Set());
    }
    for (const node of nodes) {
      for (const other of node.links) {
        if (!this.defs.has(other)) throw new Error(`${node.id} links to unknown node ${other}`);
        this.adjacent.get(node.id)!.add(other);
        this.adjacent.get(other)!.add(node.id);
      }
    }
    if (nodes.filter((n) => n.kind === 'camp').length !== 1) throw new Error('A region map needs exactly one camp');
  }

  get ids(): string[] {
    return [...this.defs.keys()];
  }

  def(id: string): MapNodeDef {
    const def = this.defs.get(id);
    if (!def) throw new Error(`Unknown map node: ${id}`);
    return def;
  }

  neighbours(id: string): string[] {
    this.def(id);
    return [...this.adjacent.get(id)!];
  }

  /** Every path once, as [a, b] pairs. */
  edges(): [string, string][] {
    const out: [string, string][] = [];
    for (const [a, set] of this.adjacent) for (const b of set) if (a < b) out.push([a, b]);
    return out;
  }

  /** Has this node been cleared at least once (the camp counts as cleared)? */
  isConquered(id: string): boolean {
    return this.def(id).kind === 'camp' || this.everCleared.has(id);
  }

  isRevealed(id: string): boolean {
    return this.isConquered(id) || this.neighbours(id).some((n) => this.isConquered(n));
  }

  status(id: string, now: number): NodeStatus {
    const def = this.def(id);
    if (def.kind === 'camp') return { kind: 'camp' };
    if (!this.isRevealed(id)) return { kind: 'hidden' };
    if (!this.everCleared.has(id)) return { kind: 'open', firstClear: true };
    const respawn = RESPAWN_MS[def.kind];
    if (respawn === null) return { kind: 'secured' };
    const respawnAt = this.clearedAt.get(id)! + respawn;
    return now >= respawnAt ? { kind: 'open', firstClear: false } : { kind: 'respawning', respawnAt };
  }

  canFight(id: string, now: number): boolean {
    return this.status(id, now).kind === 'open';
  }

  /** Marks an open node cleared and returns the nodes this revealed for the first time. */
  clear(id: string, now: number): string[] {
    if (!this.canFight(id, now)) throw new Error(`Cannot clear ${id}: ${this.status(id, now).kind}`);
    const hiddenBefore = this.ids.filter((n) => !this.isRevealed(n));
    if (!this.everCleared.has(id) && this.def(id).kind === 'resource') this.harvestedAt.set(id, now);
    this.everCleared.add(id);
    this.clearedAt.set(id, now);
    return hiddenBefore.filter((n) => this.isRevealed(n));
  }

  /** True once every boss on the map has been beaten. */
  get regionCleared(): boolean {
    const bosses = [...this.defs.values()].filter((d) => d.kind === 'boss');
    return bosses.length > 0 && bosses.every((d) => this.everCleared.has(d.id));
  }

  /** Time a secured resource site has been producing since it was last harvested. */
  sinceHarvest(id: string, now: number): number {
    const since = this.harvestedAt.get(id);
    return since === undefined ? 0 : Math.max(0, now - since);
  }

  harvest(id: string, now: number): void {
    if (this.status(id, now).kind !== 'secured' || this.def(id).kind !== 'resource') throw new Error(`Nothing to harvest at ${id}`);
    this.harvestedAt.set(id, now);
  }
}

/** Whole units a site has made in `elapsedMs` at `perHour`, stopping once its store holds `capHours` worth. */
export function harvestYield(perHour: number, capHours: number, elapsedMs: number): number {
  return Math.floor((perHour * Math.min(elapsedMs, capHours * HOUR_MS)) / HOUR_MS);
}
