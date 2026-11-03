import type { SearchMatch, SearchOptions } from '../types';
export declare class StaticSearch {
    private element;
    private marks;
    private matches;
    private nodes;
    constructor(element: HTMLElement);
    search(options: SearchOptions): SearchMatch[];
    /** Marks the current presentation match and reveals it in this view's scrollport. */
    select(from: number): void;
    replaceSearch(): void;
}
