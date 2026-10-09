import type { Role, UnitStats } from '../shared';

/** Static definition of a unit kind (data, not an instance). */
export interface UnitType {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  /** Placeholder art key (a game-icons.net slug). */
  readonly icon: string;
  readonly stats: UnitStats;
}

export type UnitCatalog = ReadonlyMap<string, UnitType>;

export function catalogOf(types: readonly UnitType[]): UnitCatalog {
  return new Map(types.map((t) => [t.id, t]));
}

export function unitTypeOf(catalog: UnitCatalog, id: string): UnitType {
  const type = catalog.get(id);
  if (!type) throw new Error(`Unknown unit type: ${id}`);
  return type;
}
