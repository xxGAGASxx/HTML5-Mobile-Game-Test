import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import type { GameContent } from './content';
import { GameSession, type GameEvent } from './GameSession';
import { simulateRun } from './simulate';

function rich(content: GameContent = CONTENT): GameContent {
  return { ...content, startingResources: { gold: 10_000, food: 10_000 } };
}

describe('GameSession', () => {
  it('starts with the starting army and wallet', () => {
    const session = new GameSession(CONTENT);
    expect(session.army.units.map((u) => u.typeId)).toEqual(CONTENT.startingArmy);
    expect(session.wallet.balance).toEqual(CONTENT.startingResources);
    expect(session.wave).toBe(1);
  });

  it('hires: pays, places the unit, raises the next price and publishes events', () => {
    const session = new GameSession(rich());
    const events: GameEvent['type'][] = [];
    session.events.subscribe('CurrencySpent', (e) => events.push(e.type));
    session.events.subscribe('UnitHired', (e) => events.push(e.type));
    session.events.subscribe('FormationChanged', (e) => events.push(e.type));

    const before = session.tavernOffers().find((o) => o.type.id === 'castaway-archers')!;
    expect(before.powerAfter).toBeGreaterThan(session.power);
    session.hire('castaway-archers');

    expect(session.wallet.balance.gold).toBe(10_000 - before.price.gold);
    expect(session.army.units.at(-1)).toMatchObject({ typeId: 'castaway-archers', slot: { row: 2 } });
    expect(session.power).toBe(before.powerAfter);
    const after = session.tavernOffers().find((o) => o.type.id === 'castaway-archers')!;
    expect(after.price.gold).toBeGreaterThan(before.price.gold);
    expect(events).toEqual(['CurrencySpent', 'UnitHired', 'FormationChanged']);
  });

  it('refuses hires it cannot afford or has no room for', () => {
    const poor = new GameSession({ ...CONTENT, startingResources: { gold: 0, food: 0 } });
    expect(poor.tavernOffers().every((o) => o.blockedBy === 'cost')).toBe(true);
    expect(() => poor.hire('gull-deckhands')).toThrow();

    const session = new GameSession(rich());
    while (!session.army.isFull) session.hire('gull-deckhands');
    expect(session.tavernOffers().every((o) => o.blockedBy === 'army-full')).toBe(true);
  });

  it('trains a unit type: stats and Power go up for every unit of that type', () => {
    const session = new GameSession(rich());
    const offer = session.trainingOffers().find((o) => o.type.id === 'gull-deckhands')!;
    const hpBefore = session.playerCatalog.get('gull-deckhands')!.stats.hp;
    expect(session.train('gull-deckhands')).toBe(2);
    expect(session.playerCatalog.get('gull-deckhands')!.stats.hp).toBeGreaterThan(hpBefore);
    expect(session.power).toBe(offer.powerAfter);
  });

  it('pays loot after a won battle and moves to the next wave', () => {
    const session = new GameSession(CONTENT);
    const won: number[] = [];
    session.events.subscribe('BattleWon', (e) => won.push(e.wave));
    session.beginBattle().battle.runToEnd();
    const report = session.finishBattle();
    expect(report.outcome.winner).toBe('player');
    expect(report.loot.gold).toBeGreaterThan(0);
    expect(session.wallet.balance.gold).toBe(CONTENT.startingResources.gold + report.loot.gold);
    expect(session.wave).toBe(2);
    expect(won).toEqual([1]);
  });

  it('keeps the wave after a loss but still pays partial loot, without the clear bonus', () => {
    const weak = new GameSession({ ...CONTENT, startingArmy: ['castaway-archers'] });
    weak.beginBattle().battle.runToEnd();
    const report = weak.finishBattle();
    expect(report.outcome.winner).toBe('enemy');
    expect(weak.wave).toBe(1);
    expect(report.loot.gold).toBeLessThan(CONTENT.clearBonus(1).gold);
  });

  it('allows one battle at a time and only finishes a finished battle', () => {
    const session = new GameSession(CONTENT);
    expect(() => session.finishBattle()).toThrow();
    session.beginBattle();
    expect(() => session.beginBattle()).toThrow();
    expect(() => session.finishBattle()).toThrow();
  });

  it('reads Power synchronously at battle start', () => {
    const session = new GameSession(rich());
    session.hire('driftwood-wardens');
    expect(session.beginBattle().power).toBe(session.power);
  });
});

describe('economy simulator', () => {
  it('first hire happens after the first battle (time to first upgrade < 60 s, GDD 02)', () => {
    const [first] = simulateRun(CONTENT, 1);
    expect(first.won).toBe(true);
    expect(first.seconds).toBeLessThan(60);
    expect(first.hired.length).toBeGreaterThan(0);
  });

  it('an idle player clears the hand-made waves', () => {
    const steps = simulateRun(CONTENT, 10);
    expect(steps.some((s) => s.wave === 5 && s.won)).toBe(true);
  });
});
