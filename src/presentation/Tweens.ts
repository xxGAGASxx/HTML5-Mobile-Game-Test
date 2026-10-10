import { animate, createTimer, type AnimationParams, type JSAnimation, type TargetsParam, type Timer } from 'animejs';

/** Tracks a scene's AnimeJS tweens so they can all be stopped when the scene goes away. */
export class Tweens {
  private readonly running = new Set<JSAnimation | Timer>();

  /** Durations and delays are divided by `speed`, so 2x battles also animate at 2x. */
  speed = 1;

  play(targets: TargetsParam, params: AnimationParams): JSAnimation {
    const userComplete = params.onComplete;
    const scaled: AnimationParams = { ...params };
    if (typeof params.duration === 'number') scaled.duration = params.duration / this.speed;
    if (typeof params.delay === 'number') scaled.delay = params.delay / this.speed;
    const anim = animate(targets, {
      ...scaled,
      onComplete: (self) => {
        this.running.delete(anim);
        userComplete?.(self);
      },
    });
    this.running.add(anim);
    return anim;
  }

  /** Calls `callback` after `ms` (scaled by speed), unless the scene is torn down first. */
  wait(ms: number, callback: () => void): void {
    if (ms <= 0) {
      callback(); // a zero-length timer completes inside createTimer, before it is assigned
      return;
    }
    const timer = createTimer({
      duration: ms / this.speed,
      onComplete: () => {
        this.running.delete(timer);
        callback();
      },
    });
    this.running.add(timer);
  }

  cancelAll(): void {
    for (const anim of this.running) anim.cancel();
    this.running.clear();
  }
}
