// Isometric pixel-art island maps (GDD 04, Art-Style reference 3): a diorama of raised tiles with
// cliffs, dirt roads between the nodes, bridges, trees and a landmark per node. Baked into one PNG
// per region by scripts/build-sprites.ts; the game overlays nodes, fog and effects at runtime.
import type { RegionNode, RegionSpec } from '../../src/application/content';
import { PixelCanvas, rng } from './canvas.ts';
import { FOAM, OUTLINE, RAMPS, type Ramp } from './palette.ts';

/** Diamond tile footprint and the rise of one height level, in art pixels. */
const TW = 32;
const TH = 16;
const LEVEL = 8;
/** Slab thickness under sea level at the edge of the diorama. */
const BASE = 6;

type Mat = 'water' | 'sand' | 'grass' | 'high';

interface Tile {
  s: number;
  d: number;
  /** Centre of the tile on the ground plane (height 0). */
  cx: number;
  cy: number;
  h: number;
  mat: Mat;
}

interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Hand-placed shapes that give a region its geography. Coordinates are ground-plane art pixels. */
export interface IslandDesign {
  width: number;
  height: number;
  seed: number;
  land: Ellipse[];
  grass: Ellipse[];
  high: Ellipse[];
  peak: Ellipse[];
  /** River centreline, from its source (a waterfall off the high ground) to the sea. */
  river: { x: number; y: number }[];
  /** Ground point of the shipwreck in the shallows. */
  wreck: { x: number; y: number };
}

export interface IslandBake {
  canvas: PixelCanvas;
  /** Where each node's marker stands: the top of its tile, in art pixels. */
  nodes: Record<string, { x: number; y: number }>;
  /** Campfires and torches, for flicker effects. */
  fires: [number, number][];
  /** Open-water spots for glints. */
  glints: [number, number][];
  /**
   * Every road as a walkable line on the art, keyed `from|to` as the link is written in the region
   * data: points every few pixels from node to node, lifted onto the tiles (and bridges) it crosses.
   */
  roads: Record<string, [number, number][]>;
}

/** The Wreck Coast: beach in the south around the wreck, grassland in the middle, cliffs and the fort up north. */
export const WRECK_COAST_DESIGN: IslandDesign = {
  width: 320,
  height: 680,
  seed: 21,
  land: [
    { x: 160, y: 370, rx: 118, ry: 270 },
    { x: 108, y: 566, rx: 80, ry: 56 },
    { x: 250, y: 500, rx: 52, ry: 62 },
    { x: 165, y: 150, rx: 122, ry: 92 },
    { x: 60, y: 330, rx: 46, ry: 80 },
  ],
  grass: [
    { x: 150, y: 380, rx: 125, ry: 110 },
    { x: 80, y: 310, rx: 70, ry: 80 },
    { x: 215, y: 300, rx: 80, ry: 70 },
  ],
  high: [
    { x: 165, y: 175, rx: 140, ry: 72 },
    { x: 270, y: 225, rx: 40, ry: 34 },
  ],
  peak: [{ x: 160, y: 108, rx: 52, ry: 34 }],
  river: [
    { x: 178, y: 246 },
    { x: 200, y: 262 },
    { x: 232, y: 270 },
    { x: 268, y: 274 },
    { x: 300, y: 290 },
    { x: 340, y: 300 },
  ],
  wreck: { x: 84, y: 640 },
};

