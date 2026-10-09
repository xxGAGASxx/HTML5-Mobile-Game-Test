import type { RemoteConfigService } from '../../application/ports';

/** Reads values bundled with the build (later: data/*.json). */
export class LocalConfig implements RemoteConfigService {
  constructor(private readonly values: Readonly<Record<string, unknown>> = {}) {}

  get<T>(key: string, fallback: T): T {
    return key in this.values ? (this.values[key] as T) : fallback;
  }

  async refresh(): Promise<void> {}
}
