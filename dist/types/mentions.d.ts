import type { EditorView } from './engines/prose';
import type { Disposer, EditorOptions, MarkianInstance, TagRule } from './types';
export interface TagMatch {
    from: number;
    to: number;
    value: string;
    rule: TagRule;
    destination?: string;
}
export declare function validateTags(rules?: readonly TagRule[]): void;
export declare function matchTags(text: string, rules: readonly TagRule[]): TagMatch[];
export declare function installMentions(instance: MarkianInstance, view: EditorView, options: EditorOptions, report: (error: unknown) => void, clicked: (match: TagMatch) => void): Disposer;
