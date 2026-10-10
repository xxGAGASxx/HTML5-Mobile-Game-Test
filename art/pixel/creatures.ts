import { PixelCanvas } from './canvas.ts';
import { CELL } from './humanoid.ts';
import { EYE, OUTLINE, RAMPS } from './palette.ts';

export interface CreaturePose {
  x?: number;
  y: number;
  /** Mouth or pincer opening, 0..1. */
  open?: number;
  lunge?: number;
  strike?: boolean;
  eyes?: 'open' | 'closed';
  dead?: boolean;
}

/** Shore crab, front view: wide shell, eye stalks, two raised pincers. */
export function drawCrab(p: CreaturePose): PixelCanvas {
  const c = new PixelCanvas(CELL, CELL);
  const x = p.x ?? 0;
  const y = p.y;
  const lunge = p.lunge ?? 0;
  const open = p.open ?? 0;
  const cx = 24 + x;
  const cy = 35 + y;
  const r = RAMPS.crab;

  // Legs first (three per side), splayed to the ground.
  for (const [sx, ex] of [
    [-9, -14],
    [-7, -11],
    [-4, -7],
  ] as const) {
    c.line(cx + sx, cy + 2, cx + ex, 41, r[1]);
    c.line(cx + ex, 41, cx + ex + 1, 44, r[0]);
    c.line(cx - sx, cy + 2, cx - ex, 41, r[1]);
    c.line(cx - ex, 41, cx - ex - 1, 44, r[0]);
  }

  // Eye stalks.
  for (const ex of [-4, 4]) {
    c.line(cx + ex, cy - 6, cx + ex, cy - 10, r[2]);
    c.rect(cx + ex - 1, cy - 12, 3, 3, '#f4f0e6');
    if (p.eyes === 'closed') c.rect(cx + ex - 1, cy - 11, 3, 1, EYE);
    else c.rect(cx + ex, cy - 11, 1, 2, EYE);
  }

  c.shadedEllipse(cx, cy, 12, 7, r, 0.05);
  for (const [sx, sy] of [
    [-5, -2],
    [2, -3],
    [6, 0],
    [-2, 1],
  ] as const) c.paint(cx + sx, cy + sy, r[3]);
  for (let i = -8; i <= 8; i++) c.paint(cx + i, cy + 4, r[0]);

  // Pincers: raised on the sides, snapping forward on attack.
  for (const side of [-1, 1]) {
    const px = cx + side * (14 - lunge * 3);
    const py = cy - 10 - lunge * 4 + (p.strike ? 4 : 0);
    c.thickLine(cx + side * 9, cy - 1, px, py + 3, r[1], 2);
    c.shadedEllipse(px, py, 4.5, 4, r, 0.1);
    // Gap between the two fingers of the pincer.
    const gap = Math.round(1 + open * 3);
    for (let i = 0; i < gap; i++) {
      c.set(px - 1 + i * side * 0, py - 3 - i, null);
      c.set(px, py - 3 - i, null);
      c.set(px + side, py - 4 - i, null);
    }
    c.set(px - side * 2, py - 4, r[3]);
  }

  let out = c;
  out.outline(OUTLINE);
  if (p.dead) out = out.rot180().settle(44, CELL / 2);
  return out;
}

/** Coast wolf, 3/4 side view facing right, with a bushy tail. */
export function drawWolf(p: CreaturePose): PixelCanvas {
  const c = new PixelCanvas(CELL, CELL);
  const x = p.x ?? 0;
  const lunge = p.lunge ?? 0;
  const open = p.open ?? 0;
  const r = RAMPS.wolf;
  const dead = p.dead ?? false;
  const y = dead ? 8 : p.y;

  const bx = 21 + x;
  const by = 31 + y;

  // Tail.
  c.thickLine(bx - 10, by - 2, bx - 15, by - 8 + (dead ? 8 : 0), r[1], 3);
  c.line(bx - 14, by - 9 + (dead ? 8 : 0), bx - 16, by - 11 + (dead ? 8 : 0), r[3]);

  // Legs (far pair darker, near pair lighter); stretched when lunging, splayed when dead.
  const legs: [number, number, number][] = [
    [bx - 7, -lunge * 3, 0],
    [bx + 7, lunge * 3, 0],
    [bx - 4, -lunge * 2, 2],
    [bx + 9, lunge * 4, 2],
  ];
  for (const [lx, reach, shade] of legs) {
    const top = by + 3;
    if (dead) c.thickLine(lx, top, lx + 5, top + 2, r[shade], 2);
    else {
      c.thickLine(lx, top, lx + reach, 42, r[shade], 2);
      c.rect(Math.round(lx + reach) - 1, 43, 3, 2, r[shade === 0 ? 0 : 1]);
    }
  }

  c.shadedEllipse(bx, by, 11, 6, r);
  for (let i = -6; i <= 6; i++) c.paint(bx + i, by + 4, r[3]); // pale belly
  c.shadedEllipse(bx + 9, by - 2, 5, 5.5, r, 0.1); // chest and shoulders

  // Head.
  const hx = bx + 13 + lunge * 2;
  const hy = by - 7 + lunge * 2 + (dead ? 5 : 0);
  c.shadedEllipse(hx, hy, 5, 4.5, r, 0.1);
  for (const ex of [-3, 1]) {
    c.line(hx + ex, hy - 4, hx + ex + 1, hy - 8, r[2]);
    c.set(hx + ex + 1, hy - 6, r[0]);
    c.line(hx + ex + 1, hy - 4, hx + ex + 2, hy - 7, r[1]);
  }
  // Snout and jaw.
  const jaw = Math.round(open * 3);
  c.shadedRect(hx + 3, hy - 1, 6, 3, r);
  c.set(hx + 9, hy - 1, EYE);
  c.shadedRect(hx + 3, hy + 2 + jaw, 5, 2, r);
  if (jaw > 0) {
    c.rect(hx + 3, hy + 2, 5, jaw, '#5a1418');
    c.set(hx + 4, hy + 2, '#f4f0e6');
    c.set(hx + 6, hy + 1 + jaw, '#f4f0e6');
  }
  if (p.eyes === 'closed' || dead) c.rect(hx, hy - 1, 2, 1, EYE);
  else {
    c.rect(hx + 1, hy - 2, 1, 2, '#f0c040');
    c.set(hx + 1, hy - 1, EYE);
  }

  c.outline(OUTLINE);
  return c;
}
