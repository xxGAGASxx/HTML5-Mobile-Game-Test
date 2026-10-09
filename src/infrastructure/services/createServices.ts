import type { Services } from '../../application/ports';
import { ConsoleAnalytics, NoopAnalytics } from './Analytics';
import { LocalConfig } from './LocalConfig';
import { NoopAdsService } from './NoopAdsService';
import { NoopCloudSaveService } from './NoopCloudSaveService';
import { NoopLeaderboardService } from './NoopLeaderboardService';
import { NoopStoreService } from './NoopStoreService';

export type ServicesMode = 'noop' | 'dev';

/** Placeholder adapters while backend and SDKs are deferred (.docs/GDD/16-deferred-integrations.md). */
export function createServices(mode: ServicesMode): Services {
  return {
    ads: new NoopAdsService(),
    store: new NoopStoreService(),
    cloudSave: new NoopCloudSaveService(),
    leaderboard: new NoopLeaderboardService(),
    analytics: mode === 'dev' ? new ConsoleAnalytics() : new NoopAnalytics(),
    config: new LocalConfig(),
  };
}
