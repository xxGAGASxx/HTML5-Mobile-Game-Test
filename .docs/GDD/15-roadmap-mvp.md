# 15. Roadmap & MVP

## MVP scope (vertical slice) [P]

Goal: one region played end to end in the browser on a phone, proving the core loop is fun.

**In:**
- Region 1 (Wreck Coast): about 12 nodes, 1 ruin, 1 boss.
- Battle: 3x3 grid, 4 roles (no Support yet), Rally meter, 2 hero skills, 1x/2x speed.
- Army: 6 unit types, hire and persuade, formation editor, Army Power.
- Economy: Gold, Food, Wood. Camp with tavern and 2 gathering jobs.
- Offline accrual (8 h cap) and return screen.
- Save to IndexedDB, export/import.
- Placeholder art from game-icons.net silhouettes.

**Out (later):** relics, Captain skill tree, Stone/Renown/Relic Dust, regions 2–5, Deep Ruins,
monetization, audio polish.

**Deferred until further notice:** backend and all service SDKs (ads, IAP, analytics). Only their
interfaces and no-op placeholders are built; see [16-deferred-integrations.md](16-deferred-integrations.md).

## Milestones

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Project skeleton | Vite + TS + PixiJS + AnimeJS boot; DDD folder layout; service ports with Noop adapters; CI runs tests |
| M1 | Combat sandbox | Deterministic battle with golden tests; Pixi view with tweens |
| M2 | Army & formation | Roster, drag-to-place grid, live Power |
| M3 | Map & loop | Node map, fog, respawns, loot, Spare/Claim |
| M4 | Economy & camp | Hire, upgrade with preview, gathering, offline return |
| M5 | Vertical slice | Region 1 complete, tutorial, save, playtest on 3 phones; art style chosen |
| M5.5 | Mobile build | Capacitor Android build of the slice; PWA install tested |
| M6 | Content alpha | Regions 2–3, relics, skill tree, Support role |
| M7 | Beta | All 5 regions, Deep Ruins, audio |
| M8 | Services (deferred) | Channel chosen; real Ads/IAP/backend adapters behind existing ports |

## Decisions (2026-10-09)

| # | Question | Answer |
|---|---|---|
| 1 | Distribution channel | **Web + Mobile**: PWA and a Capacitor-wrapped app from one codebase (13) |
| 2 | Art style | **Leaning pixel art.** References in `.docs/Art-Style/`; confirm with the style test (12) |
| 3 | Backend | **Later.** Placeholder interfaces only (16) |
| 4 | Title and IP | **Non-commercial.** Working title *Wreckbound*, no reuse of the reference's name or IP (01) |

## Open questions

1. Art style: pick after the style test in [12-art-audio.md](12-art-audio.md).
