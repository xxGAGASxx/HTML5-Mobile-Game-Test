import type { Resources } from '../economy';

export type BattleResultEvent =
  | { readonly type: 'BattleWon'; readonly wave: number; readonly loot: Resources }
  | { readonly type: 'BattleLost'; readonly wave: number; readonly loot: Resources };
