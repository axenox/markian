/** Attribute-free inline HTML mappings; unsupported HTML remains opaque source. */
import type { Parent, PhrasingContent, Root } from 'mdast';
export type InlineHtmlTag = 'kbd' | 'sub' | 'sup' | 'mark';
export declare function validateInlineHtml(allowed?: readonly InlineHtmlTag[]): void;
export interface InlineHtml extends Parent {
    type: 'inlineHtml';
    tag: InlineHtmlTag;
    children: PhrasingContent[];
}
declare module 'mdast' {
    interface PhrasingContentMap {
        inlineHtml: InlineHtml;
    }
    interface RootContentMap {
        inlineHtml: InlineHtml;
    }
}
export declare function inlineHtmlSyntax(allowed: readonly InlineHtmlTag[]): () => (tree: Root) => void;
