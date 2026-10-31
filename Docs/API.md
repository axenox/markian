# API

Classic scripts expose browser globals. TypeScript declarations are generated under `dist/types`; callers do not need TypeScript or a build step. Options and callback fields are documented in [configuration](Configuration.md).

## Factories

| Function or property | Arguments | Return | Purpose |
| --- | --- | --- | --- |
| `Markian.create` | `host: HTMLElement, options: EditorOptions` | `MarkianInstance` | Mount on a `div` or `textarea`; only one editor per host. |
| `Markian.registerExtension` | `id: string, factory: ExtensionFactory` | `void` | Register trusted code before creating enabled instances. Duplicate/empty IDs throw. |
| `Markian.headings` | `markdown: string` | `Heading[]` | Parse heading anchors without mounting an editor. |
| `Markian.version` | None | `string` | Library version. |
| `MarkianViewer.create` | `host: HTMLElement, options?: ViewerOptions` | `Viewer` | Mount on a `div`, `section`, or `article`. Options default to `{}`. |
| `MarkianViewer.headings` | `markdown: string` | `Heading[]` | The same heading parser. |
| `MarkianMermaid.loadMermaid` | `document: Document, source: string` | `Promise<MermaidRenderer>` | Load the trusted script URL, check `initialize()`/`render()` and return its `{ render }` adapter. |
| `MarkianViewerMermaid.createRenderer` | `document: Document, options: ViewerMermaidOptions` | `(context: ViewerRendererContext) => Promise<string>` | Create an optional viewer fence renderer. |

`MarkianCode.codeExtension` and `MarkianMermaid.mermaidExtension` are `ExtensionFactory` values supplied by their optional scripts. Register them explicitly; they do not activate themselves.

`Heading` is `{ id: string, label: string, depth: number, line: number }`. Source lines are one-based; IDs are Unicode-aware and duplicate-safe. Parsing includes nested headings and excludes fenced-code contents.

## Editor Lifecycle

```javascript
const editor = Markian.create(host, { markdown: '# Notes' });
await editor.ready;
editor.focus();
```

Readiness waits for configured CSS, enabled extensions, and initial import. Initialization failure rejects and restores the host. A visual-preservation fallback instead resolves in Source view and reports an error. Catch `ready` rejection and surface it in the host UI.

| Read-only property | Type | Meaning |
| --- | --- | --- |
| `ready` | `Promise<void>` | Initial readiness, not a save gate for later work. |
| `element` | `HTMLElement` | Instance-owned root, not the original mount host. |
| `revision` | `number` | Current document revision. |
| `activeView` | `string` | Active ID, such as `visual`, `raw`, `preview`, `help`, `code`, or `mermaid`. |
| `readOnly` | `boolean` | Effective permission: true when either read-only or disabled is set. |

| Method | Return | Behavior |
| --- | --- | --- |
| `get()` | `string` | Complete current Markdown, including pending raw/block drafts under suspended views. |
| `set(markdown: string, options?: SetOptions)` | `void` | Replace under the policies below. |
| `execute(id: string, payload?: unknown)` | `Promise<boolean>` | True after execution; false for unsupported views, disabled commands, or forbidden mutations. Unknown IDs reject. |
| `setMode(mode: "visual" \| "raw")` | `void` | Switch document editing mode; return from specialized views first. |
| `setTheme(theme: "light" \| "dark")` | `void` | Change presentation without changing Markdown. |
| `setReadOnly(value: boolean)` | `void` | Change the read-only flag without discarding history/drafts. |
| `setDisabled(value: boolean)` | `void` | Change the independent disabled-editing flag. |
| `on(event: EventName, callback: (event: EditorEvent) => void)` | `Disposer` | Subscribe without replacing other listeners; call the result to unsubscribe. |
| `focus()` | `void` | Focus the active view. |
| `resize()` | `void` | Remeasure after host layout changes or revealing a hidden container. |
| `destroy()` | `void` | Cancel/release owned work, restore the host, and permit remounting. Safe twice. |

Await readiness before document operations, commands, search, or view navigation. Do not retain or use handles after destruction. `Disposer` means `() => void`.

### Document Replacement

```javascript
editor.set('# Loaded notes', {
  origin: 'host-load',
  resetHistory: true,
  pending: 'reject',
});
```

