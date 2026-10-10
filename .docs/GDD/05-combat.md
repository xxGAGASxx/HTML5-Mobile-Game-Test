# 05. Combat

## Reference [O/R/I]

- Troops fight on their own (auto-battle) [O].
- Player can speed up power via "non-stop clicking" [O]; battles fought by tapping enemies [R].
- A player character has an attack animation [O], so the Captain fights or taps alongside the army [I].
- Formation / army layout changes the army rating [O].
- Battles can be long and repetitive; HP and damage numbers are very large [R].
- Some battles need limited consumables [R].
- A game speed setting exists (mods change it) [R].

## Our design [P]

### Battlefield

- Portrait screen; player army in the **bottom half**, enemies in the top half.
- Each side has a **3 x 3 grid**: Front, Middle, Back rows, three lanes.
- Units target the closest enemy in their lane first, then nearest lane.

### Flow

1. Pre-battle: show enemy formation preview, Threat vs. Power, and formation editor.
2. Battle runs in real time with a fixed 10 Hz simulation tick (deterministic, see 13).
3. Ends when one side is wiped, or at **45 s** (timeout counts as a loss with partial loot).
4. Post-battle: loot, XP, and a **Spare / Claim** choice for each defeated persuadable enemy unit
   (reference allows persuade or execute [R]).

### Player interaction (the "clicking" layer)

Reference tapping was called mindless [R]. Ours:

- **Tap anywhere** adds +1 to the Captain's **Rally meter** (cap 5 taps/s to stop spam).
- Each tap also does a small Captain hit (keeps the satisfying feedback).
- Rally full (30 charges): tap a unit portrait to fire that unit's **active skill**.
- Idle players lose nothing important: units auto-cast at 50% efficiency when the meter fills on its own
  (meter also fills slowly over time).

### Stats

| Stat | Meaning |
|---|---|
| HP | Health |
| ATK | Damage per hit |
| SPD | Attacks per second, 0.5–2.0 |
| ARM | Flat-percent damage reduction, `dmg * 100 / (100 + ARM)` |
| RNG | Melee (front-only reach) or ranged (any row) |

Damage: `max(1, ATK * skillMult * rowMod) * 100 / (100 + ARM)`.

Row modifiers: Front takes 100% of targeted hits; units in Middle/Back are targeted only when the
Front of that lane is empty. Back-row ranged units get +10% ATK.

### Roles and the triangle

| Role | Row | Strong vs. | Weak vs. |
|---|---|---|---|
| Guard (shield) | Front | Fighters | Casters |
| Fighter (sword) | Front/Mid | Shooters | Guards |
| Shooter (bow) | Back | Casters | Fighters |
| Caster (magic) | Back | Guards | Shooters |
| Support (heal/buff) | Back | none | none |

Strong vs.: +25% damage dealt.

### Army Power and Threat

- **Power** = sum over units of `(HP/10 + ATK*SPD*2 + ARM) * formationBonus`.
- `formationBonus` = 1.0, +5% if every Front slot holds a Guard or Fighter, +5% if a Support is in Back.
- Recompute Power whenever the layout changes, and never let a battle start while it is being computed
  (the reference shipped this exact bug [O]).
- **Threat** uses the same formula on the enemy side.

### Consumables [P]

No consumables required to enter battles (reference complaint [R]). Optional **tonics** (heal 30%,
+20% ATK for one battle) bought with food; at most 2 per battle.

Prototype: two potions from the camp's Potions tab, mostly paid in food. **Health Potion** heals
every living unit 30% of max HP; **Damage Potion** hits every enemy for 15 + 6 per tier, ignoring
armour. Carry up to 3 of each; in battle each is a tap button with a 5 s cooldown, at most 2 of
each kind per battle. Every run starts with one of each.

### Numbers display

Use short suffixes (1.2K, 3.4M) and keep enemy HP growth around ×1.12 per region tier to avoid the
"ridiculous numbers" feel [R].

### Speed

1x / 2x from minute one, 3x after region 2. Battle VFX budget scales down at 3x.
