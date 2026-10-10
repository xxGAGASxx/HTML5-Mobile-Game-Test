/** A point in map art pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the party stands: on a node, or partway along the road from `a` to `b` (`d` art px from `a`). */
export type RoadPos = { readonly node: string } | { readonly a: string; readonly b: string; readonly d: number };

/** One stretch of a walk: along the road from `a` to `b`, from distance `from` to `to` (either way). */
export interface Leg {
  readonly a: string;
  readonly b: string;
  readonly from: number;
  readonly to: number;
}

/** A planned walk: the legs to follow and the nodes it reaches on the way, in order. */
export interface Walk {
  readonly legs: readonly Leg[];
  readonly nodes: readonly string[];
  readonly to: RoadPos;
  readonly length: number;
}

interface Road {
  readonly pts: readonly Point[];
  /** Distance from the start to each point. */
  readonly cum: readonly number[];
}

/**
 * The island's roads as walkable lines (from the map bake), for point-and-click movement:
 * find the road under a tap, and plan the shortest walk along roads to a node or a spot on a road.
 * Which nodes the party may pass through is the caller's rule (the domain's: cleared nodes only).
 */
export class RoadNetwork {
  private readonly roads = new Map<string, Road>();
  private readonly links = new Map<string, Set<string>>();
  /** Each road once, in the direction the map data wrote it. */
  private readonly keys: [string, string][] = [];

  constructor(lines: Readonly<Record<string, readonly (readonly [number, number])[]>>) {
    for (const [k, raw] of Object.entries(lines)) {
      const [a, b] = k.split('|') as [string, string];
      const pts = raw.map(([x, y]) => ({ x, y }));
      this.keys.push([a, b]);
      this.roads.set(`${a}|${b}`, measure(pts));
      this.roads.set(`${b}|${a}`, measure([...pts].reverse()));
      for (const [p, q] of [
        [a, b],
        [b, a],
      ] as const) {
        if (!this.links.has(p)) this.links.set(p, new Set());
        this.links.get(p)!.add(q);
      }
    }
  }

  length(a: string, b: string): number {
    return this.road(a, b).cum.at(-1)!;
  }

  pointAt(pos: RoadPos): Point {
    if ('node' in pos) {
      const [b] = this.links.get(pos.node) ?? [];
      if (!b) throw new Error(`No road at ${pos.node}`);
      return this.road(pos.node, b).pts[0]!;
    }
    return sample(this.road(pos.a, pos.b), pos.d);
  }

  /** The closest spot on a road accepted by `allow`, within `maxDist` art px of (x, y). */
  nearest(x: number, y: number, maxDist: number, allow: (a: string, b: string) => boolean): RoadPos | null {
    let best: RoadPos | null = null;
    let bestDist = maxDist;
    for (const [a, b] of this.keys) {
      if (!allow(a, b)) continue;
      const road = this.road(a, b);
      for (let i = 0; i < road.pts.length - 1; i++) {
        const p = road.pts[i]!;
        const q = road.pts[i + 1]!;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2));
        const dist = Math.hypot(x - p.x - t * dx, y - p.y - t * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { a, b, d: road.cum[i]! + t * (road.cum[i + 1]! - road.cum[i]!) };
        }
      }
    }
    if (best && !('node' in best)) {
      const len = this.length(best.a, best.b);
      if (best.d < 2) return { node: best.a };
      if (best.d > len - 2) return { node: best.b };
    }
    return best;
  }

  /**
   * Shortest walk from `from` to `to` along roads. The walk may go through a node only when
   * `canPass(node)` is true; it may always set off from the node it stands on and end on any node.
   */
  plan(from: RoadPos, to: RoadPos, canPass: (node: string) => boolean): Walk | null {
    // Dijkstra over nodes; each entry remembers the legs walked to reach it.
    type Entry = { cost: number; legs: Leg[]; nodes: string[] };
    const best = new Map<string, Entry>();
    const open: [string, Entry][] = [];
    const push = (node: string, e: Entry): void => {
      const known = best.get(node);
      if (known && known.cost <= e.cost) return;
      best.set(node, e);
      open.push([node, e]);
    };
    let startNode: string | null = null;
    if ('node' in from) {
      startNode = from.node;
      push(from.node, { cost: 0, legs: [], nodes: [] });
    } else {
      const len = this.length(from.a, from.b);
      push(from.a, { cost: from.d, legs: [{ a: from.a, b: from.b, from: from.d, to: 0 }], nodes: [from.a] });
      push(from.b, { cost: len - from.d, legs: [{ a: from.a, b: from.b, from: from.d, to: len }], nodes: [from.b] });
    }

    let done: Walk | null = null;
    const offer = (cost: number, legs: Leg[], nodes: string[], end: RoadPos): void => {
      if (!done || cost < done.length) done = { legs, nodes, to: end, length: cost };
    };
    // Same road, no node in between.
    if (!('node' in from) && !('node' in to)) {
      const same = from.a === to.a && from.b === to.b;
      const flipped = from.a === to.b && from.b === to.a;
      if (same || flipped) {
        const d = same ? to.d : this.length(from.a, from.b) - to.d;
        offer(Math.abs(d - from.d), [{ a: from.a, b: from.b, from: from.d, to: d }], [], to);
      }
    }

    const settled = new Set<string>();
    while (open.length) {
      open.sort((p, q) => p[1].cost - q[1].cost);
      const [node, entry] = open.shift()!;
      if (settled.has(node) || best.get(node) !== entry) continue;
      settled.add(node);
      if ('node' in to && node === to.node) offer(entry.cost, entry.legs, entry.nodes, to);
      if (node !== startNode && !canPass(node)) continue;
      if (!('node' in to)) {
        if (node === to.a) offer(entry.cost + to.d, [...entry.legs, { a: to.a, b: to.b, from: 0, to: to.d }], entry.nodes, to);
        if (node === to.b) {
          const len = this.length(to.a, to.b);
          offer(entry.cost + len - to.d, [...entry.legs, { a: to.a, b: to.b, from: len, to: to.d }], entry.nodes, to);
        }
      }
      for (const next of this.links.get(node) ?? []) {
        const len = this.length(node, next);
        push(next, { cost: entry.cost + len, legs: [...entry.legs, { a: node, b: next, from: 0, to: len }], nodes: [...entry.nodes, next] });
      }
    }
    return done;
  }

  private road(a: string, b: string): Road {
    const road = this.roads.get(`${a}|${b}`);
    if (!road) throw new Error(`No road from ${a} to ${b}`);
    return road;
  }
}

function measure(pts: Point[]): Road {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return { pts, cum };
}

function sample(road: Road, d: number): Point {
  const { pts, cum } = road;
  if (d <= 0) return pts[0]!;
  for (let i = 1; i < pts.length; i++) {
    if (cum[i]! >= d) {
      const t = (d - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1);
      return { x: pts[i - 1]!.x + t * (pts[i]!.x - pts[i - 1]!.x), y: pts[i - 1]!.y + t * (pts[i]!.y - pts[i - 1]!.y) };
    }
  }
  return pts.at(-1)!;
}
