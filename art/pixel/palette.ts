// The one palette every Wreckbound pixel sprite is drawn from. Ramps run dark -> light (4 shades),
// following the reference look: muted medieval base, saturated role accents (see .docs/Art-Style).

export type Ramp = readonly [string, string, string, string];

export const OUTLINE = '#1b1622';
export const EYE = '#1b1622';
export const SHADOW = '#000000';

export const RAMPS = {
  skin: ['#7a4632', '#b86f50', '#e0a07a', '#f2c8a0'],
  skinTan: ['#5e3426', '#8f5a3c', '#b97c55', '#d9a07a'],
  hairDark: ['#16121c', '#2a2230', '#40343e', '#5a4a52'],
  hairBrown: ['#3d2418', '#6b3f24', '#9a6136', '#b87c48'],
  hairBlond: ['#7a5a26', '#a8803a', '#d8b050', '#f0d880'],
  hairRed: ['#5a2014', '#8e3a1e', '#c05a2c', '#e08a48'],
  leather: ['#3a2418', '#5e3a24', '#87573a', '#a87a52'],
  steel: ['#3c4250', '#6b7686', '#a3afbd', '#e2e8ee'],
  wood: ['#3e2a1c', '#6a4a2e', '#94704a', '#bf9a68'],
  driftwood: ['#4a4038', '#7a6e60', '#a89c88', '#ccc4b0'],
  cloth: ['#6e6a72', '#a8a4a8', '#d8d4cc', '#f4f0e6'],
  canvas: ['#5a5038', '#8a7a58', '#b4a47c', '#d4c8a0'],
  navy: ['#141c34', '#24304e', '#34466a', '#4a608a'],
  dark: ['#1a181e', '#2c2832', '#423c48', '#5c5462'],
  blue: ['#1c2c5a', '#2e4c94', '#4a74c8', '#7aa4e8'],
  red: ['#4a1418', '#8a2428', '#c43c34', '#e8705a'],
  green: ['#1c3a20', '#2e5e2e', '#4a8a3a', '#7ab85a'],
  purple: ['#2a1a4a', '#4a2e7a', '#6e4aa8', '#9a7ad0'],
  gold: ['#6a4a14', '#a87a24', '#e0b040', '#f8e080'],
  cyan: ['#1a4a5a', '#2a8aa0', '#5ad0e0', '#c0f8ff'],
  bone: ['#5a5448', '#9a927e', '#cec4a6', '#eee6cc'],
  crab: ['#5a1a10', '#a03a1c', '#d8642c', '#f49a5a'],
  wolf: ['#2a2a34', '#4e5060', '#7c8090', '#b0b4c0'],
  sand: ['#a8824e', '#c8a064', '#dcbc80', '#ecd6a4'],
  wetSand: ['#6e5636', '#8a6c44', '#a08050', '#b49464'],
  water: ['#123848', '#1e5a6a', '#2e8494', '#6ac0c8'],
  moss: ['#2a3a1c', '#40562a', '#5a7838', '#7e9a4c'],
  rock: ['#3a3640', '#58545e', '#7c7882', '#a4a0a8'],
  fire: ['#8a2410', '#d8501c', '#f8a030', '#fff0a0'],
} as const satisfies Record<string, Ramp>;

export const FOAM = '#e8f4f0';
export const BLOOD = '#d02828';