export function bakeIsland(region: RegionSpec, design: IslandDesign): IslandBake {
  const { width: W, height: H } = design;
  const noise = valueNoise(design.seed);
  const fbm = (x: number, y: number): number => noise(x / 46, y / 46) * 0.6 + noise(x / 17, y / 17) * 0.3 + noise(x / 7, y / 7) * 0.1;
  const inside = (list: Ellipse[], x: number, y: number): number =>
    Math.max(-9, ...list.map((e) => 1 - ((x - e.x) / e.rx) ** 2 - ((y - e.y) / e.ry) ** 2));

  // 1. Tiles on a staggered diamond grid covering the canvas.
  const Y0 = 40;
  const tiles = new Map<string, Tile>();
  const key = (s: number, d: number): string => `${s},${d}`;
  for (let s = 0; Y0 + s * (TH / 2) < H - 4; s++) {
    for (let d = -12; d <= 12; d++) {
      if ((d + s) % 2 !== 0) continue;
      const cx = W / 2 + d * (TW / 2);
      const cy = Y0 + s * (TH / 2);
      if (cx < -8 || cx > W + 8) continue;
      const n = fbm(cx, cy) - 0.5;
      const landV = inside(design.land, cx, cy) + n * 0.45;
      if (landV < -0.32) continue; // open sea: not part of the diorama
      let h = 0;
      if (landV > 0) {
        h = 1;
        if (inside(design.grass, cx, cy) + n * 0.6 > 0) h = 2;
        if (inside(design.high, cx, cy) + n * 0.5 > 0) h = 3;
        if (inside(design.peak, cx, cy) + n * 0.3 > 0) h = 4;
        if (distToPolyline(design.river, cx, cy) < 11 + n * 6) h = 0;
      }
      tiles.set(key(s, d), { s, d, cx, cy, h, mat: 'water' });
    }
  }
  const tileAt = (s: number, d: number): Tile | undefined => tiles.get(key(s, d));
  const edgeNeighbours = (t: Tile): (Tile | undefined)[] => [
    tileAt(t.s - 1, t.d - 1),
    tileAt(t.s - 1, t.d + 1),
    tileAt(t.s + 1, t.d - 1),
    tileAt(t.s + 1, t.d + 1),
  ];
  // Ground point to the tile under it.
  const tileUnder = (x: number, y: number): Tile | undefined => {
    const u = (x - W / 2) / (TW / 2);
    const v = (y - Y0) / (TH / 2);
    const c = Math.round((u + v) / 2);
    const r = Math.round((v - u) / 2);
    return tileAt(c + r, c - r);
  };

  // 2. Snap nodes to tiles and flatten a clearing around each (landmarks need level ground).
  const nodeTiles = new Map<string, Tile>();
  for (const node of region.nodes) {
    let best: Tile | undefined;
    let bestD = Infinity;
    for (const t of tiles.values()) {
      const dist = Math.hypot(t.cx - node.at.x, t.cy - node.at.y);
      if (dist < bestD) {
        best = t;
        bestD = dist;
      }
    }
    if (!best) throw new Error(`No tile for node ${node.id}`);
    if (best.h === 0) best.h = 1;
    nodeTiles.set(node.id, best);
  }
  for (const [id, t] of nodeTiles) {
    const radius = landmarkRadius(region.nodes.find((n) => n.id === id)!);
    for (const o of tiles.values()) if (o.h > 0 && Math.hypot((o.cx - t.cx) / 1, (o.cy - t.cy) * 2) < radius) o.h = t.h;
  }

  // 3. Smooth away single-tile pillars and pits.
  for (let pass = 0; pass < 2; pass++) {
    for (const t of tiles.values()) {
      const ns = edgeNeighbours(t).filter((n): n is Tile => n !== undefined);
      if (ns.length < 4 || [...nodeTiles.values()].includes(t)) continue;
      const hs = ns.map((n) => n.h);
      if (t.h > Math.max(...hs)) t.h = Math.max(...hs);
      else if (t.h > 0 && t.h < Math.min(...hs)) t.h = Math.min(...hs);
    }
  }
  for (const t of tiles.values()) t.mat = t.h === 0 ? 'water' : t.h === 1 ? 'sand' : t.h === 2 ? 'grass' : 'high';

  // 4. Roads: a soft curve along every link, rasterized into a ground-plane mask (2 = road, 1 = verge).
  const road = new Uint8Array(W * H);
  const nodePoint = (id: string): { x: number; y: number } => {
    const t = nodeTiles.get(id)!;
    return { x: t.cx, y: t.cy };
  };
  const roadLines = new Map<string, { x: number; y: number }[]>();
  const bend = rng(design.seed + 5);
  for (const node of region.nodes) {
    for (const other of node.links) {
      const a = nodePoint(node.id);
      const b = nodePoint(other);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const off = (bend() - 0.5) * 0.45 * len;
      const mx = (a.x + b.x) / 2 + (-(b.y - a.y) / len) * off;
      const my = (a.y + b.y) / 2 + ((b.x - a.x) / len) * off;
      const steps = Math.ceil(len);
      const line: { x: number; y: number }[] = [];
      roadLines.set(`${node.id}|${other}`, line);
      for (let i = 0; i <= steps; i++) {
        const tt = i / steps;
        const x = (1 - tt) ** 2 * a.x + 2 * (1 - tt) * tt * mx + tt ** 2 * b.x;
        const y = (1 - tt) ** 2 * a.y + 2 * (1 - tt) * tt * my + tt ** 2 * b.y;
        line.push({ x, y });
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -7; dx <= 7; dx++) {
            const px = Math.round(x + dx);
            const py = Math.round(y + dy);
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const dist = Math.hypot(dx, dy * 1.6);
            const v = dist < 4.2 ? 2 : dist < 5.6 ? 1 : 0;
            if (v > road[py * W + px]!) road[py * W + px] = v;
          }
        }
      }
    }
  }
  for (const t of nodeTiles.values()) {
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -13; dx <= 13; dx++) {
        const px = t.cx + dx;
        const py = t.cy + dy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const dist = Math.hypot(dx, dy * 2);
        const v = dist < 10 ? 2 : dist < 12.5 ? 1 : 0;
        if (v > road[py * W + px]!) road[py * W + px] = v;
      }
    }
  }
  const roadAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : road[Math.floor(y) * W + Math.floor(x)]!);

  // 5. Paint back to front. Each drawable has a sort key: tiles by row, their props just after.
  const canvas = new PixelCanvas(W, H);
  const queue: { k: number; draw: () => void }[] = [];
  const fires: [number, number][] = [];
  const glints: [number, number][] = [];
  const nodeOut: IslandBake['nodes'] = {};
  const nearNode = (x: number, y: number, r: number): boolean => [...nodeTiles.values()].some((t) => Math.hypot(t.cx - x, (t.cy - y) * 1.6) < r);
  const props = rng(design.seed + 9);

  for (const t of tiles.values()) {
    queue.push({ k: t.s, draw: () => drawTile(canvas, t, tileAt, roadAt, design.seed) });
    // Bridges: road over water, deck at the height of the banks it joins.
    if (t.h === 0 && roadAt(t.cx, t.cy) === 2) {
      const banks = edgeNeighbours(t).filter((n): n is Tile => !!n && n.h > 0);
      const deck = Math.max(1, ...banks.map((n) => n.h));
      queue.push({ k: t.s + 0.6, draw: () => drawBridge(canvas, t, deck, roadAt) });
    }
    if (t.h === 0 && edgeNeighbours(t).every((n) => !n || n.h === 0) && props() < 0.3) glints.push([t.cx, t.cy]);
    if (t.h === 0 || roadAt(t.cx, t.cy) > 0 || nearNode(t.cx, t.cy, 22)) continue;
    const top = t.cy - t.h * LEVEL;
    const dense = fbm(t.cx + 300, t.cy);
    const r = props();
    const jx = Math.round((props() - 0.5) * 10);
    const jy = Math.round((props() - 0.5) * 4);
    let sprite: PixelCanvas | null = null;
    if (t.mat === 'sand') {
      if (r < 0.12 && dense > 0.42) sprite = palm(props);
      else if (r < 0.15) sprite = rock(props, false);
      else if (r < 0.2) sprite = smallProp(props);
    } else if (t.mat === 'grass') {
      if (r < 0.5 * dense - 0.05) sprite = props() < 0.5 ? roundTree(props) : props() < 0.8 ? pine(props) : bush(props);
      else if (r < 0.42) sprite = bush(props);
      else if (r < 0.46) sprite = rock(props, true);
    } else if (t.mat === 'high') {
      if (r < 0.55 * dense - 0.05) sprite = pine(props);
      else if (r < 0.4) sprite = rock(props, props() < 0.5);
      else if (r < 0.46) sprite = bush(props);
    }
    if (sprite) {
      const sp = sprite;
      queue.push({ k: t.s + 0.5, draw: () => canvas.blit(sp, t.cx + jx - Math.floor(sp.w / 2), top + jy + 3 - sp.h) });
    }
  }

  // Landmarks, drawn after the rows in front of them so neighbouring tiles never cut into them.
  for (const node of region.nodes) {
    const t = nodeTiles.get(node.id)!;
    const x = t.cx;
    const y = t.cy - t.h * LEVEL;
    nodeOut[node.id] = { x, y };
    queue.push({ k: t.s + 2.5, draw: () => drawLandmark(canvas, node, x, y, fires) });
  }

  // The wreck of the Gilded Gull in the shallows below the camp.
  queue.push({ k: Math.round((design.wreck.y - Y0) / (TH / 2)) + 1.5, draw: () => drawWreck(canvas, design.wreck.x, design.wreck.y) });

  // Waterfall where the river leaves the high ground.
  const src = design.river[0]!;
  const head = tileUnder(src.x, src.y);
  if (head) queue.push({ k: head.s - 0.5, draw: () => drawWaterfall(canvas, src.x, src.y, 3) });

  queue.sort((a, b) => a.k - b.k);
  for (const item of queue) item.draw();
  // Walkable lines: the road curves lifted by the height of the ground (or bridge deck) under them,
  // smoothed so the party eases up and down cliffs instead of jumping.
  const roads: IslandBake['roads'] = {};
  for (const [k, line] of roadLines) {
    const lift = line.map((p) => {
      const t = tileUnder(p.x, p.y);
      if (!t) return 0;
      if (t.h > 0) return t.h * LEVEL;
      const banks = edgeNeighbours(t).filter((n): n is Tile => !!n && n.h > 0);
      return Math.max(1, ...banks.map((n) => n.h)) * LEVEL;
    });
    const out: [number, number][] = [];
    for (let i = 0; i < line.length; i += 3) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - 6); j <= Math.min(line.length - 1, i + 6); j++) {
        sum += lift[j]!;
        n++;
      }
      out.push([Math.round(line[i]!.x * 2) / 2, Math.round((line[i]!.y - sum / n) * 2) / 2]);
    }
    const last = line.at(-1)!;
    out.push([last.x, last.y - lift.at(-1)!]);
    roads[k] = out;
  }
  // Ends of every road meet their nodes' marker points exactly.
  for (const [k, pts] of Object.entries(roads)) {
    const [a, b] = k.split('|') as [string, string];
    pts[0] = [nodeOut[a]!.x, nodeOut[a]!.y];
    pts[pts.length - 1] = [nodeOut[b]!.x, nodeOut[b]!.y];
  }
  return { canvas, nodes: nodeOut, fires, glints, roads };
}

