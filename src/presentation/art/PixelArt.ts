import { AnimatedSprite, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Role } from '../../domain/shared';
import { frames, type PixelAssets } from '../assets/pixel';
import type { Tweens } from '../Tweens';
import { PixelUnit } from '../ui/PixelUnit';

export interface UnitArtSpec {
  typeId: string;
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

/** Integer zoom for pixel art: 48 px art cells land near the slot size. */
export function pixelScaleFor(cell: number): number {
  return Math.max(1, Math.round(cell / 42));
}

export function impactKind(spec: UnitArtSpec, ranged: boolean): ImpactKind {
  if (!ranged) return 'slash';
  return spec.role === 'caster' ? 'magic' : 'spark';
}

/** Battle visuals in the game's pixel art: units, the coast battlefield, projectiles and effects. */
export class PixelArt {
  constructor(private readonly assets: PixelAssets) {}

  createUnit(spec: UnitArtSpec, tweens: Tweens): PixelUnit {
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

  /** A projectile pointing right (+x); the scene rotates it towards the target. */
  projectile(spec: UnitArtSpec, pixelScale: number): Container {
    const kind = spec.typeId === 'skull-gunner' ? 'fx/ball' : spec.role === 'caster' ? 'fx/bolt' : 'fx/arrow';
    const textures = frames(this.assets, kind);
    const sprite = textures.length > 1 ? new AnimatedSprite({ textures, animationSpeed: 0.3, autoPlay: true }) : new Sprite(textures[0]);
    sprite.anchor.set(0.5);
    sprite.scale.set(pixelScale);
    return sprite;
  }

  /** A one-shot effect that removes itself when its animation ends. */
  effect(kind: ImpactKind | 'dust', pixelScale: number, speed: number): Container {
    const fx = new AnimatedSprite({ textures: frames(this.assets, `fx/${kind}`), loop: false, updateAnchor: true });
    fx.animationSpeed = (kind === 'dust' ? 0.2 : 0.4) * speed;
    fx.scale.set(pixelScale);
    fx.onComplete = () => fx.destroy();
    fx.play();
    return fx;
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
