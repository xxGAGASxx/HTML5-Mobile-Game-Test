// Builds the game's pixel-art sprites from the sources in art/pixel/.
//   npm run sprites                 -> public/assets/sprites/pixel.png + pixel.json, ground-*.png,
//                                      public/assets/maps/<region>.png + .json (baked island maps)
//   npm run sprites -- --preview D  -> also writes x4 contact sheets and an x3 map to directory D
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PixelCanvas } from '../art/pixel/canvas.ts';
import { buildDeco, buildFx, buildGround } from '../art/pixel/fx.ts';
import { WRECK_COAST_DESIGN, bakeIsland } from '../art/pixel/island.ts';
import { buildMapSprites } from '../art/pixel/mapSprites.ts';
import { WRECK_COAST } from '../src/data/regions/wreckCoast.ts';
import { ANIMS, buildUnits } from '../art/pixel/units.ts';

const OUT = join(import.meta.dirname, '..', 'public', 'assets', 'sprites');
const MAPS_OUT = join(import.meta.dirname, '..', 'public', 'assets', 'maps');
const ATLAS_WIDTH = 1024;
const PAD = 2;
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

interface Frame {
  name: string;
  canvas: PixelCanvas;
  anchor: { x: number; y: number };
}

const frames: Frame[] = [];
const animations: Record<string, string[]> = {};

function add(key: string, list: PixelCanvas[], anchor: { x: number; y: number }): void {
  animations[key] = list.map((canvas, i) => {
    const name = `${key}/${i}`;
    frames.push({ name, canvas, anchor });
    return name;
  });
}

// Units: feet on row 44 of a 48 px cell, so anchor at the feet.
for (const [id, anims] of buildUnits()) for (const anim of ANIMS) add(`${id}/${anim}`, anims[anim], { x: 0.5, y: 45 / 48 });
for (const [key, list] of buildFx()) add(key, list, { x: 0.5, y: 0.5 });
for (const [key, list] of buildDeco()) add(key, list, { x: 0.5, y: 1 });
for (const [key, list] of buildMapSprites()) add(key, list, { x: 0.5, y: 0.5 });

// Shelf packing, tallest first.
const placed = [...frames].sort((a, b) => b.canvas.h - a.canvas.h);
const pos = new Map<string, { x: number; y: number }>();
let x = 0;
let y = 0;
let shelf = 0;
for (const f of placed) {
  if (x + f.canvas.w > ATLAS_WIDTH) {
    x = 0;
    y += shelf + PAD;
    shelf = 0;
  }
  pos.set(f.name, { x, y });
  x += f.canvas.w + PAD;
  shelf = Math.max(shelf, f.canvas.h);
}
const atlas = new PixelCanvas(ATLAS_WIDTH, y + shelf);
for (const f of frames) atlas.blit(f.canvas, pos.get(f.name)!.x, pos.get(f.name)!.y);

const json = {
  frames: Object.fromEntries(
    frames.map((f) => {
      const p = pos.get(f.name)!;
      const size = { w: f.canvas.w, h: f.canvas.h };
      return [f.name, { frame: { ...p, ...size }, sourceSize: size, spriteSourceSize: { x: 0, y: 0, ...size }, anchor: f.anchor }];
    }),
  ),
  animations,
  meta: { app: 'scripts/build-sprites.ts', image: 'pixel.png', format: 'RGBA8888', size: { w: atlas.w, h: atlas.h }, scale: '1' },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'pixel.png'), png(atlas));
writeFileSync(join(OUT, 'pixel.json'), JSON.stringify(json, null, 1) + '\n');
for (const [name, tile] of buildGround()) writeFileSync(join(OUT, `ground-${name}.png`), png(tile));
console.log(`pixel.png ${atlas.w}x${atlas.h}, ${frames.length} frames, ${Object.keys(animations).length} animations`);

// Island maps: one baked PNG per region plus where its nodes, fires and water glints are.
mkdirSync(MAPS_OUT, { recursive: true });
const island = bakeIsland(WRECK_COAST, WRECK_COAST_DESIGN);
writeFileSync(join(MAPS_OUT, `${WRECK_COAST.id}.png`), png(island.canvas));
writeFileSync(
  join(MAPS_OUT, `${WRECK_COAST.id}.json`),
  JSON.stringify({ width: island.canvas.w, height: island.canvas.h, nodes: island.nodes, fires: island.fires, glints: island.glints, roads: island.roads }) + '\n',
);
console.log(`${WRECK_COAST.id}.png ${island.canvas.w}x${island.canvas.h}, ${Object.keys(island.nodes).length} nodes`);

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx > 0) writePreview(process.argv[previewIdx + 1]!);

/** Contact sheet: one row per unit animation set, scaled x4 on a dark backdrop. */
function writePreview(dir: string): void {
  const units = buildUnits();
  const cols = 18;
  const sheet = new PixelCanvas(cols * 50, units.size * 50);
  sheet.rect(0, 0, sheet.w, sheet.h, '#22303c');
  let row = 0;
  for (const anims of units.values()) {
    let col = 0;
    for (const anim of ANIMS) {
      for (const c of anims[anim]) {
        sheet.rect(col * 50, row * 50, 49, 49, anim === 'idle' ? '#2a3a48' : anim === 'attack' ? '#30404e' : anim === 'hit' ? '#3a3040' : '#2a2a34');
        sheet.blit(c, col * 50, row * 50);
        col++;
      }
    }
    row++;
  }
  const scale = 4;
  const big = new PixelCanvas(sheet.w * scale, sheet.h * scale);
  for (let j = 0; j < sheet.h; j++) for (let i = 0; i < sheet.w; i++) {
    const c = sheet.get(i, j);
    if (c) big.rect(i * scale, j * scale, scale, scale, c.slice(0, 7));
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'units-preview.png'), png(big));
  const fxBig = new PixelCanvas(ATLAS_WIDTH, atlas.h);
  fxBig.rect(0, 0, fxBig.w, fxBig.h, '#22303c');
  fxBig.blit(atlas, 0, 0);
  writeFileSync(join(dir, 'atlas-preview.png'), png(fxBig));
  const map = new PixelCanvas(island.canvas.w, island.canvas.h);
  map.rect(0, 0, map.w, map.h, '#0b1d2a');
  map.blit(island.canvas, 0, 0);
  writeFileSync(join(dir, 'map-preview.png'), png(upscale(map, 3)));
  console.log(`preview written to ${dir}`);
}

function upscale(src: PixelCanvas, scale: number): PixelCanvas {
  const big = new PixelCanvas(src.w * scale, src.h * scale);
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const c = src.get(i, j);
    if (c) big.rect(i * scale, j * scale, scale, scale, c.slice(0, 7));
  }
  return big;
}

function png(c: PixelCanvas): Buffer {
  const rgba = c.toRGBA();
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * c.w * 4, c.w * 4).copy(raw, y * (c.w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
