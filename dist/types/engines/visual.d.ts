import { type EditorView, type ProseNode } from './prose';
import type { StructuralNode, SearchOptions, SearchMatch } from '../types';
export interface VisualEngine {
    view: EditorView;
    parse(markdown: string): ProseNode;
    serialize(node: ProseNode): string;
    replace(markdown: string, reset: boolean): void;
    setReadOnly(value: boolean): void;
    search(options: SearchOptions): SearchMatch[];
    select(from: number, to?: number): void;
    replaceSearch(replacement: string, all?: boolean): void;
    destroy(): Promise<void>;
}
export declare function createVisual(element: HTMLElement, structures: readonly StructuralNode[], readOnly: () => boolean, changed: (markdown: string) => void, selectionChanged: () => void, documentBase?: string, allowTextColors?: boolean, renderCode?: (code: string, language: string, element: HTMLElement, position: () => number | undefined, topLevel: boolean) => (() => void) | undefined): Promise<VisualEngine>;
