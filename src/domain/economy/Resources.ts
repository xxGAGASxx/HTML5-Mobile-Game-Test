/** Currencies in the core loop prototype. Wood, Stone and the rest arrive with the Camp (GDD 08). */
export type Currency = 'gold' | 'food';

export type Resources = Readonly<Record<Currency, number>>;

export const NO_RESOURCES: Resources = { gold: 0, food: 0 };

export function addResources(a: Resources, b: Resources): Resources {
  return { gold: a.gold + b.gold, food: a.food + b.food };
}

export function scaleResources(r: Resources, factor: number): Resources {
  return { gold: Math.floor(r.gold * factor), food: Math.floor(r.food * factor) };
}
