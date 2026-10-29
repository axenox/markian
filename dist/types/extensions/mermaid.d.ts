import './mermaid.css';
import type { ExtensionFactory } from '../types';
import { type MermaidRenderer } from '../mermaid-runtime';
export { loadMermaid } from '../mermaid-runtime';
export type { MermaidRenderContext, MermaidRenderer } from '../mermaid-runtime';
export interface MermaidConfig {
    renderer?: MermaidRenderer;
    source?: string;
    maxCharacters?: number;
    maxLines?: number;
}
export declare const mermaidExtension: ExtensionFactory;
