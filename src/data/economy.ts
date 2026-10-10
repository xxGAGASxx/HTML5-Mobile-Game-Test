import type { Resources } from '../domain/economy';

// Placeholder economy for the core loop prototype (GDD 08). Tune with `npm run sim`.

export const STARTING_RESOURCES: Resources = { gold: 30, food: 10 };

/** Loot each enemy drops when defeated, before the wave multiplier. */
export const ENEMY_BOUNTY: Readonly<Record<string, Resources>> = {
  'shore-crab': { gold: 8, food: 4 },
  'wreck-bandit': { gold: 10, food: 2 },
  'coast-wolf': { gold: 6, food: 6 },
  'skull-gunner': { gold: 12, food: 2 },
  'bandit-chief': { gold: 60, food: 20 },
};

/** Extra loot for winning a battle at a node of this tier (wins only). */
export function clearBonus(tier: number): Resources {
  return { gold: 15 + 5 * tier, food: 5 + 2 * tier };
}

/** Income grows a little each tier so deeper nodes keep paying for hires. */
export const LOOT_GROWTH_PER_TIER = 1.08;

/** Chest at the bottom of a ruin. */
export function ruinTreasure(tier: number): Resources {
  return { gold: 60 * tier, food: 20 * tier };
}

/** Auto-clearing a Trivial node pays half its loot (GDD 04). */
export const AUTO_CLEAR_SHARE = 0.5;

/** Tavern stock: what can be hired, and the base price of the first copy. */
export const TAVERN: readonly { typeId: string; base: Resources }[] = [
  { typeId: 'gull-deckhands', base: { gold: 50, food: 15 } },
  { typeId: 'castaway-archers', base: { gold: 80, food: 20 } },
  { typeId: 'driftwood-wardens', base: { gold: 90, food: 30 } },
  { typeId: 'tide-mystics', base: { gold: 110, food: 30 } },
];

/** Price to train each unit type from level 1 to 2; later levels grow by TRAIN_GROWTH. */
export const TRAIN_BASE: Readonly<Record<string, Resources>> = {
  'bosun-marla': { gold: 40, food: 10 },
  'gull-deckhands': { gold: 35, food: 10 },
  'castaway-archers': { gold: 45, food: 15 },
  'driftwood-wardens': { gold: 45, food: 15 },
  'tide-mystics': { gold: 55, food: 15 },
};
