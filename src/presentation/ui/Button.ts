import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { COLORS, FONT } from '../theme';

export interface ButtonOptions {
  label: string;
  width: number;
  /** At least 44 px so it is a comfortable touch target (GDD 11). */
  height?: number;
  color?: number;
  icon?: Texture;
  fontSize?: number;
  onTap: () => void;
}

export class Button extends Container {
  private readonly bg = new Graphics();
  private readonly text: Text;
  private readonly iconSprite?: Sprite;
  private isEnabled = true;
  private w: number;
  private readonly h: number;
  private readonly color: number;

  constructor(options: ButtonOptions) {
    super();
    this.w = options.width;
    this.h = Math.max(44, options.height ?? 48);
    this.color = options.color ?? COLORS.rally;
    this.text = new Text({
      text: options.label,
      style: { fontFamily: FONT, fontSize: options.fontSize ?? 18, fontWeight: 'bold', fill: COLORS.background },
    });
    this.text.anchor.set(0.5);
    this.addChild(this.bg);
    if (options.icon) {
      this.iconSprite = new Sprite(options.icon);
      this.iconSprite.anchor.set(0.5);
      this.iconSprite.tint = COLORS.background;
      this.addChild(this.iconSprite);
    }
    this.addChild(this.text);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', (e) => {
      e.stopPropagation();
      if (this.isEnabled) options.onTap();
    });
    this.on('pointerdown', () => this.isEnabled && this.scale.set(0.96));
    this.on('pointerup', () => this.scale.set(1));
    this.on('pointerupoutside', () => this.scale.set(1));
    this.draw();
  }

  get enabled(): boolean {
    return this.isEnabled;
  }

  set enabled(value: boolean) {
    if (value === this.isEnabled) return;
    this.isEnabled = value;
    this.cursor = value ? 'pointer' : 'default';
    this.draw();
  }

  set label(value: string) {
    this.text.text = value;
    this.draw();
  }

  resize(width: number): void {
    this.w = width;
    this.draw();
  }

  get buttonWidth(): number {
    return this.w;
  }

  get buttonHeight(): number {
    return this.h;
  }

  private draw(): void {
    const { w, h } = this;
    this.bg
      .clear()
      .roundRect(-w / 2, -h / 2, w, h, 10)
      .fill(this.isEnabled ? this.color : COLORS.disabled)
      .stroke({ width: 2, color: 0x000000, alpha: 0.35 });
    this.text.style.fill = this.isEnabled ? COLORS.background : COLORS.muted;
    if (this.iconSprite) {
      const size = this.h * 0.55;
      this.iconSprite.width = this.iconSprite.height = size;
      const gap = 8;
      const total = size + gap + this.text.width;
      this.iconSprite.x = -total / 2 + size / 2;
      this.text.x = this.iconSprite.x + size / 2 + gap + this.text.width / 2;
      this.iconSprite.tint = this.isEnabled ? COLORS.background : COLORS.muted;
    } else {
      this.text.x = 0;
    }
  }
}
