import { Graphics, Sprite } from 'pixi.js';
import type { Role } from '../../domain/shared';
import { icon, type Icons } from '../assets/icons';
import type { Tweens } from '../Tweens';
import { COLORS, ROLE_COLORS } from '../theme';
import { UnitView } from './UnitView';

/** Style A: role-coloured disc with a game-icons.net silhouette, HP bar underneath. */
export class UnitToken extends UnitView {
  private readonly disc = new Graphics();
  private readonly flash = new Graphics();
  private readonly sprite: Sprite;
  private size = 0;

  constructor(
    icons: Icons,
    iconSlug: string,
    private readonly role: Role,
    private readonly enemy: boolean,
    showHp = true,
  ) {
    super(showHp);
    this.sprite = new Sprite(icon(icons, iconSlug));
    this.sprite.anchor.set(0.5);
    this.sprite.tint = 0xffffff;
    this.flash.alpha = 0;
    this.body.addChild(this.disc, this.sprite, this.flash);
  }

  get radius(): number {
    return this.size / 2;
  }

  get top(): number {
    return this.radius;
  }

  setSize(size: number): void {
    this.size = size;
    const r = size / 2;
    // Enemies get a dark disc with a role-coloured ring; player units a solid role disc.
    this.disc
      .clear()
      .circle(0, 0, r)
      .fill(this.enemy ? COLORS.enemy : ROLE_COLORS[this.role])
      .stroke({ width: Math.max(2, size * 0.06), color: this.enemy ? ROLE_COLORS[this.role] : 0x000000, alpha: this.enemy ? 1 : 0.4 });
    this.flash.clear().circle(0, 0, r).fill(0xffffff);
    this.sprite.width = this.sprite.height = size * 0.62;
    this.setHpBar(size * 0.9, Math.max(4, size * 0.09), size / 2 + 4);
  }

  setSelected(selected: boolean): void {
    this.sprite.tint = selected ? COLORS.rally : 0xffffff;
  }

  attack(tweens: Tweens, dx: number, dy: number, ranged: boolean): number {
    if (ranged) return 0;
    // Melee: lunge a third of the way to the target and back; the hit lands at the peak.
    tweens.play(this.body, { x: [0, dx * 0.35, 0], y: [0, dy * 0.35, 0], duration: 240, ease: 'outQuad' });
    return 110;
  }

  hit(tweens: Tweens): void {
    tweens.play(this.flash, { alpha: [0.85, 0], duration: 160, ease: 'outQuad' });
    tweens.play(this.body.scale, { x: [1.18, 1], y: [0.84, 1], duration: 200, ease: 'outBack' });
  }

  die(tweens: Tweens): void {
    tweens.play(this, { alpha: 0, duration: 380, ease: 'inQuad' });
    tweens.play(this.scale, { x: 0.5, y: 0.5, duration: 380, ease: 'inQuad' });
  }
}
