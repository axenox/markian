import { Editor, rootCtx, defaultValueCtx, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand, turnIntoTextCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, createCodeBlockCommand } from '@milkdown/kit/preset/commonmark';
import { gfm, toggleStrikethroughCommand, insertTableCommand, addRowAfterCommand, addColAfterCommand } from '@milkdown/kit/preset/gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { callCommand, getMarkdown, replaceAll, $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection, NodeSelection } from '@milkdown/kit/prose/state';
import { closeHistory, undoDepth, redoDepth } from '@milkdown/kit/prose/history';
import { EditorState as SourceState } from '@codemirror/state';
import { EditorView as SourceView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history as sourceHistory, historyKeymap, indentWithTab, undoDepth as sourceUndoDepth, redoDepth as sourceRedoDepth } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { mdiFormatBold, mdiFormatItalic, mdiFormatStrikethrough, mdiCodeTags, mdiCodeBraces, mdiFormatListBulleted, mdiFormatListNumbered, mdiCheckboxMarkedOutline, mdiFormatQuoteClose, mdiLinkVariant, mdiTable, mdiUndo, mdiRedo, mdiFullscreen, mdiFullscreenExit, mdiWeatherNight, mdiWhiteBalanceSunny, mdiDownload, mdiClose, mdiChevronDown, mdiTableRowPlusAfter, mdiTableColumnPlusAfter, mdiFormatClear, mdiImageOutline, mdiArrowLeft } from '@mdi/js';
import { commentSyntax, commentBlock, commentInline, taskItemView, codeFenceInputRule, pairedCodeTyping, isSafeUrl } from './extensions.js';
import { sourceCommand, sourceContext, insertSourceLink } from './source-commands.js';
import { mermaidCodeView, createMermaidEditor } from './mermaid-view.js';
import example from './example.md?raw';
import '@milkdown/kit/prose/view/style/prosemirror.css';
import './style.css';

const element = id => document.getElementById(id);
const toolbar = element('toolbar');
const toolbarTools = document.createElement('div');
toolbarTools.className = 'toolbar-tools';
toolbar.append(toolbarTools);
const floating = element('floating-toolbar');
const linkDialog = element('link-dialog');
let editor;
let sourceView;
let sourceMode = false;
let sourceBaseline;
let sourceEntryValue;
let mermaidEditor;
let mermaidSession;
let changed = false;
let activeDialogSelection;
let toastTimer;
let imageDialog = false;

function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.append(shape);
  return svg;
}

function notify(message) {
  element('toast').textContent = message;
  element('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element('toast').hidden = true; }, 3500);
}

function currentView() {
  return editor.action(ctx => ctx.get(editorViewCtx));
}

function focusEditor() {
  (mermaidSession ? mermaidEditor : sourceMode ? sourceView : currentView()).focus();
}

function diagramDraft() {
  const view = currentView();
  const { position, node } = mermaidSession;
  const value = mermaidEditor.get();
  const replacement = node.type.create(node.attrs, value ? view.state.schema.text(value) : null, node.marks);
  return view.state.tr.replaceWith(position, position + node.nodeSize, replacement);
}

function documentMarkdown() {
  if (mermaidSession) return editor.action(ctx => ctx.get(serializerCtx)(diagramDraft().doc));
  return sourceMode ? sourceView.state.doc.toString() : editor.action(getMarkdown());
}

function openMermaid(position) {
  if (mermaidSession || sourceMode || typeof position !== 'number') return;
  const node = currentView().state.doc.nodeAt(position);
  if (!node || node.attrs.language?.toLowerCase() !== 'mermaid') return;
  mermaidSession = { position, node };
  toolbar.hidden = true;
  element('visual-mode').hidden = true;
  element('mermaid-mode').hidden = false;
  element('mermaid-toolbar').hidden = false;
  floating.hidden = true;
  if (!mermaidEditor) mermaidEditor = createMermaidEditor(element('mermaid-editor'), element('mermaid-preview'), () => {
    changed = true;
    updateDocument();
  });
  mermaidEditor.open(node.textContent);
  document.querySelector('.engine-label').textContent = 'Mermaid';
  element('mermaid-toolbar').scrollIntoView({ block: 'nearest' });
}

function closeMermaid(apply = true) {
  if (!mermaidSession) return;
  const view = currentView();
  const { position, node } = mermaidSession;
  if (apply && mermaidEditor.get() !== node.textContent) {
    view.dispatch(closeHistory(view.state.tr));
    view.dispatch(diagramDraft());
    view.dispatch(closeHistory(view.state.tr));
  }
  mermaidSession = undefined;
  mermaidEditor.close();
  element('mermaid-mode').hidden = true;
  element('mermaid-toolbar').hidden = true;
  element('visual-mode').hidden = false;
  toolbar.hidden = false;
  document.querySelector('.engine-label').textContent = 'Milkdown';
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)));
  updateDocument();
  view.focus();
}

