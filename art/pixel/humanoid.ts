import { PixelCanvas } from './canvas.ts';
import { EYE, OUTLINE, RAMPS, type Ramp } from './palette.ts';

/**
 * Paper-doll builder for 3/4 front-view humanoids in a 48x48 cell, feet on row 44.
 * A recipe says what the unit wears; a pose says where the body and hands are this frame.
 */

export const CELL = 48;
const FEET = 44;

export type Weapon = 'sword' | 'cutlass' | 'spear' | 'staff' | 'bow' | 'musket';

export interface Recipe {
  skin: Ramp;
  face?: 'normal' | 'skull' | 'mask';
  mask?: Ramp;
  hair?: { style: 'short' | 'long' | 'braid' | 'spiky'; ramp: Ramp };
  headgear?: { kind: 'bandana' | 'hood' | 'helmet' | 'tricorn'; ramp: Ramp; trim?: Ramp };
  torso: { style: 'tunic' | 'striped' | 'robe' | 'plate' | 'coat' | 'ribs'; ramp: Ramp; accent?: Ramp };
  bareArms?: boolean;
  belt: Ramp;
  legs: Ramp;
  boots: Ramp;
  cape?: Ramp;
  weapon: Weapon;
  shield?: { kind: 'round' | 'tower'; ramp: Ramp; accent: Ramp };
}

export interface Pose {
  bodyX?: number;
  bodyY?: number;
  crouch?: number;
  hand: [number, number];
  angle: number; // weapon direction in degrees, 0 = up, clockwise
  off?: [number, number];
  eyes?: 'open' | 'closed';
  /** Weapon-specific 0..1: bow draw, staff glow, musket flash. */
  power?: number;
  smear?: [number, number];
  stepL?: number;
  stepR?: number;
}

const dir = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];

