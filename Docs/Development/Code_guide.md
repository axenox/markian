# Code Guide

This guide maps current source responsibilities for contributors. Public concepts belong in [architecture](../Architecture.md); exact host contracts belong in [API](../API.md).

## Source Layout

| Area | Responsibility |
| --- | --- |
| [index.ts](../../src/index.ts) | Public editor factory, extension registration, mount ownership, exports, and classic-script content-CSS default. |
| [browser.ts](../../src/browser.ts) | Explicit browser-global editor entry. Public functions must be exported here as well as from `index.ts`. |
| [types.ts](../../src/types.ts) | Public options, handles, registries, sessions, events, and extension contracts. |
| [editor.ts](../../src/editor.ts) | Document projection, revision/events, view stack, host/forms, providers, permissions, and disposal. |
| [editing.ts](../../src/editing.ts) | Formatting/table commands and schema-aware GFM operations. |
| [templates.ts](../../src/templates.ts) | Template validation, literal selection escaping and active Visual/Source command insertion. |
| [mentions.ts](../../src/mentions.ts) | Bounded prefix matching, source-neutral ProseMirror decorations and rule-local suggestion/detail/action callbacks with cancellation and keyboard routing. |
| [registry.ts](../../src/registry.ts) | Ordered owned registrations and disposal. |
| [styles.ts](../../src/styles.ts) | Stylesheet URL validation, ordered loading, and owned link cleanup. |
| [search.ts](../../src/search.ts) | Bounded literal Unicode-aware matching independent of engines. |
| [visual.ts](../../src/engines/visual.ts) | Milkdown construction, schema bridge, import/serialization checks, and ProseMirror integration. |
| [prose.ts](../../src/engines/prose.ts) | Internal ProseMirror re-exports over the pinned/deduplicated graph. |
| [source.ts](../../src/engines/source.ts) | CodeMirror buffers, selection, history, search, and permissions. |
| [markdown.ts](../../src/render/markdown.ts) | GFM parsing, safe rendering, semantic comparison, mismatch diagnostics, URLs, and heading IDs. |
| [colors.ts](../../src/render/colors.ts) | Shared bounded opt-in hex-color syntax. |
| [inline-html.ts](../../src/render/inline-html.ts) | Shared attribute-free inline HTML policy and mdast mapping, independent of editor engines. |
| [template-styles.ts](../../src/render/template-styles.ts) | Shared template CSS type, browser rule parsing, document-only instance scoping and stylesheet cleanup. No editor engine dependency. |
| [mermaid-runtime.ts](../../src/mermaid-runtime.ts) | Explicit host loading, API validation, bounds and isolated serialized rendering returning Mermaid's original SVG. |
| [toolbar.ts](../../src/ui/toolbar.ts) | Declarative default layout, validation, and group-local contribution projection. |
| [controls.ts](../../src/ui/controls.ts) | Shared button icons, built-in aliases and bounded DOMPurify-sanitized raw SVG; used by recursive toolbar/menu controls. |
| [panels.ts](../../src/ui/panels.ts) | Search/destination forms, suggestions, validation, focus, and lookup cancellation. |
| [static-search.ts](../../src/ui/static-search.ts) | Disposable Help/Preview highlights without Markdown mutation. |
| [viewer.ts](../../src/viewer.ts) | Separate viewer factory, exact source, safe render lifecycle, resources, adapters, and host restoration. |
| [viewer-mermaid.ts](../../src/viewer-mermaid.ts) | Optional render-only viewer adapter, not editor UI. |
| [extensions/code.ts](../../src/extensions/code.ts) | Public-API proof of expanded code editing and block-session projection. |
| [extensions/mermaid.ts](../../src/extensions/mermaid.ts) | Optional diagram renderer/workspace, pan/zoom, source handles, help, and teardown. |
| [style.css](../../src/style.css) | Scoped editor shell and structural editing styles. Shared typography lives in [content.css](../../src/render/content.css). |