function landmarkRadius(node: RegionNode): number {
  return node.kind === 'boss' ? 44 : node.kind === 'camp' ? 34 : node.kind === 'ruin' ? 28 : 20;
}

// ---------------------------------------------------------------------------------------------
// Tiles

function tileRamps(t: Tile): { top: Ramp; face: Ramp } {
  switch (t.mat) {
    case 'water':
      return { top: RAMPS.water, face: RAMPS.deep };
    case 'sand':
      return { top: RAMPS.sand, face: RAMPS.wetSand };
    case 'grass':
      return { top: RAMPS.grass, face: RAMPS.earth };
    case 'high':
      return { top: RAMPS.grass, face: RAMPS.cliff };
  }
}

function drawTile(
  c: PixelCanvas,
  t: Tile,
  tileAt: (s: number, d: number) => Tile | undefined,
  roadAt: (x: number, y: number) => number,
  seed: number,
): void {
  const ty = t.cy - t.h * LEVEL;
  const { top, face } = tileRamps(t);
  const depth = t.h * LEVEL + BASE;

  // Side faces under the diamond's two lower edges.
  for (let k = 0; k < TW / 2; k++) {
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? t.cx - TW / 2 + k : t.cx + k;
      const yb = side < 0 ? ty + Math.floor(k / 2) : ty + 7 - Math.floor(k / 2);
      const steps = roadAt(x, yb + t.h * LEVEL + 2) === 2 && t.h > 0;
      for (let j = 1; j <= depth; j++) {
        const y = yb + j;
        const hsh = hash(x, y, seed);
        let col: string;
        const levelLine = j % LEVEL === 0;
        if (steps && j <= LEVEL + 1) {
          col = j % 3 === 0 ? RAMPS.rock[0] : side < 0 ? RAMPS.rock[2] : RAMPS.rock[3];
        } else if ((t.mat === 'grass' || t.mat === 'high') && j <= 1 + Math.floor(hash(x, 7, seed) * 3)) {
          col = side < 0 ? RAMPS.grass[1] : RAMPS.grass[2]; // grass lip over the edge
        } else if (t.mat === 'grass' && j > 5) {
          col = side < 0 ? RAMPS.cliff[1] : RAMPS.cliff[2];
          if (levelLine || hsh < 0.08) col = RAMPS.cliff[0];
        } else {
          col = side < 0 ? face[1] : face[2];
          if (levelLine && t.mat !== 'water') col = face[0];
          else if (hsh < 0.12) col = face[side < 0 ? 0 : 1];
          else if (hsh > 0.93) col = face[3];
        }
        if (j === depth) col = OUTLINE;
        c.set(x, y, col);
      }
    }
  }

  // Top diamond.
  const neighbours = [tileAt(t.s - 1, t.d - 1), tileAt(t.s - 1, t.d + 1), tileAt(t.s + 1, t.d - 1), tileAt(t.s + 1, t.d + 1)];
  for (let r = 0; r < TH; r++) {
    const hw = r < TH / 2 ? 2 * (r + 1) : 2 * (TH - r);
    const y = ty - TH / 2 + r;
    for (let x = t.cx - hw; x < t.cx + hw; x++) {
      const gy = y + t.h * LEVEL;
      const hsh = hash(x, gy, seed);
      let col = speckle(top, hsh, t.mat === 'water' ? 1 : 2);
      if (t.mat === 'high' && hsh > 0.5 && hsh < 0.56) col = RAMPS.moss[2];
      if (t.mat === 'water') {
        // Lighter water and a foam line along edges that meet land.
        const u = (x + 0.5 - t.cx) / (TW / 2);
        const v = (y + 0.5 - ty) / (TH / 2);
        const edges = [-u - v, u - v, -u + v, u + v];
        let near = 9;
        edges.forEach((e, i) => {
          const n = neighbours[i];
          if (n && n.h > 0) near = Math.min(near, 1 - e);
        });
        if (near < 0.16) col = (x + gy) % 3 === 0 ? RAMPS.water[3] : FOAM;
        else if (near < 0.42) col = hsh < 0.3 ? RAMPS.water[3] : RAMPS.water[2];
        else if (hsh > 0.985) col = RAMPS.water[3];
      } else {
        const rv = roadAt(x, gy);
        if (rv === 2) col = speckle(RAMPS.dirt, hsh, 2);
        else if (rv === 1) col = (x + gy) % 2 === 0 ? RAMPS.dirt[1] : t.mat === 'sand' ? RAMPS.sand[1] : RAMPS.grass[1];
        else if (t.mat !== 'sand' && hsh > 0.992) col = hash(x, gy, seed + 1) < 0.5 ? '#f4f0e6' : RAMPS.gold[3]; // flowers
        else if (t.mat === 'sand' && hsh > 0.994) col = RAMPS.cloth[3]; // shell grit
      }
      c.set(x, y, col);
    }
  }
}

