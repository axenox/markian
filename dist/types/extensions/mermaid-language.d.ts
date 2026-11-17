/** Lexical Mermaid highlighting for editable drafts and standalone snippet fragments.
 * See ../../Docs/Development/Extensions/Mermaid_extension.md.
 */
import type { LanguageFn } from 'highlight.js';
export declare const mermaidGrammar: LanguageFn;
export declare const mermaidHighlighter: {
    apiVersion: 1;
    version: string;
    language: string;
    highlight(source: string): import("..").SourceToken[];
};
