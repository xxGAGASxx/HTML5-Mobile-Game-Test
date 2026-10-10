import { Army, armyPower, catalogOf, type ArmyEvent, type ArmyUnit, type Slot, type UnitCatalog, type UnitType } from '../domain/army';
import type { BattleOutcome, BattleResultEvent } from '../domain/combat';
import { NO_RESOURCES, Wallet, addResources, hirePrice, scaleResources, trainPrice, type EconomyEvent, type Resources } from '../domain/economy';
import { IslandMap, harvestYield, threatLabel, type ExplorationEvent, type NodeStatus, type ThreatLabel } from '../domain/exploration';
import { UnitLevels, statsAtLevel, type ProgressionEvent } from '../domain/progression';
import { EventBus } from '../domain/shared';
import { battleLoot, battleThreat, fullClearLoot, startBattle, type PreparedBattle } from './combat';
import type { GameContent, RegionNode } from './content';

export type GameEvent = ArmyEvent | BattleResultEvent | EconomyEvent | ExplorationEvent | ProgressionEvent;

export interface TavernOffer {
  readonly type: UnitType;
  readonly price: Resources;
  /** Army Power if this unit were hired now (before/after preview, GDD 11). */
  readonly powerAfter: number;
  readonly canHire: boolean;
  readonly blockedBy?: 'army-full' | 'cost';
}

export interface TrainingOffer {
  readonly type: UnitType;
  readonly level: number;
  readonly price: Resources;
  /** Army Power after training (before/after preview, GDD 11). */
  readonly powerAfter: number;
  readonly canTrain: boolean;
  readonly blockedBy?: 'max-level' | 'cost';
}

export interface BattleReport {
  readonly nodeId: string;
  readonly outcome: BattleOutcome;
  readonly loot: Resources;
  /** Nodes this win brought out of the fog. */
  readonly revealed: readonly string[];
  /** Ruins: the floor just fought (0-based) and how many there are. */
  readonly floor?: { readonly index: number; readonly count: number };
  /** True when a ruin floor was won and another one waits: fight on or retreat. */
  readonly nextFloor: boolean;
  /** Chest from the bottom of a ruin, already included in `loot`. */
  readonly treasure?: Resources;
  /** True when this win beat the region's boss. */
  readonly regionCleared: boolean;
}

/** Everything the map shows about one node. */
export interface NodeInfo {
  readonly node: RegionNode;
  readonly status: NodeStatus;
  /** Threat of the next fight here and how it compares to the army; absent when there is nothing to fight. */
  readonly threat?: number;
  readonly label?: ThreatLabel;
  /** Loot for winning every fight here (all floors, plus a ruin's chest). */
  readonly loot: Resources;
  /** Enemy unit type ids of the next fight, front row first. */
  readonly enemies: readonly string[];
  /** Instant clear for part of the loot (GDD 04): Trivial encounters and elites only. */
  readonly canAutoClear: boolean;
  /** What a secured resource site holds right now. */
  readonly harvest?: Resources;
}

/** A ruin run in progress: the next floor and the HP each unit has left (share of max, 0 = fallen). */
interface RuinRun {
  readonly nodeId: string;
  floor: number;
  hpLeft: Map<string, number>;
}

/**
 * The core loop as application use cases: explore the island node by node, fight, collect loot,
 * hire and train. Holds the player's state for one run; presentation calls these and listens on `events`.
 */
export class GameSession {
  readonly events = new EventBus<GameEvent>();
  readonly wallet: Wallet;
  readonly army = new Army();
  readonly levels = new UnitLevels();
  readonly map: IslandMap;
  readonly enemyCatalog: UnitCatalog;
  private readonly baseCatalog: UnitCatalog;
  private leveledCatalog: UnitCatalog;
  private readonly nodes: ReadonlyMap<string, RegionNode>;
  private battles = 0;
  private readonly hires = new Map<string, number>();
  private active: { nodeId: string; prepared: PreparedBattle } | null = null;
  private ruin: RuinRun | null = null;

  constructor(
    private readonly content: GameContent,
    private readonly seed = 1,
    /** Wall clock for respawns and resource sites. */
    readonly now: () => number = Date.now,
  ) {
    this.baseCatalog = catalogOf(content.playerUnits);
    this.leveledCatalog = this.baseCatalog;
    this.enemyCatalog = catalogOf(content.enemyUnits);
    this.wallet = new Wallet(content.startingResources);
    this.nodes = new Map(content.region.nodes.map((n) => [n.id, n]));
    this.map = new IslandMap(content.region.nodes);
    for (const typeId of content.startingArmy) this.army.add(typeId, this.playerCatalog);
  }

  /** Player unit types with their current training levels applied. */
  get playerCatalog(): UnitCatalog {
    return this.leveledCatalog;
  }

  get power(): number {
    return armyPower(this.army.units, this.playerCatalog);
  }

  get battle(): PreparedBattle | null {
    return this.active?.prepared ?? null;
  }

  /** The node of the running battle. */
  get battleNode(): RegionNode | null {
    return this.active ? this.node(this.active.nodeId) : null;
  }

  /** The ruin run in progress: the floor being fought or next up (0-based). */
  get ruinFloor(): { nodeId: string; index: number; count: number } | null {
    if (!this.ruin) return null;
    return { nodeId: this.ruin.nodeId, index: this.ruin.floor, count: this.node(this.ruin.nodeId).battles.length };
  }

  get campId(): string {
    return this.content.region.nodes.find((n) => n.kind === 'camp')!.id;
  }

  node(id: string): RegionNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    return node;
  }

  nodeInfo(id: string): NodeInfo {
    const node = this.node(id);
    const status = this.map.status(id, this.now());
    let loot = NO_RESOURCES;
    node.battles.forEach((b, floor) => (loot = addResources(loot, this.battleReward(node, fullClearLoot(b, node.tier + floor, this.content)))));
    if (node.kind === 'ruin') loot = addResources(loot, this.content.ruinTreasure(node.tier));

    const floor = this.ruin?.nodeId === id ? this.ruin.floor : 0;
    const next = node.battles[floor];
    const fightable = status.kind === 'open' && next !== undefined;
    const threat = fightable ? battleThreat(next, this.enemyCatalog) : undefined;
    const label = threat === undefined ? undefined : threatLabel(threat, this.power);
    const harvest = status.kind === 'secured' && node.produces ? this.harvestOf(node) : undefined;
    return {
      node,
      status,
      threat,
      label,
      loot,
      enemies: fightable ? [...next.slots].sort((a, b) => a.row - b.row || a.lane - b.lane).map((s) => s.typeId) : [],
      canAutoClear: fightable && label === 'trivial' && (node.kind === 'encounter' || node.kind === 'elite'),
      harvest,
    };
  }

  tavernOffers(): TavernOffer[] {
    return this.content.tavern.map(({ typeId, base }) => {
      const type = this.playerCatalog.get(typeId);
      if (!type) throw new Error(`Tavern sells unknown unit: ${typeId}`);
      const price = hirePrice(base, this.hires.get(typeId) ?? 0);
      const preview = this.army.clone();
      const full = preview.isFull;
      if (!full) preview.add(typeId, this.playerCatalog);
      const affordable = this.wallet.canAfford(price);
      return {
        type,
        price,
        powerAfter: armyPower(preview.units, this.playerCatalog),
        canHire: !full && affordable,
        blockedBy: full ? 'army-full' : affordable ? undefined : 'cost',
      };
    });
  }

  /** HireUnit use case: pay the tavern price and place the unit in its best free slot. */
  hire(typeId: string): ArmyUnit {
    const offer = this.tavernOffers().find((o) => o.type.id === typeId);
    if (!offer) throw new Error(`Not for hire: ${typeId}`);
    if (!offer.canHire) throw new Error(`Cannot hire ${typeId}: ${offer.blockedBy}`);
    this.wallet.spend(offer.price);
    const unit = this.army.add(typeId, this.playerCatalog);
    this.hires.set(typeId, (this.hires.get(typeId) ?? 0) + 1);
    this.events.publish({ type: 'CurrencySpent', amount: offer.price, reason: `hire:${typeId}` });
    this.events.publish({ type: 'UnitHired', unitId: unit.id, typeId });
    this.events.publish({ type: 'FormationChanged', power: this.power });
    return unit;
  }

  /** Unit types in the army that can be trained, with price and Power preview. */
  trainingOffers(): TrainingOffer[] {
    const typeIds = [...new Set(this.army.units.map((u) => u.typeId))];
    return typeIds.map((typeId) => {
      const type = this.leveledCatalog.get(typeId)!;
      const level = this.levels.of(typeId);
      const base = this.content.trainBase[typeId];
      if (!base) throw new Error(`No training price for ${typeId}`);
      const price = trainPrice(base, level);
      const maxed = !this.levels.canRaise(typeId);
      const affordable = this.wallet.canAfford(price);
      const preview = new Map(this.leveledCatalog);
      const baseType = this.baseCatalog.get(typeId)!;
      preview.set(typeId, { ...baseType, stats: statsAtLevel(baseType.stats, level + 1) });
      return {
        type,
        level,
        price,
        powerAfter: maxed ? this.power : armyPower(this.army.units, preview),
        canTrain: !maxed && affordable,
        blockedBy: maxed ? 'max-level' : affordable ? undefined : 'cost',
      };
    });
  }

  /** TrainUnit use case: raise a unit type's level for everyone of that type. */
  train(typeId: string): number {
    const offer = this.trainingOffers().find((o) => o.type.id === typeId);
    if (!offer) throw new Error(`No ${typeId} in the army`);
    if (!offer.canTrain) throw new Error(`Cannot train ${typeId}: ${offer.blockedBy}`);
    this.wallet.spend(offer.price);
    const level = this.levels.raise(typeId);
    this.leveledCatalog = catalogOf(
      [...this.baseCatalog.values()].map((t) => ({ ...t, stats: statsAtLevel(t.stats, this.levels.of(t.id)) })),
    );
    this.events.publish({ type: 'CurrencySpent', amount: offer.price, reason: `train:${typeId}` });
    this.events.publish({ type: 'UnitTrained', typeId, level });
    this.events.publish({ type: 'FormationChanged', power: this.power });
    return level;
  }

  moveUnit(unitId: string, to: Slot): void {
    this.army.move(unitId, to);
    this.events.publish({ type: 'FormationChanged', power: this.power });
  }

  /** StartBattle use case: fight the next battle at a node with the current formation. */
  beginBattle(nodeId: string): PreparedBattle {
    if (this.active) throw new Error('A battle is already running');
    const node = this.node(nodeId);
    if (!this.map.canFight(nodeId, this.now())) throw new Error(`Nothing to fight at ${nodeId}`);
    if (this.ruin && this.ruin.nodeId !== nodeId) this.ruin = null;
    if (node.kind === 'ruin' && !this.ruin) this.ruin = { nodeId, floor: 0, hpLeft: new Map() };
    const floor = this.ruin?.floor ?? 0;
    const spec = node.battles[floor];
    if (!spec) throw new Error(`${nodeId} has no battle ${floor}`);
    this.battles++;
    const prepared = startBattle(this.army.units, this.playerCatalog, spec, this.enemyCatalog, this.seed * 7919 + this.battles, this.ruin?.hpLeft);
    this.active = { nodeId, prepared };
    return prepared;
  }

  /** Collects loot once the active battle is over; a win clears the node (or a ruin floor). */
  finishBattle(): BattleReport {
    const active = this.active;
    const outcome = active?.prepared.battle.outcome;
    if (!active || !outcome) throw new Error('No finished battle');
    this.active = null;
    const { nodeId, prepared } = active;
    const node = this.node(nodeId);
    const run = this.ruin?.nodeId === nodeId ? this.ruin : null;
    const floorIndex = run?.floor ?? 0;

    const enemyTypeIds = new Map([...prepared.enemyTypes].map(([id, t]) => [id, t.id]));
    let loot = this.battleReward(node, battleLoot(outcome, enemyTypeIds, node.tier + floorIndex, this.content));
    const won = outcome.winner === 'player';
    let revealed: string[] = [];
    let nextFloor = false;
    let treasure: Resources | undefined;
    const bossBefore = this.map.regionCleared;

    if (run && won && floorIndex < node.battles.length - 1) {
      // Survivors carry their wounds to the next floor.
      for (const c of prepared.battle.combatants) if (c.spec.side === 'player') run.hpLeft.set(c.spec.id, c.hp / c.maxHp);
      run.floor++;
      nextFloor = true;
    } else {
      this.ruin = null;
      if (won) {
        if (node.kind === 'ruin') {
          treasure = this.content.ruinTreasure(node.tier);
          loot = addResources(loot, treasure);
        }
        revealed = this.map.clear(nodeId, this.now());
      }
    }

    this.wallet.earn(loot);
    this.events.publish({ type: won ? 'BattleWon' : 'BattleLost', nodeId, loot });
    this.events.publish({ type: 'CurrencyEarned', amount: loot });
    if (won && !nextFloor) this.events.publish({ type: 'NodeCleared', nodeId, revealed, auto: false });
    const regionCleared = !bossBefore && this.map.regionCleared;
    if (regionCleared) this.events.publish({ type: 'RegionCleared' });
    return {
      nodeId,
      outcome,
      loot,
      revealed,
      floor: node.kind === 'ruin' ? { index: floorIndex, count: node.battles.length } : undefined,
      nextFloor,
      treasure,
      regionCleared,
    };
  }

  /** Leaves a ruin between floors. Loot found so far was already paid. */
  retreat(): void {
    if (this.active) throw new Error('Cannot retreat during a battle');
    this.ruin = null;
  }

  /** Clears a Trivial node instantly for part of its loot (GDD 04). */
  autoClear(nodeId: string): { loot: Resources; revealed: string[] } {
    const info = this.nodeInfo(nodeId);
    if (!info.canAutoClear) throw new Error(`Cannot auto-clear ${nodeId}`);
    const loot = scaleResources(info.loot, this.content.autoClearShare);
    const revealed = this.map.clear(nodeId, this.now());
    this.wallet.earn(loot);
    this.events.publish({ type: 'CurrencyEarned', amount: loot });
    this.events.publish({ type: 'NodeCleared', nodeId, revealed, auto: true });
    return { loot, revealed };
  }

  /** Collects what a secured resource site has produced. */
  harvest(nodeId: string): Resources {
    const node = this.node(nodeId);
    const amount = this.harvestOf(node);
    this.map.harvest(nodeId, this.now());
    this.wallet.earn(amount);
    this.events.publish({ type: 'CurrencyEarned', amount });
    return amount;
  }

  private harvestOf(node: RegionNode): Resources {
    const p = node.produces;
    if (!p) return NO_RESOURCES;
    return { ...NO_RESOURCES, [p.currency]: harvestYield(p.perHour, p.capHours, this.map.sinceHarvest(node.id, this.now())) };
  }

  private battleReward(node: RegionNode, loot: Resources): Resources {
    return scaleResources(loot, node.lootFactor ?? 1);
  }
}
