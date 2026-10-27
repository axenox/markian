import { Items } from './registry';
import { createVisual, type VisualEngine } from './engines/visual';
import { SourceEditor } from './engines/source';
import { redo, undo, closeHistory, toggleMark, setBlockType, wrapIn, wrapInList } from './engines/prose';
import { parseMarkdown, renderMarkdown, validateMarkdown } from './render/markdown';
import { commandButton } from './ui/controls';
import type { BlockSession, BlockTarget, CommandDefinition, Disposer, EditorEvent, EditorOptions, EventName, ExtensionFactory, MarkianInstance, Mode, RendererDefinition, SetOptions, SourceHandle, StructuralNode, Theme, ToolbarItem, ViewDefinition } from './types';

interface Frame {
  id: string;
  element: HTMLElement;
  dispose: Disposer;
  session?: BlockSession;
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
  private status: HTMLElement;
  private diagnostic: HTMLElement;
  private frames: Frame[] = [];
  private sources = new Set<SourceHandle>();
  private listeners = new Map<EventName, Set<(event: EditorEvent) => void>>();
  private cleanups: Disposer[] = [];
  private lastValue: string;
  private commands = new Items<CommandDefinition>(() => this.refreshToolbar(), () => this.alive());
  private toolbarItems = new Items<ToolbarItem>(() => this.refreshToolbar(), () => this.alive());
  private views = new Items<ViewDefinition>(() => {}, () => this.alive());
  private renderers = new Items<RendererDefinition>(() => {}, () => this.alive());
  private structures = new Items<StructuralNode>(() => {}, () => {
    this.alive();
    if (this.structuresClosed) throw new Error('Structural registration is closed after engine construction.');
  });

  constructor(private host: HTMLElement, private options: EditorOptions, private factories: ReadonlyMap<string, ExtensionFactory>) {
    validateMarkdown(options.markdown);
    if (host.tagName !== 'DIV' && host.tagName !== 'TEXTAREA') throw new TypeError('Mount Markian on a div or textarea.');
    if (options.initialMode && !['visual', 'raw'].includes(options.initialMode)) throw new TypeError('Unknown initial mode.');
    this.source = this.lastValue = options.markdown;
    this.locked = options.readOnly ?? false;
    this.disabled = options.disabled ?? false;
    this.originalHidden = host.hidden;
    const document = host.ownerDocument;
    this.element = document.createElement('section');
    this.element.className = 'markian';
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
    this.diagnostic = document.createElement('div');
    this.diagnostic.className = 'markian-diagnostic';
    this.diagnostic.setAttribute('role', 'alert');
    this.diagnostic.hidden = true;
    this.status = document.createElement('div');
    this.status.className = 'markian-status';
    this.element.append(this.toolbar, this.diagnostic, this.work, this.status);
    host.after(this.element);
    host.hidden = true;
    this.setTheme(options.theme ?? 'light');
    this.installCommands();
    this.listen(this.element, 'focusin', () => this.emit('focus', 'user'));
    this.listen(this.element, 'focusout', event => {
      if (!this.element.contains((event as FocusEvent).relatedTarget as Node | null)) this.emit('blur', 'user');
    });
    this.listen(this.element, 'keydown', event => {
      const keyboard = event as KeyboardEvent;
      if ((keyboard.ctrlKey || keyboard.metaKey) && keyboard.key.toLowerCase() === 's') {
        keyboard.preventDefault();
        this.emit('save-request', 'user');
      }
      if (keyboard.key === 'Escape' && this.element.classList.contains('markian-fullscreen')) {
        this.element.classList.remove('markian-fullscreen');
        this.refreshToolbar();
        this.resize();
      }
    });
    if (host.tagName === 'TEXTAREA') {
      const textarea = host as HTMLTextAreaElement;
      this.listen(textarea.form, 'reset', event => queueMicrotask(() => {
        if (!event.defaultPrevented && !this.destroyed && this.initialized) {
          this.set(textarea.defaultValue, { origin: 'form-reset', resetHistory: true, pending: 'discard' });
        }
      }));
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

  private alive(): void { if (this.destroyed) throw new Error('Markian instance has been destroyed.'); }
  private usable(): void { this.alive(); if (!this.initialized) throw new Error('Await editor.ready before using this operation.'); }

  private async initialize(): Promise<void> {
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
    const visual = await createVisual(this.visualElement, this.structures.items(), () => this.readOnly, value => {
      this.source = value;
      this.changed('user');
    });
    if (this.destroyed) { await visual.destroy(); throw new Error('Editor destroyed during initialization.'); }
    this.visual = visual;
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
    if (session && !options.pending) throw new Error('Specify pending: commit, discard, or reject before replacing a block session.');
    if (session && options.pending === 'reject') throw new Error('Replacement rejected while a block session is open.');
    if (this.mode === 'visual') this.visual!.parse(markdown);
    if (session && options.pending === 'commit') {
      while (this.frames.length) this.back();
    } else this.clearFrames();
    if (this.mode === 'visual') this.visual!.replace(markdown, options.resetHistory ?? true);
    this.source = markdown;
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
    this.visual?.setReadOnly(this.readOnly);
    this.raw?.setReadOnly(this.readOnly);
    for (const source of this.sources) source.setReadOnly(this.readOnly);
    for (const frame of this.frames) this.views.items().find(view => view.id === frame.id)?.setReadOnly?.(this.readOnly);
    this.element.dataset.readonly = String(this.readOnly);
    this.refreshToolbar();
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
    this.syncHost();
    this.updateStatus();
    this.emit('change', origin);
  }

  private syncHost(): void {
    if (this.host.tagName === 'TEXTAREA') (this.host as HTMLTextAreaElement).value = this.get();
  }

  private ensureRaw(): void {
    if (this.raw && this.rawBaseline === this.source) return;
    this.dropRaw();
    this.rawBaseline = this.source;
    this.raw = new SourceEditor(this.rawElement, this.source, this.readOnly, () => this.changed('user'));
  }

  private dropRaw(): void { this.raw?.destroy(); this.raw = undefined; this.rawBaseline = undefined; }

  async execute(id: string, payload?: unknown): Promise<boolean> {
    this.usable();
    const command = this.commands.items().find(item => item.id === id);
    if (!command) throw new Error(`Unknown command: ${id}`);
    if (!command.views.includes(this.activeView) || (command.mutates && this.readOnly)) return false;
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
    const handle: SourceHandle = {
      get: () => source.get(),
      undo: () => { if (!this.readOnly && !disposed) source.undo(); },
      redo: () => { if (!this.readOnly && !disposed) source.redo(); },
      focus: () => { if (!disposed) source.focus(); },
      resize: () => { if (!disposed) source.view.requestMeasure(); },
      setReadOnly: value => { if (!disposed) source.setReadOnly(this.readOnly || value); },
      destroy: () => { if (disposed) return; disposed = true; source.destroy(); this.sources.delete(handle); },
    };
    this.sources.add(handle);
    return handle;
  }

  getCodeTarget(): BlockTarget | null {
    this.usable();
    if (this.activeView !== 'visual') return null;
    const selection = this.visual!.view.state.selection;
    const selected = selection.$from;
    if (selected.parent.type.name !== 'code_block') return null;
    let index = -1;
    let current = -1;
    this.visual!.view.state.doc.descendants((node, position) => {
      if (node.type.name !== 'code_block') return;
      current++;
      if (selected.pos > position && selected.pos <= position + node.nodeSize) index = current;
    });
    const code = parseMarkdown(this.source).children.filter(node => node.type === 'code')[index];
    if (!code?.position) return null;
    return { from: code.position.start.offset!, to: code.position.end.offset!, value: code.value, language: code.lang ?? '', revision: this.revision };
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
        if (!this.frames.some(frame => frame.session === session)) throw new Error('Block session is no longer active.');
        validateMarkdown(value);
        draft = value;
        this.changed('user');
      },
    } : undefined;
    this.work.append(element);
    const frame: Frame = { id, element, dispose: () => {}, session };
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
    this.visualElement.hidden = this.frames.length > 0 || this.mode !== 'visual';
    this.rawElement.hidden = this.frames.length > 0 || this.mode !== 'raw';
    this.frames.forEach((frame, index) => { frame.element.hidden = index !== this.frames.length - 1; });
    this.element.dataset.view = this.activeView;
    this.refreshToolbar();
    this.updateStatus();
    this.resize();
  }

  private updateStatus(): void {
    const labels: Record<string, string> = { visual: 'Visual', raw: 'Source', code: 'Code', help: 'Help', preview: 'Preview' };
    this.status.textContent = `${labels[this.activeView] ?? this.activeView} · ${this.get().length} characters`;
  }

