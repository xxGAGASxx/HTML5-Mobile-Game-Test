import type { Resources } from './Resources';

/** Each extra copy of a unit type costs this much more than the last. */
export const HIRE_GROWTH = 1.35;
/** Each training level costs this much more than the last. */
export const TRAIN_GROWTH = 1.5;

function grow(base: Resources, factor: number): Resources {
  // Rounded to 5 so prices read cleanly; a non-zero price never rounds down to free.
  const round5 = (n: number) => (n === 0 ? 0 : Math.max(5, Math.round((n * factor) / 5) * 5));
  return { gold: round5(base.gold), food: round5(base.food) };
}

/** Hire price for the next copy of a unit type. */
export function hirePrice(base: Resources, hiredBefore: number): Resources {
  return grow(base, HIRE_GROWTH ** hiredBefore);
}

/** Price to train a unit type from `level` to `level + 1`. */
export function trainPrice(base: Resources, level: number): Resources {
  return grow(base, TRAIN_GROWTH ** (level - 1));
}
