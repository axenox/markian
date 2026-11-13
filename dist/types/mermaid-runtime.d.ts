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
    render(source: string, options: {
        idPrefix: string;
        limit: number;
        outputLimit: number;
        maxEdges: number;
        links: boolean;
        images: boolean;
        autoDirection: boolean;
    }): {
        svg: string;
    };
}
export declare function mermaidApi(value: unknown): PeleApi;
export declare function loadMermaid(document: Document, source: string): Promise<MermaidRenderer>;
export declare function bounded(source: string, characters: number, lines: number): void;
export {};