function drawBridge(c: PixelCanvas, t: Tile, deck: number, roadAt: (x: number, y: number) => number): void {
  const lift = deck * LEVEL;
  for (let r = -3; r < TH + 3; r++) {
    const y = t.cy - TH / 2 + r;
    for (let x = t.cx - TW / 2 - 2; x < t.cx + TW / 2 + 2; x++) {
      if (roadAt(x, y) !== 2) continue;
      const plank = (x + y * 2) % 4 === 0 ? RAMPS.wood[0] : (x + y) % 2 === 0 ? RAMPS.wood[2] : RAMPS.wood[3];
      c.set(x, y - lift, plank);
      c.set(x, y - lift + 1, RAMPS.wood[0]);
    }
  }
  // Posts on the corners of the span.
  for (const [dx, dy] of [
    [-8, -2],
    [8, -2],
    [-8, 4],
    [8, 4],
  ] as const) {
    const x = t.cx + dx;
    const y = t.cy + dy - lift;
    if (roadAt(x, t.cy + dy) === 0) continue;
    c.rect(x, y - 5, 2, 6, RAMPS.wood[1]);
    c.set(x, y - 5, RAMPS.wood[3]);
  }
}

// ---------------------------------------------------------------------------------------------
// Props

function palm(rand: () => number): PixelCanvas {
  const c = new PixelCanvas(26, 34);
  const lean = rand() < 0.5 ? -1 : 1;
  const tx = 13 + lean * 4;
  c.curve(13, 33, 13 + lean * 1, 22, tx, 11, RAMPS.driftwood[1]);
  c.curve(14, 33, 14 + lean * 1, 22, tx + 1, 11, RAMPS.driftwood[2]);
  for (let y = 14; y < 33; y += 3) c.set(13 + Math.round(((33 - y) / 22) * lean * 4), y, RAMPS.driftwood[0]);
  for (const [ang, len] of [
    [200, 10],
    [160, 11],
    [235, 9],
    [305, 9],
    [340, 11],
    [20, 9],
    [270, 6],
  ] as const) {
    const a = (ang * Math.PI) / 180;
    const ex = tx + Math.cos(a) * len;
    const ey = 11 + Math.sin(a) * len * 0.6 + 3;
    c.curve(tx, 11, (tx + ex) / 2, 11 + Math.sin(a) * len * 0.3 - 3, ex, ey, RAMPS.palm[2]);
    c.curve(tx, 12, (tx + ex) / 2, 12 + Math.sin(a) * len * 0.3 - 3, ex, ey + 1, RAMPS.palm[1]);
    c.set(Math.round(ex), Math.round(ey), RAMPS.palm[3]);
  }
  c.rect(tx - 1, 12, 3, 2, RAMPS.wood[1]); // coconuts
  c.outline(OUTLINE);
  return c;
}