An identical projected value is a no-op, preserving selection/history and requiring no pending-work decision. A different value during any block session or a dirty raw draft requires an explicit `pending` option:

| Policy | Meaning |
| --- | --- |
| `reject` | Refuse replacement while that work is open. |
| `discard` | Discard pending work and apply the supplied replacement. |
| `commit` | Apply pending work through its normal boundary before the supplied replacement. This does not save it to host storage. |

`origin` defaults to `host-load`; `resetHistory` defaults to true for visual replacement. Visual import validates before replacement. Raw mode can retain unfinished Markdown. Returning changed Source to Visual creates one visual history step; an unchanged round trip adds none. Failed imports retain the draft.

Read-only/disabled state blocks user mutations, not trusted host `set()`. A changed read-only block draft cannot be committed with Back until unlocked; the host can explicitly discard it through replacement.

### Events

Subscribe with `editor.on(eventName, callback)`. Every callback receives an `EditorEvent` containing `{ instance, origin, revision, view, error?, tag? }`. Read the current Markdown with `event.instance.get()`; it is not included in the payload. The returned disposer unsubscribes that listener without affecting others.

| Event name | When it fires | What you can do with it |
| --- | --- | --- |
| `change` | The complete current Markdown changes, including host replacements and pending drafts. Identical values do not notify again. | Mark the host form as dirty, synchronize a preview or form field, or schedule autosave. Use `origin` to distinguish host loads from edits and `revision` to track the value being saved. |
| `draft` | A value change occurs while Source mode or a block editing session is active; it accompanies `change`. | Update draft indicators or display the complete document with pending edits using `get()`. Do not also save the same edit from both `change` and `draft`. |
| `ready` | Initialization completes, including a preservation fallback to Source. | Enable host controls or perform initial setup. For reliable initialization sequencing, await `editor.ready` instead: a late listener misses this event, and initialization failure rejects the promise. |
| `mode` | Document editing mode changes, or a specialized view opens or closes. | Update host view selectors, show view-specific controls, or track navigation using `view`. Navigation itself is not a content change. |
| `focus` | Focus enters an element inside the editor, including moves between its internal controls. | Identify the active editor, show host editing controls, or update contextual UI. This is not limited to focus entering the whole editor from outside. |
| `blur` | Focus leaves the editor rather than moving to another internal control. | Hide host contextual UI or trigger host validation. It is not a save-completion or idle signal. |
| `error` | Markian reports an error, including a synchronous exception thrown by a non-error listener. The payload supplies `error: Error`. | Show an application notification or log diagnostic details with the current view and revision. Catch `editor.ready` rejection separately for initialization failures. |
| `save-request` | Ctrl/Cmd+S is pressed inside the editor; Markian prevents the browser's default save action. | Run the host's save workflow: await `whenIdle()`, read `get()`, then persist it. Markian does not save to storage or serialize the host's requests. |
| `tag-click` | A recognized tag is activated by pointer or keyboard. The payload supplies `tag: { rule, value, destination? }`. | Open a related record, navigate to a host destination, or show contextual details. It fires independently of the rule's `onClick`; choose one place for the same action to avoid running it twice. Neither notification changes content. |

Listeners are notifications, not cancellable hooks. They run synchronously; Markian does not await returned promises. Async listeners must handle their own rejected promises, and host saving must guard against subsequent edits during storage operations.

```javascript
const unsubscribe = editor.on('change', event => {
  console.log(event.origin, event.revision, editor.get());
});
editor.on('save-request', async () => {
  await editor.whenIdle();
  console.log(editor.get());
});
```

Change notifications describe value changes; draft notifications identify source/session editing. Committing an already reported draft must not duplicate content changes. Mode/navigation and presentation changes are not document edits. Use `ready` rather than a late subscription to wait for initialization. Ctrl/Cmd+S emits a save request; Markian does not persist the document.

### Textarea Hosts

The original textarea retains its name and form association. Its value follows active drafts synchronously. Native reset loads `defaultValue` and resets history. Pending/failed image insertion prevents native submission until resolved or explicitly removed; Markian does not automatically retry submission. The editor's disabled flag does not change native textarea disabled/submission behavior.

## Search and Images

