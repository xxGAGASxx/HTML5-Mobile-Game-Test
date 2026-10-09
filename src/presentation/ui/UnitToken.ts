import { Container, Graphics, Sprite } from 'pixi.js';
import type { Role } from '../../domain/shared';
import { icon, type Icons } from '../assets/icons';
import { COLORS, ROLE_COLORS } from '../theme';

/** A unit on the field: role-coloured disc, icon silhouette, HP bar underneath. */
export class UnitToken extends Container {
  readonly body = new Container();
  private readonly disc = new Graphics();
  private readonly flash = new Graphics();
  private readonly hpBar = new Graphics();
  private readonly sprite: Sprite;
  private size = 0;
  private hpRatio = 1;

  constructor(
    icons: Icons,
    iconSlug: string,
    private readonly role: Role,
    private readonly enemy: boolean,
    private readonly showHp = true,
  ) {
    super();
    this.sprite = new Sprite(icon(icons, iconSlug));
    this.sprite.anchor.set(0.5);
    this.sprite.tint = 0xffffff;
    this.flash.alpha = 0;
    this.body.addChild(this.disc, this.sprite, this.flash);
    this.addChild(this.body, this.hpBar);
  }

  get radius(): number {
    return this.size / 2;
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
    this.drawHp();
  }

  setHp(ratio: number): void {
    this.hpRatio = Math.max(0, Math.min(1, ratio));
    this.drawHp();
  }

  setSelected(selected: boolean): void {
    this.sprite.tint = selected ? COLORS.rally : 0xffffff;
  }

  get flashLayer(): Graphics {
    return this.flash;
  }

  private drawHp(): void {
    this.hpBar.clear();
    if (!this.showHp || this.size === 0) return;
    const w = this.size * 0.9;
    const h = Math.max(4, this.size * 0.09);
    const y = this.size / 2 + 4;
    this.hpBar.rect(-w / 2, y, w, h).fill(0x000000);
    const color = this.hpRatio > 0.5 ? COLORS.good : this.hpRatio > 0.25 ? COLORS.gold : COLORS.danger;
    if (this.hpRatio > 0) this.hpBar.rect(-w / 2, y, w * this.hpRatio, h).fill(color);
  }
}