export function drawHumanoid(r: Recipe, p: Pose, edge = OUTLINE): PixelCanvas {
  const c = new PixelCanvas(CELL, CELL);
  const crouch = p.crouch ?? 0;
  const bx = p.bodyX ?? 0;
  const by = (p.bodyY ?? 0) + crouch;
  const hx = p.hand[0] + bx;
  const hy = p.hand[1] + by;
  const off: [number, number] = p.off ? [p.off[0] + bx, p.off[1] + by] : [16 + bx, 31 + by];
  const robe = r.torso.style === 'robe';
  const coat = r.torso.style === 'coat';

  // Cape and long hair sit behind everything.
  if (r.cape) c.shadedTrapezoid(24 + bx, 22 + by, 14, 18, 18 - crouch, r.cape);
  if (r.hair?.style === 'long') c.shadedRect(17 + bx, 13 + by, 15, 13, r.hair.ramp);
  if (r.headgear?.kind === 'hood') c.shadedEllipse(24 + bx, 15 + by, 8, 8.5, r.headgear.ramp, -0.15);

  // Legs and boots stay planted; a crouch shortens the legs.
  const legTop = 34 + by;
  for (const [x, step] of [
    [19, p.stepL ?? 0],
    [25, p.stepR ?? 0],
  ] as const) {
    const bootTop = FEET - 3 - step;
    if (bootTop > legTop) c.shadedRect(x, legTop, 4, bootTop - legTop, r.legs);
    c.shadedRect(x - 1, bootTop, 5, 4, r.boots);
    c.set(x === 19 ? x - 2 : x + 4, bootTop + 3, r.boots[1]);
  }

  // Torso.
  const tTop = 22 + by;
  const tx = 24 + bx;
  if (robe) {
    c.shadedTrapezoid(tx, tTop, 12, 18, FEET - tTop - 1, r.torso.ramp);
    if (r.torso.accent) {
      c.rect(tx, tTop + 2, 1, FEET - tTop - 3, r.torso.accent[2]);
      for (let x = -8; x <= 8; x++) c.paint(tx + x, FEET - 2, r.torso.accent[1]);
    }
  } else {
    c.shadedTrapezoid(tx, tTop, 13, 11, 12, r.torso.ramp);
    if (coat) {
      c.shadedTrapezoid(tx, tTop + 10, 12, 15, Math.max(2, 8 - crouch), r.torso.ramp);
      c.rect(tx, tTop + 1, 1, 17 - crouch, r.torso.ramp[0]);
      if (r.torso.accent) for (let y = 2; y < 10; y += 3) c.set(tx - 2, tTop + y, r.torso.accent[3]);
    }
    if (r.torso.style === 'striped') for (let y = 2; y < 10; y += 3) for (let x = -6; x <= 6; x++) c.paint(tx + x, tTop + y, (r.torso.accent ?? RAMPS.red)[x > 3 ? 1 : 2]);
    if (r.torso.style === 'plate') {
      c.shadedRect(tx - 2, tTop + 2, 4, 9, r.torso.accent ?? RAMPS.blue);
      c.shadedEllipse(tx - 6, tTop + 1.5, 3, 2.5, RAMPS.steel);
      c.shadedEllipse(tx + 6, tTop + 1.5, 3, 2.5, RAMPS.steel);
    }
    if (r.torso.style === 'ribs') {
      for (let y = 2; y < 9; y += 2) for (let x = -4; x <= 4; x++) if (x !== 0) c.paint(tx + x, tTop + y, RAMPS.bone[x < 0 ? 3 : 2]);
      c.rect(tx, tTop + 1, 1, 10, RAMPS.bone[2]);
    }
    if (r.torso.style === 'tunic' && r.torso.accent) {
      c.rect(tx - 3, tTop, 7, 2, r.torso.accent[2]);
      c.rect(tx - 2, tTop + 2, 5, 1, r.torso.accent[1]);
    }
  }
  c.rect(tx - 6, tTop + 9, 12, 2, r.belt[1]);
  c.rect(tx - 6, tTop + 9, 12, 1, r.belt[2]);
  c.rect(tx - 1, tTop + 9, 2, 2, RAMPS.gold[2]);

  // Off arm (behind the shield, in front of the torso).
  const armRamp = r.bareArms ? r.skin : r.torso.style === 'plate' ? RAMPS.steel : r.torso.ramp;
  arm(c, tx - 6, tTop + 1, off[0], off[1], armRamp, r.skin);

  // Head.
  const hcx = 24.5 + bx;
  const hcy = 15 + by;
  c.shadedEllipse(hcx, hcy, 6, 6.5, r.skin, 0.1);
  face(c, r, hcx, hcy, p.eyes ?? 'open');
  hair(c, r, hcx, hcy);
  headgear(c, r, hcx, hcy);

  // Shield in the off hand.
  if (r.shield) shield(c, r.shield, off[0], off[1]);

  // Main arm and weapon.
  arm(c, tx + 5, tTop + 1, hx, hy, armRamp, r.skin);
  weapon(c, r.weapon, hx, hy, p.angle, p.power ?? 0, off);

  c.outline(edge);
  if (p.smear) smear(c, hx, hy, p.smear[0], p.smear[1], r.weapon === 'spear' ? 16 : 13);
  if (r.weapon === 'staff' && (p.power ?? 0) > 0) staffGlow(c, hx, hy, p.angle, p.power ?? 0);
  if (r.weapon === 'musket' && (p.power ?? 0) > 0) muzzle(c, hx, hy, p.angle, p.power ?? 0);
  return c;
}

function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, ramp: Ramp, skin: Ramp): void {
  c.thickLine(sx, sy + 1, hx, hy - 1, ramp[1], 3);
  c.line(sx - 1, sy, hx - 1, hy - 2, ramp[2]);
  c.rect(hx - 1, hy - 1, 3, 3, skin[2]);
  c.set(hx + 1, hy + 1, skin[1]);
}

