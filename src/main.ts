// Composition root: the only place that picks concrete adapters.
import { WebPlatform } from './infrastructure/platform/WebPlatform';
import { createServices, type ServicesMode } from './infrastructure/services/createServices';
import { Game } from './presentation/Game';
import { BootScene } from './presentation/scenes/BootScene';

(async () => {
  const servicesMode: ServicesMode = import.meta.env.VITE_SERVICES === 'dev' || import.meta.env.DEV ? 'dev' : 'noop';
  const services = createServices(servicesMode);
  const platform = new WebPlatform();

  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game element missing');

  const game = new Game();
  await game.init(parent);
  game.show(new BootScene());

  services.analytics.track('boot', { native: platform.isNativeApp });
})();
