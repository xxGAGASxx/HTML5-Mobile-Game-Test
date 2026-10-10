import { describe, expect, it } from 'vitest';
import { FOG_LEVELS, HOLE_RX, fogDensity } from './FogOfWar';

const FULL = FOG_LEVELS - 1;
const at = (grid: Uint8Array, cols: number, x: number, y: number): number => grid[y * cols + x]!;

describe('fogDensity', () => {
  it('fogs everything when nothing is revealed', () => {
    const grid = fogDensity(40, 20, 2, [], []);
    expect(grid.length).toBe(20 * 10);
    expect([...grid].every((v) => v === FULL)).toBe(true);
  });

  it('clears around a revealed node and stays thick far from it', () => {
    const grid = fogDensity(400, 200, 2, [{ x: 100, y: 100, scale: 1 }], []);
    expect(at(grid, 200, 50, 50)).toBe(0);
    expect(at(grid, 200, 190, 50)).toBe(FULL);
  });

  it('keeps a node shut while its reveal has not started', () => {
    const grid = fogDensity(400, 200, 2, [{ x: 100, y: 100, scale: 0 }], []);
    expect(at(grid, 200, 50, 50)).toBe(FULL);
  });

  it('clears a strip along an open road', () => {
    const road: [number, number][] = [
      [0, 100],
      [400, 100],
    ];
    const grid = fogDensity(400, 200, 2, [], [road]);
    expect(at(grid, 200, 150, 50)).toBe(0);
    expect(at(grid, 200, 150, 10)).toBe(FULL);
  });

  it('dithers the edge between clear and full fog', () => {
    const grid = fogDensity(400, 200, 2, [{ x: 200, y: 100, scale: 1 }], []);
    const row = [...grid.slice(50 * 200, 51 * 200)];
    const edge = row.slice(100 + HOLE_RX / 2, 100 + HOLE_RX);
    expect(edge.some((v) => v > 0 && v < FULL)).toBe(true);
  });
});
