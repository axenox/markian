import type { LanguageFn } from 'highlight.js';
import type { SourceToken } from '../types';
/** Packs expose syntax tokens, never an editing engine or executable document HTML. */
export declare function createHighlighter(language: string, grammar: LanguageFn): {
    apiVersion: 1;
    version: string;
    language: string;
    highlight(source: string): SourceToken[];
};
