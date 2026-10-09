import { Container } from 'pixi.js';

/** A full-screen view. Scenes render state and forward input; they never mutate domain state directly. */
export abstract class Scene extends Container {
  /** Called whenever the screen size changes, and once right after the scene is shown. */
  abstract layout(width: number, height: number): void;

  /** Called every frame with the real time elapsed since the last frame. */
  update(_deltaMs: number): void {}
}