function face(c: PixelCanvas, r: Recipe, cx: number, cy: number, eyes: 'open' | 'closed'): void {
  const ex = Math.floor(cx);
  const ey = Math.floor(cy) + 1;
  if (r.face === 'skull') {
    c.rect(ex - 3, ey - 1, 2, 2, EYE);
    c.rect(ex + 1, ey - 1, 2, 2, EYE);
    if (eyes === 'open') {
      c.set(ex - 2, ey, '#d02828');
      c.set(ex + 2, ey, '#d02828');
    }
    c.set(ex, ey + 2, RAMPS.bone[0]);
    for (let x = -2; x <= 2; x++) c.set(ex + x, ey + 4, x % 2 === 0 ? RAMPS.bone[0] : RAMPS.bone[3]);
    return;
  }
  if (eyes === 'open') {
    c.rect(ex - 3, ey, 1, 2, EYE);
    c.rect(ex + 2, ey, 1, 2, EYE);
  } else {
    c.rect(ex - 4, ey + 1, 2, 1, EYE);
    c.rect(ex + 2, ey + 1, 2, 1, EYE);
  }
  c.set(ex, ey + 2, r.skin[1]);
  if (r.face === 'mask') {
    const m = r.mask ?? RAMPS.red;
    for (let y = ey + 2; y <= ey + 5; y++) for (let x = ex - 5; x <= ex + 6; x++) c.paint(x, y, x > ex + 2 ? m[1] : m[2]);
  } else {
    c.set(ex, ey + 4, r.skin[0]);
    c.set(ex + 1, ey + 4, r.skin[0]);
  }
}

function hair(c: PixelCanvas, r: Recipe, cx: number, cy: number): void {
  if (!r.hair || r.headgear?.kind === 'helmet' || r.headgear?.kind === 'hood') return;
  const h = r.hair.ramp;
  // Cap over the top half of the head, then a fringe.
  for (let y = Math.floor(cy - 7.5); y <= Math.floor(cy - 1); y++) {
    for (let x = Math.floor(cx - 7); x <= Math.ceil(cx + 7); x++) {
      const nx = (x + 0.5 - cx) / 7;
      const ny = (y + 0.5 - (cy - 1)) / 7;
      if (nx * nx + ny * ny > 1) continue;
      const s = nx < -0.3 && ny < -0.2 ? 3 : nx > 0.5 ? 1 : 2;
      c.set(x, y, h[s]);
    }
  }
  const x0 = Math.floor(cx);
  const fy = Math.floor(cy - 2);
  for (const dx of [-5, -4, -2, -1, 1, 2, 4]) c.set(x0 + dx, fy + (dx % 2 === 0 ? 1 : 0), h[1]);
  c.rect(x0 - 6, fy, 1, 5, h[1]);
  c.rect(x0 + 6, fy, 1, 4, h[0]);
  if (r.hair.style === 'spiky') {
    for (const dx of [-5, -2, 1, 4]) {
      c.set(x0 + dx, fy - 7, h[2]);
      c.set(x0 + dx + 1, fy - 8, h[3]);
    }
  }
  if (r.hair.style === 'braid') {
    for (let y = 0; y < 10; y++) c.rect(x0 + 6 + (y % 2), fy + 3 + y, 2, 1, h[y % 2 === 0 ? 2 : 1]);
    c.set(x0 + 7, fy + 13, RAMPS.red[2]);
  }
}

function headgear(c: PixelCanvas, r: Recipe, cx: number, cy: number): void {
  const g = r.headgear;
  if (!g) return;
  const x0 = Math.floor(cx);
  const top = Math.floor(cy - 6.5);
  if (g.kind === 'bandana') {
    for (let x = -7; x <= 7; x++) {
      c.paint(x0 + x, top + 3, g.ramp[x < 0 ? 3 : 2]);
      c.paint(x0 + x, top + 4, g.ramp[1]);
    }
    c.rect(x0 + 6, top + 4, 2, 2, g.ramp[2]);
    c.line(x0 + 8, top + 5, x0 + 10, top + 8, g.ramp[1]);
    c.line(x0 + 7, top + 6, x0 + 8, top + 9, g.ramp[0]);
  } else if (g.kind === 'helmet') {
    for (let y = top - 1; y <= top + 6; y++) {
      for (let x = x0 - 7; x <= x0 + 7; x++) {
        const nx = (x + 0.5 - cx) / 7;
        const ny = (y + 0.5 - (cy - 0.5)) / 7.5;
        if (nx * nx + ny * ny <= 1) c.set(x, y, g.ramp[nx < -0.3 ? 3 : nx > 0.4 ? 1 : 2]);
      }
    }
    c.rect(x0 - 6, top + 6, 13, 1, g.ramp[1]);
    c.rect(x0 - 7, top + 7, 2, 6, g.ramp[2]);
    c.rect(x0 + 6, top + 7, 2, 6, g.ramp[1]);
    c.rect(x0, top - 3, 1, 4, (g.trim ?? RAMPS.blue)[2]);
    c.rect(x0 + 1, top - 3, 2, 2, (g.trim ?? RAMPS.blue)[1]);
  } else if (g.kind === 'hood') {
    // Front rim of the hood over the forehead; the back was drawn behind the head.
    for (let x = -6; x <= 6; x++) c.set(x0 + x, top + 1 + (Math.abs(x) > 4 ? 1 : 0), g.ramp[x < 0 ? 2 : 1]);
    for (let y = 2; y <= 10; y++) {
      c.set(x0 - 7, top + y, g.ramp[2]);
      c.set(x0 + 7, top + y, g.ramp[0]);
    }
    c.set(x0, top - 2, g.ramp[2]);
  } else if (g.kind === 'tricorn') {
    const trim = g.trim ?? RAMPS.gold;
    c.shadedTrapezoid(x0, top - 3, 8, 12, 4, g.ramp);
    c.rect(x0 - 9, top + 1, 19, 2, g.ramp[1]);
    c.rect(x0 - 9, top + 1, 19, 1, trim[2]);
    c.set(x0 - 10, top, g.ramp[2]);
    c.set(x0 + 10, top, g.ramp[1]);
    c.rect(x0 - 1, top - 2, 2, 2, RAMPS.bone[3]);
  }
}

function shield(c: PixelCanvas, s: NonNullable<Recipe['shield']>, x: number, y: number): void {
  if (s.kind === 'round') {
    c.ellipse(x, y, 6, 6.5, RAMPS.steel[1]);
    c.shadedEllipse(x, y, 5, 5.5, s.ramp);
    for (let a = -5; a <= 5; a++) c.paint(x - 0.5, y + a, s.accent[2]);
    for (let a = -4; a <= 4; a++) c.paint(x + a, y - 0.5, s.accent[1]);
    c.shadedEllipse(x, y, 1.6, 1.6, RAMPS.steel, 0.3);
  } else {
    c.shadedRect(Math.round(x - 5), Math.round(y - 9), 10, 17, s.ramp);
    for (const dx of [-2, 1]) for (let dy = -8; dy <= 6; dy++) c.paint(x + dx, y + dy, s.ramp[0]);
    c.rect(Math.round(x - 5), Math.round(y - 3), 10, 3, s.accent[2]);
    c.rect(Math.round(x - 5), Math.round(y - 1), 10, 1, s.accent[1]);
    c.set(x - 3, y - 6, RAMPS.steel[3]);
    c.set(x + 2, y - 6, RAMPS.steel[3]);
    c.set(x - 3, y + 4, RAMPS.steel[2]);
    c.set(x + 2, y + 4, RAMPS.steel[2]);
  }
}

function weapon(c: PixelCanvas, w: Weapon, hx: number, hy: number, angle: number, power: number, off: [number, number]): void {
  const [dx, dy] = dir(angle);
  const px = -dy;
  const py = dx;
  const at = (t: number, s = 0): [number, number] => [hx + dx * t + px * s, hy + dy * t + py * s];
  switch (w) {
    case 'sword':
    case 'cutlass': {
      const len = w === 'sword' ? 13 : 11;
      c.line(...at(-3), ...at(0), RAMPS.leather[1]);
      c.set(...at(-3), RAMPS.gold[2]);
      c.line(...at(1, -2.5), ...at(1, 2.5), RAMPS.gold[2]);
      const bend = w === 'cutlass' ? 2.5 : 0;
      c.curve(...at(2, 0.5), ...at(len * 0.6, 0.5 + bend), ...at(len + 2, bend * 0.6), RAMPS.steel[1]);
      c.curve(...at(2, -0.5), ...at(len * 0.6, -0.5 + bend), ...at(len + 1, -0.5 + bend * 0.6), RAMPS.steel[3]);
      break;
    }
    case 'spear': {
      c.line(...at(-9), ...at(13), RAMPS.wood[1]);
      c.line(...at(-9, -1), ...at(12, -1), RAMPS.wood[3]);
      c.line(...at(13), ...at(18), RAMPS.steel[3]);
      c.line(...at(13, 1), ...at(16, 1), RAMPS.steel[1]);
      c.line(...at(13, -1), ...at(16, -1), RAMPS.steel[2]);
      c.set(...at(12, 0), RAMPS.red[2]);
      c.set(...at(11, 1), RAMPS.red[1]);
      break;
    }
    case 'staff': {
      c.line(...at(-10), ...at(12), RAMPS.wood[1]);
      c.line(...at(-10, -1), ...at(11, -1), RAMPS.wood[2]);
      c.line(...at(11, -2.5), ...at(12.5, -1.5), RAMPS.gold[2]);
      c.line(...at(11, 2.5), ...at(12.5, 1.5), RAMPS.gold[1]);
      const [ox, oy] = at(14.5);
      c.shadedEllipse(ox, oy, 2.6 + power * 0.8, 2.6 + power * 0.8, RAMPS.cyan, 0.2 + power * 0.3);
      break;
    }
    case 'bow': {
      // Bow axis is perpendicular to the aim; the string is pulled back towards the off hand.
      const tipA = at(-1.5, -10);
      const tipB = at(-1.5, 10);
      const ctrl = at(5);
      c.curve(...tipA, ...ctrl, ...tipB, RAMPS.wood[1]);
      c.curve(...at(-1.5, -9), ...at(4, 0), ...at(-1.5, 9), RAMPS.wood[3]);
      const pull = at(-2 - power * 6);
      c.line(...tipA, ...pull, RAMPS.cloth[3]);
      c.line(...pull, ...tipB, RAMPS.cloth[3]);
      if (power > 0) {
        c.line(...pull, ...at(6), RAMPS.wood[2]);
        c.line(...at(6), ...at(8), RAMPS.steel[3]);
        c.set(...pull, RAMPS.cloth[3]);
        void off;
      }
      break;
    }
    case 'musket': {
      c.thickLine(...at(-6), ...at(1), RAMPS.wood[1], 2);
      c.line(...at(-6, -1), ...at(1, -1), RAMPS.wood[2]);
      c.line(...at(1), ...at(15), RAMPS.dark[2]);
      c.line(...at(1, -1), ...at(14, -1), RAMPS.steel[2]);
      c.set(...at(3, 1), RAMPS.gold[2]);
      break;
    }
  }
}

/** White motion arc behind a swinging blade, drawn after the outline so it reads as speed. */
function smear(c: PixelCanvas, hx: number, hy: number, from: number, to: number, r: number): void {
  for (let a = from; a <= to; a += 3) {
    const [dx, dy] = dir(a);
    for (let t = r - 3; t <= r + 1; t++) {
      const x = Math.round(hx + dx * t);
      const y = Math.round(hy + dy * t);
      if (!c.get(x, y)) c.set(x, y, t >= r ? '#ffffff' : '#ffffffaa');
    }
  }
}

function staffGlow(c: PixelCanvas, hx: number, hy: number, angle: number, power: number): void {
  const [dx, dy] = dir(angle);
  const ox = hx + dx * 14.5;
  const oy = hy + dy * 14.5;
  const rad = 4 + power * 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + power;
    const x = Math.round(ox + Math.cos(a) * rad);
    const y = Math.round(oy + Math.sin(a) * rad);
    if (!c.get(x, y)) c.set(x, y, i % 3 === 0 ? RAMPS.cyan[3] : '#5ad0e088');
  }
}

function muzzle(c: PixelCanvas, hx: number, hy: number, angle: number, power: number): void {
  const [dx, dy] = dir(angle);
  const fx = hx + dx * 17;
  const fy = hy + dy * 17;
  if (power >= 1) {
    c.shadedEllipse(fx, fy, 3, 3, RAMPS.fire, 0.4);
    c.set(fx + dx * 4, fy + dy * 4, RAMPS.fire[3]);
  } else {
    for (const [ox, oy, s] of [
      [0, 0, 2.5],
      [2, -3, 2],
      [-1, -5, 1.5],
    ] as const) {
      c.ellipse(fx + ox, fy + oy - (1 - power) * 3, s, s, '#a8a4a8aa');
    }
  }
}
