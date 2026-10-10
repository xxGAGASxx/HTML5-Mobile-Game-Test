import type { Resources } from '../economy';

export type BattleResultEvent =
  | { readonly type: 'BattleWon'; readonly nodeId: string; readonly loot: Resources }
  | { readonly type: 'BattleLost'; readonly nodeId: string; readonly loot: Resources };
