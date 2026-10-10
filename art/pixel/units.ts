import type { PixelCanvas } from './canvas.ts';
import { drawCrab, drawWolf, type CreaturePose } from './creatures.ts';
import { CELL, drawHumanoid, type Pose, type Recipe } from './humanoid.ts';
import { RAMPS } from './palette.ts';

/** Animation set every unit ships with (GDD 12): idle 4f, attack 6f, hit 2f, death 6f. */
export const ANIMS = ['idle', 'attack', 'hit', 'death'] as const;
export type Anim = (typeof ANIMS)[number];
export type UnitFrames = Record<Anim, PixelCanvas[]>;

// Keys match UnitType ids in src/data/units.ts.
const RECIPES: Record<string, Recipe> = {
  // Guard: the bosun, blue coat, round shield and cutlass.
  'bosun-marla': {
    skin: RAMPS.skinTan,
    hair: { style: 'braid', ramp: RAMPS.hairRed },
    headgear: { kind: 'bandana', ramp: RAMPS.blue },
    torso: { style: 'coat', ramp: RAMPS.blue, accent: RAMPS.gold },
    belt: RAMPS.leather,
    legs: RAMPS.canvas,
    boots: RAMPS.leather,
    weapon: 'cutlass',
    shield: { kind: 'round', ramp: RAMPS.wood, accent: RAMPS.blue },
  },
  // Fighter: striped deckhand with a red headscarf, bare arms and a cutlass.
  'gull-deckhands': {
    skin: RAMPS.skin,
    hair: { style: 'spiky', ramp: RAMPS.hairBrown },
    headgear: { kind: 'bandana', ramp: RAMPS.red },
    torso: { style: 'striped', ramp: RAMPS.cloth, accent: RAMPS.red },
    bareArms: true,
    belt: RAMPS.leather,
    legs: RAMPS.navy,
    boots: RAMPS.leather,
    weapon: 'sword',
  },
  // Guard: helmeted warden behind a driftwood tower shield, with a spear.
  'driftwood-wardens': {
    skin: RAMPS.skin,
    headgear: { kind: 'helmet', ramp: RAMPS.steel, trim: RAMPS.blue },
    torso: { style: 'plate', ramp: RAMPS.steel, accent: RAMPS.blue },
    belt: RAMPS.leather,
    legs: RAMPS.leather,
    boots: RAMPS.steel,
    weapon: 'spear',
    shield: { kind: 'tower', ramp: RAMPS.driftwood, accent: RAMPS.blue },
  },
  // Shooter: green-hooded archer.
  'castaway-archers': {
    skin: RAMPS.skin,
    hair: { style: 'short', ramp: RAMPS.hairBrown },
    headgear: { kind: 'hood', ramp: RAMPS.green },
    torso: { style: 'tunic', ramp: RAMPS.leather, accent: RAMPS.green },
    cape: RAMPS.green,
    belt: RAMPS.leather,
    legs: RAMPS.green,
    boots: RAMPS.leather,
    weapon: 'bow',
  },
  // Caster: purple-robed mystic with a tide-glass staff.
  'tide-mystics': {
    skin: RAMPS.skin,
    hair: { style: 'long', ramp: RAMPS.hairBlond },
    torso: { style: 'robe', ramp: RAMPS.purple, accent: RAMPS.gold },
    cape: RAMPS.purple,
    belt: RAMPS.gold,
    legs: RAMPS.purple,
    boots: RAMPS.leather,
    weapon: 'staff',
  },
  // Enemy fighter: masked wreck bandit in dark leathers.
  'wreck-bandit': {
    skin: RAMPS.skinTan,
    face: 'mask',
    mask: RAMPS.red,
    hair: { style: 'spiky', ramp: RAMPS.hairDark },
    torso: { style: 'tunic', ramp: RAMPS.dark, accent: RAMPS.leather },
    cape: RAMPS.dark,
    belt: RAMPS.leather,
    legs: RAMPS.dark,
    boots: RAMPS.leather,
    weapon: 'cutlass',
  },
  // Enemy shooter: skeleton pirate with a musket (undead palette, blood-red accent).
  'skull-gunner': {
    skin: RAMPS.bone,
    face: 'skull',
    headgear: { kind: 'tricorn', ramp: RAMPS.dark, trim: RAMPS.red },
    torso: { style: 'ribs', ramp: RAMPS.dark },
    bareArms: true,
    belt: RAMPS.red,
    legs: RAMPS.navy,
    boots: RAMPS.dark,
    weapon: 'musket',
  },
};

