import type { Disposer, ToolbarEntry, ToolbarItem, ToolbarRegistry } from '../types';
import { Items } from '../registry';

export const defaultToolbar: readonly ToolbarEntry[] = [
  { id: 'history', type: 'group', items: ['undo', 'redo'] },
  { id: 'format', type: 'group', items: [
    'headings',
    { id: 'formatting', type: 'menu', label: 'Formatting', icon: 'bold', items: ['bold', 'italic', 'strike'] },
    { id: 'lists', type: 'menu', label: 'Lists', icon: 'lists', items: ['ordered', 'bullet', 'task'] },
    'indent', 'outdent',
  ] },
  { id: 'insert', type: 'group', items: ['code', 'codeblock', 'quotes', 'link', 'image', 'table', 'rule'] },
  { id: 'document', type: 'group', items: [
    { id: 'modes', type: 'menu', label: 'View mode', icon: 'preview', items: ['visual', 'source', 'preview'] },
    'clear', 'copy', 'help',
  ] },
  { id: 'utilities', type: 'group', align: 'opposite', items: ['search', 'fullscreen', 'outline'] },
];

export function validateToolbar(entries: readonly ToolbarEntry[], depth = 0, ids = new Set<string>()): void {
  if (!Array.isArray(entries) || entries.length > 200 || depth > 8) throw new TypeError('Toolbar layouts require bounded arrays with at most eight submenu levels.');
  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (!entry) throw new TypeError('Toolbar IDs must not be empty.');
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new TypeError('Toolbar items require unique nonempty IDs.');
    ids.add(entry.id);
    for (const key of ['command', 'label', 'icon'] as const) if (entry[key] !== undefined && typeof entry[key] !== 'string') throw new TypeError(`Toolbar ${key} must be a string.`);
    if (entry.type !== undefined && entry.type !== 'menu' && entry.type !== 'group') throw new TypeError('Unknown toolbar container type.');
    if (entry.align !== undefined && (depth || !entry.type || !['default', 'opposite'].includes(entry.align))) throw new TypeError('Toolbar alignment belongs to top-level menus or groups and must be default or opposite.');
    if (entry.type ? !Array.isArray(entry.items) || entry.command !== undefined : entry.items !== undefined) throw new TypeError('Toolbar containers require items and cannot execute commands.');
    if (['menu', 'separator', 'overflow', 'fixed'].some(key => key in entry)) throw new TypeError('Use typed toolbar groups and items instead of menu, separator, overflow, or fixed.');
    if (entry.items) validateToolbar(entry.items, depth + 1, ids);
  }
}

export class ToolbarItems implements ToolbarRegistry {
  private registrations = new Items<ToolbarItem>();
  private additions: { item: ToolbarItem; group: string; beforeId?: string }[] = [];

  constructor(private base: () => readonly ToolbarEntry[], private changed: () => void = () => {}, private guard: () => void = () => {}) {}

  register(item: ToolbarItem): Disposer {
    this.guard();
    const dispose = this.registrations.insert(item);
    this.changed();
    return () => { dispose(); this.changed(); };
  }

  insert(item: ToolbarItem, group?: string, beforeId?: string): Disposer {
    this.guard();
    validateToolbar([item], 1);
    const entries = this.layout();
    const defaultGroup = [...entries].reverse().find(entry => typeof entry !== 'string' && entry.type === 'group' && entry.align !== 'opposite');
    const targetId = group ?? (typeof defaultGroup === 'string' ? undefined : defaultGroup?.id);
    const target = this.findContainer(entries, targetId);
    if (target && beforeId !== undefined && !target.some(entry => (typeof entry === 'string' ? entry : entry.id) === beforeId)) throw new Error(`Unknown toolbar ordering target in group ${targetId}: ${beforeId}`);
    const dispose = this.registrations.insert(item);
    const addition = { item, group: targetId ?? '', beforeId };
    this.additions.push(addition);
    this.changed();
    return () => {
      const index = this.additions.indexOf(addition);
      if (index < 0) return;
      this.additions.splice(index, 1);
      dispose();
      this.changed();
    };
  }

  items(): readonly ToolbarItem[] { return this.registrations.items(); }

  layout(): ToolbarEntry[] {
    const registered = new Map(this.registrations.items().map(item => [item.id, item]));
    const clone = (entries: readonly ToolbarEntry[], depth = 0): ToolbarEntry[] => {
      if (depth > 8) throw new TypeError('Toolbar containers cannot exceed eight nesting levels.');
      return entries.map(entry => {
        const item = typeof entry === 'string' ? registered.get(entry) : entry;
        return item?.items ? { ...item, items: clone(item.items, depth + 1) } : entry;
      });
    };
    const entries = clone(this.base());
    const contains = (entries: readonly ToolbarEntry[], id: string): boolean => entries.some(entry => (typeof entry === 'string' ? entry : entry.id) === id || typeof entry !== 'string' && Boolean(entry.items && contains(entry.items, id)));
    for (const { item, group, beforeId } of this.additions) {
      if (contains(entries, item.id)) continue;
      const target = this.findContainer(entries, group);
      if (!target) continue;
      const index = target.findIndex(entry => (typeof entry === 'string' ? entry : entry.id) === beforeId);
      target.splice(index < 0 ? target.length : index, 0, clone([item])[0]);
    }
    return entries;
  }

  private findContainer(entries: readonly ToolbarEntry[], id: string | undefined): ToolbarEntry[] | undefined {
    if (id === undefined) return undefined;
    for (const entry of entries) {
      const item = typeof entry === 'string' ? undefined : entry;
      if (!item?.items) continue;
      if (item.id === id) return item.items as ToolbarEntry[];
      const nested = this.findContainer(item.items, id);
      if (nested) return nested;
    }
    return undefined;
  }
}