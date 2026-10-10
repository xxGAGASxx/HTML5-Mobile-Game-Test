export type ExplorationEvent =
  | { readonly type: 'NodeCleared'; readonly nodeId: string; readonly revealed: readonly string[]; readonly auto: boolean }
  | { readonly type: 'RegionCleared' };