type PoseSet = Record<Anim, Pose[]>;

function meleePoses(): PoseSet {
  const rest: Pose = { hand: [31, 32], angle: 150, off: [16, 31] };
  return {
    idle: [rest, rest, { ...rest, bodyY: 1 }, { ...rest, bodyY: 1, angle: 148 }],
    attack: [
      { ...rest, bodyX: -1, bodyY: 1, hand: [31, 27], angle: 60 },
      { ...rest, bodyX: -1, hand: [30, 20], angle: -20, stepR: 1 },
      { ...rest, bodyX: 1, hand: [32, 24], angle: 70, smear: [-20, 60] },
      { ...rest, bodyX: 2, bodyY: 1, hand: [33, 30], angle: 125, smear: [40, 115] },
      { ...rest, bodyX: 1, bodyY: 1, hand: [31, 33], angle: 165 },
      rest,
    ],
    hit: [
      { ...rest, bodyX: -2, eyes: 'closed', angle: 165 },
      { ...rest, bodyX: -1, eyes: 'closed', angle: 158 },
    ],
    death: deathPoses(rest),
  };
}

function spearPoses(): PoseSet {
  const rest: Pose = { hand: [31, 31], angle: 4, off: [16, 31] };
  return {
    idle: [rest, rest, { ...rest, bodyY: 1 }, { ...rest, bodyY: 1 }],
    attack: [
      { ...rest, hand: [30, 32], angle: 20 },
      { ...rest, bodyX: -1, hand: [29, 33], angle: 28, stepL: 1 },
      { ...rest, bodyX: 1, hand: [33, 26], angle: 30 },
      { ...rest, bodyX: 2, hand: [35, 22], angle: 32, smear: [28, 36] },
      { ...rest, bodyX: 1, hand: [33, 27], angle: 22 },
      rest,
    ],
    hit: [
      { ...rest, bodyX: -2, eyes: 'closed', angle: -6 },
      { ...rest, bodyX: -1, eyes: 'closed', angle: 0 },
    ],
    death: deathPoses(rest),
  };
}

function bowPoses(): PoseSet {
  const rest: Pose = { hand: [32, 30], angle: 90, off: [16, 31] };
  const aim = (power: number, extra: Partial<Pose> = {}): Pose => ({
    hand: [33, 25],
    angle: 40,
    power,
    off: [Math.round(33 - Math.sin((40 * Math.PI) / 180) * (2 + power * 6)), Math.round(25 + Math.cos((40 * Math.PI) / 180) * (2 + power * 6))],
    ...extra,
  });
  return {
    idle: [rest, rest, { ...rest, bodyY: 1 }, { ...rest, bodyY: 1 }],
    attack: [aim(0), aim(0.4), aim(0.8), aim(1, { bodyX: -1 }), aim(0, { bodyX: 1 }), { ...rest, hand: [32, 28], angle: 70 }],
    hit: [
      { ...rest, bodyX: -2, eyes: 'closed' },
      { ...rest, bodyX: -1, eyes: 'closed' },
    ],
    death: deathPoses(rest),
  };
}

function staffPoses(): PoseSet {
  const rest: Pose = { hand: [31, 31], angle: 0, off: [16, 31] };
  return {
    idle: [rest, { ...rest, power: 0.15 }, { ...rest, bodyY: 1, power: 0.3 }, { ...rest, bodyY: 1, power: 0.15 }],
    attack: [
      { ...rest, hand: [31, 27], power: 0.3 },
      { ...rest, hand: [31, 21], power: 0.6, off: [18, 26] },
      { ...rest, hand: [32, 19], angle: 8, power: 1, off: [17, 21] },
      { ...rest, bodyX: 1, hand: [32, 22], angle: 12, power: 0.7, off: [18, 24] },
      { ...rest, hand: [31, 27], power: 0.3 },
      rest,
    ],
    hit: [
      { ...rest, bodyX: -2, eyes: 'closed', angle: -8 },
      { ...rest, bodyX: -1, eyes: 'closed', angle: -4 },
    ],
    death: deathPoses(rest),
  };
}

function musketPoses(): PoseSet {
  const rest: Pose = { hand: [29, 32], angle: 35, off: [21, 34] };
  const aim: Pose = { hand: [30, 27], angle: 45, off: [33, 24] };
  return {
    idle: [rest, rest, { ...rest, bodyY: 1 }, { ...rest, bodyY: 1 }],
    attack: [
      { ...aim, angle: 40, hand: [30, 29] },
      aim,
      { ...aim, power: 1 },
      { ...aim, bodyX: -1, hand: [29, 28], angle: 38, power: 0.6 },
      { ...aim, bodyX: -1, hand: [29, 29], angle: 38, power: 0.2 },
      rest,
    ],
    hit: [
      { ...rest, bodyX: -2, eyes: 'closed' },
      { ...rest, bodyX: -1, eyes: 'closed' },
    ],
    death: deathPoses(rest),
  };
}

/** Stagger, kneel, kneel lower; the last three frames (collapse and fade) are made from the kneel. */
function deathPoses(rest: Pose): Pose[] {
  return [
    { ...rest, bodyX: -2, eyes: 'closed', angle: rest.angle + 15 },
    { ...rest, crouch: 3, eyes: 'closed', angle: rest.angle + 25 },
    { ...rest, crouch: 6, eyes: 'closed', angle: rest.angle + 30 },
  ];
}

const FALL_LEFT = (c: PixelCanvas): PixelCanvas => c.rot90().rot90().rot90().settle(44, CELL / 2);

function humanoidFrames(recipe: Recipe): UnitFrames {
  const poses =
    recipe.weapon === 'bow'
      ? bowPoses()
      : recipe.weapon === 'staff'
        ? staffPoses()
        : recipe.weapon === 'musket'
          ? musketPoses()
          : recipe.weapon === 'spear'
            ? spearPoses()
            : meleePoses();
  const draw = (p: Pose): PixelCanvas => drawHumanoid(recipe, p);
  const kneel = poses.death.map(draw);
  const fallen = FALL_LEFT(draw({ ...poses.death[0]!, bodyX: 0, eyes: 'closed' }));
  return {
    idle: poses.idle.map(draw),
    attack: poses.attack.map(draw),
    hit: poses.hit.map(draw),
    death: [...kneel, fallen, fallen.dissolve(0.4), fallen.dissolve(0.75)],
  };
}

function creatureFrames(draw: (p: CreaturePose) => PixelCanvas): UnitFrames {
  const kneel = draw({ y: 2, eyes: 'closed' });
  const down = draw({ y: 0, eyes: 'closed', dead: true });
  return {
    idle: [draw({ y: 0 }), draw({ y: 0, open: 0.3 }), draw({ y: 1, open: 0.5 }), draw({ y: 1, open: 0.2 })],
    attack: [
      draw({ y: 1, x: -1, open: 0.2 }),
      draw({ y: 2, x: -2, open: 0.6 }),
      draw({ y: -2, x: 2, open: 1, lunge: 1 }),
      draw({ y: -1, x: 3, open: 0.8, lunge: 1, strike: true }),
      draw({ y: 0, x: 1, open: 0.3 }),
      draw({ y: 0 }),
    ],
    hit: [draw({ y: 0, x: -2, eyes: 'closed' }), draw({ y: 0, x: -1, eyes: 'closed' })],
    death: [draw({ y: 0, x: -2, eyes: 'closed' }), kneel, draw({ y: 3, eyes: 'closed' }), down, down.dissolve(0.4), down.dissolve(0.75)],
  };
}

export function buildUnits(): Map<string, UnitFrames> {
  const out = new Map<string, UnitFrames>();
  for (const [id, recipe] of Object.entries(RECIPES)) out.set(id, humanoidFrames(recipe));
  out.set('shore-crab', creatureFrames(drawCrab));
  out.set('coast-wolf', creatureFrames(drawWolf));
  return out;
}
