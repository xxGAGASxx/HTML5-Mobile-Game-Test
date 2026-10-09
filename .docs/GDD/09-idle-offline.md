# 09. Idle & Offline

## Reference [O/R]

- Troops act on their own [O]; assign units to collect resources while away [O].
- Plays without a constant connection [O]; idle function can be upgraded [R].
- Players report idle gains as weak [R].

## Our design [P]

### Gathering jobs

Any unit not in the active army can be assigned to a job at an unlocked resource site.

| Job | Yields | Best role bonus |
|---|---|---|
| Fishing | Food | Shooters +20% |
| Hunting | Food, hides | Fighters +20% |
| Logging | Wood | Guards +20% |
| Quarrying | Stone | Guards +20% |
| Scouting | Gold, map reveals | Casters +20% |
| Ruin digging | Relic Dust, rare relic chance | Heroes only |

Rate = `siteBase * (1 + 0.05 * unitLevel) * roleBonus * campBonus`.

### Offline rewards

- Time measured from the last save timestamp; we clamp to prevent clock tampering (if the device
  clock went backwards, award nothing; cap single gaps at the offline cap).
- Offline cap: **8 h** at start, 12 h with Camp tier 3, 16 h with Expedition skills.
- Offline efficiency: 100% of gathering, plus **auto-clear of Trivial nodes** at 50% loot.
- Return screen: one summary card, a single **Collect** button, and an optional rewarded ad for
  ×2 (see 10).

### Idle army

- An **Auto-Bounty** toggle (unlocked after region 1) lets the army repeat the last cleared Easy
  encounter while the game is open in the background, at 1x speed.
- The browser can suspend the page; we simulate missed time on resume using the same offline formula,
  so behavior doesn't depend on tab visibility.
