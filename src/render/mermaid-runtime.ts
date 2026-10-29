export interface MermaidRenderContext {
  source: string;
  id: string;
  theme: 'light' | 'dark';
  signal: AbortSignal;
}
export interface MermaidRenderer {
  render(context: MermaidRenderContext): string | Promise<string>;
}
interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string, container: HTMLElement): Promise<{ svg: string }>;
}
const loads = new WeakMap<Document, Map<string, Promise<MermaidRenderer>>>();

export function mermaidApi(value: unknown): MermaidApi {
  if (!value || typeof value !== 'object' || !('initialize' in value) || typeof value.initialize !== 'function'
    || !('render' in value) || typeof value.render !== 'function') {
    throw new TypeError('The configured Mermaid source must expose initialize() and render() functions.');
  }
  return value as MermaidApi;
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
    frame.title = 'Isolated Mermaid renderer';
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
      let api: MermaidApi;
      try { api = mermaidApi((frame.contentWindow as (Window & { mermaid?: unknown }) | null)?.mermaid); }
      catch (error) { failed(error instanceof Error ? error : new Error(String(error))); return; }
      let queue: Promise<unknown> = Promise.resolve();
      resolve({ render(context) {
        const operation = queue.then(async () => {
          if (context.signal.aborted) throw new Error('Mermaid rendering was cancelled.');
          api.initialize({ startOnLoad: false, securityLevel: 'strict', theme: context.theme === 'dark' ? 'dark' : 'default',
            maxTextSize: 20000, maxEdges: 500, htmlLabels: false, suppressErrorRendering: true });
          const container = local.createElement('div');
          local.body.append(container);
          try {
            const result = await api.render(context.id, context.source, container);
            if (!result || typeof result.svg !== 'string') throw new TypeError('Mermaid render() must return an object containing SVG text.');
            return result.svg;
          }
          finally { container.remove(); }
        });
        queue = operation.catch(() => {});
        return operation;
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