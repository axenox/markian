import type { LanguageFn } from 'highlight.js';
import type { CodeHighlighter } from './code';
/** Packs expose syntax tokens, never an editing engine or executable document HTML. */
export declare function createHighlighter(language: string, grammar: LanguageFn): CodeHighlighter;