function pine(rand: () => number): PixelCanvas {
  const h = 22 + Math.floor(rand() * 8);
  const c = new PixelCanvas(20, h + 4);
  const cx = 10;
  c.rect(cx - 1, h - 3, 3, 6, RAMPS.wood[1]);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const y0 = 1 + Math.floor((i * (h - 6)) / tiers);
    const tierH = Math.floor((h - 4) / tiers) + 3;
    const wTop = 1 + i * 1.5;
    const wBot = 6 + i * 2.2;
    for (let j = 0; j < tierH; j++) {
      const w = Math.round(wTop + ((wBot - wTop) * j) / tierH);
      for (let x = -w; x <= w; x++) {
        const shade = x < -w / 3 ? 3 : x > w / 2 ? 1 : 2;
        c.set(cx + x, y0 + j, RAMPS.leaf[j === tierH - 1 ? 0 : shade]);
      }
    }
  }
  c.outline(OUTLINE);
  return c;
}

function roundTree(rand: () => number): PixelCanvas {
  const c = new PixelCanvas(26, 30);
  c.rect(12, 18, 3, 11, RAMPS.wood[1]);
  c.set(12, 18, RAMPS.wood[2]);
  const big = 8 + rand() * 2;
  c.shadedEllipse(13, 12, big, big * 0.85, RAMPS.canopy);
  c.shadedEllipse(8, 15, 5, 4, RAMPS.canopy, -0.05);
  c.shadedEllipse(18, 15, 5, 4, RAMPS.canopy, -0.15);
  for (let i = 0; i < 6; i++) c.paint(7 + Math.floor(rand() * 12), 6 + Math.floor(rand() * 10), RAMPS.canopy[3]);
  c.outline(OUTLINE);
  return c;
}