| Method | Return | Behavior |
| --- | --- | --- |
| `search(options: SearchOptions)` | `readonly SearchMatch[]` | Literal view-scoped search; an empty query clears it. |
| `selectSearch(index: number)` | `void` | Select a match, wrapping the index through available results. |
| `replaceSearch(replacement: string, all?: boolean)` | `void` | Replace the current match, or all when true. No replacement in read-only or static Help/Preview. |
| `insertImage(blob: Blob)` | `Promise<void>` | Insert in editable Visual/Source using the built-in or host callback path. |
| `whenIdle()` | `Promise<void>` | Wait for current-document pending image operations and reject unresolved insertion failure. |

`SearchOptions` is `{ query: string, caseSensitive?: boolean, wholeWord?: boolean }`; flags default to false and query length is at most 1,000. `SearchMatch` is `{ from: number, to: number }` in the active engine's position system, not necessarily Markdown offsets. Visual search can cross inline marks within one text block, not opaque nodes; replacement inherits starting marks and replace-all is one undo step.

Raster input is PNG/JPEG/GIF/WebP up to 1,000,000 bytes. Only one insertion for the current document can be pending. Custom callbacks must return a persisted URL, not a blob/data URL. Failed or cancelled operations need retry or explicit removal.

```javascript
await editor.whenIdle();
const markdown = editor.get();
```

This is not a storage transaction. Hosts must handle subsequent edits during their own asynchronous save.

## Registries

| Accessor | Registry item |
| --- | --- |
| `getCommands()` | `CommandDefinition` |
| `getToolbar()` | `ToolbarItem` |
| `getViews()` | `ViewDefinition` |
| `getRenderers()` | `RendererDefinition` |
| `getSchema()` | `StructuralNode` |
| `getHelp()` | `{ id: string, markdown: string }` |

Each accessor returns its typed registry. Commands, views, renderers, schema, and Help use these methods:

| Method | Return | Behavior |
| --- | --- | --- |
| `insert(item: T, beforeId?: string)` | `Disposer` | Insert a unique ID, before an existing ID or at the end. Duplicate IDs/unknown ordering targets throw. |
| `items()` | `readonly T[]` | Inspect current registrations. |