Build scripts live in `Scripts`, runnable examples in `Examples`, and current tests in `Tests`.

## Dependency Boundaries

Only the visual adapter imports Milkdown. Ordinary editing uses Markian-owned definitions and shared ProseMirror exports; extensions use public API, not engines. Milkdown is replaceable wiring, while ProseMirror, remark/mdast, and CodeMirror remain the main foundations. Do not add a competing abstraction over ProseMirror.

Shared rendering cannot import editor controllers, engines, sessions, history, commands, or toolbar UI. Viewer builds embed shared rendering source independently, with no hidden runtime chunk. Build checks inspect the actual viewer module graph and enforce dependency/size boundaries. Keep host data transport out of all library modules.

Keep ProseMirror versions compatible and deduplicated. A second `prosemirror-model` copy can fail only during browser editing even when compilation succeeds.

## Document and View Ownership

The controller projects the complete current Markdown from the accepted document and pending raw/block work. It must not replace the complete value with the active surface's text. Engines retain their own selection/history; specialized views mount presentation around an optional target session.

`set` validates visual replacement before mutation, preserves identical echoes, and requires a policy for conflicting pending work. Session targets carry source offsets, language/value, and revision; opening and committing revalidate them. Help suspends presentation without committing. Public editing operations reject hidden/suspended mutations.

Visual import compares semantic trees, normalizing line endings before comparison. Serialization normalizes the entire output to LF and uses a shared final-newline policy; never trim meaningful spaces or fix Markdown using broad text substitutions. Unknown comments and generated bodies must survive without executing providers. An actual fidelity failure is reported with bounded source-node diagnostics.

Milkdown GFM already installs table editing. Reuse it instead of registering another table plugin, and preserve its distinct header/body row schema. Structural contributions precede preset mappings because parser selection follows schema insertion order. Current atomic mappings do not prove arbitrary grammar or nested serialization support.

## UI Ownership

`ToolbarItems` copies configuration and projects removable contributions. Registration order is not toolbar placement: explicit container IDs and local ordering targets control placement. Existing configured references win. Empty groups disappear without separators; opposite alignment comes only from top-level configuration.

Native popovers remain instance-owned while escaping parent clipping. Shared controls and panels supply keyboard behavior, selection retention, and focus restoration. Height-only resize notifications must not rebuild a focused toolbar. Outline navigation resolves live headings, not stale ProseMirror DOM references, and scrolls the active surface after focus.

Use [the style guide](../Styleguide.md) for reusable classes and interaction patterns rather than duplicating look-alike controls.

## Async Work and Teardown

Capture revision, selection, permissions, and view for provider work. Abort superseded work and reject stale results even if cancellation is ignored. Pending blobs stay outside saved Markdown. Failed current-document insertion blocks the save gate until resolved; obsolete work must not block or overwrite a newer document.

Initialization loads CSS, awaits enabled extension initialization, closes schema registration, creates engines, imports content, and signals readiness. Failure cleans up completed owned resources and restores the host. A failing extension must clean its own partial initialization.

Destroy cancels providers and renders, disposes views/engines/listeners/observers/styles, exits fullscreen, and restores the host. Fullscreen host callbacks pair entry with exactly-once restoration, including late entry results. Shared runtime caches are retained dependencies, not per-instance drafts or DOM.

## Build and Verification

Use [the development workflow](index.md#validation). Build emits independent editor, viewer, and optional extension assets, declarations, manifests/hashes, the root `includes.json` bundle registry, and size reports. `Scripts/includes.mjs` collects exact package versions and license texts or links from the shared build module graph; see [license maintenance](index.md#bundled-third-party-licenses). Import checks enforce Milkdown/rendering/transport boundaries. Archive fixtures install with lifecycle scripts disabled and test prebuilt assets under static subdirectory routes.

Local checks are evidence for their selected behavior only. Publication, actual host file persistence, screen readers, real devices, browser matrices, and restrictive CSP remain separate acceptance work in the [plan](../Requirements/Plan.md).