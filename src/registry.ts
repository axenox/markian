import type { Disposer, Registry } from './types';

export class Items<T extends { id: string }> implements Registry<T> {
  private entries: T[] = [];

  constructor(private changed: () => void = () => {}, private guard: () => void = () => {}) {}

  insert(item: T, before?: string): Disposer {
    this.guard();
    if (!item.id || this.entries.some(entry => entry.id === item.id)) throw new Error(`Duplicate or empty registration ID: ${item.id}`);
    const index = before === undefined ? this.entries.length : this.entries.findIndex(entry => entry.id === before);
    if (index < 0) throw new Error(`Unknown ordering target: ${before}`);
    const owned = Object.freeze({ ...item }) as T;
    this.entries.splice(index, 0, owned);
    this.changed();
    return () => {
      const current = this.entries.indexOf(owned);
      if (current < 0) return;
      this.entries.splice(current, 1);
      this.changed();
    };
  }

  items(): readonly T[] { return this.entries.slice(); }
}