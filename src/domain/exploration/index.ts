// Exploration bounded context: entities, value objects, domain services and events.
// Pure TypeScript only: no PixiJS, no DOM. See .docs/GDD/13-technical-design.md.
export {
  HOUR_MS,
  IslandMap,
  MINUTE_MS,
  RESPAWN_MS,
  harvestYield,
  type MapNodeDef,
  type NodeKind,
  type NodeStatus,
} from './IslandMap';
export { TRIVIAL_BELOW, threatLabel, type ThreatLabel } from './Threat';
export type { ExplorationEvent } from './events';
