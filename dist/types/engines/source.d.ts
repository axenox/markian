import { EditorView } from '@codemirror/view';
import type { SearchMatch, SearchOptions, SourceOptions, SourceToken } from '../types';
export declare class SourceEditor {
    readonly view: EditorView;
    private permissions;
    private highlights;
    private query;
    constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void, selected?: () => void, options?: SourceOptions);
    get(): string;
    getLanguage(): string;
    setLanguage(language: string): void;
    setHighlights(tokens: readonly SourceToken[]): void;
    search(options: SearchOptions): SearchMatch[];
    select(from: number, to?: number): void;
    replaceSearch(replacement: string, all?: boolean): void;
    undo(): void;
    redo(): void;
    indent(outdent?: boolean): void;
    setReadOnly(value: boolean): void;
    focus(): void;
    destroy(): void;
}
