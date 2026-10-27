import type { EditorView } from './engines/prose';
import type { SourceEditor } from './engines/source';
import type { EditorOptions, MarkianInstance } from './types';
export declare function installEditing(instance: MarkianInstance, visual: () => EditorView, raw: () => SourceEditor, options: EditorOptions, destination: (image: boolean) => void): void;
