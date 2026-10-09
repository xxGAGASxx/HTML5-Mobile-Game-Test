// Combat bounded context: entities, value objects, domain services and events.
// Pure TypeScript only: no PixiJS, no DOM. See .docs/GDD/13-technical-design.md.
export {
  Battle,
  CAPTAIN_TAP_ATK,
  MAX_TAPS_PER_SECOND,
  RALLY_MAX,
  TICK_HZ,
  TICK_MS,
  TIME_LIMIT_TICKS,
  attackInterval,
  type BattleEndReason,
  type BattleOutcome,
  type Combatant,
  type CombatantSpec,
  type CombatEvent,
  type Side,
} from './Battle';
export type { BattleResultEvent } from './events';
