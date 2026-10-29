export interface MermaidRenderContext {
    source: string;
    id: string;
    theme: 'light' | 'dark';
    signal: AbortSignal;
}
export interface MermaidRenderer {
    version: string;
    render(context: MermaidRenderContext): string | Promise<string>;
}
export declare function version(value: string): void;
export declare function loadMermaid(document: Document, asset: {
    url: string;
    version: string;
}): Promise<MermaidRenderer>;
export declare function bounded(source: string, characters: number, lines: number): void;
