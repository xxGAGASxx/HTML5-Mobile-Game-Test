import type { DomainEvent } from './DomainEvent';

export type EventHandler<E extends DomainEvent> = (event: E) => void;

/**
 * In-process, synchronous event bus. Contexts talk to each other only through it,
 * so no context imports another's internals.
 */
export class EventBus<E extends DomainEvent = DomainEvent> {
  private readonly handlers = new Map<E['type'], Set<EventHandler<E>>>();

  subscribe<T extends E['type']>(type: T, handler: EventHandler<Extract<E, { type: T }>>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as EventHandler<E>;
    set.add(h);
    return () => set.delete(h);
  }

  publish(event: E): void {
    const set = this.handlers.get(event.type as E['type']);
    if (!set) return;
    for (const handler of [...set]) handler(event);
  }
}
