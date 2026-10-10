import { describe, expect, it } from 'vitest';
import type { Lane, Role, Row, UnitStats } from '../shared';
import { Battle, MAX_TAPS_PER_SECOND, POTION_COOLDOWN_TICKS, POTION_USES_PER_BATTLE, RALLY_MAX, TIME_LIMIT_TICKS, type CombatantSpec, type CombatEvent, type Side } from '.';

const base: UnitStats = { hp: 100, atk: 10, spd: 1, arm: 0, ranged: false };

function unit(id: string, side: Side, row: Row, lane: Lane, role: Role = 'fighter', stats: Partial<UnitStats> = {}): CombatantSpec {
  return { id, side, typeId: id, role, row, lane, stats: { ...base, ...stats } };
}

function attacksBy(events: CombatEvent[], attackerId: string) {
  return events.filter((e): e is Extract<CombatEvent, { type: 'attack' }> => e.type === 'attack' && e.attackerId === attackerId);
}

function runCollecting(battle: Battle): CombatEvent[] {
  const events: CombatEvent[] = [];
  while (!battle.isOver) events.push(...battle.step());
  return events;
}

/** A small mixed fight used as the golden battle. */
function goldenSpecs(): CombatantSpec[] {
  return [
    unit('p-guard', 'player', 0, 1, 'guard', { hp: 240, atk: 9, spd: 0.8, arm: 30 }),
    unit('p-fighter', 'player', 0, 0, 'fighter', { hp: 130, atk: 12, arm: 10 }),
    unit('p-archer', 'player', 2, 1, 'shooter', { hp: 80, atk: 11, ranged: true }),
    unit('e-crab', 'enemy', 0, 1, 'guard', { hp: 150, atk: 6, spd: 0.8, arm: 40 }),
    unit('e-wolf', 'enemy', 0, 0, 'fighter', { hp: 80, atk: 8, spd: 1.4 }),
    unit('e-gunner', 'enemy', 2, 1, 'shooter', { hp: 70, atk: 12, spd: 0.7, ranged: true }),
  ];
}

