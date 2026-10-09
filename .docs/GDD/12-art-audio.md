# 12. Art & Audio

## Reference [O/R/I]

- Store tag: "Stylized" [O]. Medieval fantasy with knights and magic [R].
- Players wanted more animated combat [R] and liked knight and magic movement [R].
- Studio has a technical art practice (shading, lighting, post) [O], so the reference likely leans on
  polished effects [I].

## Our direction [P]

### Visual style

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
