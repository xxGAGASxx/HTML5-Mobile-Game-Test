# 13. Technical Design

## Reference [O/I]

- Native Android and Google Play Games on PC [O]; 165–175 MB install [R]; offline play [O].
- Engine unpublished; size and studio history suggest Unity [I].
- Latest fix: battle start raced with an async army-rating computation [O]. We design to avoid this.

## Stack (from CLAUDE.md) [P]

| Concern | Choice |
|---|---|
| Rendering, sprites, UI | PixiJS (v8) |
| Tweening | AnimeJS |
| Architecture | Domain Driven Design |
| Icons | game-icons.net SVGs, rasterized into spritesheets |
| Language/build | TypeScript + Vite (proposed) |
| Offline | Service worker, IndexedDB save |

## Distribution: Web + Mobile [P]

One TypeScript codebase, two targets:

| Target | Build | Notes |
|---|---|---|
| Web | Static Vite build, installable PWA (manifest + service worker) | Any modern mobile or desktop browser; offline after first load |
| Mobile app | Same web build wrapped with Capacitor (Android first, iOS optional) | Native splash, icon, haptics, status bar; storage via IndexedDB (or a Capacitor Preferences adapter) |

Platform differences go behind a `Platform` port (`vibrate`, `share`, `openUrl`, `isNativeApp`,
`safeAreaInsets`) with `WebPlatform` and `CapacitorPlatform` adapters. Domain code never checks
the platform.

## Domain Driven Design

### Bounded contexts

| Context | Responsibility | Key aggregates |
|---|---|---|
| **Army** | Roster, formation, power | `Army`, `Unit`, `Formation` |
| **Combat** | Deterministic battle simulation | `Battle`, `Combatant` |
| **Exploration** | Map, nodes, fog, respawns | `IslandMap`, `MapNode` |
| **Economy** | Wallets, costs, prices | `Wallet`, `PriceList` |
| **Gathering** | Jobs, offline accrual | `GatheringJob`, `OfflineSession` |
| **Progression** | Levels, ranks, Captain skills | `CaptainSkillTree`, `UnitProgress` |
| **Relics** | Inventory, crafting | `Relic`, `RelicInventory` |
| **Narrative** | Dialogue, codex, flags | `StoryState` |
| **Meta** | Save, settings, entitlements; service ports (deferred, see 16) | `SaveGame` |

Contexts talk through **domain events** (`BattleWon`, `UnitPersuaded`, `CurrencySpent`,
`NodeCleared`, `FormationChanged`) on an in-process event bus; no context imports another's
internals.

### Layers per context

```
src/
  domain/<context>/        entities, value objects, domain services, events (pure TS, no Pixi)
  application/<context>/   use cases (HireUnit, StartBattle, CollectOffline)
  application/ports/       service interfaces: Ads, Store, CloudSave, Leaderboard, Analytics, RemoteConfig
  infrastructure/          IndexedDB repo, clock, RNG, asset loader
  infrastructure/services/ placeholder adapters (Noop*/Dev*); real SDKs later (see 16)
  presentation/            Pixi scenes, views, AnimeJS tweens, input
  data/                    units.json, enemies.json, economy.json, map/*.json
```

The domain layer has no dependency on PixiJS or the DOM, so it runs in Node for unit tests and the
economy simulator.

### Combat determinism

- Fixed 10 Hz tick, seeded RNG (`mulberry32`), integer math for HP/damage.
- The presentation layer interpolates between ticks and plays AnimeJS tweens from emitted
  `CombatEvent`s; rendering never mutates state.
- Speed modes run more ticks per frame, not a different simulation.

### Army Power consistency

`Army.power` is a **synchronous pure function** of the formation, recomputed in the
`FormationChanged` handler. `StartBattle` reads the current value; there is no async window.
This removes the class of bug in the reference's 1.3.2326 fix [O].

### Save

- Single JSON document `SaveGame` (versioned, with migrations), stored in IndexedDB, autosaved on
  every domain event batch and on `visibilitychange`.
- Export/import as a base64 string in Settings. No backend for now; `CloudSaveService` is a
  placeholder port (see [16-deferred-integrations.md](16-deferred-integrations.md)).
- Offline time: store `lastSeenAt` (wall clock) and a monotonic play counter; reject negative gaps.

### Performance budget

| Item | Budget |
|---|---|
| Initial JS (gzip) | < 400 KB |
| First load total | < 15 MB |
| Draw calls in battle | < 40 |
| Memory | < 250 MB on mid Android |
| Frame | 16.6 ms target, 33 ms floor |

Techniques: texture atlases per biome, object pools for units/particles/numbers, `cacheAsTexture` for
static UI panels, render resolution capped at devicePixelRatio 2.

### Testing

- Domain unit tests (Vitest) for formulas, persuade chance, offline accrual, save migrations.
- Golden battle tests: fixed seed plus formation equals the exact expected outcome.
- Economy simulator outputs time-to-milestone and fails CI if any milestone exceeds its target.
