// Shared kernel: unit vocabulary used by both the Army and Combat contexts.

export type Role = 'guard' | 'fighter' | 'shooter' | 'caster';

/** Formation row, front to back. */
export type Row = 0 | 1 | 2;
export type Lane = 0 | 1 | 2;

export const ROWS: readonly Row[] = [0, 1, 2];
export const LANES: readonly Lane[] = [0, 1, 2];

export interface UnitStats {
  /** Health. */
  readonly hp: number;
  /** Damage per hit. */
  readonly atk: number;
  /** Attacks per second, 0.5 to 2.0. */
  readonly spd: number;
  /** Flat-percent damage reduction: dmg * 100 / (100 + arm). */
  readonly arm: number;
  /** Ranged units attack from any row; melee units only from the front of their lane. */
  readonly ranged: boolean;
}