Toolbar instead uses `insert(item: ToolbarItem, group?: string, beforeId?: string): Disposer`, `remove(id: string): Disposer`, and `items(): readonly ToolbarItem[]`. See [placement rules](Configuration.md#live-toolbar-insertion).

Toolbar removal applies only to the current instance: `remove(id)` recursively hides matching layout IDs without copying the default layout, modifying configured arrays or unregistering commands. Its disposer restores visibility once all removals for that ID are released, preserving other contributions. `items()` still returns registrations, not the filtered layout.

Returned disposers are idempotent and affect only their owned additions or removals, not unrelated host changes. Structural registration closes before engine construction.

### Contribution Types

| Type | Fields |
| --- | --- |
| `CommandDefinition` | Required `id`, `label`, `views: readonly string[]`, and `run(instance, payload?): void \| Promise<void>`; optional `icon` (built-in alias or sanitized SVG string), `hint` (tooltip), `swatch`, `mutates`, `enabled(instance): boolean`, and `active(instance): boolean`. `views: ["*"]` supports any view. |
| `ToolbarItem` | Required `id`; optional `command`, `label`, `icon`, `type`, `items`, `align`. See [toolbar fields](Configuration.md#toolbar). |
| `ViewDefinition` | Required `id` and `mount(context): Disposer`; optional `focus()`, `resize()`, and `setReadOnly(value)`, all returning void. |
| `RendererDefinition` | Required `id`, `language`, and `render(code: string, element: HTMLElement, context?): Disposer`; optional `visual: boolean` defaults to Preview-only behavior. Context can provide `open(view: string): void` for supported top-level targets. |
| `StructuralNode` | Required `id`, ProseMirror `schema: NodeSpec`, `fromMarkdown(node: RootContent): Attrs \| null`, and `toMarkdown(node: ProseNode): RootContent`. Current bridge supports atomic mappings over existing mdast types. |

`ViewContext` is `{ element: HTMLElement, signal: AbortSignal, session?: BlockSession }`. Extensions own rendering and must treat provider/document content as untrusted. See [writing extensions](Development/Writing_extensions.md) for initialization and cleanup rules.

Configured templates register `template:<id>` commands for Visual/Source and a `templates` menu. Use the same `execute()` and toolbar APIs as other commands. Mention insertion, details and host actions use rule-local configuration callbacks; see [templates and mentions](Configuration.md#templates-and-inline-html) for their exported types and result shapes.

## Views and Block Sessions

| Method | Return | Behavior |
| --- | --- | --- |
| `insertCodeBlock(value: string, language: string)` | `void` | Insert one undoable fence at the visual selection; requires editable Visual view. Language is 1-40 word/plus/minus characters. |
| `getCodeTarget()` | `BlockTarget \| null` | Current top-level code fence at the visual caret, or null. |
| `getActiveSession()` | `BlockSession \| null` | Current or suspended block draft. |
| `openView(id: string, target?: BlockTarget)` | `void` | Mount a registered view, optionally with a validated block session. Stale/conflicting/deleted targets throw. |
| `back()` | `void` | Restore the previous view; a changed block draft commits once. Without a view frame, returns raw mode to Visual. |
| `createSourceEditor(element: HTMLElement, value: string, changed: (value: string) => void)` | `SourceHandle` | Mount core CodeMirror inside the instance root. Intended for custom views. |

`BlockTarget` is `{ from, to, language, value, revision }`. Numeric `from`/`to` identify source offsets; obtain targets from Markian rather than inventing them. Only top-level fences currently support sessions.

`BlockSession` exposes readonly `target`, `get(): string`, and `set(value: string): void`. Setting requires the active editable block view. Help may suspend that session but cannot mutate it. The editor's `get()` projects the full document with its draft before commit. Conflicts retain drafts rather than overwriting changed documents.

### Source Handles

| Method | Return | Behavior |
| --- | --- | --- |
| `get()` | `string` | Current source text. |
| `search(options: SearchOptions)` | `readonly SearchMatch[]` | Search this source buffer. |
| `select(from: number, to?: number)` | `void` | Select source offsets; omitted end means a caret. |
| `replaceSearch(replacement: string, all?: boolean)` | `void` | Replace a selected match/all when active and editable. |
| `undo()` / `redo()` | `void` | Local history when active and editable. |
| `indent(outdent?: boolean)` | `void` | Indent, or outdent when true, when active and editable. |
| `focus()` / `resize()` | `void` | Focus or remeasure the source surface. |
| `setReadOnly(value: boolean)` | `void` | Local restriction; cannot override owner read-only state. |
| `destroy()` | `void` | Release the handle; safe twice. |

Hidden/suspended source handles cannot mutate through public editing operations. Destroy handles when their view unmounts.

## Extension Contract

`ExtensionFactory` is `() => Extension`. Each enabled instance receives a new extension. Its one required method is:

```typescript
init(instance: MarkianInstance, config: unknown, signal: AbortSignal): Disposer | Promise<Disposer>
```

Register construction-time schema contributions here. Return cleanup for owned additions and work. A partially failing initialization must clean up its own partial resources; previously completed extensions and editor resources are cleaned up by Markian. There are no current `getScripts`, `getStyles`, or separate extension-only mutation APIs.

## Viewer API

| Property or method | Return/type | Behavior |
| --- | --- | --- |
| `element` | `HTMLElement` | Instance root. |
| `ready` | `Promise<void>` | Initial optional rendering settled; renderer failures report and leave plain code. |
| `get()` | `string` | Exact supplied Markdown, not HTML or serialized editor output. |
| `set(markdown: string)` | `Promise<void>` | Render/validate replacement; identical values return the current render promise without rebuilding. |
| `setTheme(theme: "light" \| "dark")` | `Promise<void>` | Rerender presentation, including enabled adapters, without changing Markdown. |
| `destroy()` | `void` | Abort work and restore original child nodes/listeners; safe twice. |

Synchronous validation/resource-resolution failures throw and retain the prior document. Optional renderer failures call `onError` or log, retain plain code, and settle the render promise. Replacement, theme changes, and destruction abort obsolete work; late results cannot replace newer output even if a callback ignores cancellation. Other viewer methods reject use after destruction.

See [viewer callback fields and defaults](Configuration.md#viewer-options) and [renderer examples](Extensibility.md#viewer-renderers).