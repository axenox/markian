import type { EditorOptions, MarkianInstance, Disposer, DestinationSuggestion, ProviderContext } from '../types';
import type { EditorView } from '../engines/prose';
import { closeHistory, TextSelection } from '../engines/prose';
import type { SourceEditor } from '../engines/source';
import { safeUrl } from '../render/markdown';
import { commandButton } from './controls';

function field(document: Document, parent: HTMLElement, label: string, type = 'text'): HTMLInputElement {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.setAttribute('aria-label', label);
  wrapper.append(input);
  parent.append(wrapper);
  return input;
}

export function searchPanel(instance: MarkianInstance, close: () => void, initial = { query: '', caseSensitive: false, wholeWord: false }): HTMLElement {
  const document = instance.element.ownerDocument;
  const panel = document.createElement('div');
  panel.className = 'markian-panel markian-search';
  panel.setAttribute('role', 'search');
  const query = field(document, panel, 'Find');
  const replacement = field(document, panel, 'Replace');
  const sensitive = field(document, panel, 'Match case', 'checkbox');
  const whole = field(document, panel, 'Whole word', 'checkbox');
  query.value = initial.query;
  sensitive.checked = initial.caseSensitive;
  whole.checked = initial.wholeWord;
  const count = document.createElement('output');
  count.setAttribute('aria-live', 'polite');
  let index = 0;
  const find = (move = 0) => {
    const matches = instance.search({ query: query.value, caseSensitive: sensitive.checked, wholeWord: whole.checked });
    index = matches.length ? (index + move + matches.length) % matches.length : 0;
    instance.selectSearch(index);
    count.textContent = `${matches.length ? index + 1 : 0} / ${matches.length}`;
  };
  for (const input of [query, sensitive, whole]) input.addEventListener('input', () => { index = 0; find(); });
  const replace = commandButton(document, 'Replace match', 'replace', () => { instance.replaceSearch(replacement.value); find(); });
  const replaceAll = commandButton(document, 'Replace all', 'replaceAll', () => { instance.replaceSearch(replacement.value, true); find(); });
  const permissions = () => {
    const supported = !instance.readOnly && !['help', 'preview'].includes(instance.activeView);
    replacement.parentElement!.hidden = !supported;
    replace.hidden = replaceAll.hidden = !supported;
  };
  permissions();
  const observer = new MutationObserver(permissions);
  observer.observe(instance.element, { attributes: true, attributeFilter: ['data-readonly', 'data-view'] });
  const actions = document.createElement('div');
  actions.className = 'markian-panel-actions';
  actions.append(count, commandButton(document, 'Previous match', 'up', () => find(-1)), commandButton(document, 'Next match', 'down', () => find(1)), replace, replaceAll,
    commandButton(document, 'Close search', 'close', close));
  panel.append(actions);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); find(event.shiftKey ? -1 : 1); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  });
  const unlisten = instance.on('change', () => {
    if (!panel.isConnected) return;
    const matches = instance.search({ query: query.value, caseSensitive: sensitive.checked, wholeWord: whole.checked });
    count.textContent = `${matches.length ? Math.min(index + 1, matches.length) : 0} / ${matches.length}`;
  });
  const removal = new MutationObserver(() => { if (!panel.isConnected) { observer.disconnect(); removal.disconnect(); unlisten(); } });
  removal.observe(instance.element, { childList: true });
  queueMicrotask(() => query.focus());
  count.textContent = '0 / 0';
  return panel;
}

export function destinationPanel(instance: MarkianInstance, options: EditorOptions, image: boolean, visual: EditorView, raw: SourceEditor | undefined, close: () => void): { element: HTMLElement; dispose: Disposer } {
  const document = instance.element.ownerDocument;
  const panel = document.createElement('form');
  panel.className = 'markian-panel markian-destination';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', image ? 'Image' : 'Link');
  const destination = field(document, panel, image ? 'Image destination' : 'Link destination');
  const label = field(document, panel, image ? 'Alternative text' : 'Link text');
  const headingLabel = document.createElement('label');
  headingLabel.textContent = 'Target heading';
  const heading = document.createElement('select');
  heading.setAttribute('aria-label', 'Target heading');
  headingLabel.append(heading);
  headingLabel.hidden = image;
  panel.append(headingLabel);
  const suggestions = document.createElement('div');
  suggestions.className = 'markian-suggestions';
  const status = document.createElement('output');
  status.setAttribute('aria-live', 'polite');
  panel.append(status, suggestions);
  const revision = instance.revision;
  const viewId = instance.activeView;
  const selected = raw ? raw.view.state.selection.main : visual.state.selection;
  let from = selected.from;
  let to = selected.to;
  const link = !raw && selected.from === selected.to ? visual.state.selection.$from.marks().find(mark => mark.type.name === 'link') : undefined;
  if (link) {
    const parent = visual.state.selection.$from;
    parent.parent.forEach((node, offset) => {
      if (link.isInSet(node.marks)) { from = Math.min(from, parent.start() + offset); to = Math.max(to, parent.start() + offset + node.nodeSize); }
    });
    destination.value = String(link.attrs.href);
  }
  label.value = raw ? raw.view.state.sliceDoc(from, to) : visual.state.doc.textBetween(from, to);
  let pending: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const current = () => !disposed && instance.revision === revision && instance.activeView === viewId && !instance.readOnly;
  const context = (signal: AbortSignal): ProviderContext => ({ instance, query: destination.value, documentBase: options.documentBase, revision, signal });
  const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : String(error); };
  const lookup = async () => {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    suggestions.replaceChildren();
    heading.replaceChildren(new Option('None', ''));
    const provider = image ? options.onImageSuggest : options.onLinkSuggest;
    if (!provider && (image || !options.onLinkInspect)) return;
    status.textContent = 'Loading';
    try {
      const results = provider ? await provider(context(request.signal)) : [];
      if (request.signal.aborted || !current()) return;
      if (!Array.isArray(results) || results.length > 100) throw new TypeError('Suggestions must be an array of at most 100 destinations.');
      for (const result of results as readonly DestinationSuggestion[]) {
        if (typeof result.label !== 'string' || typeof result.destination !== 'string' || !safeUrl(result.destination, image)) throw new TypeError('Invalid destination suggestion.');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = result.label;
        button.addEventListener('click', () => { destination.value = result.destination; void inspect(request); });
        suggestions.append(button);
      }
      status.textContent = provider ? (results.length ? `${results.length} suggestions` : 'No suggestions') : '';
      await inspect(request);
    } catch (error) { if (!request.signal.aborted && current()) showError(error); }
  };
  const inspect = async (request: AbortController) => {
    if (image || !options.onLinkInspect) return;
    try {
      const result = await options.onLinkInspect({ ...context(request.signal), destination: destination.value });
      if (request.signal.aborted || !current()) return;
      if (!result || !['exists', 'missing', 'unknown'].includes(result.status) || (result.headings && (!Array.isArray(result.headings) || result.headings.length > 500))) throw new TypeError('Invalid link inspection result.');
      heading.replaceChildren(new Option('None', ''));
      for (const item of result.headings ?? []) {
        if (typeof item.id !== 'string' || typeof item.label !== 'string') throw new TypeError('Invalid target heading.');
        heading.append(new Option(item.label, item.id));
      }
      status.textContent = result.status;
    } catch (error) { if (!request.signal.aborted && current()) showError(error); }
  };
  destination.addEventListener('input', () => { pending?.abort(); clearTimeout(timer); timer = setTimeout(() => { void lookup(); }, 180); });
  const apply = document.createElement('button');
  apply.type = 'submit';
  apply.textContent = image ? 'Insert image' : 'Apply link';
  const actions = document.createElement('div');
  actions.className = 'markian-panel-actions';
  actions.append(apply, commandButton(document, 'Close', 'close', close));
  panel.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (!current()) throw new Error('Document or permissions changed; reopen this dialog.');
      let url = destination.value;
      if (heading.value) url = url.split('#')[0] + '#' + encodeURIComponent(heading.value);
      if (!url || !safeUrl(url, image)) throw new Error('Choose a safe destination.');
      if (raw) {
        const text = label.value.replace(/[\\\[\]]/g, '\\$&');
        const escaped = url.replace(/[<>\s]/g, character => encodeURIComponent(character));
        raw.view.dispatch({ changes: { from, to, insert: `${image ? '!' : ''}[${text}](<${escaped}>)` } });
      } else if (image) visual.dispatch(closeHistory(visual.state.tr.replaceRangeWith(from, to, visual.state.schema.nodes.image.create({ src: url, alt: label.value }))));
      else {
        const text = label.value || url;
        const transaction = closeHistory(visual.state.tr.replaceWith(from, to, visual.state.schema.text(text, [visual.state.schema.marks.link.create({ href: url })])));
        visual.dispatch(transaction.setSelection(TextSelection.near(transaction.doc.resolve(from + text.length))));
      }
      close();
    } catch (error) { showError(error); }
  });
  if (image) {
    const file = field(document, panel, 'Image file', 'file');
    file.accept = 'image/png,image/jpeg,image/gif,image/webp';
    file.addEventListener('change', () => { const blob = file.files?.[0]; if (blob) { close(); void instance.insertImage(blob).catch(() => {}); } });
  }
  panel.append(actions);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll<HTMLElement>('input, select, button')].filter(element => !element.closest('[hidden]'));
      const next = controls.indexOf(document.activeElement as HTMLElement) + (event.shiftKey ? -1 : 1);
      if (next < 0 || next >= controls.length) { event.preventDefault(); controls[(next + controls.length) % controls.length]?.focus(); }
    }
  });
  const unsubscribe = instance.on('change', () => { pending?.abort(); apply.disabled = true; status.textContent = 'Document changed; reopen this dialog.'; });
  const permissions = new MutationObserver(() => { if (!current()) { pending?.abort(); apply.disabled = true; } });
  permissions.observe(instance.element, { attributes: true, attributeFilter: ['data-readonly', 'data-view'] });
  queueMicrotask(() => destination.focus());
  return { element: panel, dispose: () => { disposed = true; pending?.abort(); clearTimeout(timer); unsubscribe(); permissions.disconnect(); } };
}