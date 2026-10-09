# 08. Economy

## Reference [O/R/I]

- Gold coins drop from enemies and pay for upgrades [R]; mods target "money" [R].
- A food resource ("steaks") comes in 50–100 per drop and pays for skills/abilities [R].
- Resources are gathered by idle units [O].
- Artifacts and loot from ruins [O].
- Players call the resources unbalanced and slow [R].

## Our currencies [P]

| Currency | Icon | Main sources | Main sinks |
|---|---|---|---|
| Gold | `two-coins` | Battles, Claim choice, bounty board | Unit levels, hiring, tavern refresh |
| Food | `meat` | Fishing/hunting gathering, battles | Hiring, persuasion, tonics |
| Wood | `wood-pile` | Logging gathering | Camp buildings |
| Stone | `stone-block` | Quarry gathering, ruins | Camp buildings |
| Renown | `laurels` | Bosses, bounty contracts, story | Captain skill tree |
| Relic Dust | `crystal-shine` | Salvaging relics, Deep Ruins | Relic upgrades |
| Pearls (premium) | `pearl-necklace` | Small quest rewards, IAP | Cosmetics, time-skips, tavern refresh |

### Faucet and drain targets (per hour of active play, region 1)

| Currency | Earned | Spent on intended path |
|---|---|---|
| Gold | ~1,800 | ~1,600 |
| Food | ~600 | ~500 |
| Wood / Stone | ~400 each | ~350 each |
| Renown | ~3 | ~3 |

Scale all income by ×1.6 per region and all costs by ×1.5 per region, so later regions slightly
loosen; this is the opposite of a wall.

### Rules

1. No single purchase costs more than **4 hours** of the target resource's income at the point it unlocks.
2. Every currency shows its income/hour on long-press.
3. Storage caps exist for Wood/Stone/Food (tied to Camp) to drive return visits, but the offline cap
   (09) is always below storage.
4. Premium currency never buys power directly in MVP (see 10).

### Tuning tooling

A data-driven `economy.json` with all costs and rates, plus a headless simulator script that plays
the intended path and outputs "time to unlock" per milestone (see 13).
