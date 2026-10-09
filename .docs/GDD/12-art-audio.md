# 12. Art & Audio

## Reference [O/R/I]

- Store tag: "Stylized" [O]. Medieval fantasy with knights and magic [R].
- Players wanted more animated combat [R] and liked knight and magic movement [R].
- Studio has a technical art practice (shading, lighting, post) [O], so the reference likely leans on
  polished effects [I].

## Our direction [P]

> **Status: OPEN.** The art style is not chosen yet. The candidates and the selection process are
> below; the "Visual style" section after them is the working default until we choose.

### Style candidates

| # | Style | Look | Production cost | Fit with PixiJS | Risk |
|---|---|---|---|---|---|
| A | **Icon-silhouette** | game-icons.net SVGs as units on colored tokens, AnimeJS juice | Very low | Excellent | Can feel abstract; weak character identity |
| B | **Pixel art** (32–48 px units) | Retro, crisp, scaled ×3–4 | Low–medium (free asset packs exist) | Excellent (nearest-neighbor scaling) | Mixing packs breaks consistency |
| C | **Chunky vector cartoon** | Thick outlines, flat shading, 3/4 view | Medium | Good (SVG to atlas) | Needs one consistent artist or generator |
| D | **Painted / hand-drawn 2D** | Soft painted units and map | High | Good | Too costly for a non-commercial project |
| E | **Paper cut-out / tabletop minis** | Units as standing cardboard minis on a board map | Low–medium | Good (sprites + tween tilt/bob) | Distinct look; animation is mostly tweens, which suits AnimeJS |

**Recommendation:** prototype with **A** (zero art cost, works today with game-icons.net), and run
a style test on **B** and **E** in parallel, since both are cheap and match AnimeJS-driven motion.

### Selection process

1. Build one battle scene (3 vs 3 units, one skill VFX, the HUD) in each shortlisted style.
2. Check on a phone at real size: can you tell roles apart at a glance? Does it read at 3x speed?
3. Check cost: how many unit types can we realistically produce in that style?
4. Pick one; record the decision here and update the palette and animation specs.

Asset licensing (applies to any style): only CC0, CC BY (credited) or self-made assets.
game-icons.net is CC BY 3.0 and needs a Credits screen.

### Visual style (working default)

- **Chunky stylized 2D**, slightly top-down 3/4 view, thick outlines, limited palettes per biome.
- Units are small (64–96 px tall on screen) and must read by silhouette and role color:
  Guard blue, Fighter red, Shooter green, Caster purple, Support gold.
- Biome palettes: Coast (sand, teal), Whisperwood (moss, amber), Sunken Steps (slate, cyan glow),
  Glass Dunes (ochre, magenta sky), Drowned Crown (navy, bioluminescent green).

### Animation (AnimeJS + sprite frames)

- Units use short frame loops (idle 4f, attack 6f, hit 2f, death 6f).
- Procedural juice via AnimeJS: squash on hit, knockback tween, number pop-ups, loot arcs to HUD,
  screen shake (respecting a "reduce motion" setting).
- Map: node unlock pulse, path draw-on, fog dissolve.

### VFX

Particle bursts with PixiJS `ParticleContainer`; skill VFX are additive-blend sprites. Cap on-screen
particles at 300 (150 at 3x speed).

### Audio

- Music: one loop per biome plus battle and boss stems (OGG + AAC fallbacks), 64–96 kbps.
- SFX: tap hit, unit attacks by role, loot pickup, level up, persuade success/fail.
- Audio unlocks on first touch (mobile browser autoplay rules).
