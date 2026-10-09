export type LeaderboardId = 'deep_ruins_weekly';

export interface LeaderboardService {
  isAvailable(): Promise<boolean>;
  submit(board: LeaderboardId, score: number): Promise<void>;
  top(board: LeaderboardId, limit: number): Promise<{ name: string; score: number }[]>;
}
