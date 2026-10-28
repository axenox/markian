import type { RootContent } from 'mdast';
import type { Attrs, NodeSpec, Node as ProseNode } from 'prosemirror-model';
export type Mode = 'visual' | 'raw';
export type Theme = 'light' | 'dark';
export type Disposer = () => void;
export type EventName = 'change' | 'draft' | 'ready' | 'mode' | 'focus' | 'blur' | 'error' | 'save-request';
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
    swatch?: string;
    views: readonly string[];
    mutates?: boolean;
    enabled?(instance: MarkianInstance): boolean;
    active?(instance: MarkianInstance): boolean;
    run(instance: MarkianInstance, payload?: unknown): void | Promise<void>;
}
export type ToolbarEntry = string | ToolbarItem;
export interface ToolbarItem {
    id: string;
    command?: string;
    label?: string;
    icon?: string;
    menu?: readonly ToolbarEntry[];
    separator?: boolean;
    overflow?: boolean;
    fixed?: boolean;
}
export interface SearchOptions {
    query: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
}
export interface SearchMatch {
    from: number;
    to: number;
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
    visual?: boolean;
    render(code: string, element: HTMLElement, context?: {
        open(view: string): void;
    }): Disposer;
}
export interface SourceHandle {
    get(): string;
    search(options: SearchOptions): readonly SearchMatch[];
    select(from: number, to?: number): void;
    replaceSearch(replacement: string, all?: boolean): void;
    undo(): void;
    redo(): void;
    indent(outdent?: boolean): void;
    focus(): void;
    resize(): void;
    setReadOnly(value: boolean): void;
    destroy(): void;
}
export interface Extension {
    init(instance: MarkianInstance, config: unknown, signal: AbortSignal): Disposer | Promise<Disposer>;
}
export type ExtensionFactory = () => Extension;
export interface ProviderContext {
    instance: MarkianInstance;
    query: string;
    documentBase?: string;
    revision: number;
    signal: AbortSignal;
}
export interface DestinationSuggestion {
    label: string;
    destination: string;
}
export interface LinkInspection {
    status: 'exists' | 'missing' | 'unknown';
    headings?: readonly {
        id: string;
        label: string;
    }[];
}
export interface ImageResult {
    destination: string;
    alt?: string;
}
export interface EditorOptions {
    markdown: string;
    initialMode?: Mode;
    sidebarVisible?: boolean;
    theme?: Theme;
    markdownCssUrls?: readonly string[];
    themeCssUrls?: readonly string[];
    readOnly?: boolean;
    disabled?: boolean;
    softbreaks?: boolean;
    label?: string;
    toolbar?: readonly ToolbarEntry[];
    floatingToolbar?: readonly string[];
    toolbarPlacement?: 'top' | 'bottom';
    documentBase?: string;
    allowTextColors?: boolean;
    textColors?: readonly string[];
    onImageResolve?(context: {
        destination: string;
    }): string;
    onLinkOpen?(context: ProviderContext & {
        destination: string;
    }): void | Promise<void>;
    onLinkSuggest?(context: ProviderContext): readonly DestinationSuggestion[] | Promise<readonly DestinationSuggestion[]>;
    onImageSuggest?(context: ProviderContext): readonly DestinationSuggestion[] | Promise<readonly DestinationSuggestion[]>;
    onLinkInspect?(context: ProviderContext & {
        destination: string;
    }): LinkInspection | Promise<LinkInspection>;
    onImageInsert?(context: ProviderContext & {
        blob: Blob;
    }): ImageResult | Promise<ImageResult>;
    onFullscreenEnter?(context: {
        instance: MarkianInstance;
        element: HTMLElement;
        signal: AbortSignal;
    }): Disposer | Promise<Disposer>;
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
    getHelp(): Registry<{
        id: string;
        markdown: string;
    }>;
    insertCodeBlock(value: string, language: string): void;
    createSourceEditor(element: HTMLElement, value: string, changed: (value: string) => void): SourceHandle;
    getCodeTarget(): BlockTarget | null;
    getActiveSession(): BlockSession | null;
    openView(id: string, target?: BlockTarget): void;
    back(): void;
    search(options: SearchOptions): readonly SearchMatch[];
    selectSearch(index: number): void;
    replaceSearch(replacement: string, all?: boolean): void;
    insertImage(blob: Blob): Promise<void>;
    whenIdle(): Promise<void>;
    focus(): void;
    resize(): void;
    destroy(): void;
}
