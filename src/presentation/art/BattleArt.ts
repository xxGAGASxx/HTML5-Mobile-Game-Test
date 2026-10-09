import { AnimatedSprite, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Role } from '../../domain/shared';
import type { Icons } from '../assets/icons';
import { frames, type PixelAssets } from '../assets/pixel';
import type { Tweens } from '../Tweens';
import { COLORS, ROLE_COLORS } from '../theme';
import { MiniUnit } from '../ui/MiniUnit';
import { PixelUnit } from '../ui/PixelUnit';
import { UnitToken } from '../ui/UnitToken';
import type { UnitView } from '../ui/UnitView';
import type { ArtStyle } from './ArtStyle';

export interface UnitArtSpec {
  typeId: string;
  icon: string;
  role: Role;
  enemy: boolean;
}

export interface FieldGeometry {
  width: number;
  height: number;
  /** y of the line between the two armies. */
  mid: number;
  cell: number;
  pixelScale: number;
  slots: readonly { x: number; y: number }[];
}

export type ImpactKind = 'slash' | 'spark' | 'magic';

/** Everything the battle scene draws that depends on the art style. */
export interface BattleArt {
  readonly style: ArtStyle;
  createUnit(spec: UnitArtSpec, tweens: Tweens): UnitView;
  drawField(layer: Container, field: FieldGeometry): void;
  /** A projectile pointing right (+x); the scene rotates it towards the target. */
  projectile(spec: UnitArtSpec, pixelScale: number): Container;
  /** A one-shot effect that removes itself when done, or null if the style has none. */
  effect(kind: ImpactKind | 'dust', pixelScale: number, speed: number): Container | null;
}

/** Integer zoom for pixel styles: 48 px art cells land near the slot size. */
export function pixelScaleFor(cell: number): number {
  return Math.max(1, Math.round(cell / 42));
}

export function impactKind(spec: UnitArtSpec, ranged: boolean): ImpactKind {
  if (!ranged) return 'slash';
  return spec.role === 'caster' ? 'magic' : 'spark';
}

export class IconArt implements BattleArt {
  readonly style = 'icons';

  constructor(private readonly icons: Icons) {}

  createUnit(spec: UnitArtSpec): UnitView {
    return new UnitToken(this.icons, spec.icon, spec.role, spec.enemy);
  }

  drawField(layer: Container, { width, height, mid }: FieldGeometry): void {
    const g = new Graphics().rect(0, 0, width, height).fill(COLORS.background);
    g.rect(0, 0, width, mid).fill({ color: COLORS.enemy, alpha: 0.18 });
    g.moveTo(16, mid).lineTo(width - 16, mid).stroke({ width: 2, color: COLORS.muted, alpha: 0.3 });
    layer.addChild(g);
  }

  projectile(spec: UnitArtSpec, pixelScale: number): Container {
    return new Graphics().circle(0, 0, Math.max(4, pixelScale * 3)).fill(ROLE_COLORS[spec.role]);
  }

  effect(): Container | null {
    return null;
  }
}

export class PixelArt implements BattleArt {
  readonly style: ArtStyle = 'pixel';

  constructor(protected readonly assets: PixelAssets) {}

  createUnit(spec: UnitArtSpec, tweens: Tweens): UnitView {
    return new PixelUnit(this.assets, spec.typeId, () => tweens.speed);
  }

