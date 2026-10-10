import type { UnitType } from '../domain/army';

// Placeholder tuning for the core loop prototype. Sprites are keyed by id (art/pixel/units.ts).

export const PLAYER_UNITS: readonly UnitType[] = [
  {
    id: 'bosun-marla',
    name: 'Bosun Marla',
    role: 'guard',
    stats: { hp: 240, atk: 9, spd: 0.8, arm: 30, ranged: false },
  },
  {
    id: 'gull-deckhands',
    name: 'Gull Deckhands',
    role: 'fighter',
    stats: { hp: 130, atk: 12, spd: 1.0, arm: 10, ranged: false },
  },
  {
    id: 'driftwood-wardens',
    name: 'Driftwood Wardens',
    role: 'guard',
    stats: { hp: 200, atk: 6, spd: 0.8, arm: 40, ranged: false },
  },
  {
    id: 'castaway-archers',
    name: 'Castaway Archers',
    role: 'shooter',
    stats: { hp: 80, atk: 11, spd: 1.0, arm: 0, ranged: true },
  },
  {
    id: 'tide-mystics',
    name: 'Tide Mystics',
    role: 'caster',
    stats: { hp: 70, atk: 18, spd: 0.6, arm: 0, ranged: true },
  },
];

export const ENEMY_UNITS: readonly UnitType[] = [
  {
    id: 'shore-crab',
    name: 'Shore Crab',
    role: 'guard',
    stats: { hp: 150, atk: 6, spd: 0.8, arm: 40, ranged: false },
  },
  {
    id: 'wreck-bandit',
    name: 'Wreck Bandit',
    role: 'fighter',
    stats: { hp: 100, atk: 10, spd: 1.0, arm: 10, ranged: false },
  },
  {
    id: 'coast-wolf',
    name: 'Coast Wolf',
    role: 'fighter',
    stats: { hp: 80, atk: 8, spd: 1.4, arm: 0, ranged: false },
  },
  {
    id: 'skull-gunner',
    name: 'Skull Gunner',
    role: 'shooter',
    stats: { hp: 70, atk: 12, spd: 0.7, arm: 0, ranged: true },
  },
];

/** The army the player starts with, best slot picked automatically. */
export const STARTING_ARMY: readonly string[] = ['bosun-marla', 'gull-deckhands'];
