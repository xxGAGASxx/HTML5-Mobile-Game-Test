import { describe, expect, it } from 'vitest';
import { Army, armyPower, catalogOf, formationBonus, unitPower, type UnitType } from '.';

const stats = { hp: 100, atk: 10, spd: 1, arm: 10, ranged: false };
const catalog = catalogOf([
  { id: 'guard', name: 'Guard', role: 'guard', stats },
  { id: 'fighter', name: 'Fighter', role: 'fighter', stats },
  { id: 'archer', name: 'Archer', role: 'shooter', stats: { ...stats, ranged: true } },
] satisfies UnitType[]);

describe('Army', () => {
  it('places front-liners up front, centre lane first, and ranged units in the back', () => {
    const army = new Army();
    expect(army.add('guard', catalog).slot).toEqual({ row: 0, lane: 1 });
    expect(army.add('fighter', catalog).slot).toEqual({ row: 0, lane: 0 });
    expect(army.add('archer', catalog).slot).toEqual({ row: 2, lane: 1 });
  });

  it('refuses units past capacity', () => {
    const army = new Army(1);
    army.add('guard', catalog);
    expect(army.isFull).toBe(true);
    expect(() => army.add('guard', catalog)).toThrow('full');
  });

  it('swaps units when moving onto an occupied slot', () => {
    const army = new Army();
    const a = army.add('guard', catalog);
    const b = army.add('archer', catalog);
    army.move(a.id, b.slot);
    expect(army.unitAt({ row: 2, lane: 1 })?.id).toBe(a.id);
    expect(army.unitAt({ row: 0, lane: 1 })?.id).toBe(b.id);
  });

  it('clones without sharing the roster', () => {
    const army = new Army();
    army.add('guard', catalog);
    const copy = army.clone();
    copy.add('fighter', catalog);
    expect(army.units).toHaveLength(1);
    expect(copy.units).toHaveLength(2);
  });
});

describe('Army Power', () => {
  it('follows HP/10 + ATK*SPD*2 + ARM', () => {
    expect(unitPower('guard', catalog)).toBe(10 + 20 + 10);
  });

  it('adds 5% when every front slot holds a guard or fighter', () => {
    const army = new Army();
    army.add('guard', catalog);
    army.add('fighter', catalog);
    expect(formationBonus(army.units, catalog)).toBe(1);
    expect(armyPower(army.units, catalog)).toBe(80);
    army.add('fighter', catalog);
    expect(formationBonus(army.units, catalog)).toBe(1.05);
    expect(armyPower(army.units, catalog)).toBe(126);
  });
});
