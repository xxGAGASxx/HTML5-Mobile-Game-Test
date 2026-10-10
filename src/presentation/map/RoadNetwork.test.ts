import { describe, expect, it } from 'vitest';
import { RoadNetwork } from './RoadNetwork';

// camp (0,0) - a (100,0) - b (100,100), plus camp - c (0,100): straight roads.
const net = new RoadNetwork({
  'camp|a': [
    [0, 0],
    [50, 0],
    [100, 0],
  ],
  'a|b': [
    [100, 0],
    [100, 100],
  ],
  'camp|c': [
    [0, 0],
    [0, 100],
  ],
});
const all = (): boolean => true;

describe('RoadNetwork', () => {
  it('finds the road under a tap, snapping to a node near its ends', () => {
    expect(net.nearest(40, 5, 10, all)).toEqual({ a: 'camp', b: 'a', d: 40 });
    expect(net.nearest(99, 1, 10, all)).toEqual({ node: 'a' });
    expect(net.nearest(50, 50, 10, all)).toBeNull();
    expect(net.nearest(40, 5, 10, (a) => a !== 'camp')).toBeNull();
  });

  it('plans the walk to a node through passable nodes', () => {
    const walk = net.plan({ node: 'camp' }, { node: 'b' }, all)!;
    expect(walk.nodes).toEqual(['a', 'b']);
    expect(walk.length).toBe(200);
    expect(walk.legs).toEqual([
      { a: 'camp', b: 'a', from: 0, to: 100 },
      { a: 'a', b: 'b', from: 0, to: 100 },
    ]);
  });

  it('will not pass through a node it may not cross, but may end on it or leave it', () => {
    const notA = (n: string): boolean => n !== 'a';
    expect(net.plan({ node: 'camp' }, { node: 'b' }, notA)).toBeNull();
    expect(net.plan({ node: 'camp' }, { node: 'a' }, notA)!.nodes).toEqual(['a']);
    expect(net.plan({ node: 'a' }, { node: 'c' }, notA)!.nodes).toEqual(['camp', 'c']);
  });

  it('walks to and from spots partway along a road', () => {
    const mid = net.plan({ node: 'c' }, { a: 'a', b: 'b', d: 30 }, all)!;
    expect(mid.nodes).toEqual(['camp', 'a']);
    expect(mid.length).toBe(230);
    expect(net.pointAt(mid.to)).toEqual({ x: 100, y: 30 });
    expect(mid.legs.at(-1)).toEqual({ a: 'a', b: 'b', from: 0, to: 30 });

    const back = net.plan({ a: 'camp', b: 'a', d: 40 }, { node: 'camp' }, all)!;
    expect(back.length).toBe(40);
    expect(back.nodes).toEqual(['camp']);
    expect(back.legs).toEqual([{ a: 'camp', b: 'a', from: 40, to: 0 }]);

    const along = net.plan({ a: 'camp', b: 'a', d: 40 }, { a: 'a', b: 'camp', d: 10 }, all)!;
    expect(along.length).toBe(50);
    expect(along.nodes).toEqual([]);
    expect(along.legs).toEqual([{ a: 'camp', b: 'a', from: 40, to: 90 }]);
  });
});
