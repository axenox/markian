import type { Disposer, EditorOptions } from './types';
export declare function markdownClasses(classes?: readonly string[]): string[];
export declare function stylesheetUrls(options: Pick<EditorOptions, 'markdownCssUrls' | 'themeCssUrls'>, document: Document): string[];
export declare function loadStylesheets(element: HTMLElement, urls: readonly string[], signal: AbortSignal, own: (dispose: Disposer) => void): Promise<void>;
