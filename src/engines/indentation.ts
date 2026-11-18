/** Shared space-based tab stops for native code blocks and source workspaces. */
export interface IndentationChange { from: number; to: number; insert: string; }

/** Expands only incoming tabs, preserving their alignment at configured tab stops. */
export function expandTabs(text: string, width: number, column = 0): string {
  let result = '';
  for (const character of text) {
    if (character === '\t') {
      const spaces = width - column % width;
      result += ' '.repeat(spaces);
      column += spaces;
    } else {
      result += character;
      column = character === '\n' || character === '\r' ? 0 : column + 1;
    }
  }
  return result;
}

/** Computes VS Code-style tab insertion or selected-line indentation without changing other text. */
export function indentationChanges(text: string, from: number, to: number, width: number, outdent = false, linewise = false): IndentationChange[] {
  const start = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1;
  if (!outdent && !linewise && !text.slice(from, to).includes('\n')) {
    const column = expandTabs(text.slice(start, from), width).length;
    return [{ from, to, insert: ' '.repeat(width - column % width) }];
  }
  const changes: IndentationChange[] = [];
  for (let position = start; position <= to;) {
    if (position === to && from !== to && position !== start) break;
    const end = text.indexOf('\n', position);
    const line = text.slice(position, end < 0 ? text.length : end);
    const prefix = line.match(/^[ \t]*/)![0];
    const column = expandTabs(prefix, width).length;
    const spaces = outdent ? Math.max(0, column - (column % width || width)) : column + width - column % width;
    const insert = ' '.repeat(spaces);
    if (prefix !== insert) changes.push({ from: position, to: position + prefix.length, insert });
    if (end < 0) break;
    position = end + 1;
  }
  return changes;
}
