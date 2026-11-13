export interface MermaidRenderContext {
  source: string;
  id: string;
  theme: 'light' | 'dark';
  signal: AbortSignal;
}
export interface MermaidRenderer {
  render(context: MermaidRenderContext): string | Promise<string>;
}
interface PeleApi {
  render(source: string, options: { idPrefix: string; limit: number; outputLimit: number; maxEdges: number; links: boolean; images: boolean; autoDirection: boolean }): { svg: string };
}
const loads = new WeakMap<Document, Map<string, Promise<MermaidRenderer>>>();

function foldPeleNotes(source: string): string {
  if (source.length > 2_000_000) throw new Error('Rendered diagram exceeds the SVG limit.');
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Pele returned invalid SVG.');
  const notes = parsed.querySelectorAll('.pele .pele-note > rect, .pele .pele-shape-note > rect');
  if (!notes.length) return source;
  for (const rect of notes) {
    const x = Number(rect.getAttribute('x') ?? 0);
    const y = Number(rect.getAttribute('y') ?? 0);
    const width = Number(rect.getAttribute('width'));
    const height = Number(rect.getAttribute('height'));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Pele returned invalid note dimensions.');
    const right = x + width;
    const bottom = y + height;
    const fold = Math.min(10, width / 4, height / 4);
    const body = parsed.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (const attribute of rect.attributes) {
      if (!['x', 'y', 'width', 'height', 'rx', 'ry'].includes(attribute.name)) body.setAttribute(attribute.name, attribute.value);
    }
    body.setAttribute('d', `M${x},${y}H${right - fold}L${right},${y + fold}V${bottom}H${x}Z`);
    const corner = parsed.createElementNS('http://www.w3.org/2000/svg', 'path');
    corner.setAttribute('class', 'markian-diagram-note-fold');
    corner.setAttribute('d', `M${right - fold},${y}V${y + fold}H${right}Z`);
    corner.setAttribute('fill', 'var(--markian-diagram-note-fold)');
    corner.setAttribute('stroke', rect.getAttribute('stroke') ?? 'var(--_b)');
    rect.replaceWith(body, corner);
  }
  return new XMLSerializer().serializeToString(parsed.documentElement);
}

export function mermaidApi(value: unknown): PeleApi {
  if (!value || typeof value !== 'object' || !('render' in value) || typeof value.render !== 'function') {
    throw new TypeError('The configured diagram source must expose Pele render().');
  }
  return value as PeleApi;
}

export function loadMermaid(document: Document, source: string): Promise<MermaidRenderer> {
  if (typeof source !== 'string' || !source.trim()) return Promise.reject(new Error('Mermaid URL is not configured. Set extensions.mermaid.config.source.'));
  const url = new URL(source, document.baseURI);
  if (!['http:', 'https:'].includes(url.protocol)) return Promise.reject(new Error('Mermaid assets require an explicit HTTP(S) URL.'));
  let entries = loads.get(document);
  if (!entries) { entries = new Map(); loads.set(document, entries); }
  const existing = entries.get(url.href);
  if (existing) return existing;
  const promise = new Promise<MermaidRenderer>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.className = 'markian-mermaid-runtime';
    frame.title = 'Isolated Pele renderer';
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    Object.assign(frame.style, { position: 'fixed', left: '-20000px', top: '0', width: '1000px', height: '800px', visibility: 'hidden', pointerEvents: 'none' });
    document.body.append(frame);
    const local = frame.contentDocument!;
    const script = local.createElement('script');
    script.src = url.href;
    const timeout = setTimeout(() => failed(new Error('Mermaid asset loading timed out. Retry the diagram.')), 15000);
    const failed = (error: Error) => { clearTimeout(timeout); frame.remove(); entries!.delete(url.href); reject(error); };
    script.onerror = () => failed(new Error('Mermaid asset could not be loaded. Retry the diagram.'));
    script.onload = () => {
      clearTimeout(timeout);
      let api: PeleApi;
      try { api = mermaidApi((frame.contentWindow as (Window & { pele?: unknown }) | null)?.pele); }
      catch (error) { failed(error instanceof Error ? error : new Error(String(error))); return; }
      resolve({ render(context) {
        if (context.signal.aborted) throw new Error('Mermaid rendering was cancelled.');
        const result = api.render(context.source, { idPrefix: context.id, limit: 20000, outputLimit: 2_000_000,
          maxEdges: 500, links: false, images: false, autoDirection: false });
        if (!result || typeof result.svg !== 'string') throw new TypeError('Pele render() must return an object containing SVG text.');
        return foldPeleNotes(result.svg);
      } });
    };
    local.head.append(script);
  });
  entries.set(url.href, promise);
  return promise;
}

export function bounded(source: string, characters: number, lines: number): void {
  if (source.length > characters || source.split('\n').length > lines) throw new Error('Diagram exceeds the configured text/complexity limit.');
  if (/%%\s*\{|^\s*---|^\s*(?:click|link|href)\s|javascript\s*:|<\s*script\b/im.test(source)) throw new Error('Diagram configuration directives and executable links are not allowed.');
}