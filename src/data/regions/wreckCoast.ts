import type { BattleSpec, RegionNode, RegionSpec } from '../../application/content';

// Region 1 (GDD 15 MVP): about 12 nodes, 1 ruin, 1 boss. The island is explored from the wreck on
// the south beach up to the Bandit Chief's fort on the northern cliffs.
// scripts/build-map.ts reads this file to bake the island art, so it may only import types.

const crab = 'shore-crab';
const bandit = 'wreck-bandit';
const wolf = 'coast-wolf';
const gunner = 'skull-gunner';

function fight(strength: number, ...slots: [string, 0 | 1 | 2, 0 | 1 | 2][]): BattleSpec {
  return { strength, slots: slots.map(([typeId, row, lane]) => ({ typeId, row, lane })) };
}

const NODES: RegionNode[] = [
  {
    id: 'camp',
    kind: 'camp',
    name: 'Wreck Camp',
    blurb: 'What is left of the Gilded Gull, and everyone who walked away from it.',
    tier: 0,
    battles: [],
    links: ['crab-shallows', 'driftwood-beach'],
    at: { x: 150, y: 600 },
  },
  {
    id: 'crab-shallows',
    kind: 'encounter',
    name: 'Crab Shallows',
    blurb: 'Crabs the size of rowboats, and a wolf that follows them.',
    tier: 1,
    battles: [fight(1, [crab, 0, 1], [wolf, 0, 0])],
    links: ['bandit-lookout'],
    at: { x: 78, y: 540 },
  },
  {
    id: 'driftwood-beach',
    kind: 'encounter',
    name: 'Driftwood Beach',
    blurb: 'A wolf pair picking through the wreckage.',
    tier: 1,
    battles: [fight(1, [wolf, 0, 0], [wolf, 0, 2])],
    links: ['bandit-lookout', 'fishing-rocks'],
    at: { x: 236, y: 546 },
  },
  {
    id: 'fishing-rocks',
    kind: 'resource',
    name: 'Fishing Rocks',
    blurb: 'Good fishing, once the crabs move on. Secured, it keeps the camp in food.',
    tier: 2,
    battles: [fight(1, [crab, 0, 0], [crab, 0, 2], [wolf, 0, 1])],
    produces: { currency: 'food', perHour: 180, capHours: 2 },
    links: [],
    at: { x: 276, y: 468 },
  },
  {
    id: 'bandit-lookout',
    kind: 'encounter',
    name: 'Bandit Lookout',
    blurb: 'Wreckers watching the beach for anything worth taking.',
    tier: 2,
    battles: [fight(1, [bandit, 0, 0], [bandit, 0, 2], [gunner, 2, 1])],
    links: ['wolf-den', 'palm-grove'],
    at: { x: 136, y: 468 },
  },
  {
    id: 'wolf-den',
    kind: 'elite',
    name: 'Wolf Den',
    blurb: 'The whole pack sleeps here. Better loot, slower to return.',
    tier: 3,
    battles: [fight(1.1, [wolf, 0, 0], [wolf, 0, 1], [wolf, 0, 2], [wolf, 1, 1])],
    lootFactor: 1.5,
    links: ['sunken-shrine'],
    at: { x: 52, y: 396 },
  },
  {
    id: 'palm-grove',
    kind: 'encounter',
    name: 'Palm Grove',
    blurb: 'Shade, coconuts, and a crab that does not share.',
    tier: 3,
    battles: [fight(1, [crab, 0, 1], [wolf, 0, 0], [wolf, 0, 2], [gunner, 2, 1])],
    links: ['smugglers-path'],
    at: { x: 196, y: 396 },
  },
  {
    id: 'sunken-shrine',
    kind: 'ruin',
    name: 'Sunken Shrine',
    blurb: 'Three floors down, no rest between them. Retreat keeps what you found.',
    tier: 4,
    battles: [
      fight(1.05, [crab, 0, 1], [wolf, 0, 0], [wolf, 0, 2], [gunner, 2, 1]),
      fight(1.1, [crab, 0, 0], [crab, 0, 2], [bandit, 0, 1], [gunner, 2, 0], [gunner, 2, 2]),
      fight(1.2, [crab, 0, 1], [gunner, 2, 0], [gunner, 2, 1], [gunner, 2, 2]),
    ],
    links: ['cliff-road'],
    at: { x: 72, y: 296 },
  },
  {
    id: 'smugglers-path',
    kind: 'encounter',
    name: "Smugglers' Path",
    blurb: 'A hidden trail up the cliffs, guarded both ways.',
    tier: 4,
    battles: [fight(1.2, [crab, 0, 0], [crab, 0, 2], [bandit, 0, 1], [gunner, 2, 0], [gunner, 2, 2])],
    links: ['cliff-road', 'gunner-nest'],
    at: { x: 232, y: 316 },
  },
  {
    id: 'gunner-nest',
    kind: 'elite',
    name: 'Gunner Nest',
    blurb: 'Dead men with muskets, and a clear view of the path.',
    tier: 5,
    battles: [fight(1.6, [crab, 0, 0], [crab, 0, 2], [bandit, 0, 1], [gunner, 2, 0], [gunner, 2, 1], [gunner, 2, 2])],
    lootFactor: 1.5,
    links: [],
    at: { x: 270, y: 224 },
  },
  {
    id: 'cliff-road',
    kind: 'encounter',
    name: 'Cliff Road',
    blurb: 'The last climb before the fort.',
    tier: 5,
    battles: [fight(1.45, [crab, 0, 0], [crab, 0, 1], [crab, 0, 2], [wolf, 1, 1], [gunner, 2, 0], [gunner, 2, 2])],
    links: ['bandit-fort'],
    at: { x: 150, y: 224 },
  },
  {
    id: 'bandit-fort',
    kind: 'boss',
    name: "Bandit Chief's Fort",
    blurb: 'The Bandit Chief holds the north of the island. Beat him to clear the Wreck Coast.',
    tier: 6,
    battles: [fight(1.7, ['bandit-chief', 0, 1], [bandit, 0, 0], [bandit, 0, 2], [wolf, 1, 1], [gunner, 2, 0], [gunner, 2, 2])],
    links: [],
    at: { x: 160, y: 104 },
  },
];

export const WRECK_COAST: RegionSpec = { id: 'wreck-coast', name: 'Wreck Coast', nodes: NODES };
