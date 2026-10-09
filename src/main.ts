// Composition root: the only place that picks concrete adapters.
import { GameSession } from './application/GameSession';
import { CONTENT } from './data/content';
import { WebPlatform } from './infrastructure/platform/WebPlatform';
import { createServices, type ServicesMode } from './infrastructure/services/createServices';
import { loadIcons } from './presentation/assets/icons';
import { loadPixelAssets } from './presentation/assets/pixel';
import { Game } from './presentation/Game';
import { BattleScene } from './presentation/scenes/BattleScene';
import { BootScene } from './presentation/scenes/BootScene';
import { CampScene } from './presentation/scenes/CampScene';
import { GalleryScene } from './presentation/scenes/GalleryScene';

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

  const [icons, pixel] = await Promise.all([loadIcons(), loadPixelAssets()]);
  // No save yet (M5): every page load is a fresh run. The seed only varies battle rolls.
  const session = new GameSession(CONTENT, Date.now() >>> 0);
  session.events.subscribe('BattleWon', (e) => services.analytics.track('battle_won', { wave: e.wave }));
  session.events.subscribe('BattleLost', (e) => services.analytics.track('battle_lost', { wave: e.wave }));
  session.events.subscribe('UnitHired', (e) => services.analytics.track('unit_hired', { type: e.typeId }));

  const roster = [...CONTENT.playerUnits.map((type) => ({ type, enemy: false })), ...CONTENT.enemyUnits.map((type) => ({ type, enemy: true }))];
  const toCamp = (): void => game.show(new CampScene(session, icons, toBattle, toGallery));
  const toBattle = (): void => game.show(new BattleScene(session, icons, pixel, toCamp));
  const toGallery = (): void => game.show(new GalleryScene(roster, icons, pixel, toCamp));
  if (new URLSearchParams(window.location.search).has('gallery')) toGallery();
  else toCamp();
})();
