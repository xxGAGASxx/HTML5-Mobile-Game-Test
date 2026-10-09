import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, UnitLevels, statsAtLevel } from '.';

describe('UnitLevels', () => {
  it('starts at 1 and raises per type', () => {
    const levels = new UnitLevels();
    expect(levels.of('a')).toBe(1);
    expect(levels.raise('a')).toBe(2);
    expect(levels.of('b')).toBe(1);
  });

  it('stops at the max level', () => {
    const levels = new UnitLevels();
    for (let i = 1; i < MAX_LEVEL; i++) levels.raise('a');
    expect(() => levels.raise('a')).toThrow();
  });

  it('scales HP and ATK only', () => {
    const base = { hp: 100, atk: 10, spd: 1, arm: 5, ranged: false };
    expect(statsAtLevel(base, 1)).toBe(base);
    expect(statsAtLevel(base, 3)).toEqual({ hp: 140, atk: 14, spd: 1, arm: 5, ranged: false });
  });
});
