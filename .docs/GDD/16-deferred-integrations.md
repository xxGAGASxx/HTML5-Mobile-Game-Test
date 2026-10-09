# 16. Deferred Integrations: Backend & Service SDKs

**Status: DEFERRED.** We are not building a backend or integrating any ads, IAP or analytics SDK
for now. The game ships fully client-side and offline. This document defines the **ports**
(interfaces) and **placeholder adapters** that stand in for them, so we can plug real services
in later without touching domain code.

## Decision [P]

| Area | Now | Later |
|---|---|---|
| Backend (cloud save, leaderboards, remote config, accounts) | None. Local IndexedDB save, export/import string | Pick a provider and implement the same ports |
| Ads SDK | `NoopAdsService`: rewarded "ads" grant the reward instantly (dev) or are hidden (release flag) | Real SDK adapter chosen by distribution channel |
| IAP / payments SDK | `NoopStoreService`: catalog is shown as "Coming soon"; purchases disabled | Real store adapter chosen by distribution channel |
| Analytics / telemetry | `ConsoleAnalytics` in dev, `NoopAnalytics` in release | Real adapter |
| Remote config | `LocalConfig` reading bundled `data/*.json` | Fetched config with local fallback |

Why: the open question of the distribution channel (web portal, PWA, or wrapped app; see 15)
decides which SDKs are even possible. Defining ports now keeps the domain clean (DDD) and lets
gameplay ship first.

## Rules while deferred

1. Domain and application layers depend **only on the interfaces** below, never on an SDK.
2. Adapters live in `src/infrastructure/services/` and are wired in one composition root
   (`src/main.ts`) using a build flag, e.g. `import.meta.env.VITE_SERVICES = "noop" | "dev"`.
3. Every call is **async and may fail**; callers must handle `unavailable` gracefully.
   The game is fully playable when every service is unavailable.
4. UI hides ad and shop entry points when `isAvailable()` is false (release build with no-op
   adapters shows no ad buttons and no shop tab).
5. Premium currency (Pearls) can only be earned from gameplay while IAP is deferred.

## Ports (TypeScript interfaces)

```ts
// src/application/ports/AdsService.ts
export type AdPlacement =
  | 'offline_double' | 'battle_double' | 'tavern_refresh' | 'persuade_retry';

export type AdResult =
  | { status: 'rewarded' }
  | { status: 'skipped' }        // user closed early
  | { status: 'unavailable' };   // no fill, no SDK, offline

export interface AdsService {
  isAvailable(placement: AdPlacement): Promise<boolean>;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}
```

```ts
// src/application/ports/StoreService.ts
export interface Product {
  id: string;                 // e.g. 'pearls_small', 'remove_ads', 'expedition_pass'
  title: string;
  priceLabel: string;         // localized string from the store; never computed by us
  kind: 'consumable' | 'non_consumable' | 'subscription';
}

export type PurchaseResult =
  | { status: 'purchased'; productId: string; receipt: string }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'unavailable' };

export interface StoreService {
  isAvailable(): Promise<boolean>;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<string[]>;   // owned non-consumable/subscription ids
}
```

```ts
// src/application/ports/CloudSaveService.ts
export interface CloudSaveService {
  isAvailable(): Promise<boolean>;
  load(): Promise<{ save: string; updatedAt: number } | null>;
  store(save: string, updatedAt: number): Promise<void>;
}
```

```ts
// src/application/ports/LeaderboardService.ts
export interface LeaderboardService {
  isAvailable(): Promise<boolean>;
  submit(board: 'deep_ruins_weekly', score: number): Promise<void>;
  top(board: 'deep_ruins_weekly', limit: number): Promise<{ name: string; score: number }[]>;
}
```

```ts
// src/application/ports/AnalyticsService.ts
export interface AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}
```

```ts
// src/application/ports/RemoteConfigService.ts
export interface RemoteConfigService {
  get<T>(key: string, fallback: T): T;   // sync read of last known values
  refresh(): Promise<void>;              // no-op while deferred
}
```

## Placeholder adapters

| Adapter | Behavior |
|---|---|
| `NoopAdsService` | `isAvailable` → false; `showRewarded` → `unavailable` |
| `DevAdsService` | `isAvailable` → true; shows a 2 s fake overlay, then `rewarded` (dev builds only, to test reward flows) |
| `NoopStoreService` | `isAvailable` → false; empty products |
| `DevStoreService` | Fake catalog from `data/products.json`; `purchase` → `purchased` with a fake receipt (dev only) |
| `NoopCloudSaveService` | `isAvailable` → false |
| `LocalLeaderboardService` | Stores personal bests in IndexedDB; `top` returns the player's own runs |
| `NoopAnalytics` / `ConsoleAnalytics` | Discard / `console.debug` |
| `LocalConfig` | Reads bundled JSON |

## Domain impact

- **Economy**: reward multipliers from ads come through an application use case
  (`ClaimAdReward(placement)`) that calls `AdsService` and then emits a normal domain event
  (`RewardDoubled`). The domain never knows an ad existed.
- **Meta**: entitlements (`removeAds`, `expeditionPass`) are stored in `SaveGame.entitlements`
  and only written by a `GrantEntitlement` use case, which later a real `StoreService` will feed.
- **Save**: `SaveGame` already carries `version` and `updatedAt`, so a future cloud save can
  resolve conflicts by newest `updatedAt` with a user prompt.

## What to decide when we return

1. Distribution channel(s): web portal (e.g. a portal SDK that bundles ads), installable PWA,
   or a wrapped app (Capacitor or similar, which unlocks native ads and store billing).
2. Ads provider and IAP provider, based on (1).
3. Backend: managed BaaS vs. our own service; needed for cloud save, leaderboards, receipt
   validation and remote config.
4. Receipt validation: server-side is required before selling anything that matters;
   until a backend exists, do not sell consumables.
5. Privacy and consent: consent dialog (GDPR/CCPA) required before any ad or analytics SDK.
6. Analytics events list (session start/end, battle result, purchase funnel, ad funnel).

## Checklist to un-defer

- [ ] Channel chosen
- [ ] Adapter implemented per port, behind the same interface
- [ ] Consent flow added
- [ ] Receipt validation in place before enabling paid products
- [ ] Remove `Dev*` adapters from release builds
- [ ] Update 10-monetization.md status from "Deferred" to "Active"
