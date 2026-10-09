# 00. Research & Sources

Research date: 2026-10-09. Public sources only.

## Store snapshot [O]

| Field | Value |
|-------|-------|
| Title | Idle Bounty Adventures (listed on some sites as "Idle Bounty") |
| Package | `com.postphysical.idle.bounty.rpg.battle` |
| Developer | Post Physical (outsourcing studio; this is an internal project) |
| Genre tags | Role Playing, Idle RPG, Casual; Single player, Stylized, Offline |
| Rating | 4.6 stars, about 8.05K–8.33K reviews |
| Downloads | 100K+ |
| Content rating | 12+ (Moderate Violence, In-Game Purchases) |
| Monetization | Contains ads, in-app purchases |
| Platforms | Android; Windows via Google Play Games on PC |
| Status | Early Access ("early stages of development") |
| Latest version | 1.3.2326 (updated Sep 6–7, 2026), about 165–175 MB |
| Permissions [R] | INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, VIBRATE, WAKE_LOCK, FOREGROUND_SERVICE |
| First Android release [R] | March 2023 (TapTap announcement); developer case study dated May 2021 |

## Store description, summarized [O]

- Explore a mysterious island, fight varied foes, inspect ancient ruins for artifacts and loot.
- Build an army: hire troops, recruit adventurers, convince enemy units to join.
- Grow power through "idle relaxation" or "non-stop clicking".
- Build an army for your playstyle, use unit formations, adapt tactics.
- Troops act on their own; assign units to collect resources while away; choose your pace.
- No constant internet connection required.

## Latest changelog (1.3.2326) [O]

- Fixed: unfinished rating computation after changing army layout could make started battles fail.
- Reworked battle ratings to better reflect difficulty relative to the army rating.
- Added an in-game support ticket menu.
- Cleaned up the player character's attack animation.

Design signals from this changelog [I]: there is a numeric **army rating** that depends on
**layout** (formation), each battle shows a **difficulty rating relative to the army rating**,
and there is a **player character** who attacks (the tap avatar).

## Developer case study [O]

From postphysical.io/cases/idle-bounty-rpg: "Mobile Mid-Core Tactical RPG", "inspired by several
classic PC games", combines tactical battles, exploration, collection and management. Premise: a ship of
explorers crashed on a mysterious island; the player is a survivor leading an expedition to find other
survivors and regain strength. Mentions ruins, dungeons, powerful artifacts.

## Player and third-party reports [R]

| Source | Claim |
|--------|-------|
| Play review (Stuu x, Sep 2026) | Finished the storyline; wants more content; no dev reply on new content. |
| Play review (Dude What, Sep 2026) | Skills/abilities cost ~4k while you earn 50–100 "steaks" (food/meat resource) at a time; uninstalled. |
| Play review (S. Goluyani, Aug 2026) | Takes a week or more to save resources to hire the army. |
| Play review (duncan grant, Jul 2024) | Fun early; lack of explanation; hard wall in the middle; idle gains weak. |
| gamespot.com.cn comment (V R) | Battles drag; even "fair" battles need limited consumables; easy mobs respawn after 6 hours; gathering tedious; 3 daily ads with little benefit; HP/damage numbers inflated. |
| gamespot.com.cn comments | "Brainless clicker", constant clicking is tiring, wants animated combat; liked knight and magic movement; battles long and repetitive. |
| liteapks.com | Enemies: humans, monsters, skeletons. Defeated enemies can be persuaded **or executed**. Relics found in dungeons, crafted/customized, equipped to boost the army or unlock skill conditions. Idle function can be upgraded. Some special units only via specific methods. |
| modded-1.com | Portrait (vertical) 2D; stages contain several battles; biomes: beach, deep forest, dungeon, desert; gold coins drop from enemies; upgrade button with no visible stat preview; warrior/archer/support types. |
| Mod sites | "Unlimited money" and "game speed" mods exist, which confirms a primary soft currency and a battle speed setting. |

Third-party listing text is partly generic or rewritten by the site; treat every row above as [R].

## Known gaps

We could not verify: exact unit list and stats, number of regions, full currency list, IAP price
points, ad placements beyond "3 daily", engine (the 165 MB size and studio history suggest Unity [I]),
and skill tree shape. Reddit and the Discord were not reachable from our research environment.
Where these matter, later documents give our own **[P]** design rather than guessing.

## Sources

- https://play.google.com/store/apps/details?id=com.postphysical.idle.bounty.rpg.battle
- https://www.postphysical.io/cases/idle-bounty-rpg
- https://www.postphysical.io/
- https://apkpure.com/idle-bounty-adventures/com.postphysical.idle.bounty.rpg.battle (version history)
- https://www.taptap.io/app/307735 (release date)
- https://idle-bounty-adventures.en.softonic.com/android (permissions, size)
- https://m.gamespot.com.cn/en/games/4547 (player comments)
- https://liteapks.com/idle-bounty-adventures.html
- https://modded-1.com/games/rpg/idle-bounty-adventures
- https://www.ldplayer.net/games/idle-bounty-adventures-on-pc.html