function bush(rand: () => number): PixelCanvas {
  const c = new PixelCanvas(16, 11);
  c.shadedEllipse(8, 6, 6, 4, RAMPS.leaf, 0.1);
  c.shadedEllipse(5, 7, 3.5, 3, RAMPS.leaf, 0.05);
  if (rand() < 0.5) for (let i = 0; i < 3; i++) c.paint(3 + Math.floor(rand() * 10), 3 + Math.floor(rand() * 5), i % 2 ? '#f4f0e6' : RAMPS.red[3]);
  c.outline(OUTLINE);
  return c;
}

function rock(rand: () => number, mossy: boolean): PixelCanvas {
  const big = rand() < 0.4;
  const c = new PixelCanvas(big ? 18 : 11, big ? 13 : 8);
  if (big) {
    c.shadedEllipse(9, 7.5, 8, 5, RAMPS.rock);
    c.shadedEllipse(5, 9, 4, 3, RAMPS.rock, -0.1);
  } else {
    c.shadedEllipse(5.5, 4.5, 4.5, 3, RAMPS.rock, 0.05);
  }
  if (mossy) for (let x = 2; x < c.w - 2; x++) c.paint(x, 2 + (x % 3 === 0 ? 1 : 0), RAMPS.moss[2]);
  c.outline(OUTLINE);
  return c;
}

