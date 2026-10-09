# 06. Army & Units

## Reference [O/R]

- Three acquisition routes: **hire** troops, **recruit** adventurers, **convince enemy units** [O].
- Units differ in style, quantity and quality [R]; groups are formed into an army [R].
- Unit types include warriors, archers, support, knights and magic users [R].
- Some special units only obtainable through specific methods [R].
- Hiring an army can take a week of saving [R] (complaint).
- Heroes unlock at certain levels and have their own skills [R].

## Our design [P]

### Unit structure

Two tiers:

- **Heroes**: named, unique, one per type, have an active skill, level up, equip one relic.
- **Troops**: stackable squads (e.g. "Reef Spearmen x6") filling one grid slot; stack size multiplies
  HP and ATK; upgrades apply to the whole type.

Army size: 5 slots at start, +1 per Camp tier, max 9.

### Acquisition

| Route | Gets | Cost | Notes |
|---|---|---|---|
| Hire (Camp tavern) | Common troops | Gold + Food | Rotating stock of 3, refresh every 4 h or for gold |
| Recruit (story) | Heroes | Free | Survivor nodes on the map |
| Persuade (after battle) | Enemy troops and some heroes | Food | Chance shown before choosing |
| Relic-gated | Special units (undead etc.) | Specific relic equipped | Matches reference's "specific methods" [R] |

**Persuade chance** = `base (by rarity) + 10% per Charisma point of the Captain + 15% if the enemy unit
survived at < 25% HP`, capped at 85%. Spare also gives +reputation with that faction; Claim gives
bounty gold. This is the reference's persuade-or-execute choice [R], made a real trade-off.

### Starting roster

| Unit | Role | Source |
|---|---|---|
| The Captain | Fighter (avatar, taps) | Start |
| Bosun Marla | Guard hero | Start |
| Gull Deckhands | Fighter troop | Start |
| Castaway Archers | Shooter troop | Region 1 survivor |
| Hedge Witch Orla | Caster hero | Region 2 |
| Reef Spearmen | Fighter troop | Persuade (bandits) |
| Bramble Wolves | Fighter troop | Persuade (Wildkin) |
| Bone Pikes | Guard troop | Persuade with *Lantern of Ash* relic |

About 24 unit types at launch (5 per region plus heroes).

### Rarity

Common, Uncommon, Rare, Epic. Rarity sets base stats and persuade chance (60/40/20/8%).
No gacha in MVP; every unit is earnable through play.

### Hiring cost targets

The first full army (5 slots filled) costs about 25 minutes of play, and filling 9 slots
at region 3 costs about 3 days, not a week [R complaint].
