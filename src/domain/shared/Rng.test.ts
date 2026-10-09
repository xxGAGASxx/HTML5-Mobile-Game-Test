import { describe, expect, it } from 'vitest';
import { Rng } from './Rng';

describe('Rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('gives different sequences for different seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
});
