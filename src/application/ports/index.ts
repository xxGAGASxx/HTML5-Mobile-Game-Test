export type { AdPlacement, AdResult, AdsService } from './AdsService';
export type { AnalyticsService } from './AnalyticsService';
export type { CloudSaveService } from './CloudSaveService';
export type { LeaderboardId, LeaderboardService } from './LeaderboardService';
export type { Platform, SafeAreaInsets } from './Platform';
export type { RemoteConfigService } from './RemoteConfigService';
export type { Product, PurchaseResult, StoreService } from './StoreService';

import type { AdsService } from './AdsService';
import type { AnalyticsService } from './AnalyticsService';
import type { CloudSaveService } from './CloudSaveService';
import type { LeaderboardService } from './LeaderboardService';
import type { RemoteConfigService } from './RemoteConfigService';
import type { StoreService } from './StoreService';

/** The set of external services wired in the composition root (src/main.ts). */
export interface Services {
  ads: AdsService;
  store: StoreService;
  cloudSave: CloudSaveService;
  leaderboard: LeaderboardService;
  analytics: AnalyticsService;
  config: RemoteConfigService;
}
