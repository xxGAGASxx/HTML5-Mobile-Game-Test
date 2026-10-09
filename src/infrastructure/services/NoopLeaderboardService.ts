import type { LeaderboardService } from '../../application/ports';

/** Stand-in until LocalLeaderboardService (IndexedDB personal bests) exists. */
export class NoopLeaderboardService implements LeaderboardService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async submit(): Promise<void> {}

  async top(): Promise<{ name: string; score: number }[]> {
    return [];
  }
}
