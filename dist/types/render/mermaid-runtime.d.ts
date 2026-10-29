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
    render(id: string, source: string, container: HTMLElement): Promise<{
        svg: string;
    }>;
}
export declare function mermaidApi(value: unknown): MermaidApi;
export declare function loadMermaid(document: Document, source: string): Promise<MermaidRenderer>;
export declare function bounded(source: string, characters: number, lines: number): void;
export {};
