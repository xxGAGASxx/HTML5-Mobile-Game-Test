// Army bounded context: entities, value objects, domain services and events.
// Pure TypeScript only: no PixiJS, no DOM. See .docs/GDD/13-technical-design.md.
export { ALL_SLOTS, Army, START_CAPACITY, armyPower, formationBonus, unitPower, type ArmyUnit, type Slot } from './Army';
export { catalogOf, unitTypeOf, type UnitCatalog, type UnitType } from './UnitType';
export type { ArmyEvent } from './events';
