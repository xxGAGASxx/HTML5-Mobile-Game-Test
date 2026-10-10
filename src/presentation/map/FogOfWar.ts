/** A clear patch around a revealed node, in art pixels. `scale` grows from 0 to 1 as it is revealed. */
export interface FogHole {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Half-size of the clear ellipse around a node: wide and flat to sit on the isometric tiles. */
export const HOLE_RX = 46;
export const HOLE_RY = 30;
/** Half-width of the clear strip along a road between two revealed nodes. */
export const ROAD_HALF_WIDTH = 12;
/** The fog thickens from clear to full over this share of the hole's size. */
export const EDGE = 0.45;
/** Distinct fog strengths: the edge is dithered between them so it stays pixel art. */
export const FOG_LEVELS = 4;

// 4x4 ordered dither thresholds in (0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * Fog density per cell over a `width` x `height` art-pixel map, 0 (clear) to FOG_LEVELS - 1 (full),
 * row by row. Everything is fogged except the patches around `holes` and the strips along `roads`.
 */
export function fogDensity(
  width: number,
  height: number,
  cell: number,
  holes: readonly FogHole[],
  roads: readonly (readonly (readonly [number, number])[])[],
): Uint8Array {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const out = new Uint8Array(cols * rows);
  const segments: [number, number, number, number][] = [];
  for (const line of roads) {
    for (let i = 1; i < line.length; i++) segments.push([line[i - 1]![0], line[i - 1]![1], line[i]![0], line[i]![1]]);
  }
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) * cell;
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cell;
      // Distance in hole-sizes to the nearest clear shape: below 1 is inside it.
      let t = Infinity;
      for (const h of holes) {
        if (h.scale <= 0) continue;
        const dx = (x - h.x) / (HOLE_RX * h.scale);
        const dy = (y - h.y) / (HOLE_RY * h.scale);
        t = Math.min(t, Math.sqrt(dx * dx + dy * dy));
      }
      for (const [ax, ay, bx, by] of segments) {
        if (t <= 1) break;
        t = Math.min(t, segmentDistance(x, y, ax, ay, bx, by) / ROAD_HALF_WIDTH);
      }
      const strength = Math.min(1, Math.max(0, (t - 1) / EDGE)) * (FOG_LEVELS - 1);
      const level = Math.floor(strength);
      out[r * cols + c] = level + (strength - level > BAYER[(r % 4) * 4 + (c % 4)]! ? 1 : 0);
    }
  }
  return out;
}

function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const k = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / len2));
  return Math.hypot(x - (ax + k * vx), y - (ay + k * vy));
}
