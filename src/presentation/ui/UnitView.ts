import { Container, Graphics } from 'pixi.js';
import type { Tweens } from '../Tweens';
import { COLORS } from '../theme';

/**
 * A unit on the battlefield, in whichever art style is active. The battle scene positions views and
 * tells them what happened (attack, hit, death); each style decides how that looks.
 */
export abstract class UnitView extends Container {
  /** The part that lunges and squashes; the HP bar and ground shadow stay put. */
  readonly body = new Container();
  protected readonly hpBar = new Graphics();
  private hpRatio = 1;
  private bar = { width: 0, height: 0, y: 0 };

  constructor(private readonly showHp: boolean) {
    super();
    this.addChild(this.body, this.hpBar);
  }

  /** Distance from the view's origin up to the top of its art (damage numbers start there). */
  abstract get top(): number;

  /** `size` is the slot size in screen px; `pixelScale` is the integer zoom pixel styles use. */
  abstract setSize(size: number, pixelScale: number): void;

  /** Plays the attack towards (dx, dy) and returns the ms until a melee blow lands. */
  abstract attack(tweens: Tweens, dx: number, dy: number, ranged: boolean): number;

  abstract hit(tweens: Tweens): void;

  abstract die(tweens: Tweens): void;

  setHp(ratio: number): void {
    this.hpRatio = Math.max(0, Math.min(1, ratio));
    this.drawHp();
  }

  protected setHpBar(width: number, height: number, y: number): void {
    this.bar = { width: Math.round(width), height: Math.round(height), y: Math.round(y) };
    this.drawHp();
  }

  private drawHp(): void {
    this.hpBar.clear();
    const { width: w, height: h, y } = this.bar;
    if (!this.showHp || w === 0) return;
    const x = -Math.round(w / 2);
    this.hpBar.rect(x, y, w, h).fill(0x000000);
    const color = this.hpRatio > 0.5 ? COLORS.good : this.hpRatio > 0.25 ? COLORS.gold : COLORS.danger;
    if (this.hpRatio > 0) this.hpBar.rect(x, y, Math.max(1, Math.round(w * this.hpRatio)), h).fill(color);
  }
}
