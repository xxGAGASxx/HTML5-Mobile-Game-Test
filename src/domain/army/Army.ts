import { LANES, ROWS, type Lane, type Role, type Row } from '../shared';
import { unitTypeOf, type UnitCatalog } from './UnitType';

export interface Slot {
  readonly row: Row;
  readonly lane: Lane;
}

/** One unit the player owns, placed on the 3 x 3 formation grid. */
export interface ArmyUnit {
  readonly id: string;
  readonly typeId: string;
  readonly slot: Slot;
}

export const START_CAPACITY = 5;

/** Slots each role tries first, best first: tanks and blades up front, ranged in the back. */
const PREFERRED_ROWS: Record<Role, readonly Row[]> = {
  guard: [0, 1, 2],
  fighter: [0, 1, 2],
  shooter: [2, 1, 0],
  caster: [2, 1, 0],
};
/** Fill the middle lane first so a single unit sits centered. */
const LANE_ORDER: readonly Lane[] = [1, 0, 2];

/** Army aggregate: roster plus formation. Power is a synchronous pure function of it (GDD 13). */
export class Army {
  private readonly list: ArmyUnit[] = [];
  private nextId = 1;

  constructor(readonly capacity: number = START_CAPACITY) {}

  get units(): readonly ArmyUnit[] {
    return this.list;
  }

  get isFull(): boolean {
    return this.list.length >= this.capacity;
  }

  unitAt(slot: Slot): ArmyUnit | undefined {
    return this.list.find((u) => u.slot.row === slot.row && u.slot.lane === slot.lane);
  }

  /** Adds a unit at its role's best free slot. Throws when the army is full. */
  add(typeId: string, catalog: UnitCatalog): ArmyUnit {
    if (this.isFull) throw new Error('Army is full');
    const role = unitTypeOf(catalog, typeId).role;
    const slot = this.freeSlotFor(role);
    if (!slot) throw new Error('No free slot');
    const unit: ArmyUnit = { id: `u${this.nextId++}`, typeId, slot };
    this.list.push(unit);
    return unit;
  }

  /** Moves a unit to a slot, swapping with whoever stands there. */
  move(unitId: string, to: Slot): void {
    const index = this.list.findIndex((u) => u.id === unitId);
    if (index < 0) throw new Error(`Unknown unit: ${unitId}`);
    const from = this.list[index].slot;
    const otherIndex = this.list.findIndex((u) => u.slot.row === to.row && u.slot.lane === to.lane);
    if (otherIndex >= 0) this.list[otherIndex] = { ...this.list[otherIndex], slot: from };
    this.list[index] = { ...this.list[index], slot: to };
  }

  clone(): Army {
    const copy = new Army(this.capacity);
    copy.list.push(...this.list);
    copy.nextId = this.nextId;
    return copy;
  }

  private freeSlotFor(role: Role): Slot | undefined {
    for (const row of PREFERRED_ROWS[role]) {
      for (const lane of LANE_ORDER) {
        if (!this.unitAt({ row, lane })) return { row, lane };
      }
    }
    return undefined;
  }
}

/** Power of one unit before formation bonuses: HP/10 + ATK*SPD*2 + ARM (GDD 05). */
export function unitPower(typeId: string, catalog: UnitCatalog): number {
  const { hp, atk, spd, arm } = unitTypeOf(catalog, typeId).stats;
  return hp / 10 + atk * spd * 2 + arm;
}

/** +5% when every Front slot holds a Guard or Fighter. (Support's +5% arrives with the Support role.) */
export function formationBonus(units: readonly ArmyUnit[], catalog: UnitCatalog): number {
  const frontHeld = LANES.every((lane) => {
    const unit = units.find((u) => u.slot.row === 0 && u.slot.lane === lane);
    if (!unit) return false;
    const role = unitTypeOf(catalog, unit.typeId).role;
    return role === 'guard' || role === 'fighter';
  });
  return frontHeld ? 1.05 : 1;
}

/** Army Power, also used as enemy Threat. Rounded for display. */
export function armyPower(units: readonly ArmyUnit[], catalog: UnitCatalog): number {
  const raw = units.reduce((sum, u) => sum + unitPower(u.typeId, catalog), 0);
  return Math.round(raw * formationBonus(units, catalog));
}

export const ALL_SLOTS: readonly Slot[] = ROWS.flatMap((row) => LANES.map((lane) => ({ row, lane })));
