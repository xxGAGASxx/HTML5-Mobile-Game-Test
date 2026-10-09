import type { AnalyticsService } from '../../application/ports';

export class NoopAnalytics implements AnalyticsService {
  track(): void {}
}

export class ConsoleAnalytics implements AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean>): void {
    console.debug('[analytics]', event, props ?? {});
  }
}
