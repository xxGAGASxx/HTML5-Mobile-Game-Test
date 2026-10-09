# 10. Monetization

## Reference [O/R]

- Contains ads and in-app purchases; content rating notes In-Game Purchases [O].
- About 3 optional daily ads, which players found low value [R].
- IAP prices not listed on the store page; no reports of predatory pricing found [I].
- The 4.6 rating suggests monetization is not the main friction; pacing is [I].

## Our model [P]

> **Status: DEFERRED.** No ads or IAP SDK is integrated for now. The design below is the target;
> the code only ships the interfaces and no-op placeholders from
> [16-deferred-integrations.md](16-deferred-integrations.md). Pearls are earned through gameplay only until then.

Free-to-play, ads plus light IAP, designed so a non-paying player can finish everything.

### Rewarded ads (opt-in only, never forced)

| Placement | Reward | Daily limit |
|---|---|---|
| Offline return | ×2 offline rewards | 3 |
| Post-battle | ×2 battle loot | 5 |
| Tavern | Free refresh | 2 |
| Failed persuade | One retry | 3 |

Each ad must give at least ~20 minutes of equivalent income, so they feel worth it (reference ads
didn't [R]). No interstitials.

### IAP (HTML5 context)

Payment depends on the distribution channel (web portal SDK, PWA with a web store, or a wrapper app).
Planned products:

| Product | Content |
|---|---|
| Remove Ads + Supporter | Ad rewards granted without watching; cosmetic banner |
| Pearl packs | Premium currency |
| Expedition Pass (monthly) | +25% offline cap, daily Pearls |
| Cosmetic skins | Captain and hero skins |

### Guardrails

- No paid-only units or relics.
- No energy/stamina system.
- Time-skips capped at 4 h per day.
- Prices and odds visible; no loot boxes in MVP.
