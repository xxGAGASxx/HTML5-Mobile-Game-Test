// Composition root: the only place that picks concrete adapters.
import { GameSession } from './application/GameSession';
import { CONTENT } from './data/content';
import { WebPlatform } from './infrastructure/platform/WebPlatform';
import { createServices, type ServicesMode } from './infrastructure/services/createServices';
import { loadIcons } from './presentation/assets/icons';
import { loadMap } from './presentation/assets/maps';
import { loadPixelAssets } from './presentation/assets/pixel';
import { Game } from './presentation/Game';
import { BattleScene } from './presentation/scenes/BattleScene';
import { BootScene } from './presentation/scenes/BootScene';
import { CampScene } from './presentation/scenes/CampScene';
import { GalleryScene } from './presentation/scenes/GalleryScene';
import { MapScene } from './presentation/scenes/MapScene';

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

  const [icons, pixel, island] = await Promise.all([loadIcons(), loadPixelAssets(), loadMap(CONTENT.region.id)]);
  const params = new URLSearchParams(window.location.search);
  // ?timescale=60 makes the game clock run 60x, for trying respawns and resource sites quickly.
  const timescale = Math.max(1, Number(params.get('timescale')) || 1);
  const startedAt = Date.now();
  const clock = (): number => startedAt + (Date.now() - startedAt) * timescale;
  // No save yet (M5): every page load is a fresh run. The seed only varies battle rolls.
  const session = new GameSession(CONTENT, Date.now() >>> 0, clock);
  session.events.subscribe('BattleWon', (e) => services.analytics.track('battle_won', { node: e.nodeId }));
  session.events.subscribe('BattleLost', (e) => services.analytics.track('battle_lost', { node: e.nodeId }));
  session.events.subscribe('NodeCleared', (e) => services.analytics.track('node_cleared', { node: e.nodeId, auto: e.auto }));
  session.events.subscribe('RegionCleared', () => services.analytics.track('region_cleared', { region: CONTENT.region.id }));
  session.events.subscribe('UnitHired', (e) => services.analytics.track('unit_hired', { type: e.typeId }));

  const roster = [...CONTENT.playerUnits.map((type) => ({ type, enemy: false })), ...CONTENT.enemyUnits.map((type) => ({ type, enemy: true }))];
  const toMap = (focus?: string, reveal: readonly string[] = []): void =>
    game.show(new MapScene(session, icons, pixel, island, { focus, reveal }, { onCamp: toCamp, onFight: toBattle }));
  const toBattle = (nodeId: string): void =>
    game.show(
      new BattleScene(session, nodeId, icons, pixel, {
        onDone: (report) => toMap(nodeId, report.revealed),
        onNextFloor: () => toBattle(nodeId),
        onRetreat: () => {
          session.retreat();
          toMap(nodeId);
        },
      }),
    );
  const toCamp = (): void => game.show(new CampScene(session, icons, pixel, () => toMap(), toGallery));
  const toGallery = (): void => game.show(new GalleryScene(roster, pixel, toCamp));
  if (params.has('gallery')) toGallery();
  else toMap();
})();
