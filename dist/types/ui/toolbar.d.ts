import type { Disposer, ToolbarEntry, ToolbarItem, ToolbarRegistry } from '../types';
export declare const defaultToolbar: readonly ToolbarEntry[];
export declare function validateToolbar(entries: readonly ToolbarEntry[], depth?: number, ids?: Set<string>): void;
export declare class ToolbarItems implements ToolbarRegistry {
    private base;
    private changed;
    private guard;
    private registrations;
    private additions;
    private removals;
    constructor(base: () => readonly ToolbarEntry[], changed?: () => void, guard?: () => void);
    register(item: ToolbarItem): Disposer;
    insert(item: ToolbarItem, group?: string, beforeId?: string): Disposer;
    items(): readonly ToolbarItem[];
    remove(id: string): Disposer;
    layout(): ToolbarEntry[];
    private findContainer;
}
