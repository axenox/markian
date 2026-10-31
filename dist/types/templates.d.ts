/** Literal template expansion and the bounded inline HTML policy shared with rendering. */
import type { InlineHtmlTag, TemplateDefinition } from './types';
import type { VisualEngine } from './engines/visual';
import type { SourceEditor } from './engines/source';
import type { EditorOptions, MarkianInstance } from './types';
export declare const inlineHtmlTags: readonly InlineHtmlTag[];
export declare function validateTemplates(templates?: readonly TemplateDefinition[], allowedHtml?: readonly InlineHtmlTag[]): void;
export declare function expandTemplate(markdown: string, selection: string, allowedHtml?: readonly InlineHtmlTag[]): {
    markdown: string;
    caret?: number;
};
export declare function installTemplates(instance: MarkianInstance, options: EditorOptions, visual: () => VisualEngine, raw: () => SourceEditor): void;
