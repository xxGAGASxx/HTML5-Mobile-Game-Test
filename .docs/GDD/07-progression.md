# 07. Progression

## Reference [O/R]

- Units upgrade with an Upgrade button; HP and damage rise, but no stat preview is shown [R].
- Skills/abilities cost about 4K of a resource earned 50–100 at a time [R].
- Relics/artifacts found in ruins and dungeons, crafted and customized, equipped to boost the army or
  unlock skill conditions [O][R].
- The idle function itself can be upgraded [R].
- Players report a hard wall mid-game [R].

## Our progression axes [P]

| Axis | Spends | Effect | Cap |
|---|---|---|---|
| Unit level | Gold | +HP/ATK per level | 10 per region tier |
| Unit rank (star) | Unit shards / duplicates from persuade | +1 skill tier, raise level cap | 5 ranks |
| Captain skills | Renown (from bosses and bounties) | Global perks | Tree of 24 nodes |
| Relics | Find in ruins; upgrade with Relic Dust | Equip on heroes | 1 per hero |
| Camp buildings | Wood + Stone | Army size, gather rate, offline cap | 5 tiers |

### Level cost curve

`goldCost(L) = round(20 * 1.15^L)`.
Each level gives +8% base HP and ATK. Show before/after values on the button (reference doesn't [R]).

### Captain skill tree

Three branches of 8 nodes, 1–3 Renown each:

- **Command**: army power, formation bonuses, extra slot.
- **Charisma**: persuade chance, hire discounts, faction reputation.
- **Expedition**: gather speed, offline cap, respawn time.

The cheapest skill costs about 1.5 days of normal Renown income at that point; we never ask for
40x a typical reward (the reference's 4K vs 50–100 [R]).

### Relics

- 3 slots of modifiers: one fixed by the relic, two rolled.
- Crafting: combine 3 relics of one tier into one random relic of the next tier.
- Some relics unlock a unit or a skill condition (e.g. *Lantern of Ash*: allows persuading undead).

### Anti-wall measures

- **Catch-up**: if the next story node is Hard or worse for 24 h, gather +25% and bounty gold +25%.
- **Goal bar**: Camp screen always shows the next 3 concrete goals with progress.
- **Respec**: Captain skills refund for free once per day.