function visualSource() {
  return editor.action(getMarkdown()).replace(/\r\n?/g, '\n');
}

function selectWord() {
  const view = currentView();
  const { selection } = view.state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return;
  const text = selection.$from.parent.textBetween(0, selection.$from.parent.content.size, '\n', '\ufffc');
  const offset = selection.$from.parentOffset;
  const characters = /[\p{L}\p{N}_'-]/u;
  if (!characters.test(text[offset] ?? '') && !characters.test(text[offset - 1] ?? '')) return;
  let from = offset;
  let to = offset;
  while (from > 0 && characters.test(text[from - 1])) from--;
  while (to < text.length && characters.test(text[to])) to++;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.$from.start() + from, selection.$from.start() + to)));
}

const commandMap = {
  bold: toggleStrongCommand, italic: toggleEmphasisCommand, strike: toggleStrikethroughCommand,
  inlineCode: toggleInlineCodeCommand, bullet: wrapInBulletListCommand,
  ordered: wrapInOrderedListCommand, quote: wrapInBlockquoteCommand,
  codeBlock: createCodeBlockCommand, table: insertTableCommand,
  row: addRowAfterCommand, column: addColAfterCommand,
  undo: undoCommand, redo: redoCommand,
};

function execute(name, payload) {
  if (mermaidSession) return;
  if (sourceMode) {
    sourceCommand(sourceView, name, payload);
    updateControls();
    return;
  }
  if (['bold', 'italic', 'strike', 'inlineCode'].includes(name)) selectWord();
  if (name === 'task') {
    const view = currentView();
    const doc = editor.action(ctx => ctx.get(parserCtx)('- [ ] New task'));
    view.dispatch(view.state.tr.replaceSelectionWith(doc.firstChild).scrollIntoView());
  } else if (name === 'clear') {
    const view = currentView();
    view.dispatch(view.state.tr.removeMark(view.state.selection.from, view.state.selection.to));
    editor.action(callCommand(turnIntoTextCommand.key));
  } else {
    editor.action(callCommand(commandMap[name].key, payload));
  }
  currentView().focus();
  updateControls();
}

function tool(name, label, path, action, parent = toolbarTools) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.dataset.command = name;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(icon(path));
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', action ?? (() => execute(name)));
  parent.append(button);
  return button;
}

function separator() {
  const divider = document.createElement('span');
  divider.className = 'toolbar-divider';
  divider.setAttribute('role', 'separator');
  toolbarTools.append(divider);
}

