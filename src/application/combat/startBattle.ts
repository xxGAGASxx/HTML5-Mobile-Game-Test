import { armyPower, catalogOf, unitTypeOf, type ArmyUnit, type UnitCatalog, type UnitType } from '../../domain/army';
import { Battle, type CombatantSpec } from '../../domain/combat';
import type { WaveSpec } from '../content';

export interface PreparedBattle {
  readonly battle: Battle;
  readonly power: number;
  readonly threat: number;
  /** Enemy unit types by combatant id, for loot and display. */
  readonly enemyTypes: ReadonlyMap<string, UnitType>;
}

/** Enemy type with HP and ATK scaled to the wave's strength. */
function scaled(type: UnitType, strength: number): UnitType {
  if (strength === 1) return type;
  const { stats } = type;
  return { ...type, stats: { ...stats, hp: Math.round(stats.hp * strength), atk: Math.round(stats.atk * strength) } };
}

/** StartBattle use case: turns the current army and a wave into a ready battle. */
export function startBattle(
  army: readonly ArmyUnit[],
  playerCatalog: UnitCatalog,
  wave: WaveSpec,
  enemyCatalog: UnitCatalog,
  seed: number,
): PreparedBattle {
  const specs: CombatantSpec[] = army.map((u) => {
    const type = unitTypeOf(playerCatalog, u.typeId);
    return { id: u.id, side: 'player', typeId: u.typeId, role: type.role, row: u.slot.row, lane: u.slot.lane, stats: type.stats };
  });

  const enemyTypes = new Map<string, UnitType>();
  const enemyUnits: ArmyUnit[] = wave.slots.map((slot, i) => {
    const id = `e${i + 1}`;
    const type = scaled(unitTypeOf(enemyCatalog, slot.typeId), wave.strength);
    enemyTypes.set(id, type);
    specs.push({ id, side: 'enemy', typeId: type.id, role: type.role, row: slot.row, lane: slot.lane, stats: type.stats });
    return { id, typeId: type.id, slot: { row: slot.row, lane: slot.lane } };
  });

  // Power is read synchronously from the formation right now: no async window (GDD 13).
  return {
    battle: new Battle(specs, seed),
    power: armyPower(army, playerCatalog),
    threat: armyPower(enemyUnits, catalogOf([...enemyTypes.values()])),
    enemyTypes,
  };
}
