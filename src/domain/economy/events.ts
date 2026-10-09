import type { Resources } from './Resources';

export type EconomyEvent =
  | { readonly type: 'CurrencyEarned'; readonly amount: Resources }
  | { readonly type: 'CurrencySpent'; readonly amount: Resources; readonly reason: string };
