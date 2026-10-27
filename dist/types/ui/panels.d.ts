import type { EditorOptions, MarkianInstance, Disposer } from '../types';
import type { EditorView } from '../engines/prose';
import type { SourceEditor } from '../engines/source';
export declare function searchPanel(instance: MarkianInstance, close: () => void, initial?: {
    query: string;
    caseSensitive: boolean;
    wholeWord: boolean;
}): HTMLElement;
export declare function destinationPanel(instance: MarkianInstance, options: EditorOptions, image: boolean, visual: EditorView, raw: SourceEditor | undefined, close: () => void): {
    element: HTMLElement;
    dispose: Disposer;
};
