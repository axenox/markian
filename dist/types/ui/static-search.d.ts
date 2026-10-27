import type { SearchMatch, SearchOptions } from '../types';
export declare class StaticSearch {
    private element;
    private marks;
    private matches;
    private nodes;
    constructor(element: HTMLElement);
    search(options: SearchOptions): SearchMatch[];
    select(from: number): void;
    replaceSearch(): void;
}
