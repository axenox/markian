import { type EditorView, type ProseNode } from './prose';
import type { StructuralNode } from '../types';
export interface VisualEngine {
    view: EditorView;
    parse(markdown: string): ProseNode;
    serialize(node: ProseNode): string;
    replace(markdown: string, reset: boolean): void;
    setReadOnly(value: boolean): void;
    destroy(): Promise<void>;
}
export declare function createVisual(element: HTMLElement, structures: readonly StructuralNode[], readOnly: () => boolean, changed: (markdown: string) => void): Promise<VisualEngine>;