  private refreshToolbar(): void {
    this.toolbar.replaceChildren();
    if (this.frames.length || this.mode === 'raw') this.toolbar.append(commandButton(this.host.ownerDocument, 'Back', 'back', () => { try { this.back(); } catch (error) { this.report(error); } }));
    for (const item of this.toolbarItems.items()) {
      const command = this.commands.items().find(candidate => candidate.id === item.command);
      if (!command || !command.views.includes(this.activeView)) continue;
      const expanded = command.id === 'fullscreen' && this.element.classList.contains('markian-fullscreen');
      const label = command.id === 'fullscreen' ? (expanded ? 'Restore original size' : 'Maximize') : command.label;
      const button = commandButton(this.host.ownerDocument, label, expanded ? 'fullscreenExit' : command.icon, () => { void this.execute(command.id).catch(error => this.report(error)); });
      if (command.id === 'fullscreen') button.setAttribute('aria-pressed', String(expanded));
      button.disabled = !this.initialized || Boolean(command.mutates && this.readOnly);
      button.dataset.command = command.id;
      this.toolbar.append(button);
    }
  }

  private installCommands(): void {
    const add = (id: string, label: string, icon: string, mutates: boolean, views: string[], run: CommandDefinition['run']) => {
      this.commands.insert({ id, label, icon, mutates, views, run });
      this.toolbarItems.insert({ id, command: id });
    };
    for (const id of ['undo', 'redo']) add(id, id === 'undo' ? 'Undo' : 'Redo', id, true, ['visual', 'raw'], () => {
      if (this.mode === 'raw') this.raw![id as 'undo' | 'redo']();
      else { const view = this.visual!.view; (id === 'undo' ? undo : redo)(view.state, view.dispatch); }
    });
    for (const [id, label, mark, wrapper] of [['bold', 'Bold', 'strong', '**'], ['italic', 'Italic', 'emphasis', '*'], ['code', 'Inline code', 'inlineCode', '`']]) {
      add(id, label, id, true, ['visual', 'raw'], () => {
        if (this.mode === 'raw') {
          const view = this.raw!.view;
          const { from, to } = view.state.selection.main;
          view.dispatch({ changes: { from, to, insert: wrapper + view.state.sliceDoc(from, to) + wrapper }, selection: { anchor: from + wrapper.length, head: to + wrapper.length } });
          this.raw!.focus();
        } else {
          const view = this.visual!.view;
          toggleMark(view.state.schema.marks[mark])(view.state, view.dispatch);
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
    add('bullet', 'Bullet list', 'bullet', true, ['visual'], () => { const view = this.visual!.view; wrapInList(view.state.schema.nodes.bullet_list)(view.state, view.dispatch); view.focus(); });
    add('quote', 'Quote', 'quote', true, ['visual'], () => { const view = this.visual!.view; wrapIn(view.state.schema.nodes.blockquote)(view.state, view.dispatch); view.focus(); });
    add('raw', 'Switch visual / source', 'raw', false, ['visual'], () => this.setMode('raw'));
    const allViews = ['visual', 'raw', 'code', 'help', 'preview'];
    add('preview', 'Preview', 'preview', false, ['visual', 'raw', 'code'], () => this.openView('preview'));
    add('help', 'Help', 'help', false, ['visual', 'raw', 'code'], () => this.openView('help'));
    add('copy', 'Copy Markdown', 'copy', false, allViews, async () => { await this.host.ownerDocument.defaultView!.navigator.clipboard.writeText(this.get()); });
    add('fullscreen', 'Maximize', 'fullscreen', false, allViews, () => {
      this.element.classList.toggle('markian-fullscreen');
      this.refreshToolbar();
      this.resize();
    });
    for (const id of ['help', 'preview']) this.views.insert({
      id,
      mount: ({ element }) => {
        element.classList.add('markian-document');
        element.innerHTML = renderMarkdown(id === 'help' ? '# Markian\n\n## Keyboard\n\n- Ctrl/Cmd+Z: Undo\n- Ctrl/Cmd+Shift+Z: Redo\n- Ctrl/Cmd+S: Request host save\n\n## Source\n\nSource preserves unsupported Markdown. Back restores the previous task.\n' : this.get(), this.options.softbreaks);
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
    this.raw?.view.requestMeasure();
    const frame = this.frames.at(-1);
    if (frame) this.views.items().find(item => item.id === frame.id)?.resize?.();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.syncHost();
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