import { type MermaidRenderer } from './mermaid-runtime';
import type { ViewerRendererContext } from './viewer';
import './render/mermaid.css';
export interface ViewerMermaidOptions {
    renderer?: MermaidRenderer;
    source?: string;
    maxCharacters?: number;
    maxLines?: number;
}
export declare function createRenderer(document: Document, options: ViewerMermaidOptions): (context: ViewerRendererContext) => Promise<string>;
