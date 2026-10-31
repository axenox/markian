/** Source-neutral mention decorations and rule-local, cancellable host callbacks. */
import { Plugin, PluginKey, Decoration, DecorationSet, closeHistory, TextSelection } from './engines/prose';
import type { EditorView, ProseNode } from './engines/prose';
import type { Disposer, EditorOptions, MarkianInstance, TagContext, TagRule, TagSuggestion } from './types';
import { safeUrl } from './render/markdown';

export interface TagMatch { from: number; to: number; value: string; rule: TagRule; destination?: string; }

export function validateTags(rules: readonly TagRule[] = []): void {
  if (!Array.isArray(rules) || rules.length > 30) throw new TypeError('tags must be an array of at most 30 rules.');
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!rule || !/^[\w-]{1,60}$/.test(rule.id) || ids.has(rule.id) || typeof rule.prefix !== 'string' || !rule.prefix.length || rule.prefix.length > 8 || /[\s\\`<>]/.test(rule.prefix)) throw new TypeError('Tag rules require unique IDs and literal nonempty prefixes of up to 8 characters.');
    ids.add(rule.id);
    if (rule.priority !== undefined && (!Number.isInteger(rule.priority) || Math.abs(rule.priority) > 1000)) throw new TypeError('Tag priority must be an integer between -1000 and 1000.');
    if (rule.maxLength !== undefined && (!Number.isInteger(rule.maxLength) || rule.maxLength < 1 || rule.maxLength > 100)) throw new TypeError('Tag maxLength must be between 1 and 100.');
    if (rule.storage !== undefined && !['plain', 'link'].includes(rule.storage)) throw new TypeError('Tag storage must be plain or link.');
    if (rule.legacyLinks !== undefined && typeof rule.legacyLinks !== 'boolean') throw new TypeError('Tag legacyLinks must be a boolean.');
    if (rule.color !== undefined && !/^#[a-f0-9]{6}$/i.test(rule.color)) throw new TypeError('Tag colors must be hexadecimal #rrggbb.');
    for (const name of ['onSuggest', 'onHover', 'onClick'] as const) if (rule[name] !== undefined && typeof rule[name] !== 'function') throw new TypeError(`tags[].${name} must be a callback function.`);
  }
}

export function matchTags(text: string, rules: readonly TagRule[]): TagMatch[] {
  const ordered = [...rules].sort((first, second) => (second.priority ?? 0) - (first.priority ?? 0) || second.prefix.length - first.prefix.length);
  const excluded = Array.from(text.matchAll(/(?:https?:\/\/|www\.)\S+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu), match => ({ from: match.index, to: match.index + match[0].length }));
  const found: TagMatch[] = [];
  for (let offset = 0; offset < text.length; offset++) {
    if (offset && !/[\s([{,;!?]/.test(text[offset - 1]) || excluded.some(range => offset >= range.from && offset < range.to)) continue;
    const rule = ordered.find(candidate => text.startsWith(candidate.prefix, offset));
    if (!rule) continue;
    const start = offset + rule.prefix.length;
    const body = text.slice(start, start + (rule.maxLength ?? 64) + 1).match(/^[\p{L}\p{N}_-]*/u)![0];
    if (body.length > (rule.maxLength ?? 64)) continue;
    found.push({ from: offset, to: start + body.length, value: rule.prefix + body, rule });
    offset = start + body.length - 1;
  }
  return found;
}

function documentTags(doc: ProseNode, rules: readonly TagRule[]): TagMatch[] {
  const found: TagMatch[] = [];
  doc.descendants((node, position) => {
    if (!node.isTextblock || node.type.spec.code) return;
    let text = '';
    let start = position + 1;
    const flush = () => {
      found.push(...matchTags(text, rules).filter(match => match.value.length > match.rule.prefix.length).map(match => ({ ...match, from: start + match.from, to: start + match.to })));
      text = '';
    };
    node.forEach((child, offset) => {
      const link = child.marks.find(mark => mark.type.name === 'link');
      const excluded = child.marks.some(mark => mark.type.spec.code || mark.type.name.startsWith('html_'));
      if (!child.isText || excluded || link) {
        flush();
        if (child.isText && link && !excluded) {
          const rule = rules.find(candidate => candidate.legacyLinks && child.text!.startsWith(candidate.prefix));
          if (rule && child.text!.length <= (rule.maxLength ?? 64) + rule.prefix.length) found.push({ from: position + 1 + offset, to: position + 1 + offset + child.nodeSize, value: child.text!, destination: String(link.attrs.href), rule });
        }
      } else {
        if (!text) start = position + 1 + offset;
        text += child.text;
      }
    });
    flush();
    return false;
  });
  return found;
}

export function installMentions(instance: MarkianInstance, view: EditorView, options: EditorOptions, report: (error: unknown) => void, clicked: (match: TagMatch) => void): Disposer {
  const rules = options.tags ?? [];
  if (!rules.length) return () => {};
  const document = instance.element.ownerDocument;
  const key = new PluginKey('markian-tags');
  let disposed = false;
  let pending: AbortController | undefined;
  let detailsRequest: AbortController | undefined;
  let panel: HTMLElement | undefined;
  let details: HTMLElement | undefined;
  let focusedTag: TagMatch | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let signature = '';
  let active = 0;
  let buttons: HTMLButtonElement[] = [];
  const context = (match: TagMatch, signal: AbortSignal): TagContext => ({ instance, rule: match.rule, value: match.value, query: match.value.slice(match.rule.prefix.length), destination: match.destination, documentBase: options.documentBase, revision: instance.revision, signal });
  const position = (element: HTMLElement, from: number) => {
    const bounds = view.coordsAtPos(from);
    const viewport = document.defaultView!;
    element.style.position = 'fixed';
    element.style.left = `${Math.max(8, Math.min(bounds.left, viewport.innerWidth - Math.min(320, viewport.innerWidth - 16) - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, viewport.innerHeight - element.getBoundingClientRect().height - 8))}px`;
  };
  const close = () => {
    pending?.abort(); clearTimeout(timer); panel?.remove(); panel = undefined; buttons = [];
    view.dom.removeAttribute('aria-controls'); view.dom.removeAttribute('aria-activedescendant');
  };
  const closeDetails = () => { detailsRequest?.abort(); details?.remove(); details = undefined; };
  const fresh = (request: AbortController, revision: number) => !disposed && !request.signal.aborted && instance.revision === revision && instance.activeView === 'visual';
  const showDetails = async (match: TagMatch) => {
    closeDetails();
    if (!match.rule.onHover) return;
    const request = new AbortController();
    detailsRequest = request;
    const revision = instance.revision;
    const element = document.createElement('div');
    element.className = 'markian-popup markian-panel markian-tag-details';
    element.setAttribute('role', 'status');
    element.textContent = 'Loading details...';
    element.popover = 'manual';
    details = element; instance.element.append(element); element.showPopover(); position(element, match.from);
    try {
      const result = await match.rule.onHover(context(match, request.signal));
      if (!fresh(request, revision)) return;
      if (!result || typeof result.title !== 'string' || result.title.length > 500 || result.description !== undefined && (typeof result.description !== 'string' || result.description.length > 2000)) throw new TypeError('Tag details require a title and an optional bounded text description.');
      const title = document.createElement('strong'); title.textContent = result.title;
      const description = document.createElement('div'); description.textContent = result.description ?? '';
      element.replaceChildren(title, description); position(element, match.from);
    } catch (error) { if (fresh(request, revision)) { element.textContent = error instanceof Error ? error.message : String(error); report(error); } }
  };
  const selected = (): TagMatch | undefined => {
    if (instance.activeView !== 'visual' || instance.readOnly || !view.state.selection.empty || view.composing) return;
    const resolved = view.state.selection.$from;
    if (resolved.parent.type.spec.code || resolved.marks().some(mark => mark.type.name === 'link' || mark.type.spec.code || mark.type.name.startsWith('html_'))) return;
    const text = resolved.parent.textBetween(0, resolved.parentOffset, '\n', '\ufffc');
    const match = matchTags(text, rules).reverse().find(candidate => candidate.to === text.length);
    return match ? { ...match, from: resolved.start() + match.from, to: resolved.pos } : undefined;
  };
  const highlight = () => {
    buttons.forEach((button, index) => button.setAttribute('aria-selected', String(index === active)));
    if (buttons[active]) { view.dom.setAttribute('aria-activedescendant', buttons[active].id); buttons[active].scrollIntoView({ block: 'nearest' }); }
  };
  const lookup = async (match: TagMatch) => {
    const request = new AbortController(); pending = request;
    const revision = instance.revision;
    const element = document.createElement('div');
    element.className = 'markian-menu-items markian-suggestions markian-tag-suggestions';
    element.id = `markian-tags-${crypto.randomUUID()}`;
    element.setAttribute('role', 'listbox'); element.setAttribute('aria-label', `${match.rule.id} suggestions`);
    element.textContent = 'Searching...';
    element.popover = 'manual';
    panel = element; instance.element.append(element); element.showPopover(); position(element, match.from);
    view.dom.setAttribute('aria-controls', element.id);
    try {
      const results = await match.rule.onSuggest!(context(match, request.signal));
      if (!fresh(request, revision) || instance.readOnly) return;
      if (!Array.isArray(results) || results.length > 100) throw new TypeError('Tag suggestions must be an array of at most 100 results.');
      for (const result of results as readonly TagSuggestion[]) if (!result || typeof result.label !== 'string' || result.label.length > 500 || typeof result.value !== 'string' || !result.value.startsWith(match.rule.prefix) || result.value.length > match.rule.prefix.length + (match.rule.maxLength ?? 64) || /[\r\n]/.test(result.value) || result.destination !== undefined && (typeof result.destination !== 'string' || !safeUrl(result.destination)) || match.rule.storage === 'link' && !result.destination) throw new TypeError('Invalid tag suggestion or missing safe link destination.');
      element.replaceChildren(); buttons = []; active = 0;
      for (const [index, result] of results.entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = result.label;
        button.className = 'markian-button';
        button.id = `${element.id}-${index}`; button.setAttribute('role', 'option');
        button.addEventListener('pointerdown', event => event.preventDefault());
        button.addEventListener('click', () => {
          if (!fresh(request, revision) || instance.readOnly) return;
          const marks = match.rule.storage === 'link' ? [view.state.schema.marks.link.create({ href: result.destination })] : [];
          const transaction = closeHistory(view.state.tr.replaceWith(match.from, match.to, [view.state.schema.text(result.value, marks), view.state.schema.text(' ')]));
          transaction.setSelection(TextSelection.create(transaction.doc, match.from + result.value.length + 1)).setStoredMarks([]);
          close(); view.dispatch(transaction); view.focus();
          signature = `${match.rule.id}:${match.from}:${result.value}:${instance.revision}`;
        });
        buttons.push(button); element.append(button);
      }
      if (!results.length) element.textContent = 'No suggestions';
      highlight(); position(element, match.from);
    } catch (error) { if (fresh(request, revision)) { element.textContent = error instanceof Error ? error.message : String(error); report(error); } }
  };
  const update = () => {
    if (disposed) return;
    const match = selected();
    const next = match ? `${match.rule.id}:${match.from}:${match.value}:${instance.revision}` : '';
    if (next === signature) return;
    signature = next; close(); closeDetails();
    if (match?.rule.onSuggest) timer = setTimeout(() => { void lookup(match); }, 150);
  };
  const plugin = new Plugin({ key, props: {
    decorations(state) {
      return DecorationSet.create(state.doc, documentTags(state.doc, rules).map(match => Decoration.inline(match.from, match.to, {
        class: 'markian-tag', 'data-markian-tag': match.rule.id, 'data-tag-from': String(match.from), tabindex: '0', role: 'button', 'aria-label': `${match.rule.id}: ${match.value}`,
        ...(match.rule.color ? { style: `--markian-tag-color:${match.rule.color}` } : {}),
      })));
    },
    handleKeyDown(_view, event) {
      if (!panel) return false;
      if (event.key === 'Escape') { close(); return true; }
      if (buttons.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        if (event.key === 'Enter') buttons[active].click();
        else { active = (active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; highlight(); }
        return true;
      }
      return false;
    },
  }, view: () => ({ update: () => queueMicrotask(update), destroy: () => { close(); closeDetails(); } }) });
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, plugin] }));
  const eventMatch = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-markian-tag]') : null;
    return target && view.dom.contains(target) ? documentTags(view.state.doc, rules).find(match => match.from === Number(target.dataset.tagFrom) && match.rule.id === target.dataset.markianTag) : undefined;
  };
  const hover = (event: Event) => {
    const match = eventMatch(event);
    if (match) { if (event.type === 'focusin') focusedTag = match; void showDetails(match); }
  };
  const click = (event: Event) => {
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) { focusedTag = undefined; return; }
    const match = eventMatch(event) ?? (event instanceof KeyboardEvent ? focusedTag : undefined); if (!match) return;
    event.preventDefault(); event.stopPropagation(); clicked(match); void showDetails(match);
    if (match.rule.onClick) {
      const request = new AbortController();
      clickRequests.add(request);
      void Promise.resolve().then(() => { if (!disposed && !request.signal.aborted) return match.rule.onClick!(context(match, request.signal)); }).catch(error => { if (!disposed && !request.signal.aborted) report(error); }).finally(() => clickRequests.delete(request));
    }
  };
  const clickRequests = new Set<AbortController>();
  const keyboard = (event: KeyboardEvent) => {
    if (!panel && details && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetails(); focusedTag = undefined; return; }
    if (panel && ['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); focusedTag = undefined;
      if (event.key === 'Escape') close();
      else if (buttons.length) {
        if (event.key === 'Enter') buttons[active].click();
        else { active = (active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; highlight(); }
      }
    } else click(event);
  };
  const outside = (event: Event) => {
    focusedTag = undefined;
    if (!instance.element.contains(event.target as Node)) { signature = ''; close(); closeDetails(); }
  };
  view.dom.addEventListener('pointerover', hover); view.dom.addEventListener('focusin', hover);
  view.dom.addEventListener('click', click, true); view.dom.addEventListener('keydown', keyboard, true);
  document.addEventListener('pointerdown', outside);
  const observer = new MutationObserver(() => { focusedTag = undefined; signature = ''; close(); closeDetails(); clickRequests.forEach(request => request.abort()); update(); });
  observer.observe(instance.element, { attributes: true, attributeFilter: ['data-view', 'data-readonly'] });
  const unlisten = instance.on('change', () => { focusedTag = undefined; clickRequests.forEach(request => request.abort()); });
  return () => {
    disposed = true; close(); closeDetails(); observer.disconnect(); unlisten(); clickRequests.forEach(request => request.abort());
    view.dom.removeEventListener('pointerover', hover); view.dom.removeEventListener('focusin', hover);
    view.dom.removeEventListener('click', click, true); view.dom.removeEventListener('keydown', keyboard, true); document.removeEventListener('pointerdown', outside);
  };
}