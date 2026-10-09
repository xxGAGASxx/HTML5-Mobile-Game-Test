# 02. Core Loop

## Reference loops [O/R/I]

- Explore island regions, pick an encounter, battle, collect loot (gold, food, materials,
  artifacts) [O][R].
- Spend resources to hire troops, upgrade units, and buy skills [O][R].
- Persuade defeated enemies to join [O].
- Assign idle units to gather while away [O].
- Story progresses through regions until it ends [R].
- Cleared easy encounters respawn on a timer (reported as 6 h) [R].
- Some battles consume limited consumables [R].

## Our loops [P]

### Moment-to-moment (seconds)

```
Battle runs automatically
  -> player taps the field to charge the Captain's ability meter
  -> meter full: tap a unit portrait to fire its skill
  -> enemies drop coins and loot, which fly to the HUD (AnimeJS)
```

### Session loop (2–5 minutes)

```
Open game -> collect offline gathering
  -> Bounty Board: pick 1–3 encounters (difficulty shown vs. army rating)
  -> adjust formation -> fight
  -> win: loot + choose Spare (recruit chance) or Claim (bounty gold)
  -> spend: hire / upgrade / skill / relic
  -> reassign gatherers -> close
```

### Long-term loop (days to weeks)

```
Unlock region -> story chapter -> region boss
  -> new unit types, new resource, new relic slot
  -> Camp upgrades raise gathering and army size caps
  -> Deep Ruins: endless floors after story completion
```

## Loop diagram

```
          +-------------------+
          |   Explore map     |
          +---------+---------+
                    v
 +----------+   +---------+   +-----------------+
 | Formation|-->| Battle  |-->| Loot / Spare or |
 +----------+   +---------+   | Claim           |
      ^                       +--------+--------+
      |                                v
 +----+-------+   +-------------+  +---------+
 | Upgrade /  |<--| Resources   |<-| Gather  |
 | Hire/Relic |   | (gold, food,|  | (idle)  |
 +------------+   |  materials) |  +---------+
                  +-------------+
```

## Session targets [P]

| Metric | Target |
|---|---|
| Median session | 3–4 min |
| Sessions/day (D7 cohort) | 4–6 |
| Time to first meaningful upgrade | < 60 s |
| Time to first persuaded unit | < 5 min |
| Story completion | 20–30 days of normal play |
