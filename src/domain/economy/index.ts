// Economy bounded context: entities, value objects, domain services and events.
// Pure TypeScript only: no PixiJS, no DOM. See .docs/GDD/13-technical-design.md.
export { HIRE_GROWTH, TRAIN_GROWTH, hirePrice, trainPrice } from './Pricing';
export { NO_RESOURCES, addResources, scaleResources, type Currency, type Resources } from './Resources';
export { Wallet } from './Wallet';
export type { EconomyEvent } from './events';
