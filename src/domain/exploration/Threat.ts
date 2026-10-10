/** How a node's Threat compares to the army's Power (GDD 04 difficulty display). */
export type ThreatLabel = 'trivial' | 'easy' | 'fair' | 'hard' | 'deadly';

/** Threat / Power below this is Trivial: the node can be auto-cleared for part of its loot. */
export const TRIVIAL_BELOW = 0.7;

export function threatLabel(threat: number, power: number): ThreatLabel {
  const ratio = threat / Math.max(1, power);
  if (ratio < TRIVIAL_BELOW) return 'trivial';
  if (ratio < 0.95) return 'easy';
  if (ratio <= 1.1) return 'fair';
  if (ratio <= 1.3) return 'hard';
  return 'deadly';
}
