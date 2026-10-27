import type { RootContent } from 'mdast';
import type { Attrs, NodeSpec, Node as ProseNode } from 'prosemirror-model';
export type Mode = 'visual' | 'raw';
export type Theme = 'light' | 'dark';
export type Disposer = () => void;
export type EventName = 'change' | 'ready' | 'mode' | 'focus' | 'blur' | 'error' | 'save-request';
export interface EditorEvent {
    instance: MarkianInstance;
    origin: string;
    revision: number;
    view: string;
    error?: Error;
}
export interface SetOptions {
    origin?: string;
    resetHistory?: boolean;
    pending?: 'reject' | 'discard' | 'commit';
}
export interface CommandDefinition {
    id: string;
    label: string;
    icon?: string;
    views: readonly string[];
    mutates?: boolean;
    run(instance: MarkianInstance, payload?: unknown): void | Promise<void>;
}
export interface ToolbarItem {
    id: string;
    command: string;
}
export interface Registry<T extends {
    id: string;
}> {
    insert(item: T, before?: string): Disposer;
    items(): readonly T[];
}
export interface StructuralNode {
    id: string;
    schema: NodeSpec;
    fromMarkdown(node: RootContent): Attrs | null;
    toMarkdown(node: ProseNode): RootContent;
}
export interface BlockTarget {
    from: number;
    to: number;
    language: string;
    value: string;
    revision: number;
}
export interface BlockSession {
    get(): string;
    set(value: string): void;
    readonly target: BlockTarget;
}
export interface ViewContext {
    element: HTMLElement;
    signal: AbortSignal;
    session?: BlockSession;
}
export interface ViewDefinition {
    id: string;
    mount(context: ViewContext): Disposer;
    focus?(): void;
    resize?(): void;
    setReadOnly?(value: boolean): void;
}
export interface RendererDefinition {
    id: string;
    language: string;
    render(code: string, element: HTMLElement): Disposer;
}
export interface SourceHandle {
    get(): string;
    undo(): void;
    redo(): void;
    focus(): void;
    resize(): void;
    setReadOnly(value: boolean): void;
    destroy(): void;
}
export interface Extension {
    init(instance: MarkianInstance, config: unknown, signal: AbortSignal): Disposer | Promise<Disposer>;
}
export type ExtensionFactory = () => Extension;
export interface EditorOptions {
    markdown: string;
    initialMode?: Mode;
    theme?: Theme;
    readOnly?: boolean;
    disabled?: boolean;
    softbreaks?: boolean;
    label?: string;
    extensions?: Record<string, {
        enabled?: boolean;
        config?: unknown;
    }>;
}
export interface MarkianInstance {
    readonly ready: Promise<void>;
    readonly element: HTMLElement;
    readonly revision: number;
    readonly activeView: string;
    readonly readOnly: boolean;
    get(): string;
    set(markdown: string, options?: SetOptions): void;
    execute(id: string, payload?: unknown): Promise<boolean>;
    setMode(mode: Mode): void;
    setTheme(theme: Theme): void;
    setReadOnly(value: boolean): void;
    setDisabled(value: boolean): void;
    on(event: EventName, callback: (event: EditorEvent) => void): Disposer;
    getCommands(): Registry<CommandDefinition>;
    getToolbar(): Registry<ToolbarItem>;
    getViews(): Registry<ViewDefinition>;
    getRenderers(): Registry<RendererDefinition>;
    getSchema(): Registry<StructuralNode>;
    createSourceEditor(element: HTMLElement, value: string, changed: (value: string) => void): SourceHandle;
    getCodeTarget(): BlockTarget | null;
    openView(id: string, target?: BlockTarget): void;
    back(): void;
    focus(): void;
    resize(): void;
    destroy(): void;
}
