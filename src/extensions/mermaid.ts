import DOMPurify from 'dompurify';
import './mermaid.css';
import { commandButton } from '../ui/controls';
import type { Disposer, ExtensionFactory, SourceHandle } from '../types';
import { bounded, loadMermaid, version, type MermaidRenderer } from '../render/mermaid-runtime';
export { loadMermaid } from '../render/mermaid-runtime';
export type { MermaidRenderContext, MermaidRenderer } from '../render/mermaid-runtime';
export interface MermaidConfig {
  renderer?: MermaidRenderer;
  asset?: { url: string; version: string };
  maxCharacters?: number;
  maxLines?: number;
}
let sequence = 0;

function safeSvg(document: Document, source: string, prefix: string): SVGElement {
  if (source.length > 2_000_000) throw new Error('Rendered diagram exceeds the SVG limit.');
  const input = new DOMParser().parseFromString(source, 'image/svg+xml');
  for (const element of input.querySelectorAll<SVGElement>('[style]')) {
    const anchor = element.style.getPropertyValue('text-anchor').trim();
    if (['start', 'middle', 'end'].includes(anchor)) element.setAttribute('text-anchor', anchor);
  }
  const clean = DOMPurify.sanitize(new XMLSerializer().serializeToString(input.documentElement), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'a', 'image', 'style', 'animate', 'set'], FORBID_ATTR: ['style'], ALLOW_DATA_ATTR: false });
  const parsed = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg' || parsed.querySelectorAll('*').length > 10000) throw new Error('Renderer returned invalid or oversized SVG.');
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGElement;
  const ids = new Map<string, string>();
  for (const element of [svg, ...svg.querySelectorAll<SVGElement>('*')]) if (element.id) { ids.set(element.id, `${prefix}-${ids.size}`); element.id = ids.get(element.id)!; }
  for (const element of [svg, ...svg.querySelectorAll('*')]) for (const attribute of [...element.attributes]) {
    if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    else if (/^(?:href|xlink:href)$/i.test(attribute.name)) {
      const target = ids.get(attribute.value.slice(1));
      if (attribute.value.startsWith('#') && target) element.setAttribute(attribute.name, `#${target}`);
      else element.removeAttribute(attribute.name);
    } else if (attribute.value.includes('url(')) {
      const match = attribute.value.match(/^url\(["']?#([^)'"\s]+)["']?\)$/);
      const target = match && ids.get(match[1]);
      if (target) element.setAttribute(attribute.name, `url(#${target})`);
      else element.removeAttribute(attribute.name);
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg;
}

export const mermaidExtension: ExtensionFactory = () => ({
  init(instance, supplied, lifetime) {
    const config = (supplied ?? {}) as MermaidConfig;
    if (typeof config !== 'object' || config === null) throw new TypeError('Mermaid config must be an object.');
    if (config.renderer) { version(config.renderer.version); if (typeof config.renderer.render !== 'function') throw new TypeError('Mermaid renderer.render must be a function.'); }
    if (config.asset) { version(config.asset.version); if (typeof config.asset.url !== 'string') throw new TypeError('Mermaid asset.url must be a string.'); }
    const characters = config.maxCharacters ?? 20000;
    const lines = config.maxLines ?? 500;
    if (!Number.isInteger(characters) || characters < 1 || characters > 20000 || !Number.isInteger(lines) || lines < 1 || lines > 500) throw new TypeError('Mermaid limits must be positive integers within 20000 characters and 500 lines.');
    const document = instance.element.ownerDocument;
    const disposers: Disposer[] = [];
    let source: SourceHandle | undefined;
    const previews = new Set<() => void>();
    const observer = new MutationObserver(() => previews.forEach(refresh => refresh()));
    observer.observe(instance.element, { attributes: true, attributeFilter: ['data-theme'] });
    const preview = (value: () => string, element: HTMLElement, open?: () => void, draft = false): Disposer => {
      element.classList.add('markian-diagram');
      element.contentEditable = 'false';
      const controls = document.createElement('div');
      controls.className = 'markian-floating markian-diagram-controls';
      controls.setAttribute('role', 'toolbar');
      controls.setAttribute('aria-label', 'Diagram controls');
      const status = document.createElement('div');
      status.className = 'markian-diagram-status';
      status.setAttribute('role', 'status');
      const viewport = document.createElement('div');
      viewport.className = 'markian-diagram-viewport';
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'img');
      viewport.setAttribute('aria-label', 'Mermaid diagram. Arrow keys pan; plus and minus zoom; Home resets.');
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
      if (open) button('Edit diagram', 'visual', open);
      button('Zoom in', 'zoomIn', () => zoom(1.25));
      button('Zoom out', 'zoomOut', () => zoom(0.8));
      button('Reset diagram view', 'reset', () => { scale = 1; offsetX = offsetY = 0; transform(); });
      button('Retry diagram', 'retry', () => refresh());
      const refresh = () => {
        request?.abort();
        clearTimeout(timer);
        element.dataset.state = 'loading';
        status.textContent = 'Rendering diagram...';
        viewport.hidden = false;
        canvas.replaceChildren();
        const current = new AbortController();
        request = current;
        timer = setTimeout(async () => {
          try {
            const text = value();
            bounded(text, characters, lines);
            const renderer = config.renderer ?? (config.asset ? await loadMermaid(document, config.asset) : undefined);
            if (!renderer) throw new Error('Mermaid URL is not configured. Set extensions.mermaid.config.asset.url.');
            if (disposed || current.signal.aborted) return;
            const id = `markian-diagram-${++sequence}`;
            const svg = await renderer.render({ source: text, id, theme: instance.element.dataset.theme === 'dark' ? 'dark' : 'light', signal: current.signal });
            if (disposed || current.signal.aborted) return;
            if (typeof svg !== 'string') throw new TypeError('Mermaid renderer must return an SVG string.');
            canvas.replaceChildren(safeSvg(document, svg, id));
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
        const code = document.createElement('div');
        code.className = 'markian-mermaid-source';
        const rendered = document.createElement('div');
        element.append(code, rendered);
        source = instance.createSourceEditor(code, session.get(), value => session.set(value));
        const dispose = preview(() => session.get(), rendered, undefined, true);
        return () => { dispose(); source?.destroy(); source = undefined; };
      }, focus: () => source?.focus(), resize: () => source?.resize(), setReadOnly: value => source?.setReadOnly(value) }));
      disposers.push(instance.getRenderers().insert({ id: 'mermaid', language: 'mermaid', visual: true, render: (code, element, context) => preview(() => code, element, context ? () => context.open('mermaid') : undefined) }));
      disposers.push(instance.getCommands().insert({ id: 'mermaid:insert', label: 'Insert diagram', icon: 'diagram', views: ['visual'], mutates: true, run: () => instance.insertCodeBlock('flowchart LR\n  A[Start] --> B[Finish]', 'mermaid') }));
      disposers.push(instance.getToolbar().insert({ id: 'mermaid:insert', command: 'mermaid:insert' }, 'insert', 'rule'));
      for (const id of ['undo', 'redo', 'indent', 'outdent'] as const) {
        disposers.push(instance.getCommands().insert({ id: `mermaid:${id}`, label: { undo: 'Undo', redo: 'Redo', indent: 'Indent', outdent: 'Outdent' }[id], icon: id, mutates: true, views: ['mermaid'], run: () => { if (id === 'indent' || id === 'outdent') source?.indent(id === 'outdent'); else source?.[id](); } }));
        disposers.push(instance.getToolbar().insert({ id: `mermaid:${id}`, command: `mermaid:${id}` }, id === 'undo' || id === 'redo' ? 'history' : 'format', id));
      }
      disposers.push(instance.getHelp().insert({ id: 'mermaid', markdown: '\n## Mermaid diagrams\n\nUse Insert diagram or Edit diagram to open the code/preview workspace. Back applies the draft as one document edit. Source drafts are included in saved Markdown before Back. Undo/redo and indentation affect the diagram session. Press Escape then Tab to leave source Tab handling. Diagram arrow keys pan, plus/minus zoom, and Home resets; pointer dragging and zoom buttons also work when read-only. Syntax errors retain the ordinary Mermaid fence.\n' }));
    } catch (error) { observer.disconnect(); disposers.reverse().forEach(dispose => dispose()); throw error; }
    return () => { observer.disconnect(); previews.clear(); disposers.reverse().forEach(dispose => dispose()); };
  },
});