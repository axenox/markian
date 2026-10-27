# Markian Architecture

## Purpose and Status

Markian is a framework-independent Markdown editor intended for standalone use and embedding in host applications. A separate lightweight viewer is planned in W16 after Codiware integration, superseding the earlier editor-only product decision. Disabled/read-only editors retain their nonmutating controls and are not the viewer implementation. Display-only Power UI widget adapters remain host-owned. Markdown is the public content format; rendered HTML and editor-engine documents are internal representations.

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
| Editor document and editing sessions | Complete document value, whole-document or targeted drafts, engine state, selections, and local history. | Replacing the document with whatever a view displays. |
| Views | Main-work-area presentation, toolbar/sidebar descriptions, available actions, focus, and measurement. | Independent document values or implicit draft commits on presentation changes. |
| Shared rendering and policy | Markdown-to-output pipeline, sanitization, URL/heading rules, block fallback, and content styles shared by editor Preview and W16 viewer. | Editor-engine imports, sessions/history, toolbar UI, host I/O, or widget bindings. |
| UI and command registry | Toolbar/menu configuration, command availability, dialogs, focus, and accessible states. | Direct host framework dependencies. |
| Host adapters | Framework lifecycle/bindings, file I/O, provider transport, document URL base, and host layout integration. | Editor engine internals as their integration API. |
| Visual engine adapter (planned, W1) | Milkdown editor creation, context/plugin registration, mdast-to-ProseMirror parsing and serialization, and teardown. The only module importing `@milkdown/*`. | Commands, node views, sessions, extensions, or public API, which use Markian-owned node definitions and plain ProseMirror APIs. |

Milkdown is a replaceable wiring layer; ProseMirror, remark/mdast, and CodeMirror are the long-term foundations. The target confines Milkdown to the visual engine adapter, imports ProseMirror through one internal re-export module, and enforces this with an import-graph check. Do not add an abstraction over ProseMirror itself. The current prototype still calls Milkdown directly from several modules.

The target exposes `Markian.create(element, options)` for editor instances, including disabled/read-only instances. Each handle owns its documents, histories, selection, callbacks, URL base, theme, and pending work. Queries must be scoped to its root; IDs must not collide across instances. Shared immutable dependencies or safe loader promises are acceptable; singleton document state is not.

## Markdown Contract

- Persist ordinary interoperable Markdown, not editor JSON or rendered HTML. Normalization is allowed, but meaningful whitespace, code, comments, and generated bodies must survive.
- Use the agreed CommonMark/GFM subset and one documented policy. Editor, Preview, and planned viewer share semantics/security fixtures and pure rendering policies, not necessarily identical DOM. Host display-widget adapters verify their own binding/lifecycle behavior.
- Store extension delimiters and metadata as invisible HTML comments. Generated bodies remain independently readable Markdown. Unregistered extensions must not erase their markers or execute providers.
- Store Mermaid as ordinary fenced `mermaid` code, mentions as ordinary text, and images as normal Markdown image syntax.
- Templates use a `markdown` string with optional `{{selection}}` substitution, including HTML stencils such as `<kbd>{{selection}}</kbd>`. Substitute selected text literally with context-safe escaping, never expression evaluation or recursive expansion; reject unsupported substitution contexts. Empty selections leave the caret at the placeholder, and insertion is one active-view undo step.
- Preserve unsupported content where possible or report it before replacing the loaded value. Never silently delete it to satisfy an engine schema.
- Treat Markdown and provider output as untrusted input. Capture comment data before display sanitization; disposable sanitized HTML must not determine the saved representation.

## Document, Editing Sessions, and Views

### Rendering Boundary for the Planned Viewer

Establish this boundary during W1-W3, before W16 implementation: Markdown parsing/rendering, sanitization, URL/heading policies, and scoped content typography/theme tokens must be importable without Milkdown/ProseMirror, CodeMirror, editor controllers, sessions, history, commands, or toolbars. Editor schema/engine adapters consume shared policies; shared modules never import those adapters. Check the dependency boundary with an import-graph check or minimal rendering fixture from extraction onward.

W16 follows W10's Codiware integration and delivers separate prebuilt `markian-viewer.min.js`, CSS, and declarations. It mounts rendered content directly, not a disabled editor. Keep the public lifecycle small; exact exports are W16 decisions and must coexist with editor globals. Separate entry points may embed shared source without requiring a runtime shared chunk; measure viewer/editor and combined costs before choosing further deduplication. No size reduction is established until the proof build is measured and accepted against a quantitative budget.

Viewer-only hosts load no editor script/CSS or engine runtime. Optional Mermaid/highlighting uses rendering-only capabilities, not the full editing extensions. Preserve safe plain-code and generated-body fallbacks without Core, automatic provider execution, or data transport. Hosts own display-widget adapters. Read-only editors keep their richer nonmutating controls and existing API independently of the viewer.

### Editor Sessions