function buildToolbar() {
  tool('mermaid-back', 'Back', mdiArrowLeft, () => closeMermaid(), element('mermaid-toolbar'));
  tool('undo', 'Undo', mdiUndo);
  tool('redo', 'Redo', mdiRedo);
  separator();
  const heading = document.createElement('select');
  heading.id = 'block-type';
  heading.setAttribute('aria-label', 'Text style');
  for (const [value, label] of [['0', 'Normal text'], ...Array.from({ length: 6 }, (_, index) => [String(index + 1), `Heading ${index + 1}`])]) {
    heading.add(new Option(label, value));
  }
  heading.addEventListener('change', () => {
    if (sourceMode) {
      sourceCommand(sourceView, 'heading', Number(heading.value));
      return;
    }
    editor.action(callCommand(Number(heading.value) ? wrapInHeadingCommand.key : turnIntoTextCommand.key, Number(heading.value)));
    currentView().focus();
  });
  const selectWrapper = document.createElement('div');
  selectWrapper.className = 'select-wrapper';
  selectWrapper.append(heading, icon(mdiChevronDown));
  toolbarTools.append(selectWrapper);
  separator();
  for (const [name, label, path] of [
    ['bold', 'Bold', mdiFormatBold], ['italic', 'Italic', mdiFormatItalic],
    ['strike', 'Strikethrough', mdiFormatStrikethrough], ['inlineCode', 'Inline code', mdiCodeTags],
  ]) {
    tool(name, label, path);
    tool(name, label, path, undefined, floating);
  }
  separator();
  tool('bullet', 'Bulleted list', mdiFormatListBulleted);
  tool('ordered', 'Numbered list', mdiFormatListNumbered);
  tool('task', 'Insert task list', mdiCheckboxMarkedOutline);
  tool('quote', 'Blockquote', mdiFormatQuoteClose);
  separator();
  tool('link', 'Insert or edit link', mdiLinkVariant, () => openLink(false));
  tool('image', 'Insert image', mdiImageOutline, () => openLink(true));
  tool('codeBlock', 'Code block', mdiCodeBraces);
  tool('table', 'Insert table', mdiTable);
  tool('row', 'Add table row', mdiTableRowPlusAfter);
  tool('column', 'Add table column', mdiTableColumnPlusAfter);
  tool('clear', 'Clear formatting', mdiFormatClear);
  const actions = document.createElement('div');
  actions.className = 'toolbar-actions';
  toolbar.append(actions);
  tool('source', 'Markdown source', mdiCodeTags, openSource, actions).classList.add('source-button');
  tool('maximize', 'Maximize editor', mdiFullscreen, toggleMaximize, actions);
}

function updateControls() {
  if (!editor) return;
  if (mermaidSession) { floating.hidden = true; return; }
  if (sourceMode) {
    const context = sourceContext(sourceView);
    for (const button of document.querySelectorAll('button[data-command]')) {
      const name = button.dataset.command;
      if (['bold', 'italic', 'strike', 'inlineCode'].includes(name)) button.setAttribute('aria-pressed', String(context[name]));
      if (name === 'undo') button.disabled = sourceUndoDepth(sourceView.state) === 0;
      if (name === 'redo') button.disabled = sourceRedoDepth(sourceView.state) === 0;
      if (['row', 'column'].includes(name)) button.disabled = !context.table;
    }
    element('block-type').value = context.heading;
    updateOutlineLocation(element('source-outline'), sourceView.state.selection.main.head);
    floating.hidden = true;
    return;
  }
  const view = currentView();
  const { state } = view;
  const { from, to, $from, empty } = state.selection;
  const markNames = { bold: 'strong', italic: 'emphasis', strike: 'strike_through', inlineCode: 'inlineCode' };
  for (const button of document.querySelectorAll('button[data-command]')) {
    const name = button.dataset.command;
    if (markNames[name]) {
      const type = state.schema.marks[markNames[name]];
      const active = type && (empty ? (state.storedMarks ?? $from.marks()).some(mark => mark.type === type) : state.doc.rangeHasMark(from, to, type));
      button.setAttribute('aria-pressed', String(Boolean(active)));
    }
    if (name === 'undo') button.disabled = undoDepth(state) === 0;
    if (name === 'redo') button.disabled = redoDepth(state) === 0;
    if (['row', 'column'].includes(name)) {
      button.disabled = !Array.from({ length: $from.depth }, (_, index) => $from.node(index + 1)).some(node => node.type.name === 'table');
    }
  }
  element('block-type').value = $from.parent.type.name === 'heading' ? String($from.parent.attrs.level) : '0';
  updateOutlineLocation(element('outline'), from);
  positionFloating();
}

