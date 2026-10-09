import { describe, expect, it } from 'vitest';
import { EventBus } from './EventBus';

type TestEvent = { type: 'BattleWon'; nodeId: string } | { type: 'CurrencySpent'; amount: number };

describe('EventBus', () => {
  it('delivers events only to handlers of the matching type', () => {
    const bus = new EventBus<TestEvent>();
    const won: string[] = [];
    const spent: number[] = [];
    bus.subscribe('BattleWon', (e) => won.push(e.nodeId));
    bus.subscribe('CurrencySpent', (e) => spent.push(e.amount));

    bus.publish({ type: 'BattleWon', nodeId: 'n1' });

    expect(won).toEqual(['n1']);
    expect(spent).toEqual([]);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<TestEvent>();
    let calls = 0;
    const off = bus.subscribe('BattleWon', () => calls++);
    off();
    bus.publish({ type: 'BattleWon', nodeId: 'n1' });
    expect(calls).toBe(0);
  });
});
