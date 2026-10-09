import type { AdResult, AdsService } from '../../application/ports';

export class NoopAdsService implements AdsService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async showRewarded(): Promise<AdResult> {
    return { status: 'unavailable' };
  }
}
