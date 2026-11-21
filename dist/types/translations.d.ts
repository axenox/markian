import type { Disposer, TranslationDictionary, TranslationParameters, TranslationSource } from './types';
export declare class Translations {
    private base;
    private overrides;
    private extensions;
    readonly sources: readonly TranslationSource[];
    constructor(sources?: readonly TranslationSource[]);
    /** Fetch only configured static assets, with no credentials or application transport settings. */
    load(baseURI: string, signal: AbortSignal, fetchAsset?: typeof fetch): Promise<void>;
    /** Extension English defaults fill gaps below host overrides; collisions are errors. */
    register(defaults: TranslationDictionary): Disposer;
    translate(key: string, parameters?: TranslationParameters): string;
    label(value: string): string;
}
