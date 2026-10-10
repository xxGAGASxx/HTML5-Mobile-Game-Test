import type { UnitType } from '../domain/army';
import type { Currency, Resources } from '../domain/economy';
import type { MapNodeDef } from '../domain/exploration';
import type { Lane, Row } from '../domain/shared';

/** Game data the use cases run on. Loaded from src/data in the composition root. */
export interface GameContent {
  readonly playerUnits: readonly UnitType[];
  readonly enemyUnits: readonly UnitType[];
  readonly startingArmy: readonly string[];
  readonly startingResources: Resources;
  readonly enemyBounty: Readonly<Record<string, Resources>>;
  /** Extra loot for winning a battle at a node of this tier. */
  readonly clearBonus: (tier: number) => Resources;
  /** Loot multiplier per tier above 1. */
  readonly lootGrowthPerTier: number;
  /** Chest at the end of a ruin's last floor (relics replace it in M6). */
  readonly ruinTreasure: (tier: number) => Resources;
  /** Share of a full clear's loot paid by an instant auto-clear of a Trivial node (GDD 04). */
  readonly autoClearShare: number;
  readonly tavern: readonly { typeId: string; base: Resources }[];
  /** Price to train each player unit type from level 1 to 2. */
  readonly trainBase: Readonly<Record<string, Resources>>;
  readonly region: RegionSpec;
}

/** One fight: enemies in their slots (row 0 is their front line), scaled by `strength`. */
export interface BattleSpec {
  readonly slots: readonly { typeId: string; row: Row; lane: Lane }[];
  /** Multiplier on enemy HP and ATK. */
  readonly strength: number;
}

/** A region map: the island the player explores node by node (GDD 04). */
export interface RegionSpec {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly RegionNode[];
}

export interface RegionNode extends MapNodeDef {
  readonly name: string;
  /** One line of flavour for the node card. */
  readonly blurb: string;
  /** Loot level: the clear bonus and loot growth follow it. */
  readonly tier: number;
  /** One battle, or one per floor for a ruin (fought back to back, no healing). Empty for the camp. */
  readonly battles: readonly BattleSpec[];
  /** Multiplier on the loot of every battle here (elites pay more). */
  readonly lootFactor?: number;
  /** A resource site's output once secured: `perHour`, stored up to `capHours` worth. */
  readonly produces?: { readonly currency: Currency; readonly perHour: number; readonly capHours: number };
  /** Where the node sits on the region art, in art pixels. The map bake snaps it to the nearest tile. */
  readonly at: { readonly x: number; readonly y: number };
}
