# Markian Architecture

## Purpose and Status

Markian is a framework-independent Markdown editor and viewer intended for standalone use and embedding in host applications. Markdown is its public value and persistence format; rendered HTML and engine documents are internal representations.

This is a living document about internal structure, ownership, and engineering principles. Update it in the same change as any architectural change. Appearance and interaction patterns belong in the [style guide](Styleguide.md). Scope, acceptance criteria, packaging work, and migration sequencing belong in the [implementation plan](Requirements/Plan.md).

The repository currently contains an approved interaction prototype, not the completed reusable library. The plan defines the approved destination. Proposed API names below are contracts to implement, not a claim that they are exported today. Earlier alternatives in the [approach](Requirements/Approach.md) must be read in light of the later decisions in the plan.

## Current Implementation

| File | Responsibility |
| --- | --- |
| [main.js](../src/main.js) | Demonstration orchestration, visual/raw switching, active document value, toolbar dispatch, outlines, and specialized editing sessions. |
| [extensions.js](../src/extensions.js) | Markdown/editor extensions, hidden comment mappings, typing rules, and URL restrictions. |
| [source-commands.js](../src/source-commands.js) | CodeMirror source transformations and raw-mode command behavior. |
| [mermaid-view.js](../src/mermaid-view.js) | Diagram node presentation, asynchronous Mermaid rendering, and code/preview workspace support. |
| [style.css](../src/style.css) | Prototype shell, document typography, controls, themes, and responsive layouts. |
| [prototype.spec.js](../Tests/prototype.spec.js) | Browser-level interaction and regression coverage. |

The prototype uses Milkdown/ProseMirror for visual editing, CodeMirror for source editing, and selected Material Design Icons paths for controls. It still has page-global state, fixed demo elements, page-wide styles, and a single `window.Markian` handle. Its Mermaid loader imports a sibling Core asset. These are prototype constraints to remove, not library conventions to reproduce.

## Responsibility Boundaries

Extract responsibilities from the prototype without treating its current file boundaries as the final module layout. Do not invent a parallel framework when existing engine facilities provide the needed behavior.

| Responsibility | Owns | Does not own |
| --- | --- | --- |
| Public instance/controller | Lifecycle, configuration, document revisions, active view, events, and host-facing commands. | Host routing, storage, authentication, or global page state. |
| Markdown pipeline | Dialect, import/export, comment mappings, normalization, heading rules, and unsupported-input policy. | DOM scraping as a persistence mechanism. |
| Editing views | Engine state, local selection/history, view-specific commands, measurement, and disposal. | Competing authoritative copies of the active value. |
| Shared rendering | Viewer output, block rendering, sanitization, URL policy, and extension interpretation. | An editable engine instance merely to display a document. |
| UI and command registry | Toolbar/menu configuration, command availability, dialogs, focus, and accessible states. | Direct host framework dependencies. |
| Host adapters | Framework lifecycle/bindings, file I/O, provider transport, document URL base, and host layout integration. | Editor engine internals as their integration API. |

The target exposes `Markian.create(element, options)` and `Markian.createViewer(element, options)`. Each handle owns its documents, histories, selection, callbacks, URL base, theme, and pending work. Queries must be scoped to its root; IDs must not collide across instances. Shared immutable dependencies or safe loader promises are acceptable; singleton document state is not.

## Markdown Contract

- Persist ordinary interoperable Markdown, not editor JSON or rendered HTML. Normalization is allowed, but meaningful whitespace, code, comments, and generated bodies must survive.
- Use the agreed CommonMark/GFM subset and one documented import/export policy. Editor and viewer must share semantics and conformance fixtures, even when their DOM differs.
- Store extension delimiters and metadata as invisible HTML comments. Generated bodies remain independently readable Markdown. Unregistered extensions must not erase their markers or execute providers.
- Store Mermaid as ordinary fenced `mermaid` code, tags as ordinary text, and images as normal Markdown image syntax.
- Preserve unsupported content where possible or report it before replacing the loaded value. Never silently delete it to satisfy an engine schema.
- Treat Markdown and provider output as untrusted input. Capture comment data before display sanitization; disposable sanitized HTML must not determine the saved representation.

## Active Views and History

Only the active view is authoritative. Visual mode owns a ProseMirror document; raw mode owns a CodeMirror buffer; specialized Mermaid/code sessions own a draft with target identity and source revision. Do not continuously synchronize two authoritative editor models.

