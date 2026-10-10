# Pixel art sources

Self-made pixel art for every unit, effect and battlefield tile (style decided in
[GDD 12](../../.docs/GDD/12-art-audio.md)). Nothing here ships directly: `npm run sprites` turns these sources into the files the game loads.

| File | What it holds |
|---|---|
| `palette.ts` | The one palette every sprite uses: 4-shade ramps (dark to light) per material |
| `canvas.ts` | Tiny pixel canvas: shaded shapes, lines, 1 px outline, rotate, dither fade |
| `humanoid.ts` | Paper-doll builder for 3/4 front-view people: outfit recipe + pose per frame |
| `creatures.ts` | Shore crab and coast wolf |
| `units.ts` | One recipe per unit (ids match `src/data/units.ts`) and its poses: idle 4f, attack 6f, hit 2f, death 6f |
| `fx.ts` | Slash, hit spark, magic burst, projectiles, death dust, shadow, beach props and ground tiles |

Output (committed, served by Vite from `public/`):

- `public/assets/sprites/pixel.png` + `pixel.json`: one PixiJS atlas with every frame and animation
  (`<unit id>/<idle|attack|hit|death>`, `fx/*`, `deco/*`, `shadow`).
- `public/assets/sprites/ground-*.png`: seamless tiles for `TilingSprite`.

Units are drawn in a 48 x 48 cell with the feet on row 44, and shown at an integer zoom with
nearest-neighbour sampling. To add a unit: add a recipe in `units.ts` keyed by its `UnitType` id,
run `npm run sprites`, and the game picks it up.

`npm run sprites -- --preview <dir>` also writes an x4 contact sheet of every unit animation.
