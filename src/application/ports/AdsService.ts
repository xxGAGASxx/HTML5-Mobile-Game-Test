export type AdPlacement = 'offline_double' | 'battle_double' | 'tavern_refresh' | 'persuade_retry';

export type AdResult =
  | { status: 'rewarded' }
  | { status: 'skipped' } // user closed early
  | { status: 'unavailable' }; // no fill, no SDK, offline

export interface AdsService {
  isAvailable(placement: AdPlacement): Promise<boolean>;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}
