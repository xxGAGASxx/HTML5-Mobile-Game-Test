# 01. Overview

## Reference game in one line [O]

A single-player, offline-capable idle tactical RPG: a shipwrecked expedition explores an island,
fights through encounters with an auto-battling army in formation, and grows by hiring, recruiting and
persuading units, while idle units gather resources.

## Our high concept [P]

**Working title:** *Wreckbound* (decided 2026-10-09).

Naming rules: this is a non-commercial project, but its title, characters and text must not reuse
the reference game's name or IP. Avoid "Idle", "Bounty" and "Adventures" in the title. A quick web
search found no game called *Wreckbound* (the nearest is *Windbound*, 2020); recheck before any
public release. Backup names: *Castaway Crew*, *Saltcrown*, *Vael Expedition*.

> Shipwrecked on a cursed island, you lead a ragtag expedition. Tap the map, pick your fights,
> set your formation and watch your squad brawl. Spare the defeated and they join you. Leave crews
> gathering while you're away, and come back stronger.

A portrait HTML5 game for mobile browsers, playable in 2–5 minute sessions, with a clear
"one more fight" pull and no hard walls.

## Design pillars [P]

1. **Every fight is a choice.** The map shows each encounter's difficulty against your army rating
   before you commit (the reference game already does this [O]). Players pick risk, not just tap.
2. **Your army is your story.** Units come from hiring, recruiting survivors, and persuading
   defeated enemies. The roster tells the tale of how you got here.
3. **Formation over grind.** Position and composition should beat raw stats within a band, so
   thinking is rewarded more than waiting.
4. **Idle respects time.** Offline gathering is generous and predictable. No week-long saves
   (the top complaint about the reference [R]).
5. **Readable at a glance.** Short numbers, clear icons (game-icons.net), visible upgrade previews
   (the reference hides them [R]).

## Genre and comparables [I]

Idle RPG plus light squad tactics. Neighbors: Idle Heroes / AFK Arena (formation auto-battle),
Heroes of Might and Magic (army stacks, map encounters, "join you" neutrals; likely one of the
"classic PC games" the dev cites [I]), Kingdom Rush (readable units), Melvor Idle (offline jobs).

## Audience [I]

Mid-core mobile players aged 16–40 who like light strategy and collection, play in short
sessions, and dislike pay-to-win pressure. The reference's 12+ rating comes from moderate violence.

## Project status [P]

- **Non-commercial** hobby/test project. Monetization (10) and service SDKs (16) stay deferred, and
  may never be needed.
- **Distribution: Web + Mobile** from one codebase (see 13).

## Platform and constraints [P]

- HTML5, mobile-first, **portrait 9:16** (the reference is vertical [R]), scales to desktop.
- Runs offline after first load (service worker); single-player, local save.
- Target devices: mid-range Android 2021+, iPhone 11+; 60 fps in battle, 30 fps acceptable on map.
- Initial download under 15 MB; lazy-load biomes.

## Unique selling points vs. the reference [P]

| Reference pain point [R] | Our answer [P] |
|---|---|
| Hard mid-game wall, slow saving | Smooth curves, catch-up bonus, visible goals (see 08) |
| Clicking feels mindless | Taps charge a hero ability instead of raw damage spam (see 05) |
| No upgrade preview | Every upgrade shows before/after stats |
| Battles drag | 2x/3x speed from the start, battles cap at ~45 s |
| Little explanation | Contextual tutorial for every new system |
| Storyline runs out | Repeatable bounty board and endless "Deep Ruins" (see 04) |
