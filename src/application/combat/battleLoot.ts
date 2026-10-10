import type { BattleOutcome } from '../../domain/combat';
import { NO_RESOURCES, addResources, scaleResources, type Resources } from '../../domain/economy';
import type { BattleSpec, GameContent } from '../content';

type LootContent = Pick<GameContent, 'enemyBounty' | 'clearBonus' | 'lootGrowthPerTier'>;

/**
 * Loot for a finished battle: every defeated enemy's bounty, plus the clear bonus on a win.
 * A loss (wipe or timeout) still pays for what was defeated: partial loot (GDD 05).
 */
export function battleLoot(outcome: BattleOutcome, enemyTypeIds: ReadonlyMap<string, string>, tier: number, content: LootContent): Resources {
  return lootFor(
    outcome.defeatedEnemies.map((id) => enemyTypeIds.get(id)),
    outcome.winner === 'player',
    tier,
    content,
  );
}

/** What winning this battle pays when every enemy falls: the loot preview on the map. */
export function fullClearLoot(spec: BattleSpec, tier: number, content: LootContent): Resources {
  return lootFor(
    spec.slots.map((s) => s.typeId),
    true,
    tier,
    content,
  );
}

function lootFor(defeated: readonly (string | undefined)[], won: boolean, tier: number, content: LootContent): Resources {
  let loot = NO_RESOURCES;
  for (const typeId of defeated) {
    const bounty = typeId ? content.enemyBounty[typeId] : undefined;
    if (bounty) loot = addResources(loot, bounty);
  }
  if (won) loot = addResources(loot, content.clearBonus(tier));
  return scaleResources(loot, content.lootGrowthPerTier ** Math.max(0, tier - 1));
}
