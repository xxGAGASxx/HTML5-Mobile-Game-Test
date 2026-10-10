import { armyPower, catalogOf, unitTypeOf, type ArmyUnit, type UnitCatalog, type UnitType } from '../../domain/army';
import { Battle, type CombatantSpec } from '../../domain/combat';
import type { BattleSpec } from '../content';

export interface PreparedBattle {
  readonly battle: Battle;
  readonly power: number;
  readonly threat: number;
  /** Enemy unit types by combatant id, for loot and display. */
  readonly enemyTypes: ReadonlyMap<string, UnitType>;
}

/** Enemy type with HP and ATK scaled to the battle's strength. */
function scaled(type: UnitType, strength: number): UnitType {
  if (strength === 1) return type;
  const { stats } = type;
  return { ...type, stats: { ...stats, hp: Math.round(stats.hp * strength), atk: Math.round(stats.atk * strength) } };
}

/** The enemy side of a battle: combatant id `e1`, `e2`… to its scaled unit type and slot. */
function enemyUnitsOf(spec: BattleSpec, enemyCatalog: UnitCatalog): { types: Map<string, UnitType>; units: ArmyUnit[] } {
  const types = new Map<string, UnitType>();
  const units = spec.slots.map((slot, i) => {
    const id = `e${i + 1}`;
    const type = scaled(unitTypeOf(enemyCatalog, slot.typeId), spec.strength);
    types.set(id, type);
    return { id, typeId: type.id, slot: { row: slot.row, lane: slot.lane } };
  });
  return { types, units };
}

/** Threat of a battle: the enemy side's Power, on the same scale as the army's (GDD 04). */
export function battleThreat(spec: BattleSpec, enemyCatalog: UnitCatalog): number {
  const { types, units } = enemyUnitsOf(spec, enemyCatalog);
  return armyPower(units, catalogOf([...types.values()]));
}

/**
 * StartBattle use case: turns the current army and a battle spec into a ready battle.
 * `hpLeft` carries damage between ruin floors: share of max HP per unit id, 0 for the fallen.
 */
export function startBattle(
  army: readonly ArmyUnit[],
  playerCatalog: UnitCatalog,
  spec: BattleSpec,
  enemyCatalog: UnitCatalog,
  seed: number,
  hpLeft?: ReadonlyMap<string, number>,
): PreparedBattle {
  const fighting = army.filter((u) => (hpLeft?.get(u.id) ?? 1) > 0);
  const specs: CombatantSpec[] = fighting.map((u) => {
    const type = unitTypeOf(playerCatalog, u.typeId);
    const share = hpLeft?.get(u.id) ?? 1;
    const hp = share < 1 ? Math.max(1, Math.round(type.stats.hp * share)) : undefined;
    return { id: u.id, side: 'player', typeId: u.typeId, role: type.role, row: u.slot.row, lane: u.slot.lane, stats: type.stats, hp };
  });

  const enemies = enemyUnitsOf(spec, enemyCatalog);
  for (const u of enemies.units) {
    const type = enemies.types.get(u.id)!;
    specs.push({ id: u.id, side: 'enemy', typeId: type.id, role: type.role, row: u.slot.row, lane: u.slot.lane, stats: type.stats });
  }

  // Power is read synchronously from the formation right now: no async window (GDD 13).
  return {
    battle: new Battle(specs, seed),
    power: armyPower(fighting, playerCatalog),
    threat: armyPower(enemies.units, catalogOf([...enemies.types.values()])),
    enemyTypes: enemies.types,
  };
}
