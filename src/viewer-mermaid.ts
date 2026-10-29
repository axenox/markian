import { bounded, loadMermaid, version, type MermaidRenderer } from './render/mermaid-runtime';
import type { ViewerRendererContext } from './viewer';
import './render/mermaid.css';

export interface ViewerMermaidOptions {
  renderer?: MermaidRenderer;
  asset?: { url: string; version: string };
  maxCharacters?: number;
  maxLines?: number;
}

let sequence = 0;

export function createRenderer(document: Document, options: ViewerMermaidOptions): (context: ViewerRendererContext) => Promise<string> {
  if (!options || (!options.renderer && !options.asset)) throw new TypeError('Viewer Mermaid requires a supplied renderer or explicit asset URL/version.');
  if (options.renderer) {
    version(options.renderer.version);
    if (typeof options.renderer.render !== 'function') throw new TypeError('Mermaid renderer.render must be a function.');
  }
  if (options.asset) version(options.asset.version);
  const characters = options.maxCharacters ?? 20000;
  const lines = options.maxLines ?? 500;
  if (!Number.isInteger(characters) || characters < 1 || characters > 20000 || !Number.isInteger(lines) || lines < 1 || lines > 500) throw new TypeError('Mermaid limits must be within 20000 characters and 500 lines.');
  return async context => {
    bounded(context.source, characters, lines);
    if (context.signal.aborted) return '';
    const renderer = options.renderer ?? await loadMermaid(document, options.asset!);
    if (context.signal.aborted) return '';
    return renderer.render({ ...context, id: `markian-viewer-mermaid-${++sequence}` });
  };
}