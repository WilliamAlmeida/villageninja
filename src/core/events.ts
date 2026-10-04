import type { Selection } from '../game/types';

export type ToastKind = 'info' | 'good' | 'warn' | 'danger';

export interface GameEvents {
  toast: { text: string; kind: ToastKind; x?: number; y?: number };
  select: Selection | null;
  newGame: void;
}

type Handler<T> = (payload: T) => void;

/** Barramento de eventos tipado: desacopla simulação, UI e render. */
export class EventBus<E> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(key: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) this.handlers.set(key, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof E>(key: K, payload: E[K]): void {
    this.handlers.get(key)?.forEach((fn) => fn(payload));
  }
}

export const bus = new EventBus<GameEvents>();
