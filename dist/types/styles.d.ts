import type { Disposer, EditorOptions } from './types';
export declare function stylesheetUrls(options: EditorOptions, document: Document): string[];
export declare function loadStylesheets(element: HTMLElement, urls: readonly string[], signal: AbortSignal, own: (dispose: Disposer) => void): Promise<void>;
