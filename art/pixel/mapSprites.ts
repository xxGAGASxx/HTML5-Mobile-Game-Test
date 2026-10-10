import { PixelCanvas, rng } from './canvas.ts';
import { FOAM, OUTLINE, RAMPS } from './palette.ts';

/** Sprites the map scene animates over the baked island: fog clouds, fire flicker, water glints. */
export function buildMapSprites(): Map<string, PixelCanvas[]> {
  const out = new Map<string, PixelCanvas[]>();

  // Fog: three puffy cloud shapes, lit from the top left like everything else.
  const clouds: PixelCanvas[] = [];
  for (let v = 0; v < 3; v++) {
    const rand = rng(40 + v);
    const c = new PixelCanvas(56, 30);
    const puffs = 5 + v;
    for (let i = 0; i < puffs; i++) {
      const px = 10 + rand() * 36;
      const py = 14 + rand() * 6 - Math.sin((px / 56) * Math.PI) * 5;
      const r = 6 + rand() * 6;
      c.shadedEllipse(px, py, r, r * 0.75, ['#5e6a78', '#8a96a2', '#b8c2ca', '#e4eaee'], 0.25);
    }
    c.outline('#3a4450');
    clouds.push(c);
  }
  out.set('map/cloud', clouds);

  // Flame for campfires and torches.
  const fire: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(9, 12);
    const sway = [0, 1, 0, -1][f]!;
    const h = [8, 9, 7, 9][f]!;
    for (let j = 0; j < h; j++) {
      const w = Math.max(0, Math.round(3.2 * Math.sin(((j + 1) / (h + 1)) * Math.PI) + 0.4));
      const x = 4 + Math.round((sway * (h - j)) / h);
      for (let i = -w; i <= w; i++) c.set(x + i, 11 - j, Math.abs(i) >= w ? RAMPS.fire[1] : j < 3 ? RAMPS.fire[3] : RAMPS.fire[2]);
    }
    c.set(4 + sway, 11 - h, RAMPS.fire[2]);
    c.outline(OUTLINE);
    fire.push(c);
  }
  out.set('map/fire', fire);

  // Glint on open water.
  const glint: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(9, 3);
    const w = [1, 3, 4, 2][f]!;
    for (let i = -w; i <= w; i++) c.set(4 + i, 1, Math.abs(i) === w ? RAMPS.water[3] : FOAM);
    glint.push(c);
  }
  out.set('map/glint', glint);
  return out;
}
