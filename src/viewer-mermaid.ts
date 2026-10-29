import { bounded, loadMermaid, type MermaidRenderer } from './render/mermaid-runtime';
import type { ViewerRendererContext } from './viewer';
import './render/mermaid.css';

export interface ViewerMermaidOptions {
  renderer?: MermaidRenderer;
  source?: string;
  maxCharacters?: number;
  maxLines?: number;
}

let sequence = 0;

export function createRenderer(document: Document, options: ViewerMermaidOptions): (context: ViewerRendererContext) => Promise<string> {
  if (!options || typeof options !== 'object') throw new TypeError('Viewer Mermaid requires a supplied renderer or source URL string.');
  if ('asset' in options) throw new TypeError('Mermaid asset is no longer supported. Use source: URL string.');
  if (!options.renderer && !options.source) throw new TypeError('Viewer Mermaid requires a supplied renderer or source URL string.');
  if (options.renderer) {
    if (typeof options.renderer.render !== 'function') throw new TypeError('Mermaid renderer.render must be a function.');
  }
  if (options.source !== undefined && (typeof options.source !== 'string' || !options.source.trim())) throw new TypeError('Mermaid source must be a nonempty URL string.');
  const characters = options.maxCharacters ?? 20000;
  const lines = options.maxLines ?? 500;
  if (!Number.isInteger(characters) || characters < 1 || characters > 20000 || !Number.isInteger(lines) || lines < 1 || lines > 500) throw new TypeError('Mermaid limits must be within 20000 characters and 500 lines.');
  return async context => {
    bounded(context.source, characters, lines);
    if (context.signal.aborted) return '';
    const renderer = options.renderer ?? await loadMermaid(document, options.source!);
    if (context.signal.aborted) return '';
    return renderer.render({ ...context, id: `markian-viewer-mermaid-${++sequence}` });
  };
}