import type { UnitStats } from '../shared';

/** Each level past 1 adds this share of base HP and ATK. Upgrades apply to the whole unit type (GDD 06). */
export const LEVEL_STAT_STEP = 0.2;
export const MAX_LEVEL = 10;

export function statsAtLevel(base: UnitStats, level: number): UnitStats {
  if (level <= 1) return base;
  const factor = 1 + LEVEL_STAT_STEP * (level - 1);
  return { ...base, hp: Math.round(base.hp * factor), atk: Math.round(base.atk * factor) };
}

/** Levels per unit type. Types never trained are level 1. */
export class UnitLevels {
  private readonly levels = new Map<string, number>();

  of(typeId: string): number {
    return this.levels.get(typeId) ?? 1;
  }

  canRaise(typeId: string): boolean {
    return this.of(typeId) < MAX_LEVEL;
  }

  raise(typeId: string): number {
    if (!this.canRaise(typeId)) throw new Error(`${typeId} is at max level`);
    const next = this.of(typeId) + 1;
    this.levels.set(typeId, next);
    return next;
  }
}
