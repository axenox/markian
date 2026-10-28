# Markian Architecture

## Purpose and Status

Markian is a framework-independent Markdown editor intended for standalone use and embedding in host applications. A separate lightweight viewer is planned in W16 after Codiware integration, superseding the earlier editor-only product decision. Disabled/read-only editors retain their nonmutating controls and are not the viewer implementation. Display-only Power UI widget adapters remain host-owned. Markdown is the public content format; rendered HTML and editor-engine documents are internal representations.

This is a living document about internal structure, ownership, and engineering principles. Update it in the same change as any architectural change. Appearance and interaction patterns belong in the [style guide](Styleguide.md). Scope, acceptance criteria, packaging work, and migration sequencing belong in the [implementation plan](Requirements/Plan.md).

The repository contains strict-TypeScript, instance-based W0-W3 foundations and W4-W7 editing/provider/navigation features. The former interaction prototype and its tests are archived under `Prototype/` and are not build inputs. The [README](../README.md) defines implemented APIs and remaining acceptance limitations; the plan remains the full approved destination, not a completion claim. Earlier alternatives in the [approach](Requirements/Approach.md) must be read in light of later plan decisions.

## Current Implementation

| File | Responsibility |
| --- | --- |
| [index.ts](../src/index.ts) | Public factory, per-host mount ownership, extension factory registration, and public exports. |
| [editor.ts](../src/editor.ts) | Instance document projection, events, commands, view stack, host/form lifecycle, and disposal. |
| [editing.ts](../src/editing.ts) | Built-in formatting/table commands and schema-aware GFM header/body operations through shared registries. |
| [search.ts](../src/search.ts) | Bounded literal Unicode-aware matching, independent of editor engines. |
| [panels.ts](../src/ui/panels.ts) | Shared search/destination forms, suggestions/inspection, validation, focus, and query cancellation. |
| [toolbar.ts](../src/ui/toolbar.ts) | Declarative grouped default toolbar, container validation, and toolbar-specific registry/projection with explicit group-local insertion and owned disposal. |
| [static-search.ts](../src/ui/static-search.ts) | Disposable Help/Preview text highlights and navigation without Markdown mutation. |
| [colors.ts](../src/render/colors.ts) | Bounded opt-in hex-color syntax shared by visual import and safe rendering. |
| [visual.ts](../src/engines/visual.ts) | Only Milkdown importer; construction, structural translation, parse/serialize fidelity checks, and ProseMirror transactions. |
| [prose.ts](../src/engines/prose.ts) | Internal ProseMirror re-exports using one pinned/deduplicated direct dependency graph, not Milkdown imports outside the adapter. |
| [source.ts](../src/engines/source.ts) | CodeMirror buffers/history and editing permissions, shared through the public source handle. |
| [markdown.ts](../src/render/markdown.ts) | Engine-independent GFM parsing, semantic comparison, safe rendering, headings, and URL policy. |
| [code.ts](../src/extensions/code.ts) | Optional W1 proof slice using public registries, block targets, renderer, and source-view handle; no engine imports. |
| [mermaid.ts](../src/extensions/mermaid.ts) | Optional W13 factory, bounded/sanitized diagram presentation, isolated deduplicated host-URL loading, public block sessions and source handles. Separate CSS and a host-provided renderer keep Mermaid out of core and distribution dependencies. |
| [style.css](../src/style.css) | Scoped editor shell, themes, controls, and structural list/table paragraph spacing; shared content typography lives in `src/render/content.css`. |
| [library.spec.js](../Tests/library.spec.js) | Browser checks against classic-script `dist`, including lifecycle, draft projection, schema registration, and preservation fixtures. |

The new library uses Milkdown/ProseMirror for visual editing, CodeMirror for source editing, and selected Material Design Icons paths. `window.Markian` is a factory, never an editor singleton. Demo globals and page styling are outside the library; startup has no Core, Mermaid, remote-font, or data-service dependency. Extensions use the same public APIs as hosts. Declaration generation, import-boundary checks, manifest hashes, notices, archive-install smoke checks, and Windows/Linux CI are implemented; publication and CI execution outside this machine remain external gates.

W13 is independently delivered without completing other pending packages. The Mermaid IIFE exposes `MarkianMermaid.mermaidExtension` and `loadMermaid`, not an automatically registered/active editor feature. The default demo stays core/Code-only; a separate packaged example opts in. A versioned host adapter returns SVG without Markian changing host configuration. The explicit local loader instead owns a separate iframe runtime, deduplicated by document/URL/version and retained as a shared dependency. It serializes strict Mermaid rendering; each diagram owns cancellation, stale-result rejection, unique SVG IDs, pan/zoom and disposal. DOMPurify removes active SVG/HTML and external resources, while optional scoped CSS supplies theme colors. See the [implemented contract](../README.md#optional-mermaid-extension).

The renderer is external: the host configures its trusted URL/version, or supplies an adapter. No Mermaid runtime is copied into `dist` or installed as a consumer dependency. Missing configuration/loading errors replace the diagram presentation, not its stored source. [The example host config](../Examples/mermaid.config.js) declares a host-assets URL; [the development server](../vite.config.js) serves it directly from the development-only dependency and excludes generated test artifacts from file watching. Archive fixtures independently supply a host asset endpoint. Neither development server behavior nor host configuration becomes a library dependency.

The existing renderer registry can opt into code-block node views with `visual: true`, retaining the actual code schema and Markdown serialization; existing Preview-only renderers remain unchanged. Top-level renderer context can open a public target-aware view; no extension imports an engine. Preview and nested fences use the same sanitizing Mermaid presentation without edit affordances. Mermaid edits use core CodeMirror handles, indentation, and W7 block-session projection/history rather than a second document model. Public help entries extend the built-in Help view, and public code insertion is permission-gated and transactional. Other pending WPs remain pending; nested block-session targeting, real-device/cross-browser/CSP and screen-reader gates are not established by W13's focused Chromium checks.

## Responsibility Boundaries

The controller owns `sidebarVisible` startup configuration (default `true`), document-outline visibility, and the outline command's pressed state. Toggling resizes the active view; heading navigation retains visibility. Specialized views hide the sidebar without changing its saved presentation choice. Toolbar placement does not control or reset outline visibility.

Visual outline targets retain heading indices, not DOM elements that ProseMirror may replace. Navigation and current-section tracking resolve the live headings. Scroll coordinates come from bounding rectangles relative to the visual scroller, after focusing the editor, so positioned content wrappers and host layout offsets do not break navigation or scroll the host page.

Configurable stylesheet ownership remains in the library. `index.ts` resolves the classic script's default content asset and marks instances using it; `styles.ts` validates HTTP(S) `markdownCssUrls` and `themeCssUrls`, resolves URLs against the document base, and loads ordered instance-owned links before readiness. Explicit content URLs replace the default list, including an empty list; theme URLs append overrides. Failure restores the host, and destruction releases the links. Base shell CSS is host-loaded; content CSS remains separately distributed. Host rules are trusted and page-wide and must be scoped by their author. Default content typography is scoped to the default-only instance marker, not applied to custom-styled instances.

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
| Visual engine adapter | Milkdown editor creation, context/plugin registration, mdast-to-ProseMirror parsing and serialization, and teardown. The only module importing `@milkdown/*`. | Commands, sessions, extensions, or public API, which use Markian-owned definitions and plain ProseMirror APIs. |

Milkdown is a replaceable wiring layer; ProseMirror, remark/mdast, and CodeMirror are the long-term foundations. The implemented boundary confines Milkdown to the visual adapter and ordinary engine operations to one internal ProseMirror re-export module. Build checks enforce Milkdown, rendering, and no-transport boundaries. Do not add an abstraction over ProseMirror itself.

The initial structural bridge supports atomic node mappings over existing mdast types, registered before preset mappings. It does not yet expose arbitrary remark grammars, nested-node serialization, input rules, or node-view registration. The Code proof and thematic-break schema fixture do not establish support for DocsFacade generated-region grammar. Failed visual fidelity checks retain exact source and fall back to raw mode at initialization; later failed imports leave the active value intact. HTML is inert in visual mode and omitted from sanitized Preview; front matter and resolved-reference differences may require source fallback. These are explicit remaining W0/W1/W3 gates.

The target exposes `Markian.create(element, options)` for editor instances, including disabled/read-only instances. Each handle owns its documents, histories, selection, callbacks, URL base, theme, and pending work. Queries must be scoped to its root; IDs must not collide across instances. Shared immutable dependencies or safe loader promises are acceptable; singleton document state is not.

`Markian.headings(markdown)` publicly re-exports the shared Markdown pipeline's heading parser and `Heading` type. Host link-inspection callbacks can inspect another document without constructing an editor or duplicating anchor generation. Parsing remains owned by `render/markdown.ts`, shared with rendering and editor navigation.

## Markdown Contract

- Final-newline presence follows the document accepted by the visual engine, independently of the host. Both edit notifications and explicit serialization use the same wrapper: when input lacked a final newline, remove only the serializer's added final LF, never trim trailing whitespace. Successful document replacement updates this policy; validation alone does not. Undo/redo of visual content retains the accepted input's newline convention. Raw-source editing continues to preserve its literal buffer.
- Visual serialization normalizes unordered and task-list markers to `-`, matching existing Toast UI-authored documents and avoiding marker-only Git diffs. The shared Milkdown remark serializer owns this choice, including nested lists; ordered-list numbering and code-fence contents are not rewritten by a text replacement.
- Persist ordinary interoperable Markdown, not editor JSON or rendered HTML. Normalization is allowed, but meaningful whitespace, code, comments, and generated bodies must survive.
- Use the agreed CommonMark/GFM subset and one documented policy. Editor, Preview, and planned viewer share semantics/security fixtures and pure rendering policies, not necessarily identical DOM. Host display-widget adapters verify their own binding/lifecycle behavior.
- Store extension delimiters and metadata as invisible HTML comments. Generated bodies remain independently readable Markdown. Unregistered extensions must not erase their markers or execute providers.
- Store Mermaid as ordinary fenced `mermaid` code, mentions as ordinary text, and images as normal Markdown image syntax.
- Alert quotes retain ordinary `> [!TYPE]` Markdown markers. Shared marker detection drives command state and sanitized Preview; the visual adapter uses decorations to hide the marker and label the quote without changing its schema or saved content. Detection preserves soft/hard line-break boundaries rather than relying on flattened node text.
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

### Implemented W4-W7 Ownership

The controller routes commands and search to the visible engine or static presentation. ProseMirror decorations and CodeMirror's search extension own editing highlights; static highlights are disposable DOM decoration. Visual matches may cross inline marks within one textblock, but not atomic/opaque nodes. Replacement inherits starting marks and is one history transaction. Help/Preview cannot replace; public handles cannot edit suspended sessions. Query state is instance-local and keyed by view; separate block sessions using the same view ID do not yet have independent query histories.

Toolbar registries and one declarative default layout drive pinned, floating, overflow, and contextual controls. Host layouts and registry contributions share recursive containers with `type: 'menu' | 'group'` and `items`. `ToolbarItems` owns registrations and removable placement records, projecting them onto copied configuration arrays. Its public `insert(item, group?, beforeId?)` targets a named container, appending when the local ordering target is omitted; an omitted group resolves to the last top-level default-aligned inline group. Existing configured ID references take precedence, and absent groups do not create new containers. Built-in definitions are registered internally without automatic placement. Extensions use the same public insertion method as hosts, not icon-based or registry-neighbor inference. The controller flattens projected inline groups into shared controls, generates separators at nonempty group boundaries, and partitions top-level containers by `align: 'default' | 'opposite'`, preserving order within each side. Opposite containers remain outside automatic overflow; command identities do not determine alignment. Additional container types, such as responsive collapsing groups, remain future work. Built-ins use `editing.ts`; extensions use public operations rather than engine getters. The controller positions instance-owned native popover flyouts and button-anchored transient panels; top-layer rendering escapes parent scrolling without moving DOM ownership outside the instance. Code expansion is offered only by the code-caret floating toolbar by default, not by a pinned extension contribution. ProseMirror primitives provide table navigation/selection. The GFM preset already owns the table-editing plugin; schema-aware commands preserve its distinct header/body rows. The controller owns parsed outline targets, view-local scrolling, and current-section indication. Shared parsing supplies nested/duplicate heading anchors to outline and Preview.

Async image operations capture revision, selection, permissions, and view. Abort races settle even if a host ignores the signal. Pending blobs never enter the saved value; failed current-document operations block `whenIdle()` and native textarea submission until retry/removal. A newer revision cannot be blocked or overwritten by an obsolete result. Hosts must await the gate and handle subsequent edits during their storage operation. Markian owns no upload/storage transaction.

Fullscreen callback entry is cancellable and paired with exactly-once restoration. The controller owns command state and teardown, not host overlays. Provider panels similarly own transient UI and stale-result validation while callbacks own I/O. See the [README](../README.md#editing-and-host-callbacks) for signatures, bounds, and limitations; real-device/IME, complete accessibility, and actual Codiware file persistence remain acceptance gates. The bounded color preset is the only currently mapped HTML style; general allowed-HTML/stencil mappings remain separate work.

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

The [configuration reference](Configuration.md) documents all public options and defaults, including every bundled extension. Maintenance requirements are defined in the repository's Copilot instructions.

Use the [package scripts](../package.json): `npm run dev`, `npm run build`, `npm test`, and `npm run verify`. The new browser suite loads only built classic scripts. Unit tests cover shared Markdown policy; the archive check installs and starts the packed example with scripts disabled. The archived prototype suite is historical, not evidence for the fresh library. Independent GitHub/GitLab rendering, real-device tests, CSP hardening, full publication/Composer installation, and remaining work-package gates are not established by these checks.

Library source is strict TypeScript with separate type checking and generated declarations. The Vite-served workspace and minimal static example load `dist`; they do not depend on source-module resolution. The DevMan-specific Apache bench/maintenance workflow remains W18 work.

Keep this document aligned with actual module ownership and approved boundaries. Mark planned versus implemented behavior explicitly as extraction proceeds. Update the plan when scope or sequencing changes, and the style guide when visual or interaction conventions change. Do not create a second competing architecture description.