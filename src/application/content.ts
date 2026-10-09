import type { UnitType } from '../domain/army';
import type { Resources } from '../domain/economy';
import type { Lane, Row } from '../domain/shared';

/** Game data the use cases run on. Loaded from src/data in the composition root. */
export interface GameContent {
  readonly playerUnits: readonly UnitType[];
  readonly enemyUnits: readonly UnitType[];
  readonly startingArmy: readonly string[];
  readonly startingResources: Resources;
  readonly enemyBounty: Readonly<Record<string, Resources>>;
  readonly clearBonus: (wave: number) => Resources;
  readonly lootGrowthPerWave: number;
  readonly tavern: readonly { typeId: string; base: Resources }[];
  /** Price to train each player unit type from level 1 to 2. */
  readonly trainBase: Readonly<Record<string, Resources>>;
  readonly waveAt: (wave: number) => WaveSpec;
}

export interface WaveSpec {
  readonly number: number;
  readonly slots: readonly { typeId: string; row: Row; lane: Lane }[];
  /** Multiplier on enemy HP and ATK. */
  readonly strength: number;
}
