import { EditorView } from '@codemirror/view';
import type { SearchMatch, SearchOptions } from '../types';
export declare class SourceEditor {
    readonly view: EditorView;
    private permissions;
    private query;
    constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void, selected?: () => void);
    get(): string;
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