**A view owns the visible main work area and its toolbar actions, not the editor's Markdown value.** The editor always exposes one complete document value. An editing session edits either that whole document or a specific target; a view presents a task using a session or modifies nothing at all. Do not create separate architectural categories of views merely because some edit content and others do not.

Visual editing uses a ProseMirror document; raw editing uses a CodeMirror buffer. Mermaid/expanded-code sessions own a draft for one code block, with stable target identity, source revision, selection, and local history. These sessions are independent of which view is currently visible. Do not continuously synchronize competing authoritative editor models.

The document controller projects the complete current Markdown from the document and its editing sessions. `get()` includes pending raw and specialized drafts even while Help or Preview is visible, without hidden mode switches or requiring a block session to commit first. Help text, preview HTML, and a standalone code-block draft must never replace the whole document value.

Views expose their available actions, toolbar/sidebar layout, focus, and measurement through the same public API used by applications and extensions. Commands route only to a supported session for the visible task; Help must not accidentally undo or replace text in a suspended editing session. The shell maintains common navigation, overflow, and fullscreen controls.

Opening Help from an unfinished Mermaid session suspends its presentation, not its draft or history. Back from Help restores the Mermaid view and selection without committing, discarding, or dirtying content. Back from Mermaid itself applies the block update under the existing session commit policy. Substantial tasks replace the main work area within the same editor shell rather than opening large dialogs; small menus and simple prompts may remain transient popups.

- Raw editing has local history. Returning changed source to visual mode is one undoable replacement; an unchanged round trip adds no edit. Validation failure retains the source buffer.
- Mermaid Back applies one changed parent-document update. An unchanged Back adds no history step. Invalid diagram syntax remains editable and serializes as a normal fence.
- Detect deleted targets and revision conflicts before applying drafts. Different host replacements need an explicit pending-workspace policy; stale drafts must not overwrite newer content.
- Emit content events for value changes, with origin and revision. Committing an already reported draft must not emit duplicate changes. Identical host echoes must not reset selection or history.
- Theme, resizing, fullscreen, and preview navigation are presentation changes, not document edits.

Visual startup is the default. Standalone callers may opt into raw startup; current Power UI and Codiware migrations always start visually.

## Configuration and Host Services

Keep declarative configuration JSON-serializable. Hosts combine it with trusted JavaScript functions when creating an instance; never evaluate function strings from documents or UXON.

Register trusted extension factories once with `Markian.registerExtension(id, factory)` before creating editors. Each instance activates registered IDs through `extensions: { id: { enabled: true, config: {} } }`; enabled factories create independent instance state. Registration alone creates no editor state or optional dependency loading. Omitted/disabled entries contribute nothing and load no optional dependencies for that instance; enabled unknown IDs are configuration errors. Load extension code explicitly outside instance configuration, without a `source` property. Mermaid renderer injection uses `extensions.mermaid.config.renderer`; any optional dependency loader belongs to that extension's documented configuration. These are proposed library contracts, not current prototype exports.

