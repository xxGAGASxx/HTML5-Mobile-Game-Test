import { Application } from 'pixi.js';
import type { Scene } from './scenes/Scene';

const MAX_RESOLUTION = 2; // performance budget: cap devicePixelRatio at 2

/** Owns the PixiJS Application and the current scene. */
export class Game {
  readonly app = new Application();
  private scene: Scene | null = null;

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      background: 0x0b1d2a,
      antialias: false, // pixel-art friendly
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    });
    parent.appendChild(this.app.canvas);
    this.app.renderer.on('resize', (w: number, h: number) => this.scene?.layout(w, h));
    this.app.ticker.add((ticker) => this.scene?.update(ticker.deltaMS));
  }

  show(scene: Scene): void {
    if (this.scene) {
      this.app.stage.removeChild(this.scene);
      this.scene.destroy({ children: true });
    }
    this.scene = scene;
    this.app.stage.addChild(scene);
    scene.layout(this.app.screen.width, this.app.screen.height);
  }
}
