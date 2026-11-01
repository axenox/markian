import './code.css';
import type { ExtensionFactory, SourceToken } from '../types';
export interface CodeHighlighter {
    readonly apiVersion: 1;
    readonly version: string;
    readonly language: string;
    highlight(source: string): readonly SourceToken[] | Promise<readonly SourceToken[]>;
}
export interface CodeLanguage {
    id: string;
    label: string;
    aliases?: readonly string[];
    source?: string;
    highlighter?: CodeHighlighter;
}
export interface CodeConfig {
    tabWidth?: number;
    languageBase?: string;
    languages?: readonly CodeLanguage[];
    maxCharacters?: number;
    maxLines?: number;
}
export declare const supportedLanguages: ({
    id: string;
    label: string;
    aliases: string[];
} | {
    id: string;
    label: string;
    aliases?: undefined;
})[];
/** Compatible URLs are retained across instances; rejected loads can be retried. */
export declare function loadCodeLanguage(document: Document, language: CodeLanguage): Promise<CodeHighlighter>;
/** Optional syntax presentation uses the same public sessions and source engine as hosts. */
export declare const codeExtension: ExtensionFactory;