Applications, built-in extensions, and third-party extensions share one public instance API. Extensions package calls such as `markian.getToolbar().insert(...)`; they do not get a separate privileged customization API or access to private engine state. These calls change live instance state without overwriting user configuration or callbacks. Public methods define stable IDs, positioning, collision errors, explicit replacement rules, and removable owned additions. Notification subscriptions compose without replacing host handlers; exclusive overrides require an explicit operation and host authorization. Enforce permissions and lifecycle rules equally for all callers. Extension initialization returns cleanup; destruction and failed initialization release owned additions without undoing unrelated or newer host changes. See the [extension guide](Extensibility.md#one-public-api-for-applications-and-extensions) for the proposed example and detailed rules.

General callbacks are flat `on<Subject><Action>` options, alphabetically grouped by subject: `onFullscreenEnter`, `onImageInsert`, `onImageSuggest`, `onLinkInspect`, `onLinkOpen`, `onLinkSuggest`, and `onPlaceholderRegenerate`. Mention-specific `onClick`, `onHover`, and `onSuggest` handlers belong directly on their `tags[]` entry. Do not introduce a nested `callbacks` object. The plan contains proposed configuration examples and result contracts.

Initialization has a construction boundary: resolve enabled factories and required assets, collect and validate public structural contributions, then construct engines and import the initial document before readiness. Schema/parser/serializer registration closes before engine construction; reject late structural additions rather than rebuilding the editor silently. Live UI/view/renderer additions retain their documented runtime lifecycle, and optional language assets need not delay construction. Asynchronous initialization failure or destruction rolls back owned contributions and partial engine resources without undoing unrelated additions. Exact signatures remain W0/W1 work.

The first implementation proof is a minimal Code extension slice using only public commands, block rendering, and view/session operations, later reused by W14. Existing code fences do not prove new-schema registration; a focused construction-time mapping test remains required for that boundary. Templates and mentions remain core features using the same public customization operations, not privileged interfaces.

Markian implements no AJAX/data transport, endpoint knowledge, credentials, or upload client. Callbacks can return local values or promises from host services. The library owns loading/error states, abort signals, and stale-result rejection; hosts own any actual request cancellation, authorization, and transport.

Image insertion uses bounded raster data URIs by default. Codiware instead supplies a callback that saves a file and returns an ordinary URL. Temporary previews and unresolved uploads must never become falsely successful saved content.

The library supplies built-in fullscreen behavior. `onFullscreenEnter` can replace it with host layout logic and must return a restore function, synchronously or asynchronously. Exit/destruction restores once; late obsolete entries are restored immediately. Host layout operations must not be hard-coded into the editor.

## Safety and Lifecycle

- Use established parsing, editing, and sanitization libraries. The prototype's URL restrictions and hidden HTML handling do not establish complete production sanitization.
- Apply explicit HTML, SVG, URL, and image policies to imported, pasted, rendered, and provider-supplied content. Loading a document must not execute placeholders or arbitrary code.
- Recheck revision, permissions, and instance lifetime after asynchronous work. Errors must be actionable without destroying the last valid document.
- Destruction cancels pending work and releases listeners, observers, engine views, overlays, and owned resources. It is idempotent and restores the original host.
- Textarea integration preserves form association, synchronizes the active value, and defines reset behavior. In Markian, disabled means read-only editing, not an inert/unfocusable editor or an automatic change to native form-submission behavior.
- Both disabled/read-only entry points block user document changes across typing, paste/drop, raw/code drafts, undo/redo, replace, task toggles, insertion callbacks, and regeneration. Preserve search without replacement, selection, copying text or complete Markdown, safe navigation, Help, fullscreen, and diagram preview navigation. Recheck permissions before applying asynchronous results. State changes retain the document, pending drafts, and history without committing them; trusted host `set()` remains available under its explicit replacement policy.

## Distribution and Integration

The target distribution is committed, deterministic, prebuilt core and optional extension JavaScript/CSS plus declarations, a manifest, and third-party notices. The core classic script exposes the `window.Markian` factory; extension files supply factories for explicit registration. Installation must not require Node.js, a consumer build, import maps, or an implicit CDN dependency. Package identities are `axenox/markian`, `markian`, and `npm-asset/markian`. This modular contract replaces the earlier all-features/single-bundle requirement.

Keep ordinary Markdown editing, basic raw-source editing, parsing, sanitization, and core controls usable without optional extensions. A raw-source editing engine may be shared with the code extension, but programming-language packs and enhanced code highlighting/workspaces are optional assets, not mandatory core dependencies. Disabled extensions must not cause their optional dependencies to load, even when matching fences exist in a document; retain source and provide safe plain-code fallback.

Mermaid is an optional extension with a separately supplied renderer/adapter or configured dependency loader, not a sibling Core filesystem dependency or core-bundled library. Code highlighting and language packs follow the same modular policy. Explicitly enabled extensions may load declared prebuilt dependencies on demand through documented host-controlled URLs; forbid hidden bundler chunks or guessed CDN locations. Deduplicate compatible asset loads across instances while keeping extension state, callbacks, sessions, and teardown instance-local. Hosts may preload assets instead, including for offline/CSP-controlled deployments. Demo fonts, sample assets, masthead, and download controls are not library dependencies.

The distribution manifest records core/extension versions, declared assets/dependencies, and hashes. Build, publication, and committed-artifact checks cover the whole modular distribution, not just the core file. Test core-only startup with no Mermaid or programming-language highlighting requests, enabled extension loading/failure handling, and multi-instance deduplication. No size or speed improvement is claimed without measurement.

External extensions follow the same public contract but ship in their owning package, not necessarily Markian's distribution or manifest. ExFace/Power UI Core owns and supplies the planned prebuilt `docsPlaceholders` extension and DocsFacade grammar. The host resolves its browser assets, composes package metadata, and loads/registers its factory before per-instance activation; no Core filesystem import or mandatory Core dependency belongs in Markian. Core's package owns build/version/dependency metadata and notices, while IDE may configure the extension and host callbacks without duplicating its grammar. Core-free/disabled instances preserve unknown comments and generated bodies without loading Core or executing providers.

Host integrations use the public API. Core gains a separate `MarkianTrait`; the existing `ToastUIEditorTrait` remains unchanged and facades migrate independently. Do not bulk-rewrite stored documents or couple release schedules across hosts.

## Verification and Maintenance

Use the existing [package scripts](../package.json): `npm run dev`, `npm run build`, and `npm test`. Reuse focused cases in the browser suite for changed behavior. Add conformance, isolation, lifecycle, and distribution checks as those library responsibilities are implemented; do not report prototype checks as proof of unimplemented contracts.

Keep this document aligned with actual module ownership and approved boundaries. Mark planned versus implemented behavior explicitly as extraction proceeds. Update the plan when scope or sequencing changes, and the style guide when visual or interaction conventions change. Do not create a second competing architecture description.