import type { ToolbarEntry } from '../types';

export const defaultToolbar: readonly ToolbarEntry[] = [
  'undo', 'redo', { id: 'history-divider', separator: true },
  'headings',
  { id: 'formatting', label: 'Formatting', icon: 'bold', menu: ['bold', 'italic', 'strike'] },
  { id: 'lists', label: 'Lists', icon: 'lists', menu: ['ordered', 'bullet', 'task'] },
  'indent', 'outdent', { id: 'format-divider', separator: true },
  'code', 'codeblock', 'quotes', 'link', 'image', 'table', 'rule', 
  { id: 'insert-divider', separator: true },
  { id: 'modes', label: 'View mode', icon: 'preview', menu: ['visual', 'source', 'preview'] },
  'outline', 'clear', 'copy', 'help',
  { id: 'more', overflow: true }, 'search', 'fullscreen',
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
    for (const key of ['separator', 'overflow', 'fixed'] as const) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') throw new TypeError(`Toolbar ${key} must be a boolean.`);
    if (entry.overflow && depth) throw new TypeError('An overflow boundary belongs at toolbar level, not inside a submenu.');
    if ((entry.separator || entry.overflow) && (entry.command || entry.menu || entry.separator && entry.overflow)) throw new TypeError('Toolbar separators and overflow boundaries cannot contain commands or menus.');
    if (entry.menu) validateToolbar(entry.menu, depth + 1, ids);
  }
  if (!depth && entries.filter(entry => typeof entry !== 'string' && entry.overflow).length > 1) throw new TypeError('A toolbar can have only one overflow boundary.');
}