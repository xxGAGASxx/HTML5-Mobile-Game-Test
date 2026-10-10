import type { Ramp } from './palette.ts';

/** Light comes from the top left, as in the reference sprites. */
const LIGHT = normalize([-0.5, -0.65, 0.6]);

function normalize(v: number[]): [number, number, number] {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A small indexed-free pixel canvas: each cell holds a '#rrggbb' colour (optionally '#rrggbbaa') or null. */
export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  private readonly px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, c: string | null): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  /** Paints only over pixels that are already filled (for details that must stay inside a shape). */
  paint(x: number, y: number, c: string): void {
    if (this.get(Math.floor(x), Math.floor(y))) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Flat-ish block lit from the top left: bright left edge and top, dark right edge and bottom. */
  shadedRect(x: number, y: number, w: number, h: number, r: Ramp): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 2;
        if (i === 0 || j === 0) s = 3;
        if (i >= w - 2 && w > 3) s = 1;
        if (j === h - 1 && h > 2) s = Math.min(s, 1);
        if (i === w - 1 && j === h - 1 && w > 2) s = 0;
        this.set(x + i, y + j, r[s]);
      }
    }
  }

  /** Trapezoid from width `wTop` to `wBottom`, centred on cx, shaded like shadedRect. */
  shadedTrapezoid(cx: number, y: number, wTop: number, wBottom: number, h: number, r: Ramp): void {
    for (let j = 0; j < h; j++) {
      const w = Math.round(wTop + ((wBottom - wTop) * j) / Math.max(1, h - 1));
      const x0 = Math.round(cx - w / 2);
      for (let i = 0; i < w; i++) {
        let s = 2;
        if (i === 0 || j === 0) s = 3;
        if (i >= w - 2) s = 1;
        if (j === h - 1) s = Math.min(s, 1);
        this.set(x0 + i, y + j, r[s]);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    }
  }

  /** Sphere-lit ellipse using the 4-step ramp. `bias` pushes the whole shape lighter (+) or darker (-). */
  shadedEllipse(cx: number, cy: number, rx: number, ry: number, r: Ramp, bias = 0): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias;
        const s = dot > 0.92 ? 3 : dot > 0.55 ? 2 : dot > 0.12 ? 1 : 0;
        this.set(x, y, r[s]);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A line `width` pixels thick (square brush). */
  thickLine(x0: number, y0: number, x1: number, y1: number, c: string, width: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const off = Math.floor(width / 2);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      this.rect(x - off, y - off, width, width, c);
    }
  }

  /** Quadratic curve through a control point. */
  curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: string): void {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 2;
    let px = Math.round(x0);
    let py = Math.round(y0);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      this.line(px, py, Math.round(x), Math.round(y), c);
      px = Math.round(x);
      py = Math.round(y);
    }
  }

  /** Adds a 1 px outline around every filled pixel (4-neighbourhood), the reference sprites' dark edge. */
  outline(c: string): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.solid(x - 1, y) || this.solid(x + 1, y) || this.solid(x, y - 1) || this.solid(x, y + 1)) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = c;
  }

  private solid(x: number, y: number): boolean {
    const c = this.get(x, y);
    return c !== null && c.length === 7; // translucent pixels (shadows, glows) do not get an outline
  }

  blit(src: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c) this.set(dx + x, dy + y, c);
      }
    }
  }

  clone(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.blit(this, 0, 0);
    return c;
  }

  /** Lossless quarter turn clockwise around the canvas centre (canvas must be square). */
  rot90(): PixelCanvas {
    const out = new PixelCanvas(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.h - 1 - y, x, this.get(x, y));
    return out;
  }

  rot180(): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, this.h - 1 - y, this.get(x, y));
    return out;
  }

  flipH(): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, y, this.get(x, y));
    return out;
  }

  /** Moves the content so its lowest filled row sits on `bottom` and it is centred on `cx`. */
  settle(bottom: number, cx?: number): PixelCanvas {
    let minX = this.w;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.get(x, y)) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxY < 0) return this.clone();
    const dx = cx === undefined ? 0 : Math.round(cx - (minX + maxX + 1) / 2);
    const out = new PixelCanvas(this.w, this.h);
    out.blit(this, dx, bottom - maxY);
    return out;
  }

  /** Ordered-dither fade: removes `amount` (0..1) of the pixels in a 4x4 Bayer pattern. */
  dissolve(amount: number): PixelCanvas {
    const out = this.clone();
    const cut = amount * 16;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (BAYER4[(y % 4) * 4 + (x % 4)]! < cut) out.set(x, y, null);
    return out;
  }

  /** Replaces every filled pixel's colour (used for the white hit flash frame). */
  map(fn: (c: string) => string): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y);
      if (c) out.set(x, y, fn(c));
    }
    return out;
  }

  toRGBA(): Uint8Array {
    const out = new Uint8Array(this.w * this.h * 4);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (!c) continue;
      out[i * 4] = parseInt(c.slice(1, 3), 16);
      out[i * 4 + 1] = parseInt(c.slice(3, 5), 16);
      out[i * 4 + 2] = parseInt(c.slice(5, 7), 16);
      out[i * 4 + 3] = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255;
    }
    return out;
  }
}

/** Deterministic RNG so every build produces identical sheets. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
