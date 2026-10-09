import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { JSAnimation } from 'animejs';
import type { Role } from '../../domain/shared';
import { frames, type PixelAssets } from '../assets/pixel';
import type { Tweens } from '../Tweens';
import { COLORS, ROLE_COLORS } from '../theme';
import { UnitView } from './UnitView';

const FIGURE_HEIGHT = 36;

/**
 * Style E: the pixel figure printed on a cardboard standee on a round base, like a tabletop mini.
 * There is no frame animation; all motion is AnimeJS tilting, hopping and toppling the standee.
 */
export class MiniUnit extends UnitView {
  private readonly base = new Graphics();
  /** Tilted by attacks, hits and death; the standee inside it sways on its own. */
  private readonly tilt = new Container();
  private readonly standee = new Container();
  private readonly flash: Sprite;
  private sway: JSAnimation | null = null;
  private zoom = 1;
  private feet = 0;

  constructor(
    assets: PixelAssets,
    typeId: string,
    private readonly role: Role,
    private readonly enemy: boolean,
    private readonly tweens: Tweens,
    showHp = true,
  ) {
    super(showHp);
    const texture: Texture = frames(assets, `${typeId}/mini`)[0]!;
    this.standee.addChild(new Sprite(texture));
    this.flash = new Sprite(texture);
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;
    this.standee.addChild(this.flash);
    this.addChildAt(this.base, 0);
    this.tilt.addChild(this.standee);
    this.body.addChild(this.tilt);
  }

  get top(): number {
    return Math.round((FIGURE_HEIGHT / 2 + 2) * this.zoom);
  }

  setSize(_size: number, pixelScale: number): void {
    const z = (this.zoom = pixelScale);
    this.feet = Math.round((FIGURE_HEIGHT / 2) * z);
    this.standee.scale.set(z);
    this.tilt.position.set(0, this.feet);
    const rx = 15 * z;
    const ry = 5 * z;
    const color = this.enemy ? COLORS.enemy : ROLE_COLORS[this.role];
    this.base
      .clear()
      .ellipse(0, this.feet + z * 1.5, rx, ry)
      .fill(0x000000)
      .ellipse(0, this.feet, rx, ry)
      .fill(color)
      .stroke({ width: z, color: this.enemy ? ROLE_COLORS[this.role] : 0xffffff, alpha: 0.5 });
    this.setHpBar(22 * z, 2 * z, this.feet + 6 * z + 2);
    this.startSway();
  }

  attack(tweens: Tweens, dx: number, dy: number): number {
    // Hop towards the target, tilting into the blow.
    const lean = (dx === 0 ? 1 : Math.sign(dx)) * 0.28;
    tweens.play(this.body, { x: [0, dx * 0.3, 0], y: [0, dy * 0.3 - 6 * this.zoom, 0], duration: 300, ease: 'outQuad' });
    tweens.play(this.tilt, { rotation: [0, lean, 0], duration: 300, ease: 'outQuad' });
    return 140;
  }

  hit(tweens: Tweens): void {
    tweens.play(this.flash, { alpha: [0.9, 0], duration: 180, ease: 'outQuad' });
    tweens.play(this.tilt, { rotation: [0.32, -0.2, 0.1, 0], duration: 420, ease: 'outQuad' });
  }

  die(tweens: Tweens): void {
    this.stopSway();
    this.hpBar.visible = false;
    tweens.play(this.tilt, { rotation: (this.enemy ? -1 : 1) * 1.5, duration: 450, ease: 'outBounce' });
    tweens.play(this, { alpha: 0, duration: 300, delay: 800, ease: 'inQuad' });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.stopSway();
    super.destroy(options);
  }

  private startSway(): void {
    if (this.sway) return;
    const phase = Math.random() * 0.06 - 0.03;
    this.standee.rotation = phase;
    this.sway = this.tweens.play(this.standee, { rotation: [-0.035, 0.035], duration: 900 + Math.random() * 300, loop: true, alternate: true, ease: 'inOutSine' });
  }

  private stopSway(): void {
    if (this.sway) this.tweens.cancel(this.sway);
    this.sway = null;
  }
}
