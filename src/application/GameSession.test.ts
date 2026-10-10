import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import type { GameContent } from './content';
import { HOUR_MS, threatLabel } from '../domain/exploration';
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
    expect(session.nodeInfo('crab-shallows').status).toEqual({ kind: 'open', firstClear: true });
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

  it('pays loot after a won battle, clears the node and lifts the fog beyond it', () => {
    const session = new GameSession(CONTENT);
    const events: GameEvent[] = [];
    session.events.subscribe('BattleWon', (e) => events.push(e));
    session.events.subscribe('NodeCleared', (e) => events.push(e));
    expect(session.nodeInfo('bandit-lookout').status.kind).toBe('hidden');
    fightAt(session, 'crab-shallows').battle.runToEnd();
    const report = session.finishBattle();
    expect(report.outcome.winner).toBe('player');
    expect(report.loot.gold).toBeGreaterThan(0);
    expect(session.wallet.balance.gold).toBe(CONTENT.startingResources.gold + report.loot.gold);
    expect(report.revealed).toEqual(['bandit-lookout']);
    expect(session.nodeInfo('crab-shallows').status.kind).toBe('respawning');
    expect(events.map((e) => e.type)).toEqual(['BattleWon', 'NodeCleared']);
  });

  it('keeps the node open after a loss but still pays partial loot, without the clear bonus', () => {
    const weak = new GameSession({ ...CONTENT, startingArmy: ['castaway-archers'] });
    fightAt(weak, 'crab-shallows').battle.runToEnd();
    const report = weak.finishBattle();
    expect(report.outcome.winner).toBe('enemy');
    expect(report.revealed).toEqual([]);
    expect(weak.nodeInfo('crab-shallows').status).toEqual({ kind: 'open', firstClear: true });
    expect(report.loot.gold).toBeLessThan(CONTENT.clearBonus(1).gold);
  });

  it('only fights open nodes, one battle at a time', () => {
    const session = new GameSession(CONTENT);
    expect(() => session.finishBattle()).toThrow();
    expect(() => session.beginBattle('bandit-fort')).toThrow(); // under the fog
    expect(() => session.beginBattle('camp')).toThrow();
    expect(() => session.beginBattle('crab-shallows')).toThrow(); // the party is still in camp
    fightAt(session, 'crab-shallows');
    expect(() => session.beginBattle('driftwood-beach')).toThrow();
    expect(() => session.travel('driftwood-beach')).toThrow(); // no walking mid-battle
    expect(() => session.finishBattle()).toThrow();
  });

  it('respawns a cleared encounter after 2 hours', () => {
    let now = 0;
    const session = new GameSession(CONTENT, 1, () => now);
    fightAt(session, 'crab-shallows').battle.runToEnd();
    session.finishBattle();
    expect(() => fightAt(session, 'crab-shallows')).toThrow();
    now = 2 * HOUR_MS;
    expect(session.nodeInfo('crab-shallows').status).toEqual({ kind: 'open', firstClear: false });
  });

  it('shows Threat against Power with a label and a loot preview', () => {
    const session = new GameSession(CONTENT);
    const info = session.nodeInfo('crab-shallows');
    expect(info.threat).toBeGreaterThan(0);
    expect(info.label).toBe(threatLabel(info.threat!, session.power));
    expect(info.enemies).toEqual(['coast-wolf', 'shore-crab']); // front row, lane by lane
    expect(info.loot.gold).toBeGreaterThan(CONTENT.clearBonus(1).gold);
    expect(session.nodeInfo('camp').threat).toBeUndefined();
  });

  it('auto-clears a Trivial node for half its loot', () => {
    const session = new GameSession(rich());
    while (!session.army.isFull) session.hire('driftwood-wardens');
    const info = session.nodeInfo('crab-shallows');
    expect(info.label).toBe('trivial');
    expect(info.canAutoClear).toBe(true);
    const before = session.wallet.balance.gold;
    session.travel('crab-shallows');
    const { loot, revealed } = session.autoClear('crab-shallows');
    expect(loot.gold).toBe(Math.floor(info.loot.gold * CONTENT.autoClearShare));
    expect(session.wallet.balance.gold).toBe(before + loot.gold);
    expect(revealed).toEqual(['bandit-lookout']);
    expect(() => session.autoClear('driftwood-beach')).toThrow(); // the party is not there
    session.travel('driftwood-beach');
    expect(() => session.autoClear('driftwood-beach')).not.toThrow();
  });

  it('refuses to auto-clear a node that is not Trivial', () => {
    const session = new GameSession(CONTENT);
    expect(session.nodeInfo('crab-shallows').canAutoClear).toBe(false);
    session.travel('crab-shallows');
    expect(() => session.autoClear('crab-shallows')).toThrow();
  });

  it('runs a ruin floor by floor, carrying wounds, and pays its chest at the bottom', () => {
    const session = new GameSession(rich());
    while (!session.army.isFull) session.hire('driftwood-wardens');
    for (let i = 0; i < 6; i++) session.train('driftwood-wardens');
    clearPath(session, ['crab-shallows', 'bandit-lookout', 'wolf-den']);

    const first = fightAt(session, 'sunken-shrine');
    first.battle.runToEnd();
    const floor1 = session.finishBattle();
    expect(floor1.floor).toEqual({ index: 0, count: 3 });
    expect(floor1.nextFloor).toBe(true);
    expect(session.nodeInfo('sunken-shrine').status.kind).toBe('open');
    const wounded = first.battle.combatants.find((c) => c.spec.side === 'player' && c.hp < c.maxHp && c.hp > 0)!;

    const second = fightAt(session, 'sunken-shrine');
    expect(second.battle.get(wounded.spec.id)!.hp).toBe(wounded.hp);
    second.battle.runToEnd();
    expect(session.finishBattle().floor).toEqual({ index: 1, count: 3 });

    fightAt(session, 'sunken-shrine').battle.runToEnd();
    const last = session.finishBattle();
    expect(last.nextFloor).toBe(false);
    expect(last.treasure).toEqual(CONTENT.ruinTreasure(4));
    expect(last.revealed).toEqual(['cliff-road']);
    expect(session.nodeInfo('sunken-shrine').status.kind).toBe('respawning');
  });

  it('retreating from a ruin starts it over from the first floor', () => {
    const session = new GameSession(rich());
    while (!session.army.isFull) session.hire('driftwood-wardens');
    for (let i = 0; i < 6; i++) session.train('driftwood-wardens');
    clearPath(session, ['crab-shallows', 'bandit-lookout', 'wolf-den']);
    fightAt(session, 'sunken-shrine').battle.runToEnd();
    session.finishBattle();
    session.retreat();
    fightAt(session, 'sunken-shrine').battle.runToEnd();
    expect(session.finishBattle().floor?.index).toBe(0);
  });

  it('secures a resource site that then fills up with food to collect', () => {
    let now = 0;
    const session = new GameSession(rich(), 1, () => now);
    while (!session.army.isFull) session.hire('driftwood-wardens');
    clearPath(session, ['driftwood-beach', 'fishing-rocks']);
    expect(session.nodeInfo('fishing-rocks').status).toEqual({ kind: 'secured' });
    now = HOUR_MS / 2;
    const harvest = session.nodeInfo('fishing-rocks').harvest!;
    expect(harvest.food).toBe(90);
    const food = session.wallet.balance.food;
    expect(session.harvest('fishing-rocks')).toEqual(harvest);
    expect(session.wallet.balance.food).toBe(food + 90);
    expect(session.nodeInfo('fishing-rocks').harvest!.food).toBe(0);
  });

  it('walks the party along paths, through cleared nodes only', () => {
    const session = new GameSession(CONTENT);
    expect(session.partyAt).toBe('camp');
    expect(session.routeTo('bandit-lookout')).toBeNull(); // in the fog
    fightAt(session, 'crab-shallows').battle.runToEnd();
    session.finishBattle();
    expect(session.travel('camp')).toEqual(['crab-shallows', 'camp']);
    expect(session.routeTo('bandit-lookout')).toEqual(['camp', 'crab-shallows', 'bandit-lookout']);
    expect(() => session.beginBattle('bandit-lookout')).toThrow();
    session.travel('bandit-lookout');
    expect(session.partyAt).toBe('bandit-lookout');
  });

  it('sells potions up to the stack limit', () => {
    const session = new GameSession(rich());
    const health = () => session.potionOffers().find((o) => o.potion.id === 'health')!;
    expect(health().owned).toBe(CONTENT.startingPotions.health);
    while (health().canBuy) session.buyPotion('health');
    expect(health()).toMatchObject({ owned: CONTENT.potionStack, blockedBy: 'full' });
    expect(() => session.buyPotion('health')).toThrow();
    const price = health().potion.price;
    const bought = CONTENT.potionStack - (CONTENT.startingPotions.health ?? 0);
    expect(session.wallet.balance.gold).toBe(10_000 - price.gold * bought);

    const poor = new GameSession({ ...CONTENT, startingResources: { gold: 0, food: 0 } });
    expect(poor.potionOffers().every((o) => o.blockedBy === 'cost')).toBe(true);
  });

  it('uses potions in battle from the satchel; blasts grow with the tier', () => {
    const session = new GameSession(CONTENT);
    const events: GameEvent[] = [];
    session.events.subscribe('PotionUsed', (e) => events.push(e));
    expect(() => session.usePotion('health')).toThrow(); // no battle
    const { battle } = fightAt(session, 'driftwood-beach');
    const damage = session.battlePotions().find((p) => p.potion.id === 'damage')!;
    expect(damage).toMatchObject({ owned: 1, canUse: true, cooldown: 0, effect: { kind: 'blast', damage: 15 + 6 * session.node('driftwood-beach').tier } });
    expect(session.usePotion('damage')).toBe(true);
    expect(session.satchel.count('damage')).toBe(0);
    expect(session.usePotion('damage')).toBe(false); // none left
    expect(events).toEqual([{ type: 'PotionUsed', potionId: 'damage', nodeId: 'driftwood-beach' }]);
    battle.step();
    expect(session.battlePotions().find((p) => p.potion.id === 'damage')).toMatchObject({ canUse: false, usesLeft: 1 });
  });

  it('reads Power synchronously at battle start', () => {
    const session = new GameSession(rich());
    session.hire('driftwood-wardens');
    expect(fightAt(session, 'crab-shallows').power).toBe(session.power);
  });
});

/** Walks the party to a node (if it is not there yet) and starts its next battle. */
function fightAt(session: GameSession, id: string) {
  if (session.partyAt !== id) session.travel(id);
  return session.beginBattle(id);
}

/** Wins each node in order (the army must be strong enough). */
function clearPath(session: GameSession, ids: string[]): void {
  for (const id of ids) {
    fightAt(session, id).battle.runToEnd();
    const report = session.finishBattle();
    if (report.outcome.winner !== 'player') throw new Error(`Lost at ${id}`);
  }
}

describe('economy simulator', () => {
  it('first hire happens after the first battle (time to first upgrade < 60 s, GDD 02)', () => {
    const [first] = simulateRun(CONTENT, 1);
    expect(first.won).toBe(true);
    expect(first.seconds).toBeLessThan(60);
    expect(first.hired.length).toBeGreaterThan(0);
  });

  it('an idle player beats the Bandit Chief and clears the Wreck Coast', () => {
    const steps = simulateRun(CONTENT, 40);
    expect(steps.at(-1)?.regionCleared).toBe(true);
    expect(steps.at(-1)!.minutes).toBeLessThan(30);
  });
});
