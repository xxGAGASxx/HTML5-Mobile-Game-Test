# 04. Exploration & Map

## Reference [O/R]

- Map explored by tapping regions, which reveals new locations [R].
- Ruins to inspect for artifacts and loot [O]; dungeons hold relics [R].
- Each area ends in a boss [R]; stages hold several battles [R].
- Cleared easy mobs respawn after about 6 hours [R].
- Each battle shows a difficulty rating relative to the army rating [O].

## Our design [P]

### Map structure

- One vertical-scrolling island map per region, made of **nodes** connected by paths.
- Fog of war hides nodes until an adjacent node is cleared.
- Node types:

| Node | Icon (game-icons.net) | Behavior |
|---|---|---|
| Camp | `camping-tent` | Home base, always available |
| Encounter | `crossed-swords` | Battle; respawns |
| Elite | `skull-crossed-bones` | Harder battle, better loot, longer respawn |
| Ruin | `ancient-ruins` | 3–5 floor mini-dungeon, relic at end |
| Resource site | `wood-pile`, `stone-pile`, `fishing-pole` | Unlocks a gathering job |
| Survivor | `person` | Story recruit |
| Boss | `crowned-skull` | Region gate |

### Difficulty display

Each node shows its **Threat** next to the army **Power** (reference shows a relative rating [O]):

| Threat / Power | Label | Color |
|---|---|---|
| < 0.7 | Trivial | grey |
| 0.7–0.95 | Easy | green |
| 0.95–1.1 | Fair | yellow |
| 1.1–1.3 | Hard | orange |
| > 1.3 | Deadly | red |

### Respawns

- Normal encounters respawn after **2 h** (reference's 6 h was a complaint [R]); elites 8 h.
- "Trivial" nodes can be **auto-cleared** instantly for 50% loot: removes boring repeat fights.

### Ruins

- Short chains of 3–5 battles without healing between floors; retreat keeps loot so far.
- Final floor drops a relic (see 07).
- **Deep Ruins** (post-story): endless floors, +4% Threat per floor, weekly leaderboard stored locally
  (no backend in MVP).
