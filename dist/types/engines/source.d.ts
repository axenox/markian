import { EditorView } from '@codemirror/view';
export declare class SourceEditor {
    readonly view: EditorView;
    private permissions;
    constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void);
    get(): string;
    undo(): void;
    redo(): void;
    setReadOnly(value: boolean): void;
    focus(): void;
    destroy(): void;
}
