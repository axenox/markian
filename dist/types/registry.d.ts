import type { Disposer, Registry } from './types';
export declare class Items<T extends {
    id: string;
}> implements Registry<T> {
    private changed;
    private guard;
    private entries;
    constructor(changed?: () => void, guard?: () => void);
    insert(item: T, before?: string): Disposer;
    items(): readonly T[];
}
