import type { EditorOptions, ExtensionFactory, MarkianInstance } from './types';
export declare function registerExtension(id: string, factory: ExtensionFactory): void;
export declare function create(element: HTMLElement, options: EditorOptions): MarkianInstance;
export declare const version = "0.1.0";
export type * from './types';