function smallProp(rand: () => number): PixelCanvas {
  const c = new PixelCanvas(20, 8);
  if (rand() < 0.5) {
    c.shadedRect(2, 3, 15, 3, RAMPS.driftwood);
    c.line(3, 3, 10, 3, RAMPS.driftwood[3]);
  } else {
    c.shadedEllipse(6, 4, 3, 2.5, RAMPS.cloth, 0.2);
    c.rect(12, 3, 3, 3, RAMPS.crab[2]);
  }
  c.outline(OUTLINE);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Landmarks (one per node kind), drawn centred on the node's tile top at (x, y).

function drawLandmark(c: PixelCanvas, node: RegionNode, x: number, y: number, fires: [number, number][]): void {
  switch (node.kind) {
    case 'camp':
      tent(c, x - 18, y - 4, RAMPS.canvas);
      tent(c, x + 16, y - 8, RAMPS.cloth);
      crate(c, x + 24, y + 4);
      crate(c, x + 29, y + 1);
      barrel(c, x - 27, y + 3);
      campfire(c, x, y + 6);
      fires.push([x, y + 4]);
      banner(c, x - 4, y - 12, RAMPS.blue);
      break;
    case 'encounter':
      campfire(c, x + 11, y + 3, true);
      bedroll(c, x - 13, y + 2);
      break;
    case 'elite':
      skullPike(c, x - 12, y + 2);
      skullPike(c, x + 12, y + 1);
      bones(c, x + 4, y + 6);
      break;
    case 'ruin':
      arch(c, x, y - 5);
      torch(c, x - 15, y + 2);
      torch(c, x + 15, y + 2);
      fires.push([x - 15, y - 9], [x + 15, y - 9]);
      break;
    case 'resource':
      dock(c, x + 6, y + 2);
      barrel(c, x - 12, y + 2);
      break;
    case 'boss':
      fort(c, x, y);
      fires.push([x - 26, y - 34], [x + 26, y - 34]);
      break;
  }
}

function tent(c: PixelCanvas, x: number, y: number, ramp: Ramp): void {
  const t = new PixelCanvas(26, 20);
  for (let j = 0; j < 16; j++) {
    const w = Math.round((j * 11) / 15);
    for (let i = -w; i <= w; i++) t.set(13 + i, 3 + j, i < 0 ? ramp[3] : ramp[1]);
  }
  t.line(13, 3, 13, 18, ramp[0]);
  for (let j = 10; j < 19; j++) t.set(13, j, OUTLINE); // door
  t.set(12, 18, OUTLINE);
  t.set(14, 18, OUTLINE);
  t.rect(12, 0, 2, 4, RAMPS.wood[1]);
  t.outline(OUTLINE);
  c.blit(t, x - 13, y - 19);
}

function crate(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(10, 10);
  t.shadedRect(0, 1, 9, 8, RAMPS.wood);
  t.line(0, 1, 8, 8, RAMPS.wood[0]);
  t.rect(0, 1, 9, 1, RAMPS.wood[3]);
  t.outline(OUTLINE);
  c.blit(t, x - 5, y - 9);
}

function barrel(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(9, 11);
  t.shadedRect(1, 1, 7, 9, RAMPS.wood);
  t.rect(1, 3, 7, 1, RAMPS.steel[1]);
  t.rect(1, 7, 7, 1, RAMPS.steel[1]);
  t.rect(2, 0, 5, 1, RAMPS.wood[3]);
  t.outline(OUTLINE);
  c.blit(t, x - 4, y - 10);
}

function campfire(c: PixelCanvas, x: number, y: number, cold = false): void {
  const t = new PixelCanvas(14, 9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    t.set(7 + Math.round(Math.cos(a) * 5), 5 + Math.round(Math.sin(a) * 2.5), RAMPS.rock[2]);
  }
  t.line(4, 6, 10, 4, RAMPS.wood[1]);
  t.line(4, 4, 10, 6, RAMPS.wood[2]);
  if (cold) t.set(7, 4, RAMPS.dark[2]);
  t.outline(OUTLINE);
  c.blit(t, x - 7, y - 7);
}

function bedroll(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(16, 7);
  t.shadedRect(1, 1, 13, 4, RAMPS.red);
  t.shadedEllipse(3, 3, 2.5, 2, RAMPS.canvas, 0.2);
  t.outline(OUTLINE);
  c.blit(t, x - 8, y - 5);
}

function banner(c: PixelCanvas, x: number, y: number, ramp: Ramp): void {
  const t = new PixelCanvas(10, 26);
  t.rect(1, 0, 2, 26, RAMPS.wood[1]);
  t.set(1, 0, RAMPS.gold[3]);
  t.shadedRect(3, 2, 6, 10, ramp);
  t.set(5, 6, RAMPS.gold[3]);
  t.set(6, 5, RAMPS.gold[2]);
  t.set(3, 12, ramp[1]);
  t.set(8, 12, ramp[1]);
  t.outline(OUTLINE);
  c.blit(t, x - 2, y - 14);
}

function skullPike(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(9, 22);
  t.rect(4, 6, 1, 16, RAMPS.wood[1]);
  t.shadedEllipse(4.5, 4, 3.5, 3.5, RAMPS.bone, 0.2);
  t.set(3, 4, OUTLINE);
  t.set(5, 4, OUTLINE);
  t.rect(3, 6, 3, 1, RAMPS.bone[1]);
  t.outline(OUTLINE);
  c.blit(t, x - 4, y - 21);
}

function bones(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(12, 6);
  t.line(1, 4, 10, 1, RAMPS.bone[3]);
  t.line(2, 1, 9, 4, RAMPS.bone[2]);
  t.outline(OUTLINE);
  c.blit(t, x - 6, y - 5);
}

function arch(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(36, 36);
  const block = (bx: number, by: number, w: number, h: number): void => {
    t.shadedRect(bx, by, w, h, RAMPS.rock);
    t.set(bx + w - 1, by + h - 1, RAMPS.rock[0]);
  };
  for (let row = 0; row < 6; row++) {
    block(3, 32 - row * 5 - 5, 7, 5);
    block(26, 32 - row * 5 - 5, 7, 5);
  }
  // Curved top made of wedge blocks.
  for (let a = 180; a <= 360; a += 30) {
    const r = (a * Math.PI) / 180;
    block(Math.round(18 + Math.cos(r) * 12) - 3, Math.round(8 + Math.sin(r) * 7) - 1, 7, 5);
  }
  for (let i = 0; i < 9; i++) t.paint(4 + ((i * 7) % 28), 4 + ((i * 11) % 26), RAMPS.moss[2]);
  t.outline(OUTLINE);
  c.blit(t, x - 18, y - 33);
}

function torch(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(7, 15);
  t.rect(3, 5, 1, 10, RAMPS.wood[1]);
  t.shadedRect(1, 3, 5, 3, RAMPS.rock);
  t.outline(OUTLINE);
  c.blit(t, x - 3, y - 14);
}

function dock(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(30, 22);
  // Planks running down-right into the water, iso style.
  for (let i = 0; i < 12; i++) {
    const px = 2 + i * 2;
    const py = 4 + i;
    t.line(px, py, px + 8, py - 4, i % 2 ? RAMPS.wood[2] : RAMPS.wood[3]);
    t.set(px + 8, py - 3, RAMPS.wood[0]);
  }
  for (const [px, py] of [
    [3, 5],
    [11, 1],
    [23, 11],
    [27, 9],
  ] as const) t.rect(px, py, 2, 7, RAMPS.wood[1]);
  // Fishing pole and line.
  t.line(24, 9, 29, 0, RAMPS.wood[2]);
  t.line(29, 0, 29, 8, RAMPS.cloth[2]);
  t.outline(OUTLINE);
  c.blit(t, x - 6, y - 10);
}

function fort(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(84, 60);
  const ox = 42;
  // Palisade wall: a row of sharpened logs, back row first for depth.
  const logs = (y0: number, x0: number, x1: number, ramp: Ramp): void => {
    for (let lx = x0; lx <= x1; lx += 3) {
      const h = 16 + ((lx * 7) % 3);
      t.rect(lx, y0 - h, 3, h, ramp[2]);
      t.set(lx, y0 - h, ramp[3]);
      t.set(lx + 1, y0 - h - 1, ramp[3]);
      t.rect(lx + 2, y0 - h + 1, 1, h - 1, ramp[1]);
    }
  };
  logs(38, 12, 72, RAMPS.wood);
  // Towers.
  for (const tx of [6, 66]) {
    t.shadedRect(tx, 14, 12, 34, RAMPS.wood);
    t.shadedRect(tx - 2, 10, 16, 6, RAMPS.wood);
    t.rect(tx + 4, 22, 4, 4, OUTLINE); // window
    for (let i = 0; i < 4; i++) t.rect(tx - 2 + i * 4, 7, 2, 3, RAMPS.wood[2]);
  }
  logs(56, 18, 34, RAMPS.wood);
  logs(56, 50, 66, RAMPS.wood);
  // Gate.
  t.shadedRect(ox - 8, 36, 16, 20, RAMPS.leather);
  t.line(ox, 36, ox, 55, RAMPS.leather[0]);
  t.rect(ox - 8, 44, 16, 1, RAMPS.steel[1]);
  // Flag on the gate.
  t.rect(ox - 1, 18, 1, 18, RAMPS.wood[1]);
  t.shadedRect(ox, 19, 9, 6, RAMPS.red);
  t.set(ox + 4, 21, RAMPS.bone[3]);
  t.outline(OUTLINE);
  c.blit(t, x - ox, y - 56);
}

function drawWreck(c: PixelCanvas, x: number, y: number): void {
  const t = new PixelCanvas(70, 48);
  // Hull lying on its side, bow up out of the water.
  for (let i = 0; i < 52; i++) {
    const top = 26 - Math.round(Math.sin((i / 52) * Math.PI) * 6) - Math.round(i * 0.25);
    const bottom = 40 - Math.round(i * 0.1);
    for (let yy = top; yy <= bottom; yy++) {
      const plank = (yy - top) % 4 === 0;
      t.set(6 + i, yy, plank ? RAMPS.wood[0] : yy - top < 2 ? RAMPS.wood[3] : i % 9 === 0 ? RAMPS.wood[1] : RAMPS.wood[2]);
    }
  }
  // Broken ribs and a hole.
  t.rect(30, 30, 9, 6, OUTLINE);
  for (const rx of [31, 34, 37]) t.rect(rx, 29, 1, 8, RAMPS.wood[1]);
  // Snapped mast with a torn sail.
  t.thickLine(40, 22, 50, 4, RAMPS.wood[1], 2);
  t.line(49, 7, 60, 12, RAMPS.wood[1]);
  for (let j = 0; j < 9; j++) t.line(51, 8 + j, 58 - Math.floor(j / 2), 12 + j, j % 3 === 0 ? RAMPS.canvas[1] : RAMPS.canvas[3]);
  t.outline(OUTLINE);
  // Waterline foam.
  for (let i = 4; i < 62; i += 2) t.set(i, 41 + (i % 4 === 0 ? 0 : 1), FOAM);
  c.blit(t, x - 35, y - 42);
}

function drawWaterfall(c: PixelCanvas, x: number, y: number, levels: number): void {
  const h = levels * LEVEL + 6;
  const top = y - h - 4;
  for (let j = 0; j < h; j++) {
    for (let i = -5; i <= 5; i++) {
      const stripe = (i + 7 + Math.floor(j / 3)) % 4 === 0;
      c.set(x + i, top + j, Math.abs(i) === 5 ? RAMPS.water[1] : stripe ? FOAM : i < 0 ? RAMPS.water[3] : RAMPS.water[2]);
    }
  }
  for (let i = -8; i <= 8; i++) c.set(x + i, top + h, i % 2 === 0 ? FOAM : RAMPS.water[3]);
  for (let i = -6; i <= 6; i += 2) c.set(x + i, top + h + 1, FOAM);
}

// ---------------------------------------------------------------------------------------------
// Helpers

function speckle(r: Ramp, hsh: number, base: number): string {
  if (hsh < 0.16) return r[Math.max(0, base - 1)]!;
  if (hsh > 0.86) return r[Math.min(3, base + 1)]!;
  return r[base]!;
}

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(seed: number): (x: number, y: number) => number {
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, seed);
    const b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed);
    const d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function distToPolyline(pts: { x: number; y: number }[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return best;
}
