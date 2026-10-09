import { animate, type JSAnimation } from 'animejs';
import { Graphics, Text } from 'pixi.js';
import { Scene } from './Scene';

/** Placeholder first screen proving PixiJS renders and AnimeJS tweens Pixi objects. */
export class BootScene extends Scene {
  private readonly title = new Text({
    text: 'Wreckbound',
    style: { fontFamily: 'monospace', fontSize: 48, fill: 0xf2e6c9, fontWeight: 'bold' },
  });
  private readonly subtitle = new Text({
    text: 'Loading…',
    style: { fontFamily: 'monospace', fontSize: 18, fill: 0x8fb3c4 },
  });
  private readonly marker = new Graphics().rect(-12, -12, 24, 24).fill(0xe0a050);
  private readonly tweens: JSAnimation[] = [];

  constructor() {
    super();
    this.title.anchor.set(0.5);
    this.subtitle.anchor.set(0.5);
    this.addChild(this.marker, this.title, this.subtitle);

    this.title.alpha = 0;
    this.tweens.push(
      animate(this.title, { alpha: 1, duration: 800, ease: 'outQuad' }),
      animate(this.marker, { rotation: Math.PI * 2, duration: 2400, ease: 'linear', loop: true }),
      animate(this.marker.scale, { x: 1.4, y: 1.4, duration: 600, ease: 'inOutSine', loop: true, alternate: true }),
    );
  }

  layout(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.title.position.set(cx, cy - 40);
    this.subtitle.position.set(cx, cy);
    this.marker.position.set(cx, cy + 70);
  }

  override destroy(options?: Parameters<Scene['destroy']>[0]): void {
    for (const tween of this.tweens) tween.revert();
    super.destroy(options);
  }
}
