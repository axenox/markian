/** Shared space-based tab stops for native code blocks and source workspaces. */
export interface IndentationChange {
    from: number;
    to: number;
    insert: string;
}
/** Expands only incoming tabs, preserving their alignment at configured tab stops. */
export declare function expandTabs(text: string, width: number, column?: number): string;
/** Computes VS Code-style tab insertion or selected-line indentation without changing other text. */
export declare function indentationChanges(text: string, from: number, to: number, width: number, outdent?: boolean, linewise?: boolean): IndentationChange[];
