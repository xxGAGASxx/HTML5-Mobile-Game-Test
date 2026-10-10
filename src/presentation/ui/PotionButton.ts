import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { COLORS, FONT } from '../theme';

/** Square battle button for a potion: icon, how many are left, and a cooldown shade that drains away. */
export class PotionButton extends Container {
  static readonly SIZE = 56;
  private readonly bg = new Graphics();
  private readonly shade = new Graphics();
  private readonly iconSprite: Sprite;
  private readonly badge = new Graphics();
  private readonly countText: Text;
  private isEnabled = true;

  constructor(
    texture: Texture,
    private readonly color: number,
    onTap: () => void,
  ) {
    super();
    const size = PotionButton.SIZE;
    this.iconSprite = new Sprite(texture);
    this.iconSprite.anchor.set(0.5);
    this.iconSprite.width = this.iconSprite.height = size * 0.62;
    this.countText = new Text({
      text: '0',
      style: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: COLORS.text, padding: 2 },
    });
    this.countText.anchor.set(0.5);
    this.countText.position.set(size / 2 - 8, -size / 2 + 8);
    this.addChild(this.bg, this.iconSprite, this.shade, this.badge, this.countText);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', (e) => {
      e.stopPropagation();
      if (this.isEnabled) onTap();
    });
    this.on('pointerdown', (e) => {
      e.stopPropagation(); // never also counts as a rally tap on the field
      if (this.isEnabled) this.scale.set(0.94);
    });
    this.on('pointerup', () => this.scale.set(1));
    this.on('pointerupoutside', () => this.scale.set(1));
    this.draw();
  }

  /** `cooldown` is the share of the cooldown still to run (1 just used, 0 ready). */
  set(count: number, enabled: boolean, cooldown: number): void {
    const text = String(count);
    if (this.countText.text !== text) this.countText.text = text;
    if (enabled !== this.isEnabled) {
      this.isEnabled = enabled;
      this.cursor = enabled ? 'pointer' : 'default';
      this.draw();
    }
    const size = PotionButton.SIZE;
    const h = (size - 4) * Math.min(1, Math.max(0, cooldown));
    this.shade.clear();
    if (h > 0) this.shade.roundRect(-size / 2 + 2, -size / 2 + 2, size - 4, h, 8).fill({ color: 0x000000, alpha: 0.55 });
  }

  private draw(): void {
    const size = PotionButton.SIZE;
    this.bg
      .clear()
      .roundRect(-size / 2, -size / 2, size, size, 10)
      .fill(this.isEnabled ? COLORS.panelLight : COLORS.disabled)
      .stroke({ width: 2, color: this.isEnabled ? this.color : 0x000000, alpha: this.isEnabled ? 1 : 0.35 });
    this.iconSprite.tint = this.isEnabled ? this.color : COLORS.muted;
    this.badge
      .clear()
      .circle(size / 2 - 8, -size / 2 + 8, 10)
      .fill(COLORS.background)
      .stroke({ width: 2, color: this.isEnabled ? this.color : COLORS.muted });
  }
}
