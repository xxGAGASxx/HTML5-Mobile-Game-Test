import type { GameContent } from '../application/content';
import {
  AUTO_CLEAR_SHARE,
  ENEMY_BOUNTY,
  LOOT_GROWTH_PER_TIER,
  POTIONS,
  POTION_STACK,
  STARTING_POTIONS,
  STARTING_RESOURCES,
  TAVERN,
  TRAIN_BASE,
  clearBonus,
  ruinTreasure,
} from './economy';
import { WRECK_COAST } from './regions/wreckCoast';
import { ENEMY_UNITS, PLAYER_UNITS, STARTING_ARMY } from './units';

export const CONTENT: GameContent = {
  playerUnits: PLAYER_UNITS,
  enemyUnits: ENEMY_UNITS,
  startingArmy: STARTING_ARMY,
  startingResources: STARTING_RESOURCES,
  enemyBounty: ENEMY_BOUNTY,
  clearBonus,
  lootGrowthPerTier: LOOT_GROWTH_PER_TIER,
  ruinTreasure,
  autoClearShare: AUTO_CLEAR_SHARE,
  tavern: TAVERN,
  trainBase: TRAIN_BASE,
  region: WRECK_COAST,
  potions: POTIONS,
  potionStack: POTION_STACK,
  startingPotions: STARTING_POTIONS,
};