describe('Battle', () => {
  it('golden: a fixed seed and formation always give this exact result', () => {
    const outcome = new Battle(goldenSpecs(), 1234).runToEnd();
    expect(outcome).toEqual({
      winner: 'player',
      reason: 'wipe',
      defeatedEnemies: GOLDEN_DEFEATED,
      ticks: GOLDEN_TICKS,
    });
  });

  it('is deterministic for the same seed and inputs', () => {
    const play = () => {
      const battle = new Battle(goldenSpecs(), 99);
      const events: CombatEvent[] = [];
      while (!battle.isOver) {
        if (battle.tick % 3 === 0) battle.tap();
        events.push(...battle.step());
      }
      return events;
    };
    expect(play()).toEqual(play());
  });

  it('targets the front of the lane before anyone behind it', () => {
    const battle = new Battle(
      [
        unit('archer', 'player', 2, 1, 'shooter', { ranged: true, atk: 1 }),
        unit('front', 'enemy', 0, 1, 'fighter', { atk: 0 }),
        unit('back', 'enemy', 2, 1, 'fighter', { atk: 0 }),
      ],
      1,
    );
    const events: CombatEvent[] = [];
    for (let i = 0; i < 30; i++) events.push(...battle.step());
    const targets = new Set(attacksBy(events, 'archer').map((e) => e.targetId));
    expect(targets).toEqual(new Set(['front']));
  });

  it('switches to the nearest lane when its own lane is empty', () => {
    const battle = new Battle([unit('a', 'player', 0, 0), unit('far', 'enemy', 0, 2), unit('near', 'enemy', 0, 1)], 1);
    const events: CombatEvent[] = [];
    for (let i = 0; i < 15; i++) events.push(...battle.step());
    expect(attacksBy(events, 'a')[0].targetId).toBe('near');
  });

  it('keeps melee units behind a living ally from swinging', () => {
    const battle = new Battle(
      [
        unit('front', 'player', 0, 1, 'guard', { hp: 10_000, atk: 1 }),
        unit('behind', 'player', 1, 1, 'fighter'),
        unit('enemy', 'enemy', 0, 1, 'fighter', { hp: 10_000, atk: 1 }),
      ],
      1,
    );
    const events: CombatEvent[] = [];
    for (let i = 0; i < 40; i++) events.push(...battle.step());
    expect(attacksBy(events, 'behind')).toHaveLength(0);
    expect(attacksBy(events, 'front').length).toBeGreaterThan(0);
  });

  it('applies armor and the role triangle', () => {
    // Shooter beats caster: +25%. Back-row ranged: +10%. Spread is 90..110%.
    const battle = new Battle(
      [unit('s', 'player', 2, 1, 'shooter', { atk: 100, ranged: true }), unit('c', 'enemy', 0, 1, 'caster', { hp: 100_000, atk: 0, arm: 100 })],
      7,
    );
    const events: CombatEvent[] = [];
    for (let i = 0; i < 30; i++) events.push(...battle.step());
    for (const hit of attacksBy(events, 's')) {
      // 100 * 1.1 * 1.25 = 137.5, spread 123..151, halved by 100 armor.
      expect(hit.damage).toBeGreaterThanOrEqual(61);
      expect(hit.damage).toBeLessThanOrEqual(75);
    }
  });

  it('caps taps at 5 per second', () => {
    const battle = new Battle([unit('p', 'player', 0, 1, 'fighter', { atk: 0 }), unit('e', 'enemy', 0, 1, 'fighter', { hp: 10_000, atk: 0 })], 1);
    let hits = 0;
    for (let i = 0; i < 10; i++) {
      for (let t = 0; t < 10; t++) battle.tap();
      hits += battle.step().filter((e) => e.type === 'captainHit').length;
    }
    expect(hits).toBe(MAX_TAPS_PER_SECOND);
  });

  it('fires Rally on demand once full, and by itself at half strength if left alone', () => {
    const specs = [unit('p', 'player', 0, 1, 'fighter', { atk: 0 }), unit('e', 'enemy', 0, 1, 'fighter', { hp: 100_000, atk: 0 })];
    const manual = new Battle(specs, 1);
    while (!manual.rallyReady) {
      manual.tap();
      manual.step();
    }
    manual.fireRally();
    expect(manual.step()).toContainEqual(expect.objectContaining({ type: 'rallyFired', efficiency: 1 }));
    expect(manual.rally).toBe(0);

    const idle = new Battle(specs, 1);
    const events = runCollecting(idle);
    const fired = events.filter((e) => e.type === 'rallyFired');
    expect(fired.length).toBeGreaterThan(0);
    expect(fired.every((e) => e.type === 'rallyFired' && e.efficiency === 0.5)).toBe(true);
    expect(RALLY_MAX).toBe(30);
  });

  it('counts a timeout as a loss', () => {
    const battle = new Battle(
      [unit('p', 'player', 0, 1, 'fighter', { hp: 100_000 }), unit('wall', 'enemy', 0, 1, 'guard', { hp: 100_000, atk: 0 })],
      1,
    );
    const outcome = battle.runToEnd();
    expect(outcome.winner).toBe('enemy');
    expect(outcome.reason).toBe('timeout');
    expect(outcome.ticks).toBe(TIME_LIMIT_TICKS);
  });

  it('can start a unit below full HP, never above it', () => {
    const battle = new Battle(
      [{ ...unit('hurt', 'player', 0, 1), hp: 40 }, { ...unit('over', 'player', 0, 0), hp: 999 }, unit('e', 'enemy', 0, 1)],
      1,
    );
    expect(battle.get('hurt')).toMatchObject({ hp: 40, maxHp: 100 });
    expect(battle.get('over')).toMatchObject({ hp: 100, maxHp: 100 });
  });

  it('ignores input after the battle ends', () => {
    const battle = new Battle([unit('p', 'player', 0, 1, 'fighter', { atk: 1000 }), unit('e', 'enemy', 0, 1, 'fighter', { hp: 1 })], 1);
    battle.runToEnd();
    battle.tap();
    expect(battle.step()).toEqual([]);
  });

  it('a health potion heals every living ally by a share of max HP, never past full', () => {
    const battle = new Battle(
      [
        { ...unit('hurt', 'player', 0, 1), hp: 20 },
        { ...unit('scratched', 'player', 0, 0), hp: 95 },
        unit('e', 'enemy', 2, 1, 'fighter', { atk: 0 }),
      ],
      1,
    );
    expect(battle.usePotion('health', { kind: 'heal', pct: 30 })).toBe(true);
    const events = battle.step();
    expect(events).toContainEqual({ type: 'potionUsed', tick: 1, potionId: 'health', effect: 'heal' });
    expect(events).toContainEqual({ type: 'healed', tick: 1, targetId: 'hurt', amount: 30 });
    expect(events).toContainEqual({ type: 'healed', tick: 1, targetId: 'scratched', amount: 5 });
    expect(battle.get('hurt')!.hp).toBe(50);
    expect(battle.get('scratched')!.hp).toBe(100);
  });

  it('a damage potion hits every living enemy for a flat amount, ignoring armour', () => {
    const battle = new Battle(
      [unit('p', 'player', 0, 1, 'fighter', { atk: 0 }), unit('crab', 'enemy', 0, 1, 'guard', { arm: 40 }), unit('weak', 'enemy', 2, 0, 'shooter', { hp: 10 })],
      1,
    );
    battle.usePotion('damage', { kind: 'blast', damage: 25 });
    const events = battle.step();
    expect(events).toContainEqual({ type: 'potionHit', tick: 1, targetId: 'crab', damage: 25, killed: false });
    expect(events).toContainEqual({ type: 'potionHit', tick: 1, targetId: 'weak', damage: 25, killed: true });
    expect(battle.get('crab')!.hp).toBe(75);
    expect(events.some((e) => e.type === 'potionHit' && e.targetId === 'p')).toBe(false);
  });

  it('puts each potion on a cooldown and caps uses per battle', () => {
    const battle = new Battle([unit('p', 'player', 0, 1, 'fighter', { hp: 100_000, atk: 0 }), unit('e', 'enemy', 0, 1, 'fighter', { hp: 100_000, atk: 0 })], 1);
    const heal = { kind: 'heal', pct: 10 } as const;
    expect(battle.usePotion('health', heal)).toBe(true);
    expect(battle.usePotion('health', heal)).toBe(false); // already on its way
    expect(battle.canUsePotion('damage')).toBe(true); // kinds cool down separately
    battle.step();
    expect(battle.potionCooldown('health')).toBe(POTION_COOLDOWN_TICKS);
    expect(battle.usePotion('health', heal)).toBe(false);
    for (let used = 1; used < POTION_USES_PER_BATTLE; used++) {
      while (!battle.canUsePotion('health')) battle.step();
      expect(battle.usePotion('health', heal)).toBe(true);
      battle.step();
    }
    while (battle.potionCooldown('health') > 0) battle.step();
    expect(battle.potionsUsed('health')).toBe(POTION_USES_PER_BATTLE);
    expect(battle.canUsePotion('health')).toBe(false);
  });
});

// Changing these means the simulation changed: make sure that was intended.
const GOLDEN_DEFEATED = ['e-wolf', 'e-crab', 'e-gunner'];
const GOLDEN_TICKS = 121;