The controller must obtain the current value, command availability, selection, focus, measurement, and disposal behavior from the active view. `get()` includes visible raw and specialized drafts without hidden mode switches.

- Raw editing has local history. Returning changed source to visual mode is one undoable replacement; an unchanged round trip adds no edit. Validation failure retains the source buffer.
- Mermaid Back applies one changed parent-document update. An unchanged Back adds no history step. Invalid diagram syntax remains editable and serializes as a normal fence.
- Detect deleted targets and revision conflicts before applying drafts. Different host replacements need an explicit pending-workspace policy; stale drafts must not overwrite newer content.
- Emit content events for value changes, with origin and revision. Committing an already reported draft must not emit duplicate changes. Identical host echoes must not reset selection or history.
- Theme, resizing, fullscreen, and preview navigation are presentation changes, not document edits.

Visual startup is the default. Standalone callers may opt into raw startup; current Power UI and Codiware migrations always start visually.

## Configuration and Host Services

Keep declarative configuration JSON-serializable. Hosts combine it with trusted JavaScript functions when creating an instance; never evaluate function strings from documents or UXON.

General callbacks are flat `on<Subject><Action>` options, alphabetically grouped by subject: `onFullscreenEnter`, `onImageInsert`, `onImageSuggest`, `onLinkInspect`, `onLinkOpen`, `onLinkSuggest`, and `onPlaceholderRegenerate`. Tag-specific `onClick`, `onHover`, and `onSuggest` handlers belong directly on their `tags[]` entry. Do not introduce a nested `callbacks` object. The plan contains proposed configuration examples and result contracts.

Markian implements no AJAX/data transport, endpoint knowledge, credentials, or upload client. Callbacks can return local values or promises from host services. The library owns loading/error states, abort signals, and stale-result rejection; hosts own any actual request cancellation, authorization, and transport.

Image insertion uses bounded raster data URIs by default. Codiware instead supplies a callback that saves a file and returns an ordinary URL. Temporary previews and unresolved uploads must never become falsely successful saved content.

The library supplies built-in fullscreen behavior. `onFullscreenEnter` can replace it with host layout logic and must return a restore function, synchronously or asynchronously. Exit/destruction restores once; late obsolete entries are restored immediately. Host layout operations must not be hard-coded into the editor.

## Safety and Lifecycle

- Use established parsing, editing, and sanitization libraries. The prototype's URL restrictions and hidden HTML handling do not establish complete production sanitization.
- Apply explicit HTML, SVG, URL, and image policies to imported, pasted, rendered, and provider-supplied content. Loading a document must not execute placeholders or arbitrary code.
- Recheck revision, permissions, and instance lifetime after asynchronous work. Errors must be actionable without destroying the last valid document.
- Destruction cancels pending work and releases listeners, observers, engine views, overlays, and owned resources. It is idempotent and restores the original host.
- Textarea integration preserves form association, synchronizes the active value, and defines reset behavior. Read-only and disabled states must cover every command and provider entry point.

## Distribution and Integration

The target distribution is committed, deterministic JavaScript/CSS plus declarations, a manifest, and third-party notices. A classic script exposes the `window.Markian` factory; installation must not require Node.js, a consumer build, import maps, or implicit CDN/chunk loading. Package identities are `axenox/markian`, `markian`, and `npm-asset/markian`.

Bundle the baseline editing dependencies. Mermaid is an explicitly supplied renderer/adapter or configured loader, not a sibling Core filesystem dependency. Demo fonts, sample assets, masthead, and download controls are not library dependencies.

Host integrations use the public API. Core gains a separate `MarkianTrait`; the existing `ToastUIEditorTrait` remains unchanged and facades migrate independently. Do not bulk-rewrite stored documents or couple release schedules across hosts.

## Verification and Maintenance

Use the existing [package scripts](../package.json): `npm run dev`, `npm run build`, and `npm test`. Reuse focused cases in the browser suite for changed behavior. Add conformance, isolation, lifecycle, and distribution checks as those library responsibilities are implemented; do not report prototype checks as proof of unimplemented contracts.

Keep this document aligned with actual module ownership and approved boundaries. Mark planned versus implemented behavior explicitly as extraction proceeds. Update the plan when scope or sequencing changes, and the style guide when visual or interaction conventions change. Do not create a second competing architecture description.