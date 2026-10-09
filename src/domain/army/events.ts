export type ArmyEvent =
  | { readonly type: 'UnitHired'; readonly unitId: string; readonly typeId: string }
  | { readonly type: 'FormationChanged'; readonly power: number };
