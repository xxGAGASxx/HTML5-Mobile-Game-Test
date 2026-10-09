import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Resources } from '../../domain/economy';
import { icon, type Icons } from '../assets/icons';
import { formatNumber } from '../format';
import type { Tweens } from '../Tweens';
import { COLORS, FONT } from '../theme';

const HEIGHT = 52;

/** Top bar: Gold | Food, plus a right-aligned caption (wave, power). */
export class ResourceBar extends Container {
  readonly goldIcon: Sprite;
  readonly foodIcon: Sprite;
  private readonly bg = new Graphics();
  private readonly goldText: Text;
  private readonly foodText: Text;
  private readonly caption: Text;
  /** Resting scale of the icons, so overlapping pulses never compound. */
  private readonly iconScale: number;
  private shown: Resources = { gold: 0, food: 0 };
  private readonly counter = { gold: 0, food: 0 };

  constructor(
    icons: Icons,
    private readonly tweens: Tweens,
  ) {
    super();
    const style = { fontFamily: FONT, fontSize: 20, fontWeight: 'bold' as const, fill: COLORS.text };
    this.goldIcon = this.makeIcon(icons, 'two-coins', COLORS.gold);
    this.foodIcon = this.makeIcon(icons, 'meat', COLORS.food);
    this.iconScale = this.goldIcon.scale.x;
    this.goldText = new Text({ text: '0', style });
    this.foodText = new Text({ text: '0', style });
    this.caption = new Text({ text: '', style: { ...style, fontSize: 15, fill: COLORS.muted } });
    for (const t of [this.goldText, this.foodText]) t.anchor.set(0, 0.5);
    this.caption.anchor.set(1, 0.5);
    this.addChild(this.bg, this.goldIcon, this.goldText, this.foodIcon, this.foodText, this.caption);
  }

  static readonly HEIGHT = HEIGHT;

  /** Sets the balance; `animate` counts the numbers up instead of jumping. */
  set(resources: Resources, animate = false): void {
    const from = this.shown;
    this.shown = resources;
    if (!animate) {
      this.counter.gold = resources.gold;
      this.counter.food = resources.food;
      this.render();
      return;
    }
    this.counter.gold = from.gold;
    this.counter.food = from.food;
    this.tweens.play(this.counter, {
      gold: resources.gold,
      food: resources.food,
      duration: 700,
      ease: 'outQuad',
      onUpdate: () => this.render(),
    });
  }

  setCaption(text: string): void {
    this.caption.text = text;
  }

  /** Little bounce when loot lands on an icon. */
  pulse(target: Sprite): void {
    const base = this.iconScale;
    this.tweens.play(target.scale, { x: [base * 1.35, base], y: [base * 1.35, base], duration: 220, ease: 'outQuad' });
  }

  layout(width: number): void {
    this.bg.clear().rect(0, 0, width, HEIGHT).fill(COLORS.panel);
    const cy = HEIGHT / 2;
    this.goldIcon.position.set(24, cy);
    this.goldText.position.set(42, cy);
    this.foodIcon.position.set(132, cy);
    this.foodText.position.set(150, cy);
    this.caption.position.set(width - 12, cy);
  }

  private render(): void {
    this.goldText.text = formatNumber(Math.round(this.counter.gold));
    this.foodText.text = formatNumber(Math.round(this.counter.food));
  }

  private makeIcon(icons: Icons, slug: string, tint: number): Sprite {
    const s = new Sprite(icon(icons, slug));
    s.anchor.set(0.5);
    s.tint = tint;
    s.width = s.height = 26;
    return s;
  }
}
