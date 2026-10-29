import './mermaid.css';
import type { ExtensionFactory } from '../types';
import { type MermaidRenderer } from '../render/mermaid-runtime';
export { loadMermaid } from '../render/mermaid-runtime';
export type { MermaidRenderContext, MermaidRenderer } from '../render/mermaid-runtime';
export interface MermaidConfig {
    renderer?: MermaidRenderer;
    source?: string;
    maxCharacters?: number;
    maxLines?: number;
}
export declare const mermaidExtension: ExtensionFactory;
