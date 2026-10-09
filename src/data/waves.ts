import type { Lane, Row } from '../domain/shared';

export interface WaveSlot {
  readonly typeId: string;
  readonly row: Row;
  readonly lane: Lane;
}

// Wreck Coast enemy waves for the core loop prototype. Row 0 is the enemy front line.
const LAYOUTS: readonly (readonly WaveSlot[])[] = [
  [
    { typeId: 'shore-crab', row: 0, lane: 1 },
    { typeId: 'coast-wolf', row: 0, lane: 0 },
  ],
  [
    { typeId: 'wreck-bandit', row: 0, lane: 0 },
    { typeId: 'wreck-bandit', row: 0, lane: 2 },
    { typeId: 'skull-gunner', row: 2, lane: 1 },
  ],
  [
    { typeId: 'shore-crab', row: 0, lane: 1 },
    { typeId: 'coast-wolf', row: 0, lane: 0 },
    { typeId: 'coast-wolf', row: 0, lane: 2 },
    { typeId: 'skull-gunner', row: 2, lane: 1 },
  ],
  [
    { typeId: 'shore-crab', row: 0, lane: 0 },
    { typeId: 'shore-crab', row: 0, lane: 2 },
    { typeId: 'wreck-bandit', row: 0, lane: 1 },
    { typeId: 'skull-gunner', row: 2, lane: 0 },
    { typeId: 'skull-gunner', row: 2, lane: 2 },
  ],
  [
    { typeId: 'shore-crab', row: 0, lane: 0 },
    { typeId: 'shore-crab', row: 0, lane: 1 },
    { typeId: 'shore-crab', row: 0, lane: 2 },
    { typeId: 'coast-wolf', row: 1, lane: 1 },
    { typeId: 'skull-gunner', row: 2, lane: 0 },
    { typeId: 'skull-gunner', row: 2, lane: 2 },
  ],
];

/** Enemy HP and ATK grow by this much per wave past the hand-made ones. */
export const ENDLESS_GROWTH = 1.1;

export interface Wave {
  readonly number: number;
  readonly slots: readonly WaveSlot[];
  /** Multiplier on enemy HP and ATK. */
  readonly strength: number;
}

/** Wave 1 onwards. After the hand-made waves, the last layout repeats and gets stronger. */
export function waveAt(number: number): Wave {
  const index = Math.min(number, LAYOUTS.length) - 1;
  const extra = Math.max(0, number - LAYOUTS.length);
  return { number, slots: LAYOUTS[index], strength: ENDLESS_GROWTH ** extra };
}
