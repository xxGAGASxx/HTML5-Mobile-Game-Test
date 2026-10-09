export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Everything that differs between the web build and the Capacitor app. Domain code never checks the platform. */
export interface Platform {
  readonly isNativeApp: boolean;
  vibrate(ms: number): void;
  share(data: { title?: string; text?: string; url?: string }): Promise<boolean>;
  openUrl(url: string): void;
  safeAreaInsets(): SafeAreaInsets;
}
