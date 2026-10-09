export interface AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}
