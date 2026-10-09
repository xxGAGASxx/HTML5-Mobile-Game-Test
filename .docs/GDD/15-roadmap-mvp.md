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

## Milestones

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Project skeleton | Vite + TS + PixiJS + AnimeJS boot; DDD folder layout; CI runs tests |
| M1 | Combat sandbox | Deterministic battle with golden tests; Pixi view with tweens |
| M2 | Army & formation | Roster, drag-to-place grid, live Power |
| M3 | Map & loop | Node map, fog, respawns, loot, Spare/Claim |
| M4 | Economy & camp | Hire, upgrade with preview, gathering, offline return |
| M5 | Vertical slice | Region 1 complete, tutorial, save, playtest on 3 phones |
| M6 | Content alpha | Regions 2–3, relics, skill tree, Support role |
| M7 | Beta | All 5 regions, Deep Ruins, ads/IAP adapter, audio |

## Open questions

1. Distribution channel (web portal, PWA, or wrapped app)? It decides the ad and IAP SDKs.
2. Art: commission sprites, or stay with stylized icon-based units for MVP?
3. Is a backend wanted later (cloud save, leaderboards)? The DDD repositories allow swapping it in.
4. Working title and IP: confirm the name doesn't collide with the reference game's.
