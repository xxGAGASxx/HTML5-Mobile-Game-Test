import { describe, expect, it } from 'vitest';
import { HOUR_MS, IslandMap, harvestYield, type MapNodeDef } from './IslandMap';
import { threatLabel } from './Threat';

// camp - a - b - boss, with an elite hanging off a and a resource site off b.
const NODES: MapNodeDef[] = [
  { id: 'camp', kind: 'camp', links: ['a'] },
  { id: 'a', kind: 'encounter', links: ['b', 'elite'] },
  { id: 'elite', kind: 'elite', links: [] },
  { id: 'b', kind: 'encounter', links: ['boss', 'fish'] },
  { id: 'fish', kind: 'resource', links: [] },
  { id: 'boss', kind: 'boss', links: [] },
];

describe('IslandMap', () => {
  it('starts with only the camp and its neighbours out of the fog', () => {
    const map = new IslandMap(NODES);
    expect(map.ids.filter((id) => map.isRevealed(id))).toEqual(['camp', 'a']);
    expect(map.status('a', 0)).toEqual({ kind: 'open', firstClear: true });
    expect(map.status('b', 0)).toEqual({ kind: 'hidden' });
    expect(map.status('camp', 0)).toEqual({ kind: 'camp' });
  });

  it('treats links as two-way paths', () => {
    const map = new IslandMap(NODES);
    expect(map.neighbours('elite')).toEqual(['a']);
    expect(map.edges()).toContainEqual(['a', 'camp']);
    expect(map.edges()).toHaveLength(5);
  });

  it('clearing a node reveals its neighbours once', () => {
    const map = new IslandMap(NODES);
    expect(map.clear('a', 0)).toEqual(['elite', 'b']);
    expect(map.status('b', 0).kind).toBe('open');
  });

  it('respawns encounters after 2 h and elites after 8 h, keeping the fog lifted', () => {
    const map = new IslandMap(NODES);
    map.clear('a', 1000);
    expect(map.status('a', 1000 + HOUR_MS)).toEqual({ kind: 'respawning', respawnAt: 1000 + 2 * HOUR_MS });
    expect(map.canFight('a', 1000 + HOUR_MS)).toBe(false);
    expect(map.status('a', 1000 + 2 * HOUR_MS)).toEqual({ kind: 'open', firstClear: false });
    expect(map.clear('a', 1000 + 2 * HOUR_MS)).toEqual([]);

    map.clear('elite', 0);
    expect(map.canFight('elite', 7 * HOUR_MS)).toBe(false);
    expect(map.canFight('elite', 8 * HOUR_MS)).toBe(true);
    expect(map.isRevealed('b')).toBe(true);
  });

  it('refuses to clear hidden, respawning or secured nodes', () => {
    const map = new IslandMap(NODES);
    expect(() => map.clear('b', 0)).toThrow();
    expect(() => map.clear('camp', 0)).toThrow();
    map.clear('a', 0);
    expect(() => map.clear('a', 0)).toThrow();
  });

  it('a beaten boss stays beaten and clears the region', () => {
    const map = new IslandMap(NODES);
    map.clear('a', 0);
    map.clear('b', 0);
    expect(map.regionCleared).toBe(false);
    map.clear('boss', 0);
    expect(map.status('boss', 100 * HOUR_MS)).toEqual({ kind: 'secured' });
    expect(map.regionCleared).toBe(true);
  });

  it('a secured resource site produces until harvested', () => {
    const map = new IslandMap(NODES);
    map.clear('a', 0);
    map.clear('b', 0);
    expect(() => map.harvest('fish', 0)).toThrow();
    map.clear('fish', 1000);
    expect(map.status('fish', 1000)).toEqual({ kind: 'secured' });
    expect(map.sinceHarvest('fish', 1000 + HOUR_MS)).toBe(HOUR_MS);
    map.harvest('fish', 1000 + HOUR_MS);
    expect(map.sinceHarvest('fish', 1000 + HOUR_MS)).toBe(0);
  });

  it('rejects maps with unknown links or no single camp', () => {
    expect(() => new IslandMap([{ id: 'camp', kind: 'camp', links: ['nowhere'] }])).toThrow();
    expect(() => new IslandMap([{ id: 'a', kind: 'encounter', links: [] }])).toThrow();
  });
});

describe('harvestYield', () => {
  it('grows with time and stops at the cap', () => {
    expect(harvestYield(60, 2, HOUR_MS / 2)).toBe(30);
    expect(harvestYield(60, 2, 10 * HOUR_MS)).toBe(120);
    expect(harvestYield(60, 2, 0)).toBe(0);
  });
});

describe('threatLabel', () => {
  it('follows the GDD 04 thresholds', () => {
    expect(threatLabel(60, 100)).toBe('trivial');
    expect(threatLabel(70, 100)).toBe('easy');
    expect(threatLabel(100, 100)).toBe('fair');
    expect(threatLabel(120, 100)).toBe('hard');
    expect(threatLabel(140, 100)).toBe('deadly');
  });
});
