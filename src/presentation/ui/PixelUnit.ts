import { AnimatedSprite, Container, Graphics, Sprite } from 'pixi.js';
import { frames, type PixelAssets } from '../assets/pixel';
import type { Tweens } from '../Tweens';
import { COLORS } from '../theme';

/** Art rows from the feet (row 44 of the 48 px cell) up to the top of a typical head. */
const FIGURE_HEIGHT = 36;
const FPS = { idle: 5, attack: 20, hit: 12, death: 10 } as const;

/**
 * A unit drawn as a frame-by-frame pixel sprite (idle, attack, hit, death) at an integer zoom,
 * standing on a soft shadow, centred on its position. AnimeJS adds the small melee lunge.
 */
export class PixelUnit extends Container {
  /** The part that lunges; the HP bar and ground shadow stay put. */
  readonly body = new Container();
  private readonly hpBar = new Graphics();
  private readonly shadow: Sprite;
  private readonly sprite: AnimatedSprite;
  private readonly flash: Sprite;
  private zoom = 1;
  private hpRatio = 1;
  private dead = false;

  constructor(
    private readonly assets: PixelAssets,
    private readonly typeId: string,
    private readonly speed: () => number,
    private readonly showHp = true,
  ) {
    super();
    this.shadow = new Sprite(frames(assets, 'shadow')[0]);
    this.shadow.anchor.set(0.5);
    this.sprite = new AnimatedSprite({ textures: frames(assets, `${typeId}/idle`), updateAnchor: true });
    this.flash = new Sprite(this.sprite.texture);
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;
    this.sprite.onFrameChange = () => (this.flash.texture = this.sprite.texture);
    this.body.addChild(this.sprite, this.flash);
    this.addChild(this.shadow, this.body, this.hpBar);
    this.idle(true);
  }

  /** Distance from the origin up to the top of the figure (damage numbers start there). */
  get top(): number {
    return Math.round((FIGURE_HEIGHT / 2) * this.zoom);
  }

  setSize(pixelScale: number): void {
    const z = (this.zoom = pixelScale);
    // The figure is centred on the slot, so the feet sit half a figure below the origin.
    const feet = Math.round((FIGURE_HEIGHT / 2) * z);
    for (const s of [this.sprite, this.flash]) {
      s.scale.set(z);
      s.position.set(0, feet);
    }
    this.shadow.scale.set(z);
    this.shadow.position.set(0, feet);
    this.drawHp();
  }

  setHp(ratio: number): void {
    this.hpRatio = Math.max(0, Math.min(1, ratio));
    this.drawHp();
  }

  setSelected(selected: boolean): void {
    this.sprite.tint = selected ? COLORS.rally : 0xffffff;
  }

  /** Plays the attack towards (dx, dy) and returns the ms until the blow lands. */
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

  private drawHp(): void {
    this.hpBar.clear();
    if (!this.showHp) return;
    const z = this.zoom;
    const w = 22 * z;
    const x = -w / 2;
    const y = Math.round((FIGURE_HEIGHT / 2 + 3) * z);
    this.hpBar.rect(x, y, w, 2 * z).fill(0x000000);
    const color = this.hpRatio > 0.5 ? COLORS.good : this.hpRatio > 0.25 ? COLORS.gold : COLORS.danger;
    if (this.hpRatio > 0) this.hpBar.rect(x, y, Math.max(1, Math.round(w * this.hpRatio)), 2 * z).fill(color);
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
