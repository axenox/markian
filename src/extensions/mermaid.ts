/** Diagram rendering and source workspace; see ../../Docs/Development/Extensions/Mermaid_extension.md. */
import DOMPurify from 'dompurify';
import './mermaid.css';
import { commandButton } from '../ui/controls';
import type { Disposer, ExtensionFactory, RendererContext, SourceHandle } from '../types';
import { bounded, loadMermaid, type MermaidRenderer } from '../mermaid-runtime';
import { diagramFor, diagrams, genericSnippets } from './mermaid-snippets';
import { mermaidHighlighter } from './mermaid-language';
import { renderTokens } from './highlight-tokens';
export { loadMermaid } from '../mermaid-runtime';
export type { MermaidRenderContext, MermaidRenderer } from '../mermaid-runtime';
export interface MermaidConfig {
  renderer?: MermaidRenderer;
  source?: string;
  maxCharacters?: number;
  maxLines?: number;
}
let sequence = 0;

function safeSvg(document: Document, source: string): SVGElement {
  if (source.length > 2_000_000) throw new Error('Rendered diagram exceeds the SVG limit.');
  const input = new DOMParser().parseFromString(source, 'image/svg+xml');
  const clean = DOMPurify.sanitize(new XMLSerializer().serializeToString(input.documentElement), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'a', 'image', 'use', 'animate', 'set'], ALLOW_DATA_ATTR: true });
  const parsed = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg' || parsed.querySelectorAll('*').length > 10000) throw new Error('Renderer returned invalid or oversized SVG.');
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGElement;
  const ids = new Set([svg, ...svg.querySelectorAll('[id]')].map(element => element.id));
  for (const element of [svg, ...svg.querySelectorAll('*')]) for (const attribute of [...element.attributes]) {
    if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    else if (/^(?:href|xlink:href)$/i.test(attribute.name)) {
      if (!attribute.value.startsWith('#') || !ids.has(attribute.value.slice(1))) element.removeAttribute(attribute.name);
    } else if (attribute.name !== 'style' && /url\s*\(/i.test(attribute.value)) {
      const match = attribute.value.match(/^url\(["']?#([^)'"\s]+)["']?\)$/);
      if (!match || !ids.has(match[1])) element.removeAttribute(attribute.name);
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg;
}

export const mermaidExtension: ExtensionFactory = () => ({
  init(instance, supplied, lifetime) {
    const t = (key: string) => instance.translate(key);
    const config = (supplied ?? {}) as MermaidConfig;
    if (typeof config !== 'object' || config === null) throw new TypeError('Mermaid config must be an object.');
    if ('asset' in config) throw new TypeError('Mermaid asset is no longer supported. Use source: URL string.');
    if (config.renderer && typeof config.renderer.render !== 'function') throw new TypeError('Mermaid renderer.render must be a function.');
    if (config.source !== undefined && (typeof config.source !== 'string' || !config.source.trim())) throw new TypeError('Mermaid source must be a nonempty URL string.');
    const characters = config.maxCharacters ?? 20000;
    const lines = config.maxLines ?? 500;
    if (!Number.isInteger(characters) || characters < 1 || characters > 20000 || !Number.isInteger(lines) || lines < 1 || lines > 500) throw new TypeError('Mermaid limits must be positive integers within 20000 characters and 500 lines.');
    const document = instance.element.ownerDocument;
    const disposers: Disposer[] = [];
    let source: SourceHandle | undefined;
    const previews = new Set<() => void>();
    const observer = new MutationObserver(() => previews.forEach(refresh => refresh()));
    observer.observe(instance.element, { attributes: true, attributeFilter: ['data-theme'] });
    const preview = (value: () => string, element: HTMLElement, context?: RendererContext, draft = false): Disposer => {
      element.classList.add('markian-diagram');
      element.contentEditable = 'false';
      const controls = document.createElement('div');
      controls.className = 'markian-floating markian-diagram-controls';
      controls.setAttribute('role', 'toolbar');
      controls.setAttribute('aria-label', t('MERMAID.CONTROLS'));
      const status = document.createElement('div');
      status.className = 'markian-diagram-status';
      status.setAttribute('role', 'status');
      const viewport = document.createElement('div');
      viewport.className = 'markian-diagram-viewport';
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'img');
      viewport.setAttribute('aria-label', t('MERMAID.DIAGRAM'));
      const canvas = document.createElement('div');
      canvas.className = 'markian-diagram-canvas';
      viewport.append(canvas);
      element.replaceChildren(controls, status, viewport);
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      let request: AbortController | undefined;
      let timer: ReturnType<typeof setTimeout>;
      let disposed = false;
      let drag: { id: number; x: number; y: number } | undefined;
      const transform = () => { canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`; };
      const zoom = (factor: number) => { scale = Math.max(0.2, Math.min(5, scale * factor)); transform(); };
      const button = (label: string, icon: string, action: () => void) => controls.append(commandButton(document, label, icon, action));
      if (context) button(t('MERMAID.EDIT'), 'visual', () => context.open('mermaid'));
      button(t('MERMAID.ZOOM_IN'), 'zoomIn', () => zoom(1.25));
      button(t('MERMAID.ZOOM_OUT'), 'zoomOut', () => zoom(0.8));
      button(t('MERMAID.RESET'), 'reset', () => { scale = 1; offsetX = offsetY = 0; transform(); });
      button(t('MERMAID.RETRY'), 'retry', () => refresh());
      if (context) {
        button(t('CODE.COPY'), 'copy', () => context.copy());
        const deletion = commandButton(document, t('CODE.DELETE'), 'delete', () => context.delete());
        deletion.dataset.markianBlockDelete = '';
        controls.append(deletion);
      }
      const refresh = () => {
        request?.abort();
        clearTimeout(timer);
        element.dataset.state = 'loading';
        status.textContent = t('MERMAID.LOADING');
        viewport.hidden = false;
        const current = new AbortController();
        request = current;
        timer = setTimeout(async () => {
          try {
            const text = value();
            bounded(text, characters, lines);
            const renderer = config.renderer ?? (config.source ? await loadMermaid(document, config.source) : undefined);
            if (!renderer) throw new Error(t('MERMAID.NOT_CONFIGURED'));
            if (disposed || current.signal.aborted) return;
            const id = `markian-diagram-${++sequence}`;
            const svg = await renderer.render({ source: text, id, theme: instance.element.dataset.theme === 'dark' ? 'dark' : 'light', signal: current.signal });
            if (disposed || current.signal.aborted) return;
            if (typeof svg !== 'string') throw new TypeError('Mermaid renderer must return an SVG string.');
            canvas.replaceChildren(safeSvg(document, svg));
            status.textContent = '';
            element.dataset.state = 'ready';
          } catch (error) {
            if (disposed || current.signal.aborted) return;
            status.textContent = error instanceof Error ? error.message : String(error);
            canvas.replaceChildren();
            viewport.hidden = true;
            element.dataset.state = 'error';
          }
        }, 120);
      };
      viewport.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') zoom(1.25);
        else if (event.key === '-') zoom(0.8);
        else if (event.key === 'Home') { scale = 1; offsetX = offsetY = 0; transform(); }
        else if (event.key === 'ArrowLeft') { offsetX -= 30; transform(); }
        else if (event.key === 'ArrowRight') { offsetX += 30; transform(); }
        else if (event.key === 'ArrowUp') { offsetY -= 30; transform(); }
        else if (event.key === 'ArrowDown') { offsetY += 30; transform(); }
        else return;
        event.preventDefault();
        event.stopPropagation();
      });
      viewport.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; viewport.setPointerCapture(event.pointerId); });
      viewport.addEventListener('pointermove', event => { if (!drag || drag.id !== event.pointerId) return; offsetX += event.clientX - drag.x; offsetY += event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY; transform(); });
      const release = () => { drag = undefined; };
      viewport.addEventListener('pointerup', release);
      viewport.addEventListener('pointercancel', release);
      viewport.addEventListener('wheel', event => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
      previews.add(refresh);
      const unsubscribe = draft ? instance.on('draft', refresh) : () => {};
      const stop = () => { if (disposed) return; disposed = true; request?.abort(); clearTimeout(timer); previews.delete(refresh); unsubscribe(); element.replaceChildren(); element.classList.remove('markian-diagram'); };
      lifetime.addEventListener('abort', stop, { once: true });
      refresh();
      return () => { lifetime.removeEventListener('abort', stop); stop(); };
    };
    try {
      disposers.push(instance.getViews().insert({ id: 'mermaid', mount({ element, session }) {
        if (!session) throw new Error('The Mermaid view requires a code-block session.');
        element.classList.add('markian-mermaid');
        const sidebar = document.createElement('aside');
        sidebar.className = 'markian-mermaid-snippets';
        sidebar.setAttribute('aria-label', t('MERMAID.SNIPPETS'));
        const code = document.createElement('div');
        code.className = 'markian-mermaid-source';
        const input = document.createElement('div');
        input.className = 'markian-mermaid-input';
        const highlightStatus = document.createElement('div');
        highlightStatus.className = 'markian-mermaid-highlight-status';
        highlightStatus.setAttribute('role', 'status');
        code.append(input, highlightStatus);
        const rendered = document.createElement('div');
        element.append(sidebar, code, rendered);
        let currentType: string | undefined;
        const updateSnippets = () => {
          const diagram = diagramFor(session.get());
          for (const type of diagrams) instance.element.querySelectorAll<HTMLButtonElement>(`[data-command="mermaid:type:${type.id}"]`).forEach(button => {
            button.setAttribute('aria-pressed', String(type.id === diagram?.id));
          });
          if (sidebar.childElementCount && currentType === diagram?.id) return;
          currentType = diagram?.id;
          const title = document.createElement('h2');
          title.textContent = instance.translate('MERMAID.SNIPPETS_TITLE', { type: diagram ? t(diagram.label) : 'Mermaid' });
          const hint = document.createElement('p');
          hint.textContent = t(diagram ? 'MERMAID.SNIPPETS_HINT' : 'MERMAID.CHOOSE_TYPE');
          sidebar.replaceChildren(title, hint);
          for (const group of diagram?.groups ?? genericSnippets) {
            const heading = document.createElement('h3');
            heading.textContent = t(group.label);
            sidebar.append(heading);
            for (const snippet of group.snippets) {
              const caption = t(snippet.label);
              const button = commandButton(document, instance.translate('MERMAID.INSERT_SNIPPET', { label: caption }), undefined, () => { void instance.execute('mermaid:snippet', snippet.code); });
              button.classList.add('markian-mermaid-snippet');
              button.disabled = instance.readOnly;
              button.title = `${caption}\n${snippet.code}`;
              const label = document.createElement('span');
              label.textContent = caption;
              const fragment = document.createElement('code');
              renderTokens(fragment, snippet.code, mermaidHighlighter.highlight(snippet.code));
              button.replaceChildren(label, fragment);
              sidebar.append(button);
            }
          }
        };
        let highlightTimer: ReturnType<typeof setTimeout>;
        let disposed = false;
        const refreshHighlight = () => {
          if (disposed || lifetime.aborted) return;
          clearTimeout(highlightTimer);
          highlightTimer = setTimeout(() => {
            if (disposed || lifetime.aborted) return;
            try {
              const text = activeSource.get();
              if (text.length > characters || text.split('\n').length > lines) throw new Error(t('CODE.LIMIT'));
              activeSource.setHighlights(mermaidHighlighter.highlight(text));
              highlightStatus.textContent = '';
            } catch (error) {
              activeSource.setHighlights([]);
              highlightStatus.textContent = error instanceof Error ? error.message : String(error);
            }
          }, 100);
        };
        source = instance.createSourceEditor(input, session.get(), value => { session.set(value); refreshHighlight(); }, { label: t('MERMAID.SOURCE') });
        const activeSource = source;
        refreshHighlight();
        updateSnippets();
        const unsubscribe = instance.on('draft', updateSnippets);
        const dispose = preview(() => session.get(), rendered, undefined, true);
        return () => { disposed = true; clearTimeout(highlightTimer); unsubscribe(); dispose(); activeSource.destroy(); if (source === activeSource) source = undefined; };
      }, focus: () => source?.focus(), resize: () => source?.resize(), setReadOnly: value => {
        source?.setReadOnly(value);
        instance.element.querySelectorAll<HTMLButtonElement>('.markian-mermaid-snippet').forEach(button => { button.disabled = value; });
      } }));
      disposers.push(instance.getRenderers().insert({ id: 'mermaid', language: 'mermaid', visual: true, render: (code, element, context) => preview(() => code, element, context) }));
      disposers.push(instance.getCommands().insert({ id: 'mermaid:insert', label: t('MERMAID.INSERT'), icon: 'diagram', views: ['visual'], mutates: true, run: () => instance.insertCodeBlock('flowchart LR\n  A[Start] --> B[Finish]', 'mermaid') }));
      disposers.push(instance.getToolbar().insert({ id: 'mermaid:insert', command: 'mermaid:insert' }, 'insert', 'rule'));
      disposers.push(instance.getCommands().insert({
        id: 'mermaid:snippet', label: t('MERMAID.SNIPPET_COMMAND'), views: ['mermaid'], mutates: true,
        run: (_, value) => {
          if (typeof value !== 'string') throw new TypeError('Diagram snippets must be source text.');
          if (!source) throw new Error('The Mermaid source editor is not available.');
          source.replaceSelection(value);
          source.focus();
        },
      }));
      for (const diagram of diagrams) disposers.push(instance.getCommands().insert({
        id: `mermaid:type:${diagram.id}`, label: t(diagram.label), icon: 'diagram', views: ['mermaid'], mutates: true,
        hint: instance.translate('MERMAID.TEMPLATE_HINT', { type: t(diagram.label) }),
        active: () => diagramFor(source?.get() ?? '')?.id === diagram.id,
        run: () => {
          if (!source) throw new Error('The Mermaid source editor is not available.');
          source.select(0, source.get().length);
          source.replaceSelection(diagram.template);
          source.focus();
        },
      }));
      disposers.push(instance.getToolbar().insert({
        id: 'mermaid:types', type: 'menu', label: t('MERMAID.TYPE'), icon: 'diagram',
        items: diagrams.map(diagram => `mermaid:type:${diagram.id}`),
      }, 'insert'));
      for (const id of ['undo', 'redo', 'indent', 'outdent'] as const) {
        disposers.push(instance.getCommands().insert({ id: `mermaid:${id}`, label: t(`${id === 'undo' || id === 'redo' ? 'TOOLBAR' : 'CODE'}.${id.toUpperCase()}`), icon: id, mutates: true, views: ['mermaid'], run: () => { if (id === 'indent' || id === 'outdent') source?.indent(id === 'outdent'); else source?.[id](); } }));
        disposers.push(instance.getToolbar().insert({ id: `mermaid:${id}`, command: `mermaid:${id}` }, id === 'undo' || id === 'redo' ? 'history' : 'format', id));
      }
      disposers.push(instance.getHelp().insert({ id: 'mermaid', markdown: t('HELP.MERMAID') }));
    } catch (error) { observer.disconnect(); disposers.reverse().forEach(dispose => dispose()); throw error; }
    return () => { observer.disconnect(); previews.clear(); disposers.reverse().forEach(dispose => dispose()); };
  },
});