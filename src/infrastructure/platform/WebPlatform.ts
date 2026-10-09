import type { Platform, SafeAreaInsets } from '../../application/ports';

export class WebPlatform implements Platform {
  readonly isNativeApp = false;

  vibrate(ms: number): void {
    navigator.vibrate?.(ms);
  }

  async share(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
    if (!navigator.share) return false;
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  }

  openUrl(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  safeAreaInsets(): SafeAreaInsets {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
    return {
      top: read('--sat'),
      right: read('--sar'),
      bottom: read('--sab'),
      left: read('--sal'),
    };
  }
}
