import { Rng, type Lane, type Role, type Row, type UnitStats } from '../shared';

export type Side = 'player' | 'enemy';

/** Everything combat needs to know about one unit. The Army context maps its units to these. */
export interface CombatantSpec {
  readonly id: string;
  readonly side: Side;
  readonly typeId: string;
  readonly role: Role;
  readonly row: Row;
  readonly lane: Lane;
  readonly stats: UnitStats;
  /** HP at the start of the battle when below full (ruins carry damage between floors). */
  readonly hp?: number;
}

export interface Combatant {
  readonly spec: CombatantSpec;
  readonly maxHp: number;
  hp: number;
  /** Ticks until the next attack. */
  cooldown: number;
}

export type BattleEndReason = 'wipe' | 'timeout';

export type CombatEvent =
  | { type: 'attack'; tick: number; attackerId: string; targetId: string; damage: number; killed: boolean; rally: boolean }
  | { type: 'captainHit'; tick: number; targetId: string; damage: number; killed: boolean }
  | { type: 'rallyFired'; tick: number; efficiency: number }
  | { type: 'potionUsed'; tick: number; potionId: string; effect: PotionEffect['kind'] }
  | { type: 'healed'; tick: number; targetId: string; amount: number }
  | { type: 'potionHit'; tick: number; targetId: string; damage: number; killed: boolean }
  | { type: 'ended'; tick: number; winner: Side; reason: BattleEndReason };

/** What a potion does when it lands: heal every living ally by a share of max HP, or hit every enemy. */
export type PotionEffect = { readonly kind: 'heal'; readonly pct: number } | { readonly kind: 'blast'; readonly damage: number };

export interface BattleOutcome {
  readonly winner: Side;
  readonly reason: BattleEndReason;
  /** Enemy combatant ids defeated, in the order they fell. */
  readonly defeatedEnemies: readonly string[];
  readonly ticks: number;
}

/** Fixed simulation rate (GDD 13). Speed modes run more ticks per frame, never a different sim. */
export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;
/** 45 s limit; a timeout counts as a loss with partial loot (GDD 05). */
export const TIME_LIMIT_TICKS = 45 * TICK_HZ;

export const RALLY_MAX = 30;
/** The meter also fills slowly by itself: one charge per second. */
export const RALLY_PASSIVE_TICKS = TICK_HZ;
/** Taps are capped at 5 per second so spam does not pay. */
export const MAX_TAPS_PER_SECOND = 5;
/** If the player leaves a full meter alone this long, it fires by itself at half strength. */
export const RALLY_AUTO_DELAY_TICKS = 3 * TICK_HZ;
export const RALLY_SKILL_PCT = 200;
export const CAPTAIN_TAP_ATK = 3;
/** After a potion lands, the same kind can't be used again for this long. */
export const POTION_COOLDOWN_TICKS = 5 * TICK_HZ;
/** Each kind of potion can be used at most this often per battle (GDD 05), so they help but never carry a fight. */
export const POTION_USES_PER_BATTLE = 2;

const STRONG_VS: Record<Role, Role> = {
  guard: 'fighter',
  fighter: 'shooter',
  shooter: 'caster',
  caster: 'guard',
};

/**
 * Deterministic auto-battle on two 3 x 3 grids. Same specs plus same seed plus same inputs at the
 * same ticks always give the same result. Input is queued and applied at the next tick.
 */
export class Battle {
  readonly combatants: readonly Combatant[];
  private readonly byId = new Map<string, Combatant>();
  private readonly rng: Rng;
  private tickCount = 0;
  private rallyCharge = 0;
  private rallyFullSince = -1;
  private pendingTaps = 0;
  private pendingRally = false;
  private readonly acceptedTapTicks: number[] = [];
  private readonly defeatedEnemies: string[] = [];
  private readonly pendingPotions = new Map<string, PotionEffect>();
  private readonly potionReadyAt = new Map<string, number>();
  private readonly potionUses = new Map<string, number>();
  private result: BattleOutcome | null = null;

  constructor(specs: readonly CombatantSpec[], seed: number) {
    this.rng = new Rng(seed);
    // Act front to back, lane by lane, player before enemy within a slot: a stable, fair order.
    const ordered = [...specs].sort(
      (a, b) => a.row - b.row || a.lane - b.lane || (a.side === b.side ? 0 : a.side === 'player' ? -1 : 1),
    );
    this.combatants = ordered.map((spec) => {
      const interval = attackInterval(spec.stats);
      // Stagger first swings so a whole side does not hit on the same tick.
      const hp = Math.min(spec.stats.hp, Math.max(1, spec.hp ?? spec.stats.hp));
      return { spec, maxHp: spec.stats.hp, hp, cooldown: 1 + this.rng.int(interval) };
    });
    for (const c of this.combatants) this.byId.set(c.spec.id, c);
  }

  get tick(): number {
    return this.tickCount;
  }

  get rally(): number {
    return this.rallyCharge;
  }

  get rallyReady(): boolean {
    return this.rallyCharge >= RALLY_MAX;
  }

  get isOver(): boolean {
    return this.result !== null;
  }

  get outcome(): BattleOutcome | null {
    return this.result;
  }

  get(id: string): Combatant | undefined {
    return this.byId.get(id);
  }

  /** Player tapped the field: +1 Rally and a small Captain hit, applied on the next tick. */
  tap(): void {
    if (!this.isOver) this.pendingTaps++;
  }

  /** Player fired the full Rally meter, applied on the next tick. */
  fireRally(): void {
    if (!this.isOver && this.rallyReady) this.pendingRally = true;
  }

  /** Whether potion `id` can be used now: battle running, off cooldown, and under the per-battle cap. */
  canUsePotion(id: string): boolean {
    return (
      !this.isOver &&
      !this.pendingPotions.has(id) &&
      this.potionsUsed(id) < POTION_USES_PER_BATTLE &&
      this.potionCooldown(id) === 0
    );
  }

  /** Ticks until potion `id` is off cooldown. */
  potionCooldown(id: string): number {
    return Math.max(0, (this.potionReadyAt.get(id) ?? 0) - this.tickCount);
  }

  potionsUsed(id: string): number {
    return (this.potionUses.get(id) ?? 0) + (this.pendingPotions.has(id) ? 1 : 0);
  }

  /** Player used a potion; it lands on the next tick. Returns false when it can't be used now. */
  usePotion(id: string, effect: PotionEffect): boolean {
    if (!this.canUsePotion(id)) return false;
    this.pendingPotions.set(id, effect);
    return true;
  }

  /** Advances one simulation tick and returns what happened during it. */
  step(): CombatEvent[] {
    if (this.result) return [];
    const events: CombatEvent[] = [];
    const tick = ++this.tickCount;

    this.applyTaps(tick, events);
    this.applyPotions(tick, events);
    if (tick % RALLY_PASSIVE_TICKS === 0) this.chargeRally(1, tick);
    if (this.pendingRally && this.rallyReady) {
      this.doRally(tick, 1, events);
    } else if (this.rallyReady && tick - this.rallyFullSince >= RALLY_AUTO_DELAY_TICKS) {
      this.doRally(tick, 0.5, events);
    }
    this.pendingRally = false;

    for (const c of this.combatants) {
      if (c.hp <= 0 || this.checkEnd(tick, events)) continue;
      c.cooldown--;
      if (c.cooldown > 0 || !this.canReach(c)) continue;
      const target = this.targetFor(c.spec.side === 'player' ? 'enemy' : 'player', c.spec.lane);
      if (!target) continue;
      this.strike(c, target, 100, false, tick, events);
      c.cooldown = attackInterval(c.spec.stats);
    }

    this.checkEnd(tick, events);
    return events;
  }

  /** Runs to the end with no player input. Handy for tests and the economy simulator. */
  runToEnd(): BattleOutcome {
    while (!this.result) this.step();
    return this.result;
  }

  private applyTaps(tick: number, events: CombatEvent[]): void {
    const windowStart = tick - TICK_HZ + 1;
    while (this.acceptedTapTicks.length && this.acceptedTapTicks[0] < windowStart) this.acceptedTapTicks.shift();
    for (; this.pendingTaps > 0; this.pendingTaps--) {
      if (this.acceptedTapTicks.length >= MAX_TAPS_PER_SECOND) continue;
      this.acceptedTapTicks.push(tick);
      this.chargeRally(1, tick);
      const target = this.targetFor('enemy', 1);
      if (!target) continue;
      const damage = mitigate(CAPTAIN_TAP_ATK, target.spec.stats.arm);
      const killed = this.hurt(target, damage);
      events.push({ type: 'captainHit', tick, targetId: target.spec.id, damage, killed });
    }
  }

  private applyPotions(tick: number, events: CombatEvent[]): void {
    for (const [id, effect] of this.pendingPotions) {
      this.potionUses.set(id, (this.potionUses.get(id) ?? 0) + 1);
      this.potionReadyAt.set(id, tick + POTION_COOLDOWN_TICKS);
      events.push({ type: 'potionUsed', tick, potionId: id, effect: effect.kind });
      for (const c of this.combatants) {
        if (c.hp <= 0) continue; // the fallen stay down
        if (effect.kind === 'heal' && c.spec.side === 'player') {
          const amount = Math.min(c.maxHp - c.hp, Math.max(1, Math.round((c.maxHp * effect.pct) / 100)));
          if (amount <= 0) continue;
          c.hp += amount;
          events.push({ type: 'healed', tick, targetId: c.spec.id, amount });
        } else if (effect.kind === 'blast' && c.spec.side === 'enemy') {
          // Alchemist's fire ignores armour: the button can promise an exact number.
          const damage = Math.max(1, effect.damage);
          const killed = this.hurt(c, damage);
          events.push({ type: 'potionHit', tick, targetId: c.spec.id, damage, killed });
        }
      }
    }
    this.pendingPotions.clear();
  }

  private chargeRally(amount: number, tick: number): void {
    if (this.rallyReady) return;
    this.rallyCharge = Math.min(RALLY_MAX, this.rallyCharge + amount);
    if (this.rallyReady) this.rallyFullSince = tick;
  }

  /** Every living player unit strikes at once, regardless of cooldown or reach. */
  private doRally(tick: number, efficiency: number, events: CombatEvent[]): void {
    this.rallyCharge = 0;
    this.rallyFullSince = -1;
    events.push({ type: 'rallyFired', tick, efficiency });
    const skillPct = Math.round(RALLY_SKILL_PCT * efficiency);
    for (const c of this.combatants) {
      if (c.spec.side !== 'player' || c.hp <= 0) continue;
      const target = this.targetFor('enemy', c.spec.lane);
      if (!target) break;
      this.strike(c, target, skillPct, true, tick, events);
    }
  }

  private strike(attacker: Combatant, target: Combatant, skillPct: number, rally: boolean, tick: number, events: CombatEvent[]): void {
    const damage = this.damage(attacker.spec, target.spec, skillPct);
    const killed = this.hurt(target, damage);
    events.push({ type: 'attack', tick, attackerId: attacker.spec.id, targetId: target.spec.id, damage, killed, rally });
  }

  /** `max(1, ATK * skillMult * rowMod) * 100 / (100 + ARM)` with the role triangle and ±10% spread. */
  private damage(attacker: CombatantSpec, target: CombatantSpec, skillPct: number): number {
    let pct = skillPct;
    if (attacker.stats.ranged && attacker.row === 2) pct = (pct * 110) / 100;
    if (STRONG_VS[attacker.role] === target.role) pct = (pct * 125) / 100;
    const spread = 90 + this.rng.int(21);
    const raw = Math.max(1, Math.floor((attacker.stats.atk * pct * spread) / 10000));
    return mitigate(raw, target.stats.arm);
  }

  private hurt(target: Combatant, damage: number): boolean {
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp > 0) return false;
    if (target.spec.side === 'enemy') this.defeatedEnemies.push(target.spec.id);
    return true;
  }

  /** Melee units only swing when nobody on their side stands in front of them in their lane. */
  private canReach(c: Combatant): boolean {
    if (c.spec.stats.ranged) return true;
    return !this.combatants.some(
      (o) => o.hp > 0 && o.spec.side === c.spec.side && o.spec.lane === c.spec.lane && o.spec.row < c.spec.row,
    );
  }

  /** Front-most living unit of `side` in `lane`, else in the nearest lane (lower lane wins ties). */
  private targetFor(side: Side, lane: Lane): Combatant | undefined {
    let best: Combatant | undefined;
    let bestKey = Infinity;
    for (const c of this.combatants) {
      if (c.hp <= 0 || c.spec.side !== side) continue;
      const key = Math.abs(c.spec.lane - lane) * 100 + c.spec.row * 10 + c.spec.lane;
      if (key < bestKey) {
        best = c;
        bestKey = key;
      }
    }
    return best;
  }

  private checkEnd(tick: number, events: CombatEvent[]): boolean {
    if (this.result) return true;
    const playerAlive = this.combatants.some((c) => c.spec.side === 'player' && c.hp > 0);
    const enemyAlive = this.combatants.some((c) => c.spec.side === 'enemy' && c.hp > 0);
    let winner: Side | null = null;
    let reason: BattleEndReason = 'wipe';
    if (!enemyAlive) winner = 'player';
    else if (!playerAlive) winner = 'enemy';
    else if (tick >= TIME_LIMIT_TICKS) {
      winner = 'enemy';
      reason = 'timeout';
    }
    if (!winner) return false;
    this.result = { winner, reason, defeatedEnemies: [...this.defeatedEnemies], ticks: tick };
    events.push({ type: 'ended', tick, winner, reason });
    return true;
  }
}

export function attackInterval(stats: UnitStats): number {
  return Math.max(1, Math.round(TICK_HZ / stats.spd));
}

function mitigate(damage: number, arm: number): number {
  return Math.max(1, Math.floor((damage * 100) / (100 + arm)));
}
