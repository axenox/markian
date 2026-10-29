import { Items } from './registry';
import { createVisual, type VisualEngine } from './engines/visual';
import { SourceEditor } from './engines/source';
import { redo, undo, closeHistory, toggleMark, setBlockType, TextSelection } from './engines/prose';
import { parseMarkdown, renderMarkdown, validateMarkdown, safeUrl, headings } from './render/markdown';
import { findMatches } from './search';
import { commandButton } from './ui/controls';
import { defaultToolbar, ToolbarItems, validateToolbar } from './ui/toolbar';
import { searchPanel, destinationPanel } from './ui/panels';
import { installEditing } from './editing';
import { StaticSearch } from './ui/static-search';
import { loadStylesheets, markdownClasses, stylesheetUrls } from './styles';
import type { BlockSession, BlockTarget, CommandDefinition, Disposer, EditorEvent, EditorOptions, EventName, ExtensionFactory, MarkianInstance, Mode, RendererDefinition, SetOptions, SourceHandle, StructuralNode, Theme, ToolbarEntry, ToolbarItem, ViewDefinition, SearchOptions, SearchMatch } from './types';

interface Frame {
  id: string;
  element: HTMLElement;
  dispose: Disposer;
  session?: BlockSession;
  search?: StaticSearch;
  baseline?: string;
}

function fence(value: string, language: string): string {
  const longest = Math.max(2, ...Array.from(value.matchAll(/`+/g), match => match[0].length));
  const marker = '`'.repeat(longest + 1);
  return `${marker}${language}\n${value}\n${marker}`;
}

export class EditorInstance implements MarkianInstance {
  readonly element: HTMLElement;
  readonly ready: Promise<void>;
  revision = 0;
  private lifetime = new AbortController();
  private initialized = false;
  private structuresClosed = false;
  private destroyed = false;
  private fullscreenEntry?: AbortController;
  private fullscreenRestore?: Disposer;
  private source: string;
  private mode: Mode = 'visual';
  private locked = false;
  private disabled = false;
  private originalHidden: boolean;
  private visual?: VisualEngine;
  private raw?: SourceEditor;
  private rawBaseline?: string;
  private visualElement: HTMLElement;
  private rawElement: HTMLElement;
  private work: HTMLElement;
  private toolbar: HTMLElement;
  private toolbarWidth = 0;
  private status: HTMLElement;
  private diagnostic: HTMLElement;
  private floating: HTMLElement;
  private outline: HTMLElement;
  private searchElement?: HTMLElement;
  private destination?: { element: HTMLElement; dispose: Disposer };
  private queries = new Map<string, SearchOptions>();
  private outlineRevision = -1;
  private outlineTargets: { button: HTMLButtonElement; headingIndex: number; line: number }[] = [];
  private frames: Frame[] = [];
  private sources = new Set<SourceHandle>();
  private sourceElements = new Map<SourceHandle, HTMLElement>();
  private searchOptions: SearchOptions = { query: '' };
  private searchMatches: readonly SearchMatch[] = [];
  private searchIndex = 0;
  private pendingImages = new Map<Promise<void>, number>();
  private imageControllers = new Set<AbortController>();
  private imageFailure?: unknown;
  private imageRetry?: HTMLElement;
  private listeners = new Map<EventName, Set<(event: EditorEvent) => void>>();
  private cleanups: Disposer[] = [];
  private cssUrls: readonly string[];
  private lastValue: string;
  private commands = new Items<CommandDefinition>(() => this.refreshToolbar(), () => this.alive());
  private toolbarItems = new ToolbarItems(() => this.options.toolbar ?? defaultToolbar, () => this.refreshToolbar(), () => this.alive());
  private views = new Items<ViewDefinition>(() => {}, () => this.alive());
  private renderers = new Items<RendererDefinition>(() => {}, () => this.alive());
  private structures = new Items<StructuralNode>(() => {}, () => {
    this.alive();
    if (this.structuresClosed) throw new Error('Structural registration is closed after engine construction.');
  });

  constructor(private host: HTMLElement, private options: EditorOptions, private factories: ReadonlyMap<string, ExtensionFactory>) {
    validateMarkdown(options.markdown);
    options = { ...options, markdownCssClasses: markdownClasses(options.markdownCssClasses) };
    this.options = options;
    this.cssUrls = stylesheetUrls(options, host.ownerDocument);
    for (const [name, callback] of Object.entries(options)) if (name.startsWith('on') && callback !== undefined && typeof callback !== 'function') throw new TypeError(`${name} must be a callback function.`);
    for (const name of ['readOnly', 'disabled', 'softbreaks', 'allowTextColors', 'sidebarVisible'] as const) if (options[name] !== undefined && typeof options[name] !== 'boolean') throw new TypeError(`${name} must be a boolean.`);
    if (options.toolbar !== undefined) validateToolbar(options.toolbar);
    if (options.floatingToolbar !== undefined && (!Array.isArray(options.floatingToolbar) || options.floatingToolbar.some(id => typeof id !== 'string'))) throw new TypeError('floatingToolbar must be an array of command IDs.');
    if (options.textColors && (!Array.isArray(options.textColors) || options.textColors.length < 5 || options.textColors.length > 10 || options.textColors.some(color => typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) || new Set(options.textColors.map(color => color.toLowerCase())).size !== options.textColors.length)) throw new TypeError('Text colors require 5-10 unique hexadecimal #rrggbb swatches.');
    if (options.toolbarPlacement && !['top', 'bottom'].includes(options.toolbarPlacement)) throw new TypeError('Unknown toolbar placement.');
    if (options.documentBase) new URL(options.documentBase, host.ownerDocument.baseURI);
    if (host.tagName !== 'DIV' && host.tagName !== 'TEXTAREA') throw new TypeError('Mount Markian on a div or textarea.');
    if (options.initialMode && !['visual', 'raw'].includes(options.initialMode)) throw new TypeError('Unknown initial mode.');
    this.source = this.lastValue = options.markdown;
    this.locked = options.readOnly ?? false;
    this.disabled = options.disabled ?? false;
    this.originalHidden = host.hidden;
    const document = host.ownerDocument;
    this.element = document.createElement('section');
    this.element.className = 'markian';
    this.element.classList.toggle('markian-outline-open', options.sidebarVisible ?? true);
    this.element.setAttribute('aria-label', options.label ?? 'Markdown editor');
    this.element.dataset.markian = '';
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'markian-toolbar';
    this.toolbar.setAttribute('role', 'toolbar');
    this.toolbar.setAttribute('aria-label', 'Editor commands');
    this.work = document.createElement('div');
    this.work.className = 'markian-work';
    this.visualElement = document.createElement('div');
    this.visualElement.className = 'markian-visual';
    this.rawElement = document.createElement('div');
    this.rawElement.className = 'markian-source';
    this.work.append(this.visualElement, this.rawElement);
    this.floating = document.createElement('div');
    this.floating.className = 'markian-floating';
    this.floating.setAttribute('role', 'toolbar');
    this.floating.setAttribute('aria-label', 'Selection commands');
    this.floating.hidden = true;
    this.outline = document.createElement('nav');
    this.outline.className = 'markian-outline';
    this.outline.setAttribute('aria-label', 'Document outline');
    this.work.append(this.outline);
    this.diagnostic = document.createElement('div');
    this.diagnostic.className = 'markian-diagnostic';
    this.diagnostic.setAttribute('role', 'alert');
    this.diagnostic.hidden = true;
    this.status = document.createElement('div');
    this.status.className = 'markian-status';
    this.element.append(this.toolbar, this.floating, this.diagnostic, this.work, this.status);
    this.element.dataset.toolbarPlacement = options.toolbarPlacement ?? 'top';
    host.after(this.element);
    host.hidden = true;
    this.setTheme(options.theme ?? 'light');
    this.installCommands();
    this.listen(this.element, 'focusin', () => this.emit('focus', 'user'));
    this.listen(this.element, 'focusout', event => {
      if (!this.element.contains((event as FocusEvent).relatedTarget as Node | null)) this.emit('blur', 'user');
    });
    this.listen(this.host.ownerDocument, 'pointerdown', event => {
      const target = event.target as Node | null;
      for (const menu of this.toolbar.querySelectorAll<HTMLDetailsElement>('details[open]')) if (!menu.contains(target)) this.setMenuOpen(menu, false);
      if (this.searchElement && !this.searchElement.contains(target)) this.closeSearch(false);
      if (this.destination && !this.destination.element.contains(target)) this.closeDestination(false);
    });
    this.listen(this.element, 'keydown', event => {
      const keyboard = event as KeyboardEvent;
      if ((keyboard.ctrlKey || keyboard.metaKey) && keyboard.key.toLowerCase() === 's') {
        keyboard.preventDefault();
        this.emit('save-request', 'user');
      }
      if ((keyboard.ctrlKey || keyboard.metaKey) && ['f', 'h'].includes(keyboard.key.toLowerCase())) {
        keyboard.preventDefault();
        this.openSearch();
      }
      if (keyboard.key === 'Escape' && this.searchElement) { this.closeSearch(); return; }
      if (keyboard.key === 'Escape' && this.destination) { this.closeDestination(); return; }
      if (keyboard.key === 'Escape') this.exitFullscreen();
    });
    this.listen(this.toolbar, 'keydown', event => {
      const keyboard = event as KeyboardEvent;
      const target = keyboard.target as HTMLElement;
      const focusedMenu = target.closest('details');
      const menu = target.matches('summary') && focusedMenu && !focusedMenu.open && keyboard.key !== 'ArrowRight'
        ? focusedMenu.parentElement?.closest('details') ?? focusedMenu
        : focusedMenu;
      if (keyboard.key === 'Escape' && menu) {
        keyboard.preventDefault();
        keyboard.stopPropagation();
        this.setMenuOpen(menu, false);
        menu.querySelector<HTMLElement>(':scope > summary')?.focus();
      } else if (keyboard.key === 'ArrowRight' && target.matches('summary') && target.closest('.markian-menu-items') && menu) {
        keyboard.preventDefault();
        this.setMenuOpen(menu, true);
        this.menuControls(menu)[1]?.focus();
      } else if (keyboard.key === 'ArrowLeft' && menu?.parentElement?.closest('details')) {
        keyboard.preventDefault();
        this.setMenuOpen(menu, false);
        menu.querySelector<HTMLElement>(':scope > summary')?.focus();
      } else if (['ArrowDown', 'ArrowUp'].includes(keyboard.key) && menu) {
        keyboard.preventDefault();
        this.setMenuOpen(menu, true);
        const controls = this.menuControls(menu);
        const index = controls.indexOf(target);
        controls[(index + (keyboard.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus();
      } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboard.key)) {
        keyboard.preventDefault();
        const scope = menu && ['Home', 'End'].includes(keyboard.key) ? menu : this.toolbar;
        const controls = scope === menu ? this.menuControls(menu!) : [...this.toolbar.querySelectorAll<HTMLElement>(':scope > button:not(:disabled), :scope > details > summary')].filter(control => control.getClientRects().length);
        const index = controls.indexOf(target);
        const next = keyboard.key === 'Home' ? 0 : keyboard.key === 'End' ? controls.length - 1 : (index + (keyboard.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
        controls[next]?.focus();
      }
    });
    this.listen(this.toolbar, 'click', event => {
      if (!(event.target as Element).closest('button')) return;
      for (const menu of this.toolbar.querySelectorAll<HTMLDetailsElement>('details[open]')) this.setMenuOpen(menu, false);
      this.positionPanels();
    });
    this.listen(this.visualElement, 'contextmenu', event => {
      if (!(event.target as Element).closest('td,th') || this.readOnly) return;
      event.preventDefault();
      this.refreshFloating(true);
    });
    for (const eventName of ['paste', 'drop']) this.listen(this.element, eventName, event => {
      const transfer = event instanceof ClipboardEvent ? event.clipboardData : (event as DragEvent).dataTransfer;
      const files = [...(transfer?.files ?? [])].filter(file => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.readOnly) return;
      if (files.length > 1) { this.report(new Error('Insert one image at a time.')); return; }
      void this.insertImage(files[0]).catch(() => {});
    });
    this.listen(this.element, 'click', event => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!anchor || !this.element.contains(anchor)) return;
      event.preventDefault();
      const mouse = event as MouseEvent;
      if (!this.readOnly && !mouse.ctrlKey && !mouse.metaKey && this.activeView === 'visual') return;
      const destination = anchor.getAttribute('href') ?? '';
      if (!safeUrl(destination)) return;
      if (this.options.onLinkOpen) {
        void Promise.resolve(this.options.onLinkOpen({ instance: this, destination, query: '', revision: this.revision, documentBase: this.options.documentBase, signal: this.lifetime.signal })).catch(error => this.report(error));
      } else {
        const resolved = new URL(destination, this.options.documentBase ? new URL(this.options.documentBase, document.baseURI) : document.baseURI);
        document.defaultView?.open(resolved.href, '_blank', 'noopener,noreferrer');
      }
    });
    const resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      if (this.element.clientWidth !== this.toolbarWidth) this.refreshToolbar();
      this.positionPanels();
    });
    resizeObserver.observe(this.element);
    this.cleanups.push(() => resizeObserver.disconnect());
    const positionPanels = () => this.positionPanels();
    document.addEventListener('scroll', positionPanels, true);
    this.cleanups.push(() => document.removeEventListener('scroll', positionPanels, true));
    this.listen(document.defaultView, 'resize', positionPanels);
    const scroll = () => this.updateCurrentSection();
    this.work.addEventListener('scroll', scroll, true);
    this.cleanups.push(() => this.work.removeEventListener('scroll', scroll, true));
    if (host.tagName === 'TEXTAREA') {
      const textarea = host as HTMLTextAreaElement;
      this.listen(textarea.form, 'reset', event => queueMicrotask(() => {
        if (!event.defaultPrevented && !this.destroyed && this.initialized) {
          this.set(textarea.defaultValue, { origin: 'form-reset', resetHistory: true, pending: 'discard' });
        }
      }));
      this.listen(textarea.form, 'submit', event => {
        if ([...this.pendingImages.values()].includes(this.revision) || this.imageFailure) {
          event.preventDefault();
          this.report(new Error('Finish, retry, or remove pending images before submitting.'));
        }
      });
    }
    this.ready = this.initialize().catch(error => {
      this.report(error);
      this.destroy();
      throw error;
    });
    this.refreshToolbar();
    this.show();
  }

  get activeView(): string { return this.frames.at(-1)?.id ?? this.mode; }
  get readOnly(): boolean { return this.locked || this.disabled; }
  getCommands() { return this.commands; }
  getToolbar() { return this.toolbarItems; }
  getViews() { return this.views; }
  getRenderers() { return this.renderers; }
  getSchema() { return this.structures; }
  private help = new Items<{ id: string; markdown: string }>(() => {}, () => this.alive());
  getHelp() { return this.help; }

  insertCodeBlock(value: string, language: string): void {
    this.usable();
    validateMarkdown(value);
    if (!/^[\w+-]{1,40}$/.test(language)) throw new TypeError('Invalid code-block language.');
    if (this.readOnly || this.activeView !== 'visual') throw new Error('Code insertion requires an editable visual view.');
    const view = this.visual!.view;
    view.dispatch(closeHistory(view.state.tr.replaceSelectionWith(view.state.schema.nodes.code_block.create({ language }, value ? view.state.schema.text(value) : undefined)).scrollIntoView()));
  }

  private alive(): void { if (this.destroyed) throw new Error('Markian instance has been destroyed.'); }
  private usable(): void { this.alive(); if (!this.initialized) throw new Error('Await editor.ready before using this operation.'); }

  private async initialize(): Promise<void> {
    await loadStylesheets(this.element, this.cssUrls, this.lifetime.signal, dispose => this.cleanups.push(dispose));
    this.alive();
    for (const [id, entry] of Object.entries(this.options.extensions ?? {})) {
      if (!entry || entry.enabled !== true) continue;
      const factory = this.factories.get(id);
      if (!factory) throw new Error(`Unknown enabled extension: ${id}`);
      const extension = factory();
      const dispose = await extension.init(this, entry.config, this.lifetime.signal);
      if (typeof dispose !== 'function') throw new TypeError(`Extension ${id} must return a disposer.`);
      if (this.destroyed) { dispose(); throw new Error('Editor destroyed during initialization.'); }
      this.cleanups.push(dispose);
    }
    this.structuresClosed = true;
    const checkToolbar = (entries: readonly ToolbarEntry[], path: readonly string[] = []) => {
      for (const entry of entries) {
        const item = typeof entry === 'string' ? this.toolbarItems.items().find(item => item.id === entry) ?? { id: entry, command: entry } : entry;
        if (path.includes(item.id)) throw new Error(`Recursive toolbar menu: ${item.id}`);
        if (item.command && !this.commands.items().some(command => command.id === item.command)) throw new Error(`Unknown toolbar command: ${item.command}`);
        if (item.items) checkToolbar(item.items, [...path, item.id]);
      }
    };
    checkToolbar(this.toolbarItems.layout());
    for (const id of this.options.floatingToolbar ?? []) if (!this.commands.items().some(item => item.id === id)) throw new Error(`Unknown floating command: ${id}`);
    const visual = await createVisual(this.visualElement, this.structures.items(), () => this.readOnly, value => {
      this.source = value;
      this.changed('user');
    }, () => { if (this.initialized) { this.refreshToolbar(); this.refreshFloating(); } }, this.options.documentBase, this.options.allowTextColors,
    (code, language, element, position, topLevel) => {
      const renderer = this.renderers.items().find(item => item.visual === true && item.language === language);
      if (!renderer) return undefined;
      return renderer.render(code, element, topLevel ? { open: id => {
        const offset = position();
        if (offset === undefined) throw new Error('The diagram target was deleted.');
        this.visual!.select(offset + 1);
        const target = this.getCodeTarget();
        if (!target) throw new Error('Only top-level code blocks support editing sessions.');
        this.openView(id, target);
      } } : undefined);
    });
    if (this.destroyed) { await visual.destroy(); throw new Error('Editor destroyed during initialization.'); }
    this.visual = visual;
    visual.view.dom.classList.add(...this.options.markdownCssClasses!);
    this.initialized = true;
    try { visual.replace(this.source, true); }
    catch (error) { this.mode = 'raw'; this.ensureRaw(); this.report(error); }
    if (this.options.initialMode === 'raw') { this.mode = 'raw'; this.ensureRaw(); }
    this.show();
    this.syncHost();
    this.emit('ready', 'initial');
  }

  get(): string {
    this.alive();
    const session = this.frames.find(frame => frame.session)?.session;
    if (session && session.get() !== session.target.value) {
      return this.source.slice(0, session.target.from) + fence(session.get(), session.target.language) + this.source.slice(session.target.to);
    }
    return this.mode === 'raw' && this.raw ? this.raw.get() : this.source;
  }

  set(markdown: string, options: SetOptions = {}): void {
    this.usable();
    validateMarkdown(markdown);
    if (markdown === this.get()) return;
    const session = this.frames.find(frame => frame.session)?.session;
    const dirtyRaw = this.mode === 'raw' && this.raw?.get() !== this.source;
    if ((session || dirtyRaw) && !options.pending) throw new Error('Specify pending: commit, discard, or reject before replacing an editing session.');
    if ((session || dirtyRaw) && options.pending === 'reject') throw new Error('Replacement rejected while an editing session is open.');
    if (this.mode === 'visual') this.visual!.parse(markdown);
    if (session && options.pending === 'commit') {
      while (this.frames.length) this.back();
    } else this.clearFrames();
    if (dirtyRaw && options.pending === 'commit') {
      this.visual!.replace(this.raw!.get(), false);
      this.source = this.raw!.get();
    }
    if (this.mode === 'visual') this.visual!.replace(markdown, options.resetHistory ?? true);
    this.source = markdown;
    this.imageFailure = undefined;
    this.imageRetry?.remove();
    this.dropRaw();
    if (this.mode === 'raw') this.ensureRaw();
    this.diagnostic.hidden = true;
    this.changed(options.origin ?? 'host-load');
    this.show();
  }

  setMode(mode: Mode): void {
    this.usable();
    if (mode !== 'visual' && mode !== 'raw') throw new TypeError('Unknown mode.');
    if (this.frames.length) throw new Error('Return from the current view before changing mode.');
    if (mode === this.mode) return;
    if (mode === 'visual') {
      const value = this.raw!.get();
      if (value !== this.source) this.visual!.replace(value, false);
      else this.visual!.parse(value);
      this.source = value;
      this.rawBaseline = value;
    } else this.ensureRaw();
    this.mode = mode;
    this.diagnostic.hidden = true;
    this.show();
    this.emit('mode', 'user');
    this.focus();
  }

  setTheme(theme: Theme): void {
    this.alive();
    if (theme !== 'light' && theme !== 'dark') throw new TypeError('Theme must be light or dark.');
    this.element.dataset.theme = theme;
  }

  setReadOnly(value: boolean): void { this.alive(); this.locked = Boolean(value); this.updatePermissions(); }
  setDisabled(value: boolean): void { this.alive(); this.disabled = Boolean(value); this.updatePermissions(); }

  private updatePermissions(): void {
    for (const controller of this.imageControllers) controller.abort();
    this.closeDestination();
    this.visual?.setReadOnly(this.readOnly);
    this.raw?.setReadOnly(this.readOnly);
    for (const source of this.sources) source.setReadOnly(this.readOnly);
    for (const frame of this.frames) this.views.items().find(view => view.id === frame.id)?.setReadOnly?.(this.readOnly);
    this.element.dataset.readonly = String(this.readOnly);
    this.refreshToolbar();
    this.refreshFloating();
  }

  on(event: EventName, callback: (event: EditorEvent) => void): Disposer {
    this.alive();
    if (typeof callback !== 'function') throw new TypeError('Event handler must be a function.');
    const handlers = this.listeners.get(event) ?? new Set();
    this.listeners.set(event, handlers);
    handlers.add(callback);
    return () => { handlers.delete(callback); };
  }

  private emit(event: EventName, origin: string, error?: Error): void {
    const payload: EditorEvent = { instance: this, origin, revision: this.revision, view: this.activeView, error };
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(payload); } catch (failure) { if (event !== 'error') this.report(failure); }
    }
  }

  private report(value: unknown): void {
    const error = value instanceof Error ? value : new Error(String(value));
    this.diagnostic.textContent = error.message;
    this.diagnostic.hidden = false;
    this.emit('error', 'system', error);
  }

  private changed(origin: string): void {
    const value = this.get();
    if (value === this.lastValue) return;
    this.lastValue = value;
    this.revision++;
    for (const controller of this.imageControllers) controller.abort();
    this.syncHost();
    this.updateStatus();
    this.updateOutline();
    this.emit('change', origin);
    if (this.mode === 'raw' || this.frames.some(frame => frame.session)) this.emit('draft', origin);
  }

  private syncHost(): void {
    if (this.host.tagName === 'TEXTAREA') (this.host as HTMLTextAreaElement).value = this.get();
  }

  private ensureRaw(): void {
    if (this.raw && this.rawBaseline === this.source) return;
    this.dropRaw();
    this.rawBaseline = this.source;
    this.raw = new SourceEditor(this.rawElement, this.source, this.readOnly, () => {
      this.changed('user');
      this.refreshToolbar();
    }, () => {
      this.refreshToolbar();
      this.refreshFloating();
    });
  }

  private dropRaw(): void { this.raw?.destroy(); this.raw = undefined; this.rawBaseline = undefined; }

  async execute(id: string, payload?: unknown): Promise<boolean> {
    this.usable();
    const command = this.commands.items().find(item => item.id === id);
    if (!command) throw new Error(`Unknown command: ${id}`);
    if ((!command.views.includes('*') && !command.views.includes(this.activeView)) || (command.mutates && this.readOnly) || command.enabled?.(this) === false) return false;
    await command.run(this, payload);
    return true;
  }

  createSourceEditor(element: HTMLElement, value: string, changed: (value: string) => void): SourceHandle {
    this.alive();
    validateMarkdown(value);
    if (!this.element.contains(element)) throw new Error('Source editors must mount within their owning instance.');
    const source = new SourceEditor(element, value, this.readOnly, next => {
      if (!this.readOnly && !this.destroyed) changed(next);
    });
    let disposed = false;
    const editable = () => !this.readOnly && !disposed && this.frames.at(-1)?.element.contains(element);
    const handle: SourceHandle = {
      get: () => source.get(),
      search: options => source.search(options),
      select: (from, to) => source.select(from, to),
      replaceSearch: (replacement, all) => { if (editable()) source.replaceSearch(replacement, all); },
      undo: () => { if (editable()) source.undo(); },
      redo: () => { if (editable()) source.redo(); },
      indent: outdent => { if (editable()) source.indent(outdent); },
      focus: () => { if (!disposed) source.focus(); },
      resize: () => { if (!disposed) source.view.requestMeasure(); },
      setReadOnly: value => { if (!disposed) source.setReadOnly(this.readOnly || value); },
      destroy: () => { if (disposed) return; disposed = true; source.destroy(); this.sources.delete(handle); this.sourceElements.delete(handle); },
    };
    this.sources.add(handle);
    this.sourceElements.set(handle, element);
    return handle;
  }

  private searchEngine(): SourceHandle | SourceEditor | VisualEngine | StaticSearch | undefined {
    const frame = this.frames.at(-1);
    if (frame) {
      const source = [...this.sources].find(source => frame.element.contains(this.sourceElements.get(source)!));
      if (source) return source;
      frame.search ??= new StaticSearch(frame.element);
      return frame.search;
    }
    return this.mode === 'raw' ? this.raw : this.visual;
  }

  search(options: SearchOptions): readonly SearchMatch[] {
    this.usable();
    if (typeof options.query !== 'string' || options.query.length > 1000) throw new TypeError('Search query must be a string of at most 1000 characters.');
    this.searchOptions = { ...options };
    this.queries.set(this.activeView, this.searchOptions);
    this.searchMatches = this.searchEngine()?.search(options) ?? findMatches(this.frames.at(-1)?.element.textContent ?? '', options);
    return this.searchMatches;
  }

  selectSearch(index: number): void {
    this.usable();
    this.search(this.searchOptions);
    this.searchIndex = this.searchMatches.length ? ((index % this.searchMatches.length) + this.searchMatches.length) % this.searchMatches.length : 0;
    const match = this.searchMatches[this.searchIndex];
    if (match) this.searchEngine()?.select(match.from, match.to);
  }

  replaceSearch(replacement: string, all = false): void {
    this.usable();
    validateMarkdown(replacement);
    if (this.readOnly) return;
    this.searchEngine()?.replaceSearch(replacement, all);
    this.search(this.searchOptions);
  }

  async whenIdle(): Promise<void> {
    await Promise.all([...this.pendingImages].filter(([, revision]) => revision === this.revision).map(([operation]) => operation));
    if (this.imageFailure) throw this.imageFailure;
  }

  async insertImage(blob: Blob): Promise<void> {
    this.usable();
    if (this.readOnly || !['visual', 'raw'].includes(this.activeView)) throw new Error('Images cannot be inserted in this view.');
    if ([...this.pendingImages.values()].includes(this.revision)) throw new Error('Wait for the pending image or cancel it before inserting another.');
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(blob.type) || blob.size > 1_000_000) throw new Error('Choose a raster image of at most 1 MB.');
    const revision = this.revision;
    const activeView = this.activeView;
    const selection = this.mode === 'raw' ? this.raw!.view.state.selection.main : this.visual!.view.state.selection;
    const controller = new AbortController();
    this.imageControllers.add(controller);
    const abort = () => controller.abort();
    this.lifetime.signal.addEventListener('abort', abort, { once: true });
    let cancel: () => void = () => {};
    const cancelled = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(new Error('Image insertion became stale or was cancelled; retry it in the current document.'));
      controller.signal.addEventListener('abort', cancel, { once: true });
    });
    const operation = (async () => {
      const supplied = (async () => this.options.onImageInsert
        ? await this.options.onImageInsert({ instance: this, blob, query: '', documentBase: this.options.documentBase, revision, signal: controller.signal })
        : { destination: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }) })();
      const result = await Promise.race([supplied, cancelled]);
      if (this.destroyed || controller.signal.aborted || this.readOnly || revision !== this.revision || activeView !== this.activeView) throw new Error('Image insertion became stale; retry the image in the current document.');
      if (!result || typeof result.destination !== 'string' || !safeUrl(result.destination, true) || !result.destination || /^blob:/i.test(result.destination)) throw new Error('Image callback returned an unsafe destination.');
      if (this.options.onImageInsert && /^data:/i.test(result.destination)) throw new Error('Image callbacks must return a saved image destination, not embedded binary.');
      const alt = result.alt ?? '';
      if (typeof alt !== 'string') throw new TypeError('Image alt text must be a string.');
      if (this.mode === 'raw') {
        const destination = result.destination.replace(/[<>\s]/g, character => encodeURIComponent(character));
        this.raw!.view.dispatch({ changes: { from: selection.from, to: selection.to, insert: `![${alt.replace(/[\\\[\]]/g, '\\$&')}](<${destination}>)` } });
      } else {
        const view = this.visual!.view;
        view.dispatch(closeHistory(view.state.tr.replaceRangeWith(selection.from, selection.to, view.state.schema.nodes.image.create({ src: result.destination, alt }))));
      }
      this.imageFailure = undefined;
      this.imageRetry?.remove();
    })();
    this.pendingImages.set(operation, revision);
    const pending = this.host.ownerDocument.createElement('div');
    pending.className = 'markian-panel';
    const pendingLabel = this.host.ownerDocument.createElement('span');
    pendingLabel.textContent = 'Inserting image';
    pending.append(pendingLabel, commandButton(this.host.ownerDocument, 'Cancel image insertion', 'close', () => controller.abort()));
    this.element.insertBefore(pending, this.work);
    this.status.setAttribute('aria-busy', 'true');
    try { await operation; }
    catch (error) {
      if (!this.destroyed && revision === this.revision) { this.imageFailure = error; this.report(error); }
      if (!this.destroyed && revision === this.revision) {
        this.imageRetry?.remove();
        const retry = this.host.ownerDocument.createElement('div');
        retry.className = 'markian-panel';
        const label = this.host.ownerDocument.createElement('span');
        label.textContent = 'Image insertion failed';
        const retryButton = commandButton(this.host.ownerDocument, 'Retry image', 'redo', () => { retry.remove(); void this.insertImage(blob).catch(() => {}); });
        const remove = commandButton(this.host.ownerDocument, 'Remove pending image', 'close', () => { this.imageFailure = undefined; retry.remove(); });
        retry.append(label, retryButton, remove);
        this.element.insertBefore(retry, this.work);
        this.imageRetry = retry;
      }
      throw error;
    }
    finally {
      this.pendingImages.delete(operation);
      this.imageControllers.delete(controller);
      controller.signal.removeEventListener('abort', cancel);
      pending.remove();
      this.lifetime.signal.removeEventListener('abort', abort);
      this.status.setAttribute('aria-busy', String(this.pendingImages.size > 0));
    }
  }

  getCodeTarget(): BlockTarget | null {
    this.usable();
    if (this.activeView !== 'visual') return null;
    const selection = this.visual!.view.state.selection;
    const selected = selection.$from;
    if (selected.parent.type.name !== 'code_block' || selected.depth !== 1) return null;
    let index = -1;
    let current = -1;
    this.visual!.view.state.doc.forEach((node, position) => {
      if (node.type.name !== 'code_block') return;
      current++;
      if (selected.pos > position && selected.pos <= position + node.nodeSize) index = current;
    });
    const code = parseMarkdown(this.source).children.filter(node => node.type === 'code')[index];
    if (!code?.position) return null;
    return { from: code.position.start.offset!, to: code.position.end.offset!, value: code.value, language: code.lang ?? '', revision: this.revision };
  }

  getActiveSession(): BlockSession | null {
    this.usable();
    return this.frames.find(frame => frame.session)?.session ?? null;
  }

  openView(id: string, target?: BlockTarget): void {
    this.usable();
    const view = this.views.items().find(item => item.id === id);
    if (!view) throw new Error(`Unknown view: ${id}`);
    if (target && (target.revision !== this.revision || this.frames.some(frame => frame.session))) throw new Error('Stale or conflicting block target.');
    if (target && !parseMarkdown(this.source).children.some(node => node.type === 'code'
      && node.position?.start.offset === target.from && node.position.end.offset === target.to
      && node.value === target.value && (node.lang ?? '') === target.language)) throw new Error('The target no longer identifies this code block.');
    const element = this.host.ownerDocument.createElement('div');
    element.className = 'markian-view';
    let draft = target?.value ?? '';
    const session: BlockSession | undefined = target ? {
      target: Object.freeze({ ...target }), get: () => draft,
      set: value => {
        this.usable();
        if (this.readOnly) throw new Error('The editor is read-only.');
        if (this.frames.at(-1)?.session !== session) throw new Error('Block session is not the active editing view.');
        validateMarkdown(value);
        draft = value;
        this.changed('user');
      },
    } : undefined;
    this.work.append(element);
    const frame: Frame = { id, element, dispose: () => {}, session, baseline: this.source };
    this.frames.push(frame);
    try { frame.dispose = view.mount({ element, session, signal: this.lifetime.signal }); }
    catch (error) { this.frames.pop(); element.remove(); this.show(); throw error; }
    view.setReadOnly?.(this.readOnly);
    this.show();
    this.emit('mode', 'navigation');
    this.focus();
  }

  back(): void {
    this.usable();
    const frame = this.frames.at(-1);
    if (!frame) {
      if (this.mode === 'raw') this.setMode('visual');
      return;
    }
    if (frame.session && frame.session.get() !== frame.session.target.value) {
      if (frame.baseline !== this.source) throw new Error('The target document changed. The draft is retained; choose an explicit host replacement policy.');
      if (this.readOnly) throw new Error('Unlock the editor before applying this draft. The draft is retained.');
      const value = this.get();
      this.visual!.replace(value, false);
      this.source = value;
    }
    this.frames.pop();
    frame.dispose();
    frame.element.remove();
    this.show();
    this.emit('mode', 'navigation');
    this.focus();
  }

  private clearFrames(): void {
    for (const frame of this.frames.reverse()) { frame.dispose(); frame.element.remove(); }
    this.frames = [];
  }

  private show(): void {
    this.closeSearch();
    this.closeDestination();
    this.visualElement.hidden = this.frames.length > 0 || this.mode !== 'visual';
    this.rawElement.hidden = this.frames.length > 0 || this.mode !== 'raw';
    this.frames.forEach((frame, index) => { frame.element.hidden = index !== this.frames.length - 1; });
    this.element.dataset.view = this.activeView;
    this.refreshToolbar();
    this.updateStatus();
    this.updateOutline();
    this.refreshFloating();
    this.resize();
  }

  private updateStatus(): void {
    const labels: Record<string, string> = { visual: 'Visual', raw: 'Source', code: 'Code', mermaid: 'Mermaid', help: 'Help', preview: 'Preview' };
    this.status.textContent = `${labels[this.activeView] ?? this.activeView} · ${this.get().length} characters`;
  }

  private refreshToolbar(): void {
    this.toolbarWidth = this.element.clientWidth;
    this.toolbar.replaceChildren();
    const hasBack = this.frames.length > 0 || this.mode === 'raw';
    if (hasBack) {
      const back = commandButton(this.host.ownerDocument, 'Back', 'back', () => { try { this.back(); } catch (error) { this.report(error); } });
      back.dataset.fixed = 'true';
      const divider = this.host.ownerDocument.createElement('span');
      divider.className = 'markian-separator';
      divider.dataset.fixed = 'true';
      divider.setAttribute('role', 'separator');
      divider.setAttribute('aria-orientation', 'vertical');
      this.toolbar.append(back, divider);
    }
    const registered = this.toolbarItems.items();
    const entries = this.toolbarItems.layout();
    const separator = () => {
      const divider = this.host.ownerDocument.createElement('span');
      divider.className = 'markian-separator';
      divider.setAttribute('role', 'separator');
      divider.setAttribute('aria-orientation', 'vertical');
      return divider;
    };
    const renderEntries = (items: readonly ToolbarEntry[]): HTMLElement[] => {
      const controls: HTMLElement[] = [];
      let previousGroup = false;
      for (const entry of items) {
        const item = typeof entry === 'string' ? registered.find(candidate => candidate.id === entry) : entry;
        const group = item?.type === 'group';
        const children = group ? renderEntries(item.items ?? []) : [render(entry)].filter((control): control is HTMLElement => control !== null);
        if (!children.length) continue;
        if (controls.length && (group || previousGroup)) controls.push(separator());
        controls.push(...children);
        previousGroup = group;
      }
      return controls;
    };
    const render = (entry: ToolbarEntry): HTMLElement | null => {
      const item = typeof entry === 'string' ? registered.find(candidate => candidate.id === entry) ?? { id: entry, command: entry } : entry;
      if (hasBack && item.id === 'modes') return null;
      const command = this.commands.items().find(candidate => candidate.id === (item.command ?? item.id));
      if (command && !command.views.includes('*') && !command.views.includes(this.activeView) && !item.items) return null;
      if (!command && !item.items) {
        if (this.initialized) throw new Error(`Unknown toolbar command: ${item.command ?? item.id}`);
        return null;
      }
      if (item.type === 'menu') {
        const children = renderEntries(item.items ?? []);
        if (!children.length) return null;
        const label = item.label ?? command?.label ?? item.id;
        const menu = this.host.ownerDocument.createElement('details');
        menu.className = 'markian-menu';
        menu.dataset.toolbarItem = item.id;
        const summary = this.host.ownerDocument.createElement('summary');
        summary.title = label;
        summary.setAttribute('aria-label', label);
        summary.append(...commandButton(this.host.ownerDocument, label, item.icon ?? command?.icon, () => {}).childNodes);
        const text = this.host.ownerDocument.createElement('span');
        text.className = 'markian-menu-label';
        text.textContent = label;
        summary.append(text);
        const chevron = commandButton(this.host.ownerDocument, label, 'chevron', () => {}).firstElementChild!;
        chevron.classList.add('markian-menu-chevron');
        summary.append(chevron);
        const choices = this.host.ownerDocument.createElement('div');
        choices.className = 'markian-menu-items';
        choices.append(...children);
        menu.append(summary, choices);
        this.installMenu(menu);
        return menu;
      }
      if (!command) return null;
      const expanded = command.id === 'fullscreen' && Boolean(this.fullscreenRestore);
      const label = command.id === 'fullscreen' ? (expanded ? 'Restore original size' : 'Maximize') : item.label ?? command.label;
      const button = commandButton(this.host.ownerDocument, label, expanded ? 'fullscreenExit' : item.icon ?? command.icon, () => { void this.execute(command.id).catch(error => this.report(error)); });
      if (command.id === 'fullscreen') button.setAttribute('aria-pressed', String(expanded));
      button.disabled = !this.initialized || Boolean(command.mutates && this.readOnly) || command.enabled?.(this) === false;
      if (this.initialized && command.active) button.setAttribute('aria-pressed', String(command.active(this)));
      button.dataset.command = command.id;
      const text = this.host.ownerDocument.createElement('span');
      text.className = 'markian-menu-label';
      text.textContent = label;
      button.append(text);
      if (command.swatch) {
        button.replaceChildren();
        button.classList.add('markian-swatch');
        button.style.backgroundColor = command.swatch;
      }
      return button;
    };
    const opposite = entries.filter(entry => typeof entry !== 'string' && entry.align === 'opposite');
    this.toolbar.append(...renderEntries(entries.filter(entry => !opposite.includes(entry))));
    const oppositeControls = renderEntries(opposite);
    if (oppositeControls.length) {
      const marker = this.host.ownerDocument.createElement('span');
      marker.dataset.overflowBoundary = '';
      marker.hidden = true;
      this.toolbar.append(marker);
      const divider = this.toolbar.children.length > 1 ? separator() : null;
      const controls = divider ? [divider, ...oppositeControls] : oppositeControls;
      controls[0].dataset.oppositeStart = '';
      for (const control of controls) control.dataset.fixed = 'true';
      this.toolbar.append(...controls);
    }
    this.layoutToolbar();
    this.positionPanels();
  }

  private positionMenu(menu: HTMLDetailsElement): void {
    if (!menu.isConnected || !menu.open) return;
    const choices = menu.querySelector<HTMLElement>(':scope > .markian-menu-items')!;
    if (!choices.matches(':popover-open')) choices.showPopover();
    const viewport = this.host.ownerDocument.defaultView!;
    choices.style.maxHeight = `${Math.max(80, Math.min(300, viewport.innerHeight - 24))}px`;
    choices.style.maxWidth = `${Math.max(120, viewport.innerWidth - 16)}px`;
    const bounds = choices.getBoundingClientRect();
    const anchor = menu.querySelector<HTMLElement>(':scope > summary')!.getBoundingClientRect();
    const root = this.element.getBoundingClientRect();
    const parent = menu.parentElement?.closest<HTMLElement>('.markian-menu-items');
    let left = anchor.left;
    const bottom = this.toolbar.getBoundingClientRect().top > this.work.getBoundingClientRect().top;
    let top = bottom ? anchor.top - bounds.height : anchor.bottom;
    if (parent) {
      const parentBounds = parent.getBoundingClientRect();
      const rightFits = parentBounds.right + bounds.width + 4 <= viewport.innerWidth - 8;
      left = rightFits ? parentBounds.right + 4 : parentBounds.left - bounds.width - 4;
      top = anchor.top;
      choices.dataset.side = rightFits ? 'right' : 'left';
    } else left = Math.min(left, root.right - 8 - bounds.width);
    choices.style.left = `${Math.max(8, Math.min(viewport.innerWidth - 8 - bounds.width, left))}px`;
    choices.style.top = `${Math.max(8, Math.min(viewport.innerHeight - 8 - bounds.height, top))}px`;
  }

  private menuControls(menu: HTMLDetailsElement): HTMLElement[] {
    return [...menu.querySelectorAll<HTMLElement>(':scope > summary, :scope > .markian-menu-items > button:not(:disabled), :scope > .markian-menu-items > details > summary')].filter(control => control.getClientRects().length > 0);
  }

  private installMenu(menu: HTMLDetailsElement): void {
    const choices = menu.querySelector<HTMLElement>(':scope > .markian-menu-items')!;
    choices.popover = 'manual';
    menu.querySelector<HTMLElement>(':scope > summary')!.addEventListener('pointerdown', event => event.preventDefault());
    menu.querySelector<HTMLElement>(':scope > summary')!.addEventListener('click', event => {
      event.preventDefault();
      this.setMenuOpen(menu, !menu.open);
    });
    menu.addEventListener('toggle', () => {
      if (!menu.isConnected) return;
      if (menu.open) this.positionMenu(menu);
      else if (choices.matches(':popover-open')) choices.hidePopover();
    });
    choices.addEventListener('scroll', () => {
      for (const child of choices.querySelectorAll<HTMLDetailsElement>('details[open]')) this.positionMenu(child);
    });
  }

  private setMenuOpen(menu: HTMLDetailsElement, open: boolean): void {
    if (open) {
      for (const sibling of menu.parentElement?.children ?? []) if (sibling !== menu && sibling instanceof HTMLDetailsElement) this.setMenuOpen(sibling, false);
      menu.open = true;
      this.positionMenu(menu);
    } else {
      for (const child of menu.querySelectorAll<HTMLDetailsElement>('details[open]')) this.setMenuOpen(child, false);
      menu.open = false;
      const choices = menu.querySelector<HTMLElement>(':scope > .markian-menu-items');
      if (choices?.matches(':popover-open')) choices.hidePopover();
    }
  }

  private layoutToolbar(): void {
    const available = this.toolbar.clientWidth;
    if (!available) return;
    const controls = [...this.toolbar.children].filter(control => !(control as HTMLElement).hidden) as HTMLElement[];
    const boundary = this.toolbar.querySelector<HTMLElement>('[data-overflow-boundary]');
    const width = (control: HTMLElement) => {
      const style = this.host.ownerDocument.defaultView!.getComputedStyle(control);
      return control.getBoundingClientRect().width + (control.dataset.oppositeStart !== undefined ? 0 : parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0) + 2;
    };
    const budget = available - 16;
    if (controls.reduce((total, control) => total + width(control), 0) <= budget) { this.trimSeparators(this.toolbar); return; }
    const overflow = this.host.ownerDocument.createElement('details');
    overflow.className = 'markian-menu markian-overflow';
    const summary = this.host.ownerDocument.createElement('summary');
    summary.setAttribute('aria-label', 'More commands');
    summary.title = 'More commands';
    summary.append(...commandButton(this.host.ownerDocument, 'More commands', 'more', () => {}).childNodes);
    const choices = this.host.ownerDocument.createElement('div');
    choices.className = 'markian-menu-items';
    const fixed = controls.filter(control => control.dataset.fixed === 'true');
    const movable = controls.filter(control => !fixed.includes(control));
    let used = fixed.reduce((total, control) => total + width(control), this.element.clientWidth <= 480 ? 42 : 34);
    let spilling = false;
    for (const control of movable) {
      if (used + width(control) > budget) spilling = true;
      if (spilling) choices.append(control);
      else used += width(control);
    }
    overflow.append(summary, choices);
    this.installMenu(overflow);
    this.toolbar.insertBefore(overflow, boundary ?? null);
    this.trimSeparators(this.toolbar);
    this.trimSeparators(choices);
  }

  private trimSeparators(container: HTMLElement): void {
    const children = [...container.children].filter(child => !(child as HTMLElement).hidden) as HTMLElement[];
    for (let index = 0; index < children.length; index++) {
      if (!children[index].classList.contains('markian-separator')) continue;
      if (!index || index === children.length - 1 || children[index - 1].classList.contains('markian-separator')) children[index].hidden = true;
    }
  }

  private refreshFloating(contextual = false): void {
    this.floating.replaceChildren();
    const visual = this.activeView === 'visual' ? this.visual?.view : undefined;
    const raw = this.activeView === 'raw' ? this.raw?.view : undefined;
    const selection = visual?.state.selection ?? raw?.state.selection.main;
    let inTable = false;
    if (visual) for (let depth = visual.state.selection.$from.depth; depth > 0; depth--) if (visual.state.selection.$from.node(depth).type.name === 'table') inTable = true;
    const inCode = visual?.state.selection.$from.parent.type.name === 'code_block' && this.commands.items().some(command => command.id === 'code:expand');
    if (!selection || (selection.empty && !inTable && !inCode && !contextual) || this.readOnly && !inCode || this.searchElement || this.destination) { this.floating.hidden = true; return; }
    const items = inCode ? ['code:expand'] : inTable ? ['table:row-after', 'table:column-after', 'table:delete-row', 'table:delete-column'] : this.options.floatingToolbar ?? ['bold', 'italic', 'code', 'strike', 'link', 'clear'];
    for (const id of items) {
      const command = this.commands.items().find(item => item.id === id);
      if (!command || !command.views.includes(this.activeView)) continue;
      const button = commandButton(this.host.ownerDocument, command.label, command.icon, () => { void this.execute(id).catch(error => this.report(error)); });
      button.dataset.command = id;
      button.disabled = command.enabled?.(this) === false;
      if (command.active) button.setAttribute('aria-pressed', String(command.active(this)));
      this.floating.append(button);
    }
    this.floating.hidden = !this.floating.childElementCount;
    const position = visual ? visual.coordsAtPos(selection.from) : raw?.coordsAtPos(selection.from);
    const end = visual ? visual.coordsAtPos(selection.to) : raw?.coordsAtPos(selection.to);
    if (position && end) {
      const root = this.element.getBoundingClientRect();
      const work = this.work.getBoundingClientRect();
      const nativeSelection = this.host.ownerDocument.getSelection();
      const range = visual && nativeSelection?.rangeCount ? nativeSelection.getRangeAt(0) : undefined;
      const bounds = range && visual?.dom.contains(range.commonAncestorContainer) ? range.getBoundingClientRect() : undefined;
      const selectionTop = bounds?.top ?? Math.min(position.top, end.top);
      const selectionBottom = bounds?.bottom ?? Math.max(position.bottom, end.bottom);
      const topBound = Math.max(work.top, 0) + 8;
      const bottomBound = Math.min(work.bottom, this.host.ownerDocument.documentElement.clientHeight) - 8;
      const height = this.floating.offsetHeight;
      const above = Math.min(selectionTop - height - 8, bottomBound - height);
      const below = Math.max(selectionBottom + 8, topBound);
      const top = above >= topBound ? above : below + height <= bottomBound ? below : undefined;
      if (top === undefined) { this.floating.hidden = true; return; }
      this.floating.style.top = `${top - root.top - this.element.clientTop}px`;
      this.floating.style.left = `${Math.max(8, Math.min(root.width - this.floating.offsetWidth - 8, position.left - root.left))}px`;
      this.floating.style.right = 'auto';
    } else this.floating.hidden = true;
  }

  private closeSearch(restoreFocus = true): void {
    if (!this.searchElement) return;
    this.searchEngine()?.search({ query: '' });
    this.searchElement.remove();
    this.searchElement = undefined;
    if (restoreFocus && this.initialized && !this.destroyed) this.focus();
  }

  private openSearch(): void {
    this.closeDestination();
    if (this.searchElement) { this.searchElement.querySelector('input')?.focus(); return; }
    const previous = this.queries.get(this.activeView);
    this.searchElement = this.wrapPanel(searchPanel(this, () => this.closeSearch(), { query: previous?.query ?? '', caseSensitive: previous?.caseSensitive ?? false, wholeWord: previous?.wholeWord ?? false }), 'search');
    this.element.insertBefore(this.searchElement, this.work);
    this.searchElement.showPopover();
    this.positionPanels();
  }

  private closeDestination(restoreFocus = true): void {
    if (!this.destination) return;
    this.destination.dispose();
    this.destination.element.remove();
    this.destination = undefined;
    if (restoreFocus && this.initialized && !this.destroyed) this.focus();
  }

  private openDestination(image: boolean): void {
    this.closeSearch();
    this.closeDestination();
    this.destination = destinationPanel(this, this.options, image, this.visual!.view, this.mode === 'raw' ? this.raw : undefined, () => this.closeDestination());
    this.destination.element = this.wrapPanel(this.destination.element, image ? 'image' : 'link');
    this.element.insertBefore(this.destination.element, this.work);
    this.destination.element.showPopover();
    this.positionPanels();
  }

  private wrapPanel(panel: HTMLElement, command: string): HTMLElement {
    const popup = this.host.ownerDocument.createElement('div');
    popup.className = 'markian-popup';
    popup.dataset.anchorCommand = command;
    popup.popover = 'manual';
    popup.append(panel);
    const observer = new ResizeObserver(() => { if (popup.isConnected) this.positionPanels(); else observer.disconnect(); });
    observer.observe(panel);
    const disconnect = new MutationObserver(() => {
      if (!popup.isConnected) { observer.disconnect(); disconnect.disconnect(); }
    });
    disconnect.observe(this.element, { childList: true });
    return popup;
  }

  private positionPanels(): void {
    if (this.destroyed) return;
    const viewport = this.host.ownerDocument.defaultView!;
    for (const popup of [this.searchElement, this.destination?.element]) {
      if (!popup?.isConnected || !popup.matches(':popover-open')) continue;
      const command = popup.dataset.anchorCommand;
      let anchor = [...this.toolbar.querySelectorAll<HTMLElement>('[data-command]')].find(button => button.dataset.command === command);
      for (let menu = anchor?.closest('details'); menu; menu = menu.parentElement?.closest('details')) anchor = menu.querySelector<HTMLElement>(':scope > summary')!;
      anchor ??= this.toolbar.querySelector<HTMLElement>('.markian-overflow > summary') ?? this.toolbar.querySelector<HTMLElement>('button, summary') ?? this.toolbar;
      const bounds = anchor.getBoundingClientRect();
      const bottom = this.toolbar.getBoundingClientRect().top > this.work.getBoundingClientRect().top;
      const below = viewport.innerHeight - bounds.bottom - 20;
      const above = bounds.top - 20;
      const opensAbove = bottom ? above >= 100 || above > below : below < 160 && above > below;
      popup.dataset.side = opensAbove ? 'above' : 'below';
      const panel = popup.firstElementChild as HTMLElement;
      panel.style.maxHeight = `${Math.max(80, opensAbove ? above : below)}px`;
      const size = popup.getBoundingClientRect();
      const left = Math.max(8, Math.min(viewport.innerWidth - size.width - 8, bounds.left));
      popup.style.left = `${left}px`;
      popup.style.top = `${Math.max(8, opensAbove ? bounds.top - size.height - 10 : bounds.bottom + 10)}px`;
      popup.style.setProperty('--markian-tip-left', `${Math.max(12, Math.min(size.width - 12, bounds.left + bounds.width / 2 - left))}px`);
    }
  }

  private updateOutline(): void {
    if (!this.initialized || this.destroyed) return;
    this.outline.hidden = this.frames.length > 0;
    if (this.frames.length || this.outlineRevision === this.revision && this.outline.childElementCount) return;
    this.outlineRevision = this.revision;
    this.outline.replaceChildren();
    this.outlineTargets = [];
    const title = this.host.ownerDocument.createElement('h2');
    title.className = 'markian-outline-title';
    title.textContent = 'Outline';
    this.outline.append(title);
    const entries = headings(this.get());
    const visualHeadings = this.visualElement.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6');
    entries.forEach((entry, index) => {
      const rendered = visualHeadings[index];
      if (rendered) rendered.id = entry.id;
      if (entry.line === 1) return;
      const button = this.host.ownerDocument.createElement('button');
      button.type = 'button';
      button.textContent = entry.label;
      button.style.paddingInlineStart = `${8 + (entry.depth - 1) * 10}px`;
      button.addEventListener('click', () => {
        this.outline.querySelector('[aria-current]')?.removeAttribute('aria-current');
        button.setAttribute('aria-current', 'location');
        if (this.mode === 'raw') {
          const line = this.raw!.view.state.doc.line(entry.line);
          this.raw!.select(line.from);
          this.raw!.focus();
        } else {
          const heading = this.visualElement.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')[index];
          if (!heading) return;
          this.visual!.view.focus();
          const top = this.visualElement.scrollTop + heading.getBoundingClientRect().top - this.visualElement.getBoundingClientRect().top;
          this.visualElement.scrollTo({ top, behavior: 'instant' });
        }
      });
      this.outline.append(button);
      this.outlineTargets.push({ button, headingIndex: index, line: entry.line });
    });
    this.element.dataset.hasOutline = String(this.outlineTargets.length > 0);
    this.updateCurrentSection();
  }

  private updateCurrentSection(): void {
    if (this.destroyed || this.frames.length) return;
    let active = this.outlineTargets[0];
    if (this.mode === 'raw' && this.raw) {
      const visible = this.raw.view.state.doc.lineAt(this.raw.view.viewport.from).number;
      for (const target of this.outlineTargets) if (target.line <= visible) active = target;
    } else {
      const top = this.visualElement.getBoundingClientRect().top + 24;
      const renderedHeadings = this.visualElement.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6');
      for (const target of this.outlineTargets) {
        const rendered = renderedHeadings[target.headingIndex];
        if (rendered && rendered.getBoundingClientRect().top <= top) active = target;
      }
    }
    for (const target of this.outlineTargets) {
      if (target === active) target.button.setAttribute('aria-current', 'location');
      else target.button.removeAttribute('aria-current');
    }
  }

  private installCommands(): void {
    const add = (id: string, label: string, icon: string, mutates: boolean, views: string[], run: CommandDefinition['run']) => {
      this.commands.insert({ id, label, icon, mutates, views, run,
        enabled: id === 'undo' || id === 'redo' ? () => this.mode === 'raw' || (id === 'undo' ? undo : redo)(this.visual!.view.state) : undefined,
        active: id === 'outline' ? () => this.element.classList.contains('markian-outline-open') : ['bold', 'italic', 'code'].includes(id) ? () => {
          if (this.activeView !== 'visual') return false;
          const state = this.visual!.view.state;
          const mark = state.schema.marks[{ bold: 'strong', italic: 'emphasis', code: 'inlineCode' }[id]!];
          return state.selection.empty ? Boolean(mark.isInSet(state.storedMarks ?? state.selection.$from.marks())) : state.doc.rangeHasMark(state.selection.from, state.selection.to, mark);
        } : undefined,
      });
      this.toolbarItems.register({ id, command: id });
    };
    for (const id of ['undo', 'redo']) add(id, id === 'undo' ? 'Undo' : 'Redo', id, true, ['visual', 'raw'], () => {
      if (this.mode === 'raw') this.raw![id as 'undo' | 'redo']();
      else { const view = this.visual!.view; (id === 'undo' ? undo : redo)(view.state, view.dispatch); }
    });
    for (const [id, label, mark, wrapper] of [['bold', 'Bold', 'strong', '**'], ['italic', 'Italic', 'emphasis', '*'], ['code', 'Inline code', 'inlineCode', '`']]) {
      add(id, label, id, true, ['visual', 'raw'], () => {
        if (this.mode === 'raw') {
          const view = this.raw!.view;
          const selection = view.state.selection.main;
          let { from, to } = selection;
          if (selection.empty) {
            const line = view.state.doc.lineAt(from);
            const offset = from - line.from;
            from -= line.text.slice(0, offset).match(/[\p{L}\p{M}\p{N}_]+$/u)?.[0].length ?? 0;
            to += line.text.slice(offset).match(/^[\p{L}\p{M}\p{N}_]+/u)?.[0].length ?? 0;
          }
          view.dispatch({ changes: { from, to, insert: wrapper + view.state.sliceDoc(from, to) + wrapper }, selection: { anchor: selection.from + wrapper.length, head: selection.to + wrapper.length } });
          this.raw!.focus();
        } else {
          const view = this.visual!.view;
          const selected = view.state.selection;
          if (selected.empty && selected.$from.parent.isTextblock) {
            const text = selected.$from.parent.textContent;
            const offset = selected.$from.parentOffset;
            const start = text.slice(0, offset).match(/[\p{L}\p{M}\p{N}_]+$/u)?.[0].length ?? 0;
            const end = text.slice(offset).match(/^[\p{L}\p{M}\p{N}_]+/u)?.[0].length ?? 0;
            if (start || end) this.visual!.select(selected.from - start, selected.from + end);
          }
          toggleMark(view.state.schema.marks[mark])(view.state, transaction => {
            if (selected.empty) transaction.setSelection(TextSelection.create(transaction.doc, selected.from));
            view.dispatch(closeHistory(transaction));
          });
          view.focus();
        }
      });
    }
    add('heading', 'Heading 2', 'heading', true, ['visual'], () => {
      const view = this.visual!.view;
      const block = view.state.selection.$from.parent;
      const isHeading = block.type === view.state.schema.nodes.heading && block.attrs.level === 2;
      setBlockType(
        isHeading ? view.state.schema.nodes.paragraph : view.state.schema.nodes.heading,
        isHeading ? undefined : { level: 2 }
      )(view.state, transaction => view.dispatch(closeHistory(transaction)));
      view.focus();
    });
    add('bullet', 'Bullet list', 'bullet', true, ['visual', 'raw'], async () => { await this.execute('list:bullet'); });
    add('raw', 'Switch visual / source', 'raw', false, ['visual'], () => this.setMode('raw'));
    for (const [id, label, mode] of [['visual', 'Visual', 'visual'], ['source', 'Source', 'raw']] as const) {
      this.commands.insert({ id, label, icon: id === 'source' ? 'raw' : 'visual', views: ['visual', 'raw', 'preview'], active: () => this.activeView === mode,
        run: () => { if (this.activeView === 'preview') this.back(); this.setMode(mode); },
      });
    }
    const allViews = ['*'];
    add('preview', 'Preview', 'preview', false, allViews, () => { if (this.activeView !== 'preview') this.openView('preview'); });
    add('help', 'Help', 'help', false, allViews, () => { if (this.activeView !== 'help') this.openView('help'); });
    add('copy', 'Copy Markdown', 'copy', false, allViews, async () => { await this.host.ownerDocument.defaultView!.navigator.clipboard.writeText(this.get()); });
    add('fullscreen', 'Maximize', 'fullscreen', false, allViews, () => this.toggleFullscreen());
    add('search', 'Find and replace', 'search', false, allViews, () => this.openSearch());
    add('outline', 'Document outline', 'outline', false, ['visual', 'raw'], () => { this.element.classList.toggle('markian-outline-open'); this.resize(); });
    this.commands.insert({ id: 'link:open', label: 'Open link', icon: 'link', views: ['visual'],
      enabled: () => Boolean(this.visual!.view.state.selection.$from.marks().some(mark => mark.type.name === 'link')),
      run: async () => {
        const destination = String(this.visual!.view.state.selection.$from.marks().find(mark => mark.type.name === 'link')!.attrs.href);
        if (!safeUrl(destination)) throw new Error('Unsafe link destination.');
        if (this.options.onLinkOpen) await this.options.onLinkOpen({ instance: this, destination, query: '', revision: this.revision, documentBase: this.options.documentBase, signal: this.lifetime.signal });
        else this.host.ownerDocument.defaultView?.open(new URL(destination, this.options.documentBase ? new URL(this.options.documentBase, this.host.ownerDocument.baseURI) : this.host.ownerDocument.baseURI).href, '_blank', 'noopener,noreferrer');
      },
    });
    this.toolbarItems.register({ id: 'link:open', command: 'link:open' });
    installEditing(this, () => this.visual!.view, () => this.raw!, this.options, image => this.openDestination(image), item => this.toolbarItems.register(item));
    for (const id of ['help', 'preview']) this.views.insert({
      id,
      mount: ({ element }) => {
        element.classList.add('markian-document', ...this.options.markdownCssClasses!);
        element.innerHTML = renderMarkdown(id === 'help' ? '# Markian\n\n## Keyboard\n\n- Ctrl/Cmd+Z: Undo\n- Ctrl/Cmd+Shift+Z: Redo\n- Ctrl/Cmd+S: Request host save\n\n## Source\n\nSource preserves unsupported Markdown. Back restores the previous task.\n' + this.help.items().map(item => item.markdown).join('\n\n') : this.get(), this.options.softbreaks, this.options.allowTextColors);
        if (this.options.documentBase) for (const image of element.querySelectorAll('img[src]')) {
          const source = image.getAttribute('src') ?? '';
          if (safeUrl(source, true)) image.setAttribute('src', new URL(source, new URL(this.options.documentBase, this.host.ownerDocument.baseURI)).href);
        }
        const disposers: Disposer[] = [];
        if (id === 'preview') for (const code of element.querySelectorAll('pre > code')) {
          const renderer = this.renderers.items().find(item => code.classList.contains(`language-${item.language}`));
          if (renderer) disposers.push(renderer.render(code.textContent ?? '', code.parentElement!));
        }
        return () => disposers.reverse().forEach(dispose => dispose());
      },
    });
  }

  private listen(target: EventTarget | null, event: string, handler: EventListener): void {
    target?.addEventListener(event, handler);
    this.cleanups.push(() => target?.removeEventListener(event, handler));
  }

  private exitFullscreen(): void {
    this.fullscreenEntry?.abort();
    this.fullscreenEntry = undefined;
    const restore = this.fullscreenRestore;
    this.fullscreenRestore = undefined;
    try { restore?.(); } catch (error) { this.report(error); }
    this.element.dataset.fullscreen = 'false';
    if (!this.destroyed) { this.refreshToolbar(); this.resize(); }
  }

  private async toggleFullscreen(): Promise<void> {
    if (this.fullscreenRestore || this.fullscreenEntry) { this.exitFullscreen(); return; }
    const entry = new AbortController();
    this.fullscreenEntry = entry;
    try {
      const restore = this.options.onFullscreenEnter
        ? await this.options.onFullscreenEnter({ instance: this, element: this.element, signal: entry.signal })
        : (() => { this.element.classList.add('markian-fullscreen'); return () => this.element.classList.remove('markian-fullscreen'); })();
      if (typeof restore !== 'function') throw new TypeError('onFullscreenEnter must return a restore function.');
      if (entry.signal.aborted || this.destroyed) { restore(); return; }
      this.fullscreenRestore = restore;
      this.element.dataset.fullscreen = 'true';
      this.refreshToolbar();
      this.resize();
    } finally { if (this.fullscreenEntry === entry) this.fullscreenEntry = undefined; }
  }

  focus(): void {
    this.usable();
    const frame = this.frames.at(-1);
    if (frame) {
      const view = this.views.items().find(item => item.id === frame.id);
      if (view?.focus) view.focus();
      else { frame.element.tabIndex = -1; frame.element.focus(); }
    } else if (this.mode === 'raw') this.raw?.focus();
    else this.visual?.view.focus();
  }

  resize(): void {
    if (this.destroyed) return;
    this.refreshToolbar();
    this.raw?.view.requestMeasure();
    const frame = this.frames.at(-1);
    if (frame) this.views.items().find(item => item.id === frame.id)?.resize?.();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.syncHost();
    this.exitFullscreen();
    this.closeDestination();
    this.closeSearch();
    this.destroyed = true;
    this.lifetime.abort();
    this.clearFrames();
    for (const source of this.sources) source.destroy();
    this.dropRaw();
    void this.visual?.destroy().catch(error => this.report(error));
    for (const dispose of this.cleanups.reverse()) {
      try { dispose(); } catch (error) { this.report(error); }
    }
    this.cleanups = [];
    this.element.remove();
    this.host.hidden = this.originalHidden;
    this.listeners.clear();
  }
}