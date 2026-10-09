import { Army, armyPower, catalogOf, type ArmyEvent, type ArmyUnit, type Slot, type UnitCatalog, type UnitType } from '../domain/army';
import type { BattleOutcome, BattleResultEvent } from '../domain/combat';
import { Wallet, hirePrice, trainPrice, type EconomyEvent, type Resources } from '../domain/economy';
import { UnitLevels, statsAtLevel, type ProgressionEvent } from '../domain/progression';
import { EventBus } from '../domain/shared';
import { battleLoot, startBattle, type PreparedBattle } from './combat';
import type { GameContent } from './content';

export type GameEvent = ArmyEvent | BattleResultEvent | EconomyEvent | ProgressionEvent;

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
  readonly wave: number;
  readonly outcome: BattleOutcome;
  readonly loot: Resources;
}

/**
 * The core loop as application use cases: fight a wave, collect loot, hire, fight the next wave.
 * Holds the player's state for one run; presentation calls these and listens on `events`.
 */
export class GameSession {
  readonly events = new EventBus<GameEvent>();
  readonly wallet: Wallet;
  readonly army = new Army();
  readonly levels = new UnitLevels();
  readonly enemyCatalog: UnitCatalog;
  private readonly baseCatalog: UnitCatalog;
  private leveledCatalog: UnitCatalog;
  private waveNumber = 1;
  private battles = 0;
  private readonly hires = new Map<string, number>();
  private active: PreparedBattle | null = null;

  constructor(
    private readonly content: GameContent,
    private readonly seed = 1,
  ) {
    this.baseCatalog = catalogOf(content.playerUnits);
    this.leveledCatalog = this.baseCatalog;
    this.enemyCatalog = catalogOf(content.enemyUnits);
    this.wallet = new Wallet(content.startingResources);
    for (const typeId of content.startingArmy) this.army.add(typeId, this.playerCatalog);
  }

  get wave(): number {
    return this.waveNumber;
  }

  /** Player unit types with their current training levels applied. */
  get playerCatalog(): UnitCatalog {
    return this.leveledCatalog;
  }

  get power(): number {
    return armyPower(this.army.units, this.playerCatalog);
  }

  get battle(): PreparedBattle | null {
    return this.active;
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

  /** StartBattle use case: fight the current wave with the current formation. */
  beginBattle(): PreparedBattle {
    if (this.active) throw new Error('A battle is already running');
    const wave = this.content.waveAt(this.waveNumber);
    this.battles++;
    this.active = startBattle(this.army.units, this.playerCatalog, wave, this.enemyCatalog, this.seed * 7919 + this.battles);
    return this.active;
  }

  /** Collects loot once the active battle is over, and advances the wave on a win. */
  finishBattle(): BattleReport {
    const prepared = this.active;
    const outcome = prepared?.battle.outcome;
    if (!prepared || !outcome) throw new Error('No finished battle');
    this.active = null;

    const wave = this.waveNumber;
    const enemyTypeIds = new Map([...prepared.enemyTypes].map(([id, t]) => [id, t.id]));
    const loot = battleLoot(outcome, enemyTypeIds, wave, this.content);
    this.wallet.earn(loot);

    const won = outcome.winner === 'player';
    if (won) this.waveNumber++;
    this.events.publish({ type: won ? 'BattleWon' : 'BattleLost', wave, loot });
    this.events.publish({ type: 'CurrencyEarned', amount: loot });
    return { wave, outcome, loot };
  }
}
