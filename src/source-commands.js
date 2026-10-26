import { EditorSelection } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { undo, redo, isolateHistory } from '@codemirror/commands';

function ancestor(state, names) {
  for (let node = syntaxTree(state).resolveInner(state.selection.main.head, -1); node; node = node.parent) {
    if (names.includes(node.name)) return node;
  }
  return null;
}

export function sourceContext(view) {
  const state = view.state;
  const heading = ancestor(state, Array.from({ length: 6 }, (_, index) => `ATXHeading${index + 1}`));
  return {
    heading: heading ? heading.name.slice(-1) : '0',
    table: ancestor(state, ['Table']),
    bold: Boolean(ancestor(state, ['StrongEmphasis'])),
    italic: Boolean(ancestor(state, ['Emphasis'])),
    strike: Boolean(ancestor(state, ['Strikethrough'])),
    inlineCode: Boolean(ancestor(state, ['InlineCode'])),
  };
}

function replace(view, from, to, insert, selectionFrom = from, selectionTo = from + insert.length) {
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.single(selectionFrom, selectionTo),
    annotations: isolateHistory.of('full'),
    scrollIntoView: true,
    userEvent: 'input.toolbar',
  });
}

function wrapInline(view, marker) {
  const state = view.state;
  const selection = state.selection.main;
  const range = selection.empty ? state.wordAt(selection.head) ?? selection : selection;
  let { from, to } = range;
  const text = state.sliceDoc(from, to);
  if (state.sliceDoc(Math.max(0, from - marker.length), from) === marker && state.sliceDoc(to, to + marker.length) === marker) {
    replace(view, from - marker.length, to + marker.length, text);
  } else if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
    replace(view, from, to, text.slice(marker.length, -marker.length));
  } else {
    if (marker === '`') {
      const runs = text.match(/`+/g) ?? [];
      marker = '`'.repeat(Math.max(1, ...runs.map(run => run.length + 1)));
    }
    const padding = marker[0] === '`' && /^`|`$/.test(text) ? ' ' : '';
    const prefix = marker + padding;
    replace(view, from, to, prefix + text + padding + marker, from + prefix.length, from + prefix.length + text.length);
  }
}

function selectedLines(state) {
  const { from, to } = state.selection.main;
  const first = state.doc.lineAt(from).number;
  const last = state.doc.lineAt(to > from && state.doc.lineAt(to).from === to ? to - 1 : to).number;
  return Array.from({ length: last - first + 1 }, (_, index) => state.doc.line(first + index));
}

function prefixLines(view, name, level) {
  const lines = selectedLines(view.state);
  const pattern = name === 'heading' ? /^( {0,3})(?:#{1,6} +)?/
    : name === 'quote' ? /^(\s*)(?:> ?)?/
    : /^(\s*)(?:(?:[-+*]|\d+[.)]) +(?:\[[ xX]\] +)?)?/;
  const marker = index => name === 'heading' ? '#'.repeat(level) + (level ? ' ' : '')
    : name === 'quote' ? '> ' : name === 'ordered' ? `${index + 1}. ` : name === 'task' ? '- [ ] ' : '- ';
  const toggleOff = name !== 'heading' && lines.every(line => {
    const prefix = line.text.match(pattern)[0].trim();
    return name === 'quote' ? prefix === '>' : name === 'ordered' ? /^\d+[.)]$/.test(prefix)
      : name === 'task' ? /^[-+*] +\[[ xX]\]$/.test(prefix) : /^[-+*]$/.test(prefix);
  });
  const changes = lines.map((line, index) => {
    const match = line.text.match(pattern);
    return { from: line.from, to: line.from + match[0].length, insert: match[1] + (toggleOff ? '' : marker(index)) };
  });
  const changeSet = view.state.changes(changes);
  view.dispatch({ changes: changeSet, selection: view.state.selection.map(changeSet), annotations: isolateHistory.of('full'), userEvent: 'input.toolbar' });
}

function insertBlock(view, text) {
  const { from, to } = view.state.selection.main;
  const before = view.state.sliceDoc(0, from);
  const after = view.state.sliceDoc(to);
  const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  replace(view, from, to, prefix + text + suffix, from + prefix.length, from + prefix.length + text.length);
}

function tableCommand(view, name) {
  const table = sourceContext(view).table;
  if (!table) return false;
  const state = view.state;
  const header = table.getChild('TableHeader');
  const columns = header.getChildren('TableCell').length;
  if (name === 'row') {
    const line = state.doc.lineAt(state.selection.main.head);
    const row = `\n| ${Array.from({ length: columns }, () => ' ').join(' | ')} |`;
    const position = Math.max(line.to, state.doc.lineAt(header.to).to + 1);
    const target = state.doc.lineAt(Math.min(position, state.doc.length));
    replace(view, target.to, target.to, row, target.to + 3, target.to + 3);
  } else {
    const start = state.doc.lineAt(table.from).number;
    const end = state.doc.lineAt(table.to).number;
    const changes = Array.from({ length: end - start + 1 }, (_, index) => {
      const line = state.doc.line(start + index);
      return { from: line.to, insert: `${line.text.trimEnd().endsWith('|') ? '' : ' |'} ${index === 1 ? '---' : ' '} |` };
    });
    const changeSet = state.changes(changes);
    view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet), annotations: isolateHistory.of('full'), userEvent: 'input.toolbar' });
  }
  return true;
}

function clearFormatting(view) {
  const state = view.state;
  const { from, to } = state.selection.main;
  const changes = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['EmphasisMark', 'StrikethroughMark', 'CodeMark', 'HeaderMark', 'QuoteMark', 'ListMark'].includes(node.name)) return;
    if (node.node.parent.from > to || node.node.parent.to < from) return;
    let end = node.to;
    if (['HeaderMark', 'QuoteMark', 'ListMark'].includes(node.name) && state.sliceDoc(end, end + 1) === ' ') end++;
    changes.push({ from: node.from, to: end });
  } });
  if (!changes.length) return;
  const changeSet = state.changes(changes);
  view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet), annotations: isolateHistory.of('full'), userEvent: 'input.toolbar' });
}

export function sourceCommand(view, name, payload) {
  const markers = { bold: '**', italic: '*', strike: '~~', inlineCode: '`' };
  if (name === 'undo' || name === 'redo') (name === 'undo' ? undo : redo)(view);
  else if (markers[name]) wrapInline(view, markers[name]);
  else if (['heading', 'bullet', 'ordered', 'task', 'quote'].includes(name)) prefixLines(view, name, Number(payload ?? 0));
  else if (name === 'codeBlock') {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const fence = '`'.repeat(Math.max(3, ...(selected.match(/`+/g) ?? []).map(run => run.length + 1)));
    insertBlock(view, `${fence}\n${selected}\n${fence}`);
    const range = view.state.selection.main;
    view.dispatch({ selection: EditorSelection.single(range.from + fence.length + 1, range.to - fence.length - 1) });
  } else if (name === 'table') insertBlock(view, '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |');
  else if (['row', 'column'].includes(name)) tableCommand(view, name);
  else if (name === 'clear') clearFormatting(view);
  view.focus();
}

export function insertSourceLink(view, selection, text, url, image) {
  const label = text.replace(/([\\\[\]])/g, '\\$1');
  const destination = url.replace(/</g, '%3C').replace(/>/g, '%3E');
  replace(view, selection.from, selection.to, `${image ? '!' : ''}[${label}](<${destination}>)`);
  view.focus();
}