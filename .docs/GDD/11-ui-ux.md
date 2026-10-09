# 11. UI / UX

## Reference [O/R]

- Portrait 2D layout [R]; map tapped to explore [R].
- No stat preview on upgrades [R]; "lack of explanation" [R].
- Added an in-game support ticket menu in the latest update [O].

## Our screens [P]

```
Bottom nav: [Map] [Army] [Camp] [Relics] [Bounties]
Top bar:    Gold | Food | Wood | Stone | Pearls      (tap = income/hour)
```

| Screen | Purpose | Key elements |
|---|---|---|
| Map | Explore | Scrollable node map, fog, node popups (Threat vs Power, loot preview, respawn timer) |
| Pre-battle | Prepare | Enemy grid preview, our 3x3 grid (drag to place), Power delta live |
| Battle | Watch and tap | Unit HP bars, Rally meter, hero skill portraits, speed toggle, retreat |
| Results | Reward | Loot fly-in, XP bars, Spare/Claim cards per enemy |
| Army | Roster | Filters by role, unit card with before/after upgrade, assign to job |
| Camp | Base | Buildings, tavern, gather jobs, goal bar |
| Relics | Gear | Inventory, craft, salvage |
| Bounties | Repeatables | Daily contracts, Deep Ruins entry |
| Settings | Options | Audio, speed default, haptics, save export/import, support/feedback |

### UX rules

- One-thumb reach: primary actions in the bottom 40% of the screen.
- Touch targets at least 44 x 44 CSS px.
- Every new system gets a 1–3 step contextual tooltip on first open (fixes "lack of explanation" [R]).
- Numbers: abbreviated, with full value on long-press.
- Red dot badges only when an action is actually affordable.
- Support: "Report a problem" in Settings that copies a save snapshot and device info to the clipboard
  or opens a mail link (mirrors the reference's support ticket [O] without a backend).

### Icons

All UI icons come from https://game-icons.net (CC BY 3.0, attribution required in Credits). Icon
slugs named in these docs are indicative; confirm the exact slug on the site when importing.
Pipeline: download SVG, recolor to palette, rasterize into a PixiJS spritesheet at 1x/2x.

| Concept | Suggested icon |
|---|---|
| Battle | crossed-swords |
| Guard / Fighter / Shooter / Caster / Support | shield, broadsword, bow-arrow, magic-swirl, healing |
| Gold / Food / Wood / Stone | two-coins, meat, wood-pile, stone-block |
| Relic | ancient-sword or gem-pendant |
| Persuade / Claim | shaking-hands / skull-crossed-bones |
| Camp | camping-tent |
