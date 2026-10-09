import { describe, expect, it } from 'vitest';
import { createServices } from './createServices';

describe('createServices (noop)', () => {
  it('reports every service as unavailable so the game runs fully offline', async () => {
    const s = createServices('noop');
    expect(await s.ads.isAvailable('battle_double')).toBe(false);
    expect(await s.ads.showRewarded('battle_double')).toEqual({ status: 'unavailable' });
    expect(await s.store.isAvailable()).toBe(false);
    expect(await s.store.purchase('pearls_small')).toEqual({ status: 'unavailable' });
    expect(await s.cloudSave.isAvailable()).toBe(false);
    expect(await s.leaderboard.isAvailable()).toBe(false);
    expect(s.config.get('missing', 42)).toBe(42);
  });
});
