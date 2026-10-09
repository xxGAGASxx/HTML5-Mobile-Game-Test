import { AnimatedSprite, Sprite } from 'pixi.js';
import { frames, type PixelAssets } from '../assets/pixel';
import type { Tweens } from '../Tweens';
import { UnitView } from './UnitView';

/** Art rows from the feet (row 44 of the 48 px cell) up to the top of a typical head. */
const FIGURE_HEIGHT = 36;
const FPS = { idle: 5, attack: 20, hit: 12, death: 10 } as const;

/**
 * Style B: frame-by-frame pixel sprite (idle, attack, hit, death) at an integer zoom, standing on a
 * soft shadow. AnimeJS still adds the small lunge so attacks read at a glance.
 */
export class PixelUnit extends UnitView {
  private readonly shadow: Sprite;
  private readonly sprite: AnimatedSprite;
  private readonly flash: Sprite;
  private zoom = 1;
  private dead = false;

  constructor(
    private readonly assets: PixelAssets,
    private readonly typeId: string,
    private readonly speed: () => number,
    showHp = true,
  ) {
    super(showHp);
    this.shadow = new Sprite(frames(assets, 'shadow')[0]);
    this.sprite = new AnimatedSprite({ textures: frames(assets, `${typeId}/idle`), updateAnchor: true });
    this.flash = new Sprite(this.sprite.texture);
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;
    this.sprite.onFrameChange = () => (this.flash.texture = this.sprite.texture);
    this.addChildAt(this.shadow, 0);
    this.body.addChild(this.sprite, this.flash);
    this.idle(true);
  }

  get top(): number {
    return Math.round((FIGURE_HEIGHT / 2) * this.zoom);
  }

  setSize(_size: number, pixelScale: number): void {
    const z = (this.zoom = pixelScale);
    // The figure is centred on the slot, so the feet sit half a figure below the origin.
    const feet = Math.round((FIGURE_HEIGHT / 2) * z);
    for (const s of [this.sprite, this.flash]) {
      s.scale.set(z);
      s.position.set(0, feet);
    }
    this.shadow.anchor.set(0.5);
    this.shadow.scale.set(z);
    this.shadow.position.set(0, feet);
    this.setHpBar(22 * z, 2 * z, feet + 3 * z);
  }

  attack(tweens: Tweens, dx: number, dy: number, ranged: boolean): number {
    this.play('attack', false, () => this.idle());
    if (!ranged) tweens.play(this.body, { x: [0, dx * 0.15, 0], y: [0, dy * 0.15, 0], duration: 300, ease: 'outQuad' });
    // The blow lands on the 4th attack frame.
    return Math.round((3 / FPS.attack) * 1000);
  }

  hit(tweens: Tweens): void {
    if (this.dead) return;
    this.play('hit', false, () => this.idle());
    tweens.play(this.flash, { alpha: [0.9, 0], duration: 180, ease: 'outQuad' });
  }

  die(tweens: Tweens): void {
    this.dead = true;
    this.play('death', false);
    this.hpBar.visible = false;
    tweens.play(this, { alpha: 0, duration: 300, delay: 900, ease: 'inQuad' });
  }

  private idle(randomStart = false): void {
    if (this.dead) return;
    this.play('idle', true);
    // Desync idle loops so a squad doesn't breathe in lockstep.
    if (randomStart) this.sprite.gotoAndPlay(Math.floor(Math.random() * this.sprite.totalFrames));
  }

  private play(anim: keyof typeof FPS, loop: boolean, onDone?: () => void): void {
    this.sprite.textures = frames(this.assets, `${this.typeId}/${anim}`);
    this.sprite.loop = loop;
    this.sprite.animationSpeed = (FPS[anim] / 60) * this.speed();
    this.sprite.onComplete = onDone;
    this.sprite.gotoAndPlay(0);
  }
}
