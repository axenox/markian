import { closeHistory, setBlockType, wrapIn, wrapInList, liftListItem, sinkListItem, addRowAfter, addRowBefore, addColumnAfter, addColumnBefore, deleteRow, deleteColumn, deleteTable, setCellAttr, TextSelection } from './engines/prose';
import type { Command, EditorView, ProseNode, Transaction } from './engines/prose';
import type { SourceEditor } from './engines/source';
import type { CommandDefinition, EditorOptions, MarkianInstance, ToolbarItem } from './types';
import { defaultColors } from './render/colors';
import { quoteMarker } from './render/markdown';

export function installEditing(instance: MarkianInstance, visual: () => EditorView, raw: () => SourceEditor, options: EditorOptions, destination: (image: boolean) => void, registerToolbar: (item: ToolbarItem) => void): void {
  const add = (definition: CommandDefinition, pinned = false) => {
    instance.getCommands().insert(definition);
    if (pinned) registerToolbar({ id: definition.id, command: definition.id });
  };
  const run = (command: Command) => {
    const view = visual();
    command(view.state, transaction => view.dispatch(closeHistory(transaction)));
    view.focus();
  };
  const visualCommand = (id: string, label: string, icon: string, command: () => Command, pinned = false) => add({
    id, label, icon, views: ['visual'], mutates: true,
    enabled: () => command()(visual().state),
    run: () => run(command()),
  }, pinned);
  const sourceInsert = (value: string) => {
    const view = raw().view;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: value } });
    view.focus();
  };
  if (options.allowTextColors) {
    const palette = options.textColors ?? defaultColors;
    if (palette.length < 5 || palette.length > 10 || palette.some(color => !/^#[a-f0-9]{6}$/i.test(color))) throw new TypeError('Text colors require 5-10 hexadecimal #rrggbb swatches.');
    for (const color of palette) add({
      id: `color:${color.toLowerCase()}`, label: color, swatch: color, views: ['visual', 'raw'], mutates: true,
      run: () => {
        if (instance.activeView === 'raw') {
          const { from, to } = raw().view.state.selection.main;
          sourceInsert(`<span style="color:${color.toLowerCase()}">${raw().view.state.sliceDoc(from, to)}</span>`);
        } else {
          const view = visual();
          const { from, to, empty } = view.state.selection;
          const mark = view.state.schema.marks.text_color.create({ color: color.toLowerCase() });
          view.dispatch(closeHistory(empty ? view.state.tr.addStoredMark(mark) : view.state.tr.addMark(from, to, mark)));
        }
      },
    });
    add({ id: 'colors', label: 'Text color', icon: 'color', views: ['visual', 'raw'], run: () => {} });
    instance.getToolbar().insert({ id: 'colors', type: 'menu', items: palette.map(color => `color:${color.toLowerCase()}`) }, 'format');
  }
  const sourceLines = (transform: (line: string) => string) => {
    const view = raw().view;
    const selection = view.state.selection.main;
    const first = view.state.doc.lineAt(selection.from);
    const last = view.state.doc.lineAt(selection.to);
    view.dispatch({ changes: { from: first.from, to: last.to, insert: view.state.sliceDoc(first.from, last.to).split('\n').map(transform).join('\n') } });
  };
  const selectedListItems = (state: EditorView['state']) => {
    const items: { node: ProseNode; position: number }[] = [];
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, position) => {
      if (node.type.name === 'list_item') items.push({ node, position });
    });
    return items;
  };
  const list = (name: string): Command => (state, dispatch) => {
    const items = selectedListItems(state);
    if (items.length) {
      const lists = new Map<number, ProseNode>();
      for (const item of items) {
        const resolved = state.doc.resolve(item.position);
        lists.set(resolved.before(resolved.depth), resolved.parent);
      }
      if ([...lists.values()].every(node => node.type.name === name) && items.every(item => item.node.attrs.checked === null)) return liftListItem(state.schema.nodes.list_item)(state, dispatch);
      const transaction = state.tr;
      for (const [position, node] of lists) transaction.setNodeMarkup(position, state.schema.nodes[name], { ...node.attrs });
      for (const item of items) transaction.setNodeMarkup(item.position, undefined, { ...item.node.attrs, checked: null });
      dispatch?.(transaction);
      return true;
    }
    return wrapInList(state.schema.nodes[name])(state, dispatch);
  };
  for (let level = 1; level <= 6; level++) add({
    id: `heading:${level}`, label: `Heading ${level}`, icon: `heading${level}`, views: ['visual', 'raw'], mutates: true,
    active: () => instance.activeView === 'visual' && visual().state.selection.$from.parent.attrs.level === level,
    run: () => {
      if (instance.activeView === 'raw') {
        const view = raw().view;
        const line = view.state.doc.lineAt(view.state.selection.main.from);
        view.dispatch({ changes: { from: line.from, to: line.to, insert: '#'.repeat(level) + ' ' + line.text.replace(/^#{1,6}\s+/, '') } });
      } else run(setBlockType(visual().state.schema.nodes.heading, { level }));
    },
  });
  add({ id: 'headings', label: 'Headings', icon: 'heading', views: ['visual', 'raw'], run: () => {} });
  registerToolbar({ id: 'headings', type: 'menu', items: [1, 2, 3, 4, 5, 6].map(level => `heading:${level}`) });
  add({ id: 'strike', label: 'Strikethrough', icon: 'strike', views: ['visual', 'raw'], mutates: true, run: () => {
    if (instance.activeView === 'raw') {
      const { from, to } = raw().view.state.selection.main;
      sourceInsert(`~~${raw().view.state.sliceDoc(from, to)}~~`);
    } else {
      const view = visual();
      const mark = view.state.schema.marks.strike_through;
      const { from, to } = view.state.selection;
      const active = view.state.doc.rangeHasMark(from, to, mark);
      view.dispatch(closeHistory(active ? view.state.tr.removeMark(from, to, mark) : view.state.tr.addMark(from, to, mark.create())));
    }
  } }, true);
  for (const [id, label, prefix, node] of [['list:bullet', 'Bullet list', '- ', 'bullet_list'], ['ordered', 'Numbered list', '1. ', 'ordered_list']]) add({
    id, label, icon: id === 'ordered' ? 'ordered' : 'bullet', views: ['visual', 'raw'], mutates: true,
    run: () => { if (instance.activeView === 'raw') sourceLines(line => prefix + line.replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '')); else run(list(node)); },
  }, id === 'ordered');
  for (const [id, label, command] of [['indent', 'Indent list item', sinkListItem], ['outdent', 'Outdent list item', liftListItem]] as const) add({
    id, label, icon: id, views: ['visual', 'raw'], mutates: true,
    enabled: () => instance.activeView === 'raw' || command(visual().state.schema.nodes.list_item)(visual().state),
    run: () => { if (instance.activeView === 'raw') sourceLines(line => id === 'indent' ? '  ' + line : line.replace(/^(?: {1,2}|\t)/, '')); else run(command(visual().state.schema.nodes.list_item)); },
  }, true);
  add({ id: 'task', label: 'Task list', icon: 'task', views: ['visual', 'raw'], mutates: true, run: () => {
    if (instance.activeView === 'raw') { sourceLines(line => '- [ ] ' + line.replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '')); return; }
    const view = visual();
    const apply = (transaction: Transaction) => {
      const items = selectedListItems(view.state.apply(transaction));
      const remove = items.every(item => item.node.attrs.checked !== null);
      for (const item of items) transaction.setNodeMarkup(item.position, undefined, { ...item.node.attrs, checked: remove ? null : item.node.attrs.checked ?? false });
      view.dispatch(closeHistory(transaction));
      view.focus();
    };
    if (selectedListItems(view.state).length) apply(view.state.tr);
    else wrapInList(view.state.schema.nodes.bullet_list)(view.state, apply);
  } }, true);
  add({ id: 'rule', label: 'Horizontal rule', icon: 'rule', views: ['visual', 'raw'], mutates: true, run: () => {
    if (instance.activeView === 'raw') sourceInsert('\n\n---\n\n');
    else {
      const view = visual();
      view.dispatch(closeHistory(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hr.create()).scrollIntoView()));
    }
  } }, true);
  add({ id: 'codeblock', label: 'Code block', icon: 'expand', views: ['visual', 'raw'], mutates: true, run: () => {
    if (instance.activeView === 'raw') {
      const { from, to } = raw().view.state.selection.main;
      const value = raw().view.state.sliceDoc(from, to);
      const marker = '`'.repeat(Math.max(2, ...Array.from(value.matchAll(/`+/g), match => match[0].length)) + 1);
      sourceInsert(`\n${marker}\n${value}\n${marker}\n`);
    } else run(setBlockType(visual().state.selection.$from.parent.type.name === 'code_block' ? visual().state.schema.nodes.paragraph : visual().state.schema.nodes.code_block));
  } }, true);
  add({ id: 'clear', label: 'Clear formatting', icon: 'clear', views: ['visual'], mutates: true, run: () => {
    const view = visual();
    const { from, to } = view.state.selection;
    const transaction = closeHistory(view.state.tr.removeMark(from, to));
    if (transaction.selection.$from.parent.type.name !== 'paragraph') transaction.setBlockType(from, to, view.state.schema.nodes.paragraph);
    view.dispatch(transaction);
  } }, true);
  const quoteContext = (transaction = visual().state.tr) => {
    const selected = transaction.selection.$from;
    let depth = selected.depth;
    while (depth > 0 && selected.node(depth).type.name !== 'blockquote') depth--;
    const paragraph = depth ? selected.node(depth).firstChild : null;
    const marker = paragraph ? quoteMarker(paragraph.textBetween(0, paragraph.content.size, '\n', '\n')) : null;
    return { depth, markerLength: marker?.length ?? 0, kind: depth ? marker?.kind ?? '' : null, start: depth ? selected.start(depth) + 1 : 0 };
  };
  const sourceQuoteContext = () => {
    const view = raw().view;
    const selection = view.state.selection.main;
    let first = view.state.doc.lineAt(selection.from);
    let last = view.state.doc.lineAt(selection.to);
    if (/^ {0,3}>/.test(first.text)) {
      while (first.number > 1 && /^ {0,3}>/.test(view.state.doc.line(first.number - 1).text)) first = view.state.doc.line(first.number - 1);
      while (last.number < view.state.doc.lines && /^ {0,3}>/.test(view.state.doc.line(last.number + 1).text)) last = view.state.doc.line(last.number + 1);
    }
    const quoted = /^ {0,3}>/.test(first.text);
    const lines = view.state.sliceDoc(first.from, last.to).split('\n').map(line => quoted ? line.replace(/^ {0,3}> ?/, '') : line);
    const marker = quoted ? lines[0].match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/) : null;
    return { view, first, last, lines, marker, kind: quoted ? marker?.[1] ?? '' : null };
  };
  for (const kind of ['', 'NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) add({
    id: kind ? `quote:${kind.toLowerCase()}` : 'quote', label: kind ? kind[0] + kind.slice(1).toLowerCase() : 'Quote', icon: kind ? `quote:${kind.toLowerCase()}` : 'quote', views: ['visual', 'raw'], mutates: true,
    active: () => (instance.activeView === 'raw' ? sourceQuoteContext().kind : quoteContext().kind) === kind,
    run: () => {
      if (instance.activeView === 'raw') {
        const context = sourceQuoteContext();
        if (context.marker) context.lines.shift();
        if (!context.lines.length) context.lines.push('');
        const lines = context.kind === kind ? context.lines : [...(kind ? [`[!${kind}]`] : []), ...context.lines].map(line => '> ' + line);
        context.view.dispatch({ changes: { from: context.first.from, to: context.last.to, insert: lines.join('\n') }, selection: { anchor: context.first.from + (context.kind === kind ? 0 : kind ? kind.length + 8 : 2) } });
        context.view.focus();
      }
      else {
        const view = visual();
        const current = quoteContext();
        const apply = (transaction: Transaction) => {
          const context = quoteContext(transaction);
          if (!context.depth) return;
          if (kind && current.kind !== kind) {
            transaction.replaceWith(context.start, context.start + context.markerLength, [view.state.schema.text(`[!${kind}]`), view.state.schema.nodes.hardbreak.create()]);
          } else transaction.delete(context.start, context.start + context.markerLength);
          if (current.kind === kind) {
            const selected = transaction.selection.$from;
            const range = transaction.doc.resolve(selected.start(context.depth)).blockRange(transaction.doc.resolve(selected.end(context.depth)));
            if (range) transaction.lift(range, context.depth - 1);
          }
          view.dispatch(closeHistory(transaction));
          view.focus();
        };
        if (current.depth) apply(view.state.tr);
        else wrapIn(view.state.schema.nodes.blockquote)(view.state, apply);
      }
    },
  });
  add({ id: 'quotes', label: 'Quote', icon: 'quote', views: ['visual', 'raw'], run: () => {} });
  registerToolbar({ id: 'quotes', type: 'menu', items: ['quote', 'quote:note', 'quote:tip', 'quote:important', 'quote:warning', 'quote:caution'] });
  for (const image of [false, true]) add({ id: image ? 'image' : 'link', label: image ? 'Insert image' : 'Edit link', icon: image ? 'image' : 'link', views: ['visual', 'raw'], mutates: true, run: () => destination(image) }, true);
  add({ id: 'unlink', label: 'Remove link', icon: 'unlink', views: ['visual'], mutates: true, run: () => {
    const view = visual();
    const { from, to, $from } = view.state.selection;
    let start = from;
    let end = to;
    if (from === to) {
      const link = $from.marks().find(mark => mark.type.name === 'link');
      if (!link) return;
      $from.parent.forEach((node, offset) => {
        if (link.isInSet(node.marks)) { start = Math.min(start, $from.start() + offset); end = Math.max(end, $from.start() + offset + node.nodeSize); }
      });
    }
    view.dispatch(closeHistory(view.state.tr.removeMark(start, end, view.state.schema.marks.link)));
  } });
  add({ id: 'table', label: 'Table', icon: 'table', views: ['visual'], run: () => {} });
  add({ id: 'table:insert', label: 'Insert table', icon: 'table:insert', views: ['visual', 'raw'], mutates: true, run: (_instance, payload) => {
    const shape = payload as { rows?: number; columns?: number } | undefined;
    const rows = shape?.rows ?? 3;
    const columns = shape?.columns ?? 3;
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || rows > 100 || columns < 1 || columns > 30) throw new RangeError('Tables require 2-100 rows and 1-30 columns.');
    if (instance.activeView === 'raw') {
      const row = '| ' + Array(columns).fill(' ').join(' | ') + ' |';
      sourceInsert('\n' + [row, '| ' + Array(columns).fill('---').join(' | ') + ' |', ...Array(rows - 1).fill(row)].join('\n') + '\n');
      return;
    }
    const view = visual();
    const nodes = view.state.schema.nodes;
    const content: ProseNode[] = [];
    for (let row = 0; row < rows; row++) content.push((row ? nodes.table_row : nodes.table_header_row).create(null,
      Array.from({ length: columns }, () => (row ? nodes.table_cell : nodes.table_header).createAndFill()!)));
    const table = nodes.table.create(null, content);
    const transaction = closeHistory(view.state.tr.replaceSelectionWith(table));
    view.dispatch(transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(transaction.selection.from, transaction.doc.content.size)))).scrollIntoView());
    view.focus();
  } });
  const tableCommands: [string, string, Command][] = [
    ['row-before', 'Insert row above', addRowBefore], ['row-after', 'Insert row below', addRowAfter],
    ['column-before', 'Insert column left', addColumnBefore], ['column-after', 'Insert column right', addColumnAfter],
    ['delete-row', 'Delete row', deleteRow], ['delete-column', 'Delete column', deleteColumn], ['delete', 'Delete table', deleteTable],
    ['header', 'Use row as header', addRowAfter],
    ['left', 'Align left', setCellAttr('alignment', 'left')], ['center', 'Align center', setCellAttr('alignment', 'center')], ['right', 'Align right', setCellAttr('alignment', 'right')],
  ];
  const rowCommand = (operation: string): Command => (state, dispatch) => {
    const selected = state.selection.$from;
    let depth = selected.depth;
    while (depth > 0 && selected.node(depth).type.name !== 'table') depth--;
    if (!depth) return false;
    if (!dispatch) return true;
    const table = selected.node(depth);
    const position = selected.before(depth);
    const index = selected.index(depth);
    if (operation === 'delete-row' && table.childCount <= 2) return deleteTable(state, dispatch);
    const rows: ProseNode[] = [];
    table.forEach(row => rows.push(row));
    if (operation === 'header') {
      if (index === 0) return true;
      const current = rows[index];
      const header = rows[0];
      rows[0] = state.schema.nodes.table_header_row.create(null, Array.from({ length: current.childCount }, (_, column) => state.schema.nodes.table_header.create(current.child(column).attrs, current.child(column).content)));
      rows[index] = state.schema.nodes.table_row.create(null, Array.from({ length: header.childCount }, (_, column) => state.schema.nodes.table_cell.create(header.child(column).attrs, header.child(column).content)));
    } else if (operation === 'delete-row') {
      rows.splice(index, 1);
      if (index === 0) rows[0] = state.schema.nodes.table_header_row.create(null,
        Array.from({ length: rows[0].childCount }, (_, column) => state.schema.nodes.table_header.create(rows[0].child(column).attrs, rows[0].child(column).content)));
    } else {
      const source = rows[index];
      const row = state.schema.nodes.table_row.create(null, Array.from({ length: source.childCount }, (_, column) =>
        state.schema.nodes.table_cell.createAndFill(source.child(column).attrs)!));
      rows.splice(operation === 'row-before' ? Math.max(1, index) : index + 1, 0, row);
    }
    const transaction = state.tr.replaceWith(position, position + table.nodeSize, table.type.create(table.attrs, rows));
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(selected.pos, position + transaction.doc.nodeAt(position)!.nodeSize - 2))));
    dispatch(transaction);
    return true;
  };
  const alignColumn = (alignment: string): Command => (state, dispatch) => {
    const selected = state.selection.$from;
    let depth = selected.depth;
    while (depth > 0 && selected.node(depth).type.name !== 'table') depth--;
    if (!depth) return false;
    if (!dispatch) return true;
    const table = selected.node(depth);
    const column = selected.index(depth + 1);
    const transaction = state.tr;
    table.forEach((row, rowOffset) => {
      let cellOffset = 0;
      for (let index = 0; index < column; index++) cellOffset += row.child(index).nodeSize;
      const cell = row.child(column);
      transaction.setNodeMarkup(selected.before(depth) + rowOffset + cellOffset + 2, undefined, { ...cell.attrs, alignment });
    });
    dispatch(transaction);
    return true;
  };
  for (const [id, label, command] of tableCommands) visualCommand(`table:${id}`, label, `table:${id}`, () => {
    if (['row-before', 'row-after', 'delete-row', 'header'].includes(id)) return rowCommand(id);
    if (['left', 'center', 'right'].includes(id)) return alignColumn(id);
    if (id === 'delete-column') return (state, dispatch) => {
      const selected = state.selection.$from;
      let depth = selected.depth;
      while (depth > 0 && selected.node(depth).type.name !== 'table') depth--;
      return depth && selected.node(depth).firstChild?.childCount === 1 ? deleteTable(state, dispatch) : command(state, dispatch);
    };
    return command;
  });
  registerToolbar({ id: 'table', type: 'menu', items: ['table:insert', ...tableCommands.map(([id]) => `table:${id}`)] });
  if (options.documentBase) new URL(options.documentBase, instance.element.ownerDocument.baseURI);
}