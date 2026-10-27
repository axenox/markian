import './mermaid.css';
import type { ExtensionFactory, Theme } from '../types';
export interface MermaidRenderContext {
    source: string;
    id: string;
    theme: Theme;
    signal: AbortSignal;
}
export interface MermaidRenderer {
    version: string;
    render(context: MermaidRenderContext): string | Promise<string>;
}
export interface MermaidConfig {
    renderer?: MermaidRenderer;
    asset?: {
        url: string;
        version: string;
    };
    maxCharacters?: number;
    maxLines?: number;
}
export declare function loadMermaid(document: Document, asset: {
    url: string;
    version: string;
}): Promise<MermaidRenderer>;
export declare const mermaidExtension: ExtensionFactory;
