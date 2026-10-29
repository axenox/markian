import { headings } from './render/markdown';
import './viewer.css';
export { headings };
export type { Heading } from './render/markdown';
export interface ViewerContext {
    markdown: string;
    revision: number;
    signal: AbortSignal;
    theme: 'light' | 'dark';
    documentBase: string;
}
export interface ViewerResourceContext extends ViewerContext {
    destination: string;
    kind: 'link' | 'image';
}
export interface ViewerRendererContext extends ViewerContext {
    language: string;
    source: string;
}
export interface ViewerOptions {
    markdown?: string;
    theme?: 'light' | 'dark';
    markdownCssUrls?: readonly string[];
    markdownCssClasses?: readonly string[];
    softbreaks?: boolean;
    allowTextColors?: boolean;
    mermaid?: boolean;
    documentBase?: string;
    onResourceResolve?: (context: ViewerResourceContext) => string | null;
    onLinkOpen?: (context: ViewerResourceContext & {
        event: MouseEvent;
    }) => void;
    onError?: (error: Error) => void;
    renderers?: Readonly<Record<string, (context: ViewerRendererContext) => string | Promise<string>>>;
}
export interface Viewer {
    readonly element: HTMLElement;
    readonly ready: Promise<void>;
    get(): string;
    set(markdown: string): Promise<void>;
    setTheme(theme: 'light' | 'dark'): Promise<void>;
    destroy(): void;
}
export declare function create(host: HTMLElement, options?: ViewerOptions): Viewer;
