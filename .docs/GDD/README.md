# Game Design Document: Idle Bounty (reference analysis)

This GDD analyzes **Idle Bounty Adventures** by Post Physical
([Google Play](https://play.google.com/store/apps/details?id=com.postphysical.idle.bounty.rpg.battle))
and turns that analysis into a design for our own HTML5 mobile game built on the
stack in [`CLAUDE.md`](../../CLAUDE.md) (PixiJS, AnimeJS, Domain Driven Design, game-icons.net icons).

It is not a clone spec. Where the reference game is known, we describe it; where it is not,
we say so and propose our own design.

## Evidence legend

Every claim about the reference game carries a tag:

| Tag | Meaning |
|-----|---------|
| **[O]** | Observed: stated on the official store page or the developer's site. |
| **[R]** | Reported: stated by players in reviews or by third-party listing sites. Treat as likely, not certain. |
| **[I]** | Inferred: our reading of the evidence; not stated anywhere. |
| **[P]** | Proposed: our design decision for our game. |

All research came from public pages only (no APK teardown, no gameplay capture).
The full source list and what each one contributed is in [00-research-sources.md](00-research-sources.md).

## Documents

| # | Topic | What it covers |
|---|-------|----------------|
| 00 | [Research & sources](00-research-sources.md) | Store facts, sources, confidence, gaps |
| 01 | [Overview](01-overview.md) | High concept, pillars, audience, platform |
| 02 | [Core loop](02-core-loop.md) | Moment-to-moment, session and long-term loops |
| 03 | [World & narrative](03-world-narrative.md) | Setting, premise, story delivery |
| 04 | [Exploration & map](04-exploration-map.md) | Island, regions, ruins, encounters, respawns |
| 05 | [Combat](05-combat.md) | Auto-battle, tapping, formations, battle rating |
| 06 | [Army & units](06-army-units.md) | Hiring, recruiting, persuasion, roles, roster |
| 07 | [Progression](07-progression.md) | Unit upgrades, skills, relics, army rating |
| 08 | [Economy](08-economy.md) | Currencies, sources and sinks, tuning targets |
| 09 | [Idle & offline](09-idle-offline.md) | Gathering jobs, offline rewards, caps |
| 10 | [Monetization](10-monetization.md) | Ads, IAP, ethics guardrails |
| 11 | [UI / UX](11-ui-ux.md) | Screens, HUD, flows, icon mapping |
| 12 | [Art & audio](12-art-audio.md) | Visual direction, animation, sound |
| 13 | [Technical design](13-technical-design.md) | PixiJS/AnimeJS, DDD bounded contexts, save, perf |
| 14 | [Player feedback analysis](14-player-feedback-analysis.md) | What players love and hate, and our response |
| 15 | [Roadmap & MVP](15-roadmap-mvp.md) | Scope cuts, milestones, open questions |
