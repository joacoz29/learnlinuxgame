type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub. `Events` maps event name -> payload type. */
export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(name: K, handler: Handler<Events[K]>): () => void {
    const set = this.handlers.get(name) ?? new Set<Handler<never>>();
    set.add(handler as Handler<never>);
    this.handlers.set(name, set);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    this.handlers.get(name)?.forEach((h) => (h as Handler<Events[K]>)(payload));
  }
}
