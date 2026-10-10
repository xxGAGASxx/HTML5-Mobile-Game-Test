import type { Resources } from '../economy';

export type BattleResultEvent =
  | { readonly type: 'BattleWon'; readonly nodeId: string; readonly loot: Resources }
  | { readonly type: 'BattleLost'; readonly nodeId: string; readonly loot: Resources };

export type PotionUsedEvent = { readonly type: 'PotionUsed'; readonly potionId: string; readonly nodeId: string };
