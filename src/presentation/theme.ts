import type { Role } from '../domain/shared';

/**
 * Bundled with the game (see main.ts) so text measures and draws the same on every device;
 * phone system monospace fonts often have no real bold and clip the last letter of a label.
 */
export const FONT = 'JetBrains Mono, monospace';

export const COLORS = {
  background: 0x0b1d2a,
  panel: 0x13293a,
  panelLight: 0x1d3b52,
  text: 0xf2e6c9,
  muted: 0x8fb3c4,
  gold: 0xf2c14e,
  food: 0xe07a5f,
  danger: 0xd9483d,
  good: 0x6fcf6f,
  enemy: 0x5a2e2e,
  rally: 0xe0a050,
  disabled: 0x3a4a56,
} as const;

/** Units read by silhouette and role colour (GDD 12). */
export const ROLE_COLORS: Record<Role, number> = {
  guard: 0x3d7bd9,
  fighter: 0xd9483d,
  shooter: 0x4caf50,
  caster: 0x9b59d0,
};

export const ROLE_LABELS: Record<Role, string> = {
  guard: 'Guard',
  fighter: 'Fighter',
  shooter: 'Shooter',
  caster: 'Caster',
};
