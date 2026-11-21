/** Visual fence controls retain ProseMirror ownership of literal code and undoable language metadata. */
import { Plugin, type EditorView, type ProseNode } from './prose';
export declare const fenceDraftMeta = "markian-new-fence";
export declare function fencedCodeEditing(readOnly: () => boolean, tabWidth: number, rendered: WeakSet<Node>, translate: (key: string) => string): {
    plugin: Plugin<number | null>;
    nodeView: (initial: ProseNode, view: EditorView, getPos: () => number | undefined, render: (node: ProseNode, element: HTMLElement) => (() => void) | undefined) => {
        dom: HTMLPreElement;
        contentDOM: HTMLElement;
        update(updated: ProseNode): boolean;
        stopEvent: (event: Event) => boolean;
        ignoreMutation: (mutation: MutationRecord | {
            type: "selection";
            target: Node;
        }) => boolean;
        destroy(): void;
    };
};