function positionFloating() {
  if (!editor || sourceMode || mermaidSession || !currentView().hasFocus() || currentView().state.selection.empty || document.querySelector('dialog[open]')) {
    floating.hidden = true;
    return;
  }
  const view = currentView();
  const start = view.coordsAtPos(view.state.selection.from);
  const end = view.coordsAtPos(view.state.selection.to);
  floating.hidden = false;
  const width = floating.offsetWidth;
  floating.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, (start.left + end.right - width) / 2))}px`;
  floating.style.top = `${Math.max(8, Math.min(innerHeight - 50, start.top - 49))}px`;
}

function updateOutlineLocation(navigation, position) {
  let current;
  for (const button of navigation.children) {
    button.removeAttribute('aria-current');
    if (Number(button.dataset.position) <= position) current = button;
  }
  current?.setAttribute('aria-current', 'location');
}

function renderOutline(navigation, headings, navigate) {
  navigation.replaceChildren();
  for (const heading of headings) {
    const button = document.createElement('button');
    button.textContent = heading.text;
    button.dataset.position = String(heading.position);
    button.className = `outline-link outline-level-${heading.level}`;
    if (heading.line) {
      const line = document.createElement('span');
      line.className = 'outline-line';
      line.textContent = String(heading.line);
      line.setAttribute('aria-hidden', 'true');
      button.title = `Line ${heading.line}`;
      button.append(line);
    }
    button.addEventListener('click', () => navigate(heading.position));
    navigation.append(button);
  }
}

function updateSourceOutline() {
  const state = sourceView.state;
  const headings = [];
  const tree = ensureSyntaxTree(state, state.doc.length, 100) ?? syntaxTree(state);
  tree.iterate({ enter(node) {
    if (!/^(?:ATXHeading[1-6]|SetextHeading[12])$/.test(node.name) || state.doc.lineAt(node.from).number === 1) return;
    const headingMark = node.node.getChild('HeaderMark');
    const firstLine = state.doc.lineAt(node.from);
    const from = node.name.startsWith('ATX') ? headingMark.to : node.from;
    headings.push({
      text: state.sliceDoc(from, firstLine.to).trim().replace(/\s+#+\s*$/, ''),
      level: Number(node.name.slice(-1)),
      position: node.from,
      line: firstLine.number,
    });
  } });
  renderOutline(element('source-outline'), headings, position => {
    sourceView.dispatch({ selection: { anchor: position } });
    sourceView.requestMeasure({
      read: view => view.lineBlockAt(position),
      write: (line, view) => {
        view.scrollDOM.scrollTop = line.top + view.documentPadding.top - (view.scrollDOM.clientHeight - line.height) / 2;
      },
    });
    sourceView.focus();
  });
  element('source-lines').textContent = `SOURCE / ${state.doc.lines} LINES`;
}

function updateVisualOutline() {
  const view = currentView();
  const headings = [];
  view.state.doc.descendants((node, position) => {
    if (node.type.name === 'heading' && position !== 0) headings.push({ text: node.textContent, level: node.attrs.level, position });
  });
  renderOutline(element('outline'), headings, position => {
    view.nodeDOM(position)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position + 1))));
    view.focus();
  });
}

function updateDocument() {
  const view = currentView();
  const doc = mermaidSession ? diagramDraft().doc : view.state.doc;
  const text = sourceMode ? sourceView.state.doc.toString() : doc.textBetween(0, doc.content.size, ' ');
  element('word-count').textContent = `${text.trim().split(/\s+/).filter(Boolean).length} words`;
  element('document-state').textContent = changed ? 'Edited in this session' : 'Example document';
  element('document-state').classList.toggle('is-edited', changed);
  if (sourceMode) updateSourceOutline();
  else updateVisualOutline();
  updateControls();
}

function sourceState(value) {
  return SourceState.create({
    doc: value,
    extensions: [lineNumbers(), highlightActiveLine(), sourceHistory(), markdown({ base: markdownLanguage }), syntaxHighlighting(defaultHighlightStyle), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]), SourceView.lineWrapping,
      SourceView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'false' }),
      SourceView.updateListener.of(update => {
        if (!sourceMode) return;
        if (update.docChanged) {
          changed = true;
          element('source-error').hidden = true;
          updateDocument();
        } else if (update.selectionSet) updateControls();
      }),
    ],
  });
}

function openSource() {
  element('source-error').hidden = true;
  if (sourceMode) {
    const value = sourceView.state.doc.toString();
    try {
      validateMarkdown(value);
      if (value !== sourceEntryValue) {
        currentView().dispatch(closeHistory(currentView().state.tr));
        editor.action(replaceAll(value));
        currentView().dispatch(closeHistory(currentView().state.tr));
      }
      sourceBaseline = visualSource();
    } catch (error) {
      element('source-error').textContent = error.message;
      element('source-error').hidden = false;
      return;
    }
    sourceMode = false;
  } else {
    const value = visualSource();
    if (!sourceView) sourceView = new SourceView({ state: sourceState(value), parent: element('source-editor') });
    else if (value !== sourceBaseline) sourceView.setState(sourceState(value));
    sourceBaseline = value;
    sourceEntryValue = sourceView.state.doc.toString();
    sourceMode = true;
  }
  element('visual-mode').hidden = sourceMode;
  element('source-mode').hidden = !sourceMode;
  const button = toolbar.querySelector('[data-command="source"]');
  button.setAttribute('aria-pressed', String(sourceMode));
  button.setAttribute('aria-label', sourceMode ? 'Visual editor' : 'Markdown source');
  button.title = button.getAttribute('aria-label');
  document.querySelector('.engine-label').textContent = sourceMode ? 'CodeMirror' : 'Milkdown';
  floating.hidden = true;
  if (sourceMode) sourceView.requestMeasure();
  updateDocument();
  focusEditor();
}

function validateMarkdown(value) {
  return editor.action(ctx => {
    const doc = ctx.get(parserCtx)(value);
    if (!doc) throw new Error('This document could not be imported.');
    doc.descendants(node => {
      if (node.type.name === 'image' && !isSafeUrl(node.attrs.src, true)) throw new Error('An image uses an unsupported URL.');
      for (const mark of node.marks) {
        if (mark.type.name === 'link' && !isSafeUrl(mark.attrs.href)) throw new Error('A link uses an unsupported URL.');
      }
    });
    const output = ctx.get(serializerCtx)(doc);
    const importedComments = value.match(/<!--[\s\S]*?-->/g) ?? [];
    if (importedComments.some(comment => !output.includes(comment))) throw new Error('A comment could not be preserved. No changes were applied.');
    return doc;
  });
}

function openLink(image) {
  imageDialog = image;
  const view = currentView();
  activeDialogSelection = sourceMode ? sourceView.state.selection.main : view.state.selection;
  const selected = sourceMode ? sourceView.state.sliceDoc(activeDialogSelection.from, activeDialogSelection.to)
    : view.state.doc.textBetween(activeDialogSelection.from, activeDialogSelection.to);
  const link = sourceMode ? null : activeDialogSelection.$from.marks().find(mark => mark.type.name === 'link');
  element('link-title').textContent = image ? 'Insert image' : 'Insert or edit link';
  element('link-text').value = selected || (image ? 'Image description' : 'Link text');
  element('link-url').value = image ? '' : link?.attrs.href ?? '';
  element('link-error').hidden = true;
  linkDialog.showModal();
  element('link-url').focus();
}

function closeLink() {
  linkDialog.close();
  focusEditor();
}

function toggleMaximize() {
  const frame = document.querySelector('.editor-frame');
  const maximized = frame.classList.toggle('is-maximized');
  document.body.classList.toggle('editor-maximized', maximized);
  const button = toolbar.querySelector('[data-command="maximize"]');
  button.replaceChildren(icon(maximized ? mdiFullscreenExit : mdiFullscreen));
  button.setAttribute('aria-label', maximized ? 'Restore editor' : 'Maximize editor');
  button.title = button.getAttribute('aria-label');
  button.setAttribute('aria-pressed', String(maximized));
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = element('theme-toggle');
  button.replaceChildren(icon(theme === 'dark' ? mdiWhiteBalanceSunny : mdiWeatherNight));
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  button.title = button.getAttribute('aria-label');
  window.dispatchEvent(new Event('markian-theme'));
  if (mermaidSession) mermaidEditor.refresh();
}

const controlsPlugin = $prose(() => new Plugin({
  view: () => ({ update: () => queueMicrotask(updateControls) }),
  props: {
    handleClick(view, position, event) {
      const anchor = event.target.closest('a');
      if (anchor) {
        event.preventDefault();
        if ((event.ctrlKey || event.metaKey) && isSafeUrl(anchor.getAttribute('href'))) window.open(anchor.href, '_blank', 'noopener,noreferrer');
        return true;
      }
      return false;
    },
  },
}));

async function start() {
  setTheme('light');
  buildToolbar();
  element('link-close').append(icon(mdiClose));
  element('download').append(icon(mdiDownload), document.createTextNode('Download .md'));
  editor = await Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, element('editor'));
      ctx.set(defaultValueCtx, example);
      ctx.get(listenerCtx).markdownUpdated(() => {
        changed = true;
        if (editor) updateDocument();
      });
    })
    .use(commonmark)
    .use(codeFenceInputRule)
    .use(pairedCodeTyping)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(clipboard)
    .use(commentSyntax)
    .use(commentBlock)
    .use(commentInline)
    .use(taskItemView)
    .use(mermaidCodeView(openMermaid))
    .use(controlsPlugin)
    .create();
  const view = currentView();
  view.dom.setAttribute('aria-label', 'Document content');
  view.dom.setAttribute('role', 'textbox');
  view.dom.setAttribute('aria-multiline', 'true');
  changed = false;
  updateDocument();
  window.Markian = {
    get: documentMarkdown,
    set: value => {
      validateMarkdown(value);
      closeMermaid(false);
      editor.action(replaceAll(value));
      if (sourceMode) sourceView.setState(sourceState(value));
      sourceBaseline = sourceMode ? visualSource() : undefined;
      sourceEntryValue = sourceMode ? sourceView.state.doc.toString() : undefined;
      changed = true;
      updateDocument();
    },
    focus: focusEditor,
    setTheme,
    execute,
  };
  element('theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  for (const id of ['link-close', 'link-cancel']) element(id).addEventListener('click', closeLink);
  element('link-form').addEventListener('submit', event => {
    event.preventDefault();
    const url = element('link-url').value.trim();
    const text = element('link-text').value;
    if (!isSafeUrl(url, imageDialog)) {
      element('link-error').textContent = 'Use a relative URL or a supported web address.';
      element('link-error').hidden = false;
      return;
    }
    if (sourceMode) {
      insertSourceLink(sourceView, activeDialogSelection, text, url, imageDialog);
      closeLink();
      return;
    }
    const current = currentView();
    let transaction = current.state.tr.setSelection(activeDialogSelection);
    if (imageDialog) {
      transaction = transaction.replaceSelectionWith(current.state.schema.nodes.image.create({ src: url, alt: text }));
    } else {
      const mark = current.state.schema.marks.link.create({ href: url });
      transaction = transaction.replaceSelectionWith(current.state.schema.text(text, [mark]), false);
    }
    current.dispatch(transaction.scrollIntoView());
    closeLink();
  });
  element('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([window.Markian.get()], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'workspace-launch.md';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Markdown downloaded');
  });
  element('reset').addEventListener('click', () => element('reset-dialog').showModal());
  element('reset-cancel').addEventListener('click', () => element('reset-dialog').close());
  element('reset-confirm').addEventListener('click', () => {
    closeMermaid(false);
    editor.action(replaceAll(example, true));
    if (sourceView) sourceView.setState(sourceState(visualSource()));
    sourceBaseline = visualSource();
    sourceEntryValue = sourceView?.state.doc.toString();
    changed = false;
    updateDocument();
    element('reset-dialog').close();
    notify('Example restored');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.is-maximized') && !document.querySelector('dialog[open]')) toggleMaximize();
  });
  document.addEventListener('selectionchange', positionFloating);
  document.addEventListener('scroll', positionFloating, true);
  window.addEventListener('resize', positionFloating);
  window.addEventListener('beforeunload', event => {
    if (changed) { event.preventDefault(); event.returnValue = ''; }
  });
}

start().catch(error => {
  console.error(error);
  element('document-state').textContent = `Could not open the editor: ${error.message}`;
  toolbar.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
});