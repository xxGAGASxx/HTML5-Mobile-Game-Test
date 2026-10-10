import { PixelCanvas, rng } from './canvas.ts';
import { FOAM, OUTLINE, RAMPS } from './palette.ts';

/** Effect sprites layered over units in game (slashes, sparks, projectiles), plus the unit drop shadow. */
export function buildFx(): Map<string, PixelCanvas[]> {
  const out = new Map<string, PixelCanvas[]>();

  // Shadow: translucent, so it is drawn without an outline.
  const shadow = new PixelCanvas(26, 8);
  shadow.ellipse(13, 4, 12, 3.6, '#00000050');
  shadow.ellipse(13, 4, 8, 2.4, '#00000030');
  out.set('shadow', [shadow]);

  // Slash: a crescent that sweeps in, then thins out.
  const slash: PixelCanvas[] = [];
  const sweeps: [number, number, number][] = [
    [200, 250, 3],
    [180, 310, 4],
    [170, 350, 4],
    [175, 355, 2],
    [190, 350, 1],
  ];
  for (const [i, [a0, a1, th]] of sweeps.entries()) {
    const c = new PixelCanvas(32, 32);
    for (let a = a0; a <= a1; a += 2) {
      const t = (a - a0) / Math.max(1, a1 - a0);
      const w = Math.max(1, Math.round(th * Math.sin(t * Math.PI)));
      for (let k = 0; k < w; k++) {
        const rad = 12 - k;
        const x = Math.round(16 + Math.cos((a * Math.PI) / 180) * rad);
        const y = Math.round(16 + Math.sin((a * Math.PI) / 180) * rad * 0.8);
        c.set(x, y, k === 0 ? '#ffffff' : k === 1 ? RAMPS.steel[3] : RAMPS.red[3]);
      }
    }
    slash.push(i === 4 ? c.dissolve(0.5) : c);
  }
  out.set('fx/slash', slash);

  // Hit spark: a four-point star that bursts and breaks into dots.
  const spark: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(20, 20);
    const len = [3, 6, 8, 8][f]!;
    const gap = [0, 1, 4, 6][f]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let t = gap; t <= len; t++) c.set(10 + dx * t, 10 + dy * t, t > len - 2 ? RAMPS.gold[2] : '#ffffff');
    }
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const t = Math.round(len * 0.6);
      if (t > gap) c.set(10 + dx * t, 10 + dy * t, RAMPS.gold[3]);
    }
    if (f === 0) c.rect(9, 9, 3, 3, '#ffffff');
    spark.push(c);
  }
  out.set('fx/spark', spark);

  // Magic burst: cyan ring with sparkles.
  const magic: PixelCanvas[] = [];
  const rand = rng(7);
  for (let f = 0; f < 5; f++) {
    const c = new PixelCanvas(32, 32);
    const rad = 3 + f * 3;
    for (let a = 0; a < 360; a += 4) {
      const x = Math.round(16 + Math.cos((a * Math.PI) / 180) * rad);
      const y = Math.round(16 + Math.sin((a * Math.PI) / 180) * rad);
      c.set(x, y, f < 3 ? RAMPS.cyan[3] : RAMPS.cyan[2]);
      if (f < 2) c.set(16 + (x - 16) * 0.7, 16 + (y - 16) * 0.7, RAMPS.cyan[2]);
    }
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * (rad + 4);
      c.set(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, i % 2 ? '#ffffff' : RAMPS.purple[3]);
    }
    if (f === 0) c.shadedEllipse(16, 16, 3, 3, RAMPS.cyan, 0.5);
    magic.push(f === 4 ? c.dissolve(0.5) : c);
  }
  out.set('fx/magic', magic);

  // Projectiles all point right; the game rotates them towards the target.
  const arrow = new PixelCanvas(16, 5);
  arrow.line(1, 2, 12, 2, RAMPS.wood[2]);
  arrow.line(12, 2, 14, 2, RAMPS.steel[3]);
  arrow.set(13, 1, RAMPS.steel[2]);
  arrow.set(13, 3, RAMPS.steel[1]);
  arrow.rect(1, 1, 2, 1, RAMPS.cloth[3]);
  arrow.rect(1, 3, 2, 1, RAMPS.cloth[2]);
  arrow.outline(OUTLINE);
  out.set('fx/arrow', [arrow]);

  const bolt: PixelCanvas[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new PixelCanvas(14, 10);
    c.ellipse(4, 5, 3, 2, '#5ad0e088');
    c.shadedEllipse(8, 5, 3.5 + f * 0.5, 3.5 + f * 0.5, RAMPS.cyan, 0.4);
    c.set(1 + f, 5, RAMPS.cyan[3]);
    bolt.push(c);
  }
  out.set('fx/bolt', bolt);

  const ball = new PixelCanvas(8, 6);
  ball.ellipse(2, 3, 2, 1.5, '#a8a4a888');
  ball.shadedEllipse(5, 3, 2, 2, RAMPS.dark, 0.5);
  out.set('fx/ball', [ball]);

  // Dust puff for deaths.
  const dust: PixelCanvas[] = [];
  for (let f = 0; f < 5; f++) {
    const c = new PixelCanvas(32, 16);
    for (const [dx, s] of [
      [-8, 3],
      [0, 4],
      [8, 3],
    ] as const) {
      const spread = f * 1.5;
      c.shadedEllipse(16 + dx + Math.sign(dx) * spread, 11 - f, s + f * 0.4, s * 0.8 + f * 0.3, RAMPS.sand, 0.3);
    }
    dust.push(f >= 3 ? c.dissolve(f === 3 ? 0.4 : 0.7) : c);
  }
  out.set('fx/dust', dust);

  return out;
}

/** Decorations scattered over the coast battlefield. */
export function buildDeco(): Map<string, PixelCanvas[]> {
  const out = new Map<string, PixelCanvas[]>();

  const shell = new PixelCanvas(9, 8);
  shell.shadedEllipse(4.5, 4.5, 3.5, 3, RAMPS.cloth, 0.2);
  for (const x of [3, 5]) shell.line(4, 6, x, 2, RAMPS.cloth[1]);
  shell.rect(3, 6, 3, 1, RAMPS.crab[3]);
  shell.outline(OUTLINE);
  out.set('deco/shell', [shell]);

  const star = new PixelCanvas(11, 11);
  for (let a = 0; a < 5; a++) {
    const ang = (a / 5) * Math.PI * 2 - Math.PI / 2;
    star.thickLine(5, 5, 5 + Math.cos(ang) * 4, 5 + Math.sin(ang) * 4, RAMPS.crab[2], 2);
  }
  star.set(5, 5, RAMPS.crab[3]);
  star.outline(OUTLINE);
  out.set('deco/starfish', [star]);

  const rock = new PixelCanvas(18, 13);
  rock.shadedEllipse(9, 7.5, 8, 5, RAMPS.rock);
  rock.shadedEllipse(5, 9, 4, 3, RAMPS.rock, -0.1);
  for (let x = 4; x < 14; x++) rock.paint(x, 3 + (x % 3 === 0 ? 1 : 0), RAMPS.moss[2]);
  rock.outline(OUTLINE);
  out.set('deco/rock', [rock]);

  const wood = new PixelCanvas(26, 9);
  wood.shadedRect(2, 3, 21, 4, RAMPS.driftwood);
  wood.line(4, 4, 14, 4, RAMPS.driftwood[3]);
  wood.line(15, 5, 21, 5, RAMPS.driftwood[0]);
  wood.line(20, 2, 23, 0, RAMPS.driftwood[1]);
  wood.shadedEllipse(3, 5, 2, 2.5, RAMPS.driftwood, -0.2);
  wood.outline(OUTLINE);
  out.set('deco/driftwood', [wood]);

  const weed = new PixelCanvas(13, 10);
  for (const [x, h, s] of [
    [3, 6, 1],
    [6, 8, 2],
    [9, 5, 1],
  ] as const) weed.curve(x, 9, x - 2, 9 - h / 2, x + 1, 9 - h, RAMPS.moss[s + 1]);
  weed.outline(OUTLINE);
  out.set('deco/weed', [weed]);

  return out;
}

const TILE = 32;

/** Seamless ground tiles, exported as separate PNGs so TilingSprite can repeat them. */
export function buildGround(): Map<string, PixelCanvas> {
  const out = new Map<string, PixelCanvas>();
  out.set('sand', speckled(RAMPS.sand, 11));
  out.set('wet-sand', speckled(RAMPS.wetSand, 12));

  const water = speckled(RAMPS.water, 13, 1);
  const rand = rng(14);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * TILE);
    const y = Math.floor(rand() * TILE);
    for (let k = 0; k < 4; k++) water.set((x + k) % TILE, y, RAMPS.water[3]);
  }
  out.set('water', water);

  // Shoreline strip: water on top, foam scallops, wet sand below. 32 x 16, repeats horizontally.
  const shore = new PixelCanvas(TILE, 16);
  shore.blit(out.get('wet-sand')!, 0, 0);
  for (let x = 0; x < TILE; x++) {
    const edge = 6 + Math.round(Math.sin((x / TILE) * Math.PI * 2) * 2);
    for (let y = 0; y < edge; y++) shore.set(x, y, out.get('water')!.get(x, y)!);
    shore.set(x, edge, FOAM);
    shore.set(x, edge + 1, x % 4 === 0 ? FOAM : RAMPS.water[3]);
    if (x % 5 === 2) shore.set(x, edge + 2, FOAM);
  }
  out.set('shore', shore);

  // Wet-to-dry sand transition: dithered so the tide line isn't a hard edge. 32 x 16, repeats horizontally.
  const edge = out.get('sand')!.clone();
  const wet = out.get('wet-sand')!;
  const tide = rng(15);
  for (let x = 0; x < TILE; x++) {
    const reach = 7 + Math.round(Math.sin((x / TILE) * Math.PI * 4) * 2 + tide() * 2);
    for (let y = 0; y < 16; y++) {
      const solid = y < reach - 2;
      const dither = y < reach + 2 && (x + y) % 2 === 0;
      if (solid || dither) edge.set(x, y, wet.get(x, y));
    }
  }
  const tideCanvas = new PixelCanvas(TILE, 16);
  tideCanvas.blit(edge, 0, 0);
  out.set('tide', tideCanvas);
  return out;
}

function speckled(ramp: readonly string[], seed: number, base = 2): PixelCanvas {
  const c = new PixelCanvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, ramp[base]!);
  const rand = rng(seed);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * TILE);
    const y = Math.floor(rand() * TILE);
    const v = rand();
    c.set(x, y, v < 0.45 ? ramp[base - 1]! : v < 0.85 ? ramp[base + 1]! : ramp[0]!);
    if (v > 0.93) c.set((x + 1) % TILE, y, ramp[base - 1]!);
  }
  return c;
}
