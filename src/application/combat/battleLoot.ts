import type { BattleOutcome } from '../../domain/combat';
import { NO_RESOURCES, addResources, scaleResources, type Resources } from '../../domain/economy';
import type { GameContent } from '../content';

/**
 * Loot for a finished battle: every defeated enemy's bounty, plus the clear bonus on a win.
 * A loss (wipe or timeout) still pays for what was defeated: partial loot (GDD 05).
 */
export function battleLoot(
  outcome: BattleOutcome,
  enemyTypeIds: ReadonlyMap<string, string>,
  wave: number,
  content: Pick<GameContent, 'enemyBounty' | 'clearBonus' | 'lootGrowthPerWave'>,
): Resources {
  let loot = NO_RESOURCES;
  for (const id of outcome.defeatedEnemies) {
    const typeId = enemyTypeIds.get(id);
    const bounty = typeId ? content.enemyBounty[typeId] : undefined;
    if (bounty) loot = addResources(loot, bounty);
  }
  if (outcome.winner === 'player') loot = addResources(loot, content.clearBonus(wave));
  return scaleResources(loot, content.lootGrowthPerWave ** (wave - 1));
}