  /** Coast battlefield: surf along the top, wet sand on the enemy side, dry sand, scattered props. */
  drawField(layer: Container, f: FieldGeometry): void {
    const z = f.pixelScale;
    const g = this.assets.ground;
    const tiled = (texture: typeof g.sand, y: number, h: number): TilingSprite => {
      const t = new TilingSprite({ texture, width: f.width, height: Math.max(0, h) });
      t.tileScale.set(z);
      t.y = y;
      layer.addChild(t);
      return t;
    };
    const waterH = Math.round(Math.min(f.height * 0.08, 28 * z));
    const shoreH = 16 * z;
    tiled(g.sand, 0, f.height);
    const wetH = Math.round((f.mid * 0.55) / z) * z;
    tiled(g.wetSand, 0, wetH);
    tiled(g.tide, wetH, 16 * z);
    tiled(g.water, 0, waterH);
    tiled(g.shore, waterH - 6 * z, shoreH);

    // Dotted line in the sand between the two armies.
    const line = new Graphics();
    for (let x = 16; x < f.width - 16; x += 6 * z) line.rect(x, Math.round(f.mid), 2 * z, z).fill({ color: 0x6e5636, alpha: 0.6 });
    layer.addChild(line);

    // Props, kept away from unit slots so they never hide a unit.
    const rand = seeded(42);
    const kinds = ['deco/shell', 'deco/rock', 'deco/driftwood', 'deco/weed', 'deco/starfish', 'deco/shell', 'deco/weed'];
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < 10; tries++) {
      const x = rand() * f.width;
      const y = waterH + shoreH + rand() * (f.height - waterH - shoreH);
      if (f.slots.some((s) => Math.abs(s.x - x) < f.cell * 0.55 && Math.abs(s.y - y) < f.cell * 0.6)) continue;
      const prop = new Sprite(frames(this.assets, kinds[placed % kinds.length]!)[0]);
      prop.scale.set(z);
      prop.position.set(Math.round(x), Math.round(y));
      layer.addChild(prop);
      placed++;
    }
  }

  projectile(spec: UnitArtSpec, pixelScale: number): Container {
    const kind = spec.typeId === 'skull-gunner' ? 'fx/ball' : spec.role === 'caster' ? 'fx/bolt' : 'fx/arrow';
    const textures = frames(this.assets, kind);
    const sprite = textures.length > 1 ? new AnimatedSprite({ textures, animationSpeed: 0.3, autoPlay: true }) : new Sprite(textures[0]);
    sprite.anchor.set(0.5);
    sprite.scale.set(pixelScale);
    return sprite;
  }

  effect(kind: ImpactKind | 'dust', pixelScale: number, speed: number): Container | null {
    const fx = new AnimatedSprite({ textures: frames(this.assets, `fx/${kind}`), loop: false, updateAnchor: true });
    fx.animationSpeed = (kind === 'dust' ? 0.2 : 0.4) * speed;
    fx.scale.set(pixelScale);
    fx.onComplete = () => fx.destroy();
    fx.play();
    return fx;
  }
}

/** Style E: the pixel figures as cardboard minis on a tabletop board with a square per slot. */
export class MiniArt extends PixelArt {
  override readonly style: ArtStyle = 'minis';

  override createUnit(spec: UnitArtSpec, tweens: Tweens): UnitView {
    return new MiniUnit(this.assets, spec.typeId, spec.role, spec.enemy, tweens);
  }

  override drawField(layer: Container, f: FieldGeometry): void {
    const g = new Graphics();
    // Wooden table.
    g.rect(0, 0, f.width, f.height).fill(0x5e3a24);
    for (let y = 0; y < f.height; y += 22) g.rect(0, y, f.width, 2).fill({ color: 0x3a2418, alpha: 0.6 });
    for (let y = 11; y < f.height; y += 44) g.rect(0, y, f.width, 1).fill({ color: 0x87573a, alpha: 0.4 });
    // Printed board.
    const pad = 10;
    g.roundRect(pad, pad, f.width - pad * 2, f.height - pad * 2, 10).fill(0x2f4a3a).stroke({ width: 4, color: 0x1a2a20 });
    g.rect(pad, pad, f.width - pad * 2, f.mid - pad).fill({ color: COLORS.enemy, alpha: 0.35 });
    g.moveTo(pad, f.mid).lineTo(f.width - pad, f.mid).stroke({ width: 3, color: 0xf2ead2, alpha: 0.5 });
    // One square per slot.
    const s = f.cell * 0.92;
    for (const slot of f.slots) {
      g.rect(slot.x - s / 2, slot.y - s / 2, s, s).stroke({ width: 2, color: 0xf2ead2, alpha: 0.25 });
    }
    layer.addChild(g);
  }
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBattleArt(style: ArtStyle, icons: Icons, pixel: PixelAssets): BattleArt {
  switch (style) {
    case 'icons':
      return new IconArt(icons);
    case 'pixel':
      return new PixelArt(pixel);
    case 'minis':
      return new MiniArt(pixel);
  }
}
