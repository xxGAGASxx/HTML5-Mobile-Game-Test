import type { GameContent } from '../application/content';
import { ENEMY_BOUNTY, LOOT_GROWTH_PER_WAVE, STARTING_RESOURCES, TAVERN, TRAIN_BASE, clearBonus } from './economy';
import { ENEMY_UNITS, PLAYER_UNITS, STARTING_ARMY } from './units';
import { waveAt } from './waves';

export const CONTENT: GameContent = {
  playerUnits: PLAYER_UNITS,
  enemyUnits: ENEMY_UNITS,
  startingArmy: STARTING_ARMY,
  startingResources: STARTING_RESOURCES,
  enemyBounty: ENEMY_BOUNTY,
  clearBonus,
  lootGrowthPerWave: LOOT_GROWTH_PER_WAVE,
  tavern: TAVERN,
  trainBase: TRAIN_BASE,
  waveAt,
};
