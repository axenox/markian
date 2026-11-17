/** Portable Mermaid templates and literal source fragments for the block workspace. */
interface Snippet {
    label: string;
    code: string;
}
interface SnippetGroup {
    label: string;
    snippets: readonly Snippet[];
}
interface Diagram {
    id: string;
    label: string;
    template: string;
    groups: readonly SnippetGroup[];
}
export declare const diagrams: readonly Diagram[];
/** Reads the declaration, leaving unsupported or unfinished source untouched. */
export declare function diagramFor(source: string): Diagram | undefined;
export declare const genericSnippets: readonly SnippetGroup[];
export {};
