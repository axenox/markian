import type { ToolbarEntry } from '../types';
export declare const defaultToolbar: readonly ToolbarEntry[];
export declare function validateToolbar(entries: readonly ToolbarEntry[], depth?: number, ids?: Set<string>): void;
