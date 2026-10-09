export interface RemoteConfigService {
  get<T>(key: string, fallback: T): T; // sync read of last known values
  refresh(): Promise<void>; // no-op while deferred
}
