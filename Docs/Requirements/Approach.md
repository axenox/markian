# Recommended Approach for Markian

## Recommendation

Build Markian as a framework-independent, **Markdown-oriented visual editor, evaluating Milkdown/Crepe first**, with a shared Markdown import/export and rendering policy. Deliver a prebuilt browser-ready core plus optional extension/dependency assets, without a consumer build step. Reuse established libraries for editing, Markdown parsing, sanitization, and Mermaid rendering; build the product-specific extensions ourselves. The later extension-based modularity decision replaces the original single-file delivery requirement.

Keep the requested Obsidian-like interaction as the UX target, with an always-discoverable toolbar and Markdown typing shortcuts. Milkdown does not provide source-decoration editing by default: verify whether its visual editing satisfies that target. Raw Markdown mode should import/export the same supported content model, not introduce another persistence format.

The revised requirement permits normalized Markdown, but requires interoperability and graceful degradation of add-ons. That removes the main reason to build visual editing mechanics on CodeMirror. **Validate Milkdown/Crepe's UX and extension round trips before committing.** In particular, placeholder comments must survive editing and export while remaining invisible in other renderers. Tiptap is the main rich-text alternative; CodeMirror remains an option if editable source exposed in place is essential.

This is an architectural recommendation, not an implementation or a measured performance comparison. Library capabilities below are based on the linked upstream documentation; exact versions, browser compatibility, maintenance activity, and transitive licenses must be checked when dependencies are selected.

## What Drives the Architecture

### Markdown Is the Storage Format

The [revised requirements](Requirements.md) allow `set(markdown)` followed by `get()` to return normalized Markdown. For example, `*text*` may become `_text_`, and list markers or table layout may change. An internal structured editor model is acceptable, but the public value and stored document remain Markdown renderable without Markian. Normalization is not permission to remove comments, generated content, or unsupported constructs silently.

Use these acceptance rules:

- Import/export preserves supported content and formatting semantics, including links, images, code, tables, and application-specific markers.
- Serialization may normalize the whole document. Syntax choices and insignificant whitespace need not remain identical; hard breaks and code indentation remain meaningful.
- Placeholder delimiters and extension metadata round-trip as invisible HTML comments. Their payload and meaning survive; generated bodies remain ordinary renderable content.
- Unknown syntax and unsupported constructs must not disappear silently. Preserve them as opaque content where possible, or report unsupported input before replacing the loaded value.
- Undo restores the previous editing state and its meaning, not necessarily the original Markdown spelling. Theme changes and maximizing are not content edits.

Choose a documented serializer policy, including LF line endings, and verify stable export/import results. Per-break metadata and untouched-source-range tracking are no longer required. File encoding belongs to host file I/O. Preserve the exact payload of extension comments unless its format explicitly permits normalization; generic whitespace cleanup must not damage it.

### Live Editing Is Not Strict WYSIWYG

Start with two modes:

| Mode | Experience | Stored content |
| --- | --- | --- |
| Visual editing, default | Styled text, rendered tables/images/diagrams, and Markdown typing shortcuts. Exact in-place source exposure remains a UX acceptance question. | Normalized Markdown serialized from the editor model. |
| Markdown | Plain Markdown replaces the visual content in the same frame; the pinned toolbar edits source syntax through CodeMirror commands. | The active raw buffer is the value until switching back to visual editing. |

Do not build an ordinary document-wide split preview initially. The specialized Mermaid editor can still have code and preview side by side.

Use one rich-text engine for visual modes. A strict Word-like preset can disable Markdown input rules, but paste, literal punctuation, composition, and undo still need explicit tests. Raw mode is an in-place toggle, not an Apply/Cancel dialog. While active, its text is authoritative for get/download and its toolbar uses source commands and source-local history. Validate before switching back; on failure retain the source and report the problem. Import edited source as one undoable visual replacement; unchanged mode switches are not document edits. Preserve the raw buffer and history while visual content stays unchanged, refreshing them after visual edits or document replacement. Source selection/history and rich-text positions differ, so automatic cursor and history equivalence across modes must not be assumed.

### Portability Has Limits

Target CommonMark plus an explicitly documented GitHub-flavored Markdown subset: tables, task lists, strikethrough, and autolinks. Test GitLab as a separate rendering target; neither platform implements every extension identically.

**Graceful degradation is a storage contract, not an optional rendering mode.** Every add-on needs an explicit portable representation. Use ordinary text, links, and supported HTML for visible content, and invisible HTML comments for placeholder delimiters and metadata. Without the add-on, generated bodies must still render normally and metadata must not turn into visible punctuation, escaped comment text, custom tags, or private-use characters. Comments need not survive editing in arbitrary third-party software, but Markian must preserve them through its own import/edit/export cycle. Re-importing the saved document into Markian must restore the add-on's meaning.

The reason for comment-delimited placeholders is precisely this fallback: other renderers ignore the delimiters and show the existing generated content without running the placeholder provider. Preserve that behavior rather than introducing a new custom Markdown syntax. Unknown extension comments should survive even when their provider is not registered; recognizing a placeholder must never depend on executing it.

- `<kbd>` can remain literal HTML in the Markdown, without proprietary wrappers. Its final appearance depends on the destination renderer.
- Arbitrary text colors are not standard Markdown. GitHub strips styling that would otherwise implement them. Offer a host-only color extension using restricted HTML if needed, label its portability limitation, and disable it in a portable-document preset. Do not promise preserved colors on GitHub/GitLab.
- Store Mermaid as ordinary fenced `mermaid` code. Diagram support and syntax versions still depend on the destination.
- Data-URI images are valid stored image targets, but some renderers, including GitHub, restrict them. Preserve alternative text and document the limitation; a host publishing workflow may need to replace them with ordinary image URLs. Cross-renderer readability is not a guarantee that every embedded image renders everywhere.
- Plain-text mentions are portable text, but highlighting, suggestions, and hover cards are Markian features. Their meaning on GitHub/GitLab may differ.
- Tip/warning/error quote variants need a defined export syntax. Use ordinary quotes for the portable baseline and enable platform-specific alert syntax only through a compatibility preset.
- Heading fragments need explicit slug rules, including duplicate headings and non-ASCII text. A GitHub-style slugger does not establish GitLab compatibility by itself.

## High-Level Architecture

Use five responsibilities with clear boundaries:

| Component | Responsibility |
| --- | --- |
| Editor model and transactions | Structured document, selections, formatting commands, undo/redo, and change events. |
| Markdown import/export | Supported dialect, portable serialization, custom-node mappings, comment preservation, and unsupported-input handling. |
| Editing presentation | Milkdown/ProseMirror views, table controls, toolbar, menus, dialogs, and contextual controls. |
| Editor rendering | Render visual blocks and disabled/read-only editor presentation using the same dialect, link policy, extensions, themes, and sanitization rules. |
| Host adapters | Translate framework lifecycle, existing widget configuration, AJAX providers, and document URLs into Markian's public API. |

All user changes, including checkbox and table-cell edits, become editor-model transactions. Serialize that model through the defined Markdown exporter, including explicit comment/placeholder mappings. Rendered HTML is disposable output, never the persistence format; do not generate Markdown by scraping the editor DOM.

Milkdown's ProseMirror model drives visual editing, with remark-based Markdown conversion. Share dialect and extension definitions with display rendering where practical, and test a common conformance corpus. CodeMirror owns raw Markdown while source mode is active, and specialized code buffers in their workspaces. Only the active mode is authoritative; transfer at explicit mode boundaries rather than continuously reparsing raw typing into the rich-text model. Comments must be captured during Markdown import, before conversion to sanitized display HTML could remove them.

The later W16 decision adds a separate lightweight viewer after Codiware integration, superseding the earlier editor-only scope. Separate shared Markdown/rendering/sanitization and content styles from editor-engine/UI dependencies during initial extraction, then build the viewer through its own prebuilt entry point. Prove its smaller size through measured artifacts rather than wrapping a disabled editor. Disabled/read-only editors retain search, selection, copying complete Markdown, and other nonmutating interactions independently. Power UI owns display-widget adapters, which may adopt the viewer after W16 passes; compare shared semantic/security fixtures without requiring identical DOM implementations.

## Suggested Libraries

### Recommended Stack

| Library | Purpose and advantages | Costs and limitations |
| --- | --- | --- |
| [Milkdown / Crepe](https://milkdown.dev/docs/guide/why-milkdown) | Markdown-oriented ProseMirror/remark foundation; reuse formatting, history, and table capabilities, adapting Crepe's UI where suitable. MIT. | Custom mappings are required for supported HTML, comments, and generated regions. Obsidian-style in-place source editing is not its default model. Verify feature coverage in the library. |
| [CodeMirror 6](https://codemirror.net/docs/guide/) | Raw Markdown and code/Mermaid buffers, highlighting, indentation, line numbers, and completion. Framework-independent, MIT core packages. | Route shared toolbar commands to source operations while raw mode is active; transfer content at validated mode switches, not through continuous synchronization with another authoritative model. |
| [unified/remark](https://github.com/remarkjs/remark), `remark-gfm`, `remark-stringify`, and HTML rendering bridges | Reuse Milkdown's Markdown ecosystem for a defined dialect, normalized serialization, and display rendering. MIT ecosystem packages, subject to package-level verification. | Every custom node needs deliberate import/export behavior, especially invisible comment markers. Reuse compatible Milkdown dependencies rather than installing a conflicting conversion pipeline. |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Established HTML/SVG sanitization for rendered content, pasted HTML, and returned hover-card HTML. Available under Apache-2.0 OR MPL-2.0. | Requires a deliberately configured policy and ongoing security updates. Default settings alone do not establish Markian's URL, CSS, or image policy. |
| [Mermaid](https://mermaid.js.org/config/usage.html) | Reuse the actual diagram language and renderer rather than implementing diagrams. MIT. | Large optional dependency with version-specific browser and API requirements. Rendering is asynchronous; shared-instance configuration must be coordinated with the host. |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) via selected `@mdi/js` paths | Matches the requested icon language; embed only used SVG paths rather than a complete icon font. | Preserve applicable icon/package notices and verify the selected distribution's license. Icons still need accessible names and tooltips. |
| [Floating UI DOM](https://floating-ui.com/docs/dom), if the chosen editor's facilities are insufficient | Consistent positioning of floating toolbars, menus, and hover cards. MIT. | Additional dependency; positioning is not an accessible menu or dialog implementation. Reuse the editor's facilities where practical. |
| [github-slugger](https://github.com/Flet/github-slugger) | GitHub-style heading IDs with duplicate handling. ISC. | Requires a document-scoped slugger and tests against actual target renderers; GitLab needs its own verified policy. |

For supported embedded HTML such as `<kbd>`, define explicit editor schema and Markdown mappings. In display rendering, `rehype-raw` can parse raw HTML into the HTML tree before sanitization. Never mark arbitrary raw HTML as trusted. Preserve placeholder comments as explicit node data and serialize them back to comments, not visible text or editor-only wrappers. Sanitizers may omit comments from disposable rendered HTML; they must not define the stored Markdown representation.

Reuse CodeMirror's language parsers for editable code blocks. For display highlighting, evaluate its Lezer highlighting utilities before adding another highlighter. Deliver programming-language support through the optional code extension and declared prebuilt language assets; do not make those dependencies mandatory for ordinary comment editing or basic raw Markdown. Explicit optional loading follows the modular distribution contract.

### Supporting and Alternative Libraries

- **Markdown renderer alternative: [markdown-it](https://github.com/markdown-it/markdown-it), MIT.** Simpler rendering API, established plugin model, and table support. Task lists and other dialect features require selected plugins. It can serve display rendering, but does not replace the chosen editor's import/export mappings. Prefer sharing Milkdown's remark ecosystem initially to limit dialect drift.
- **HTML-paste conversion: [Turndown](https://github.com/mixmark-io/turndown), MIT, optionally with its GFM plugin.** Useful for general rich-text paste after sanitization. It is not a round-trip serializer and should never process existing documents on save. Excel table import should use structured clipboard table data and a defined conversion policy, not depend solely on generic HTML conversion.
- **Diagram pan/zoom: evaluate [svg-pan-zoom](https://github.com/bumbu/svg-pan-zoom), BSD-2-Clause.** It can supply a ready SVG navigation layer. Check current maintenance and touch behavior before adoption. Begin with explicit zoom/reset controls and scrolling if that meets usability needs; do not introduce a dependency solely for decorative gestures.
- **Build tooling: Rollup, with TypeScript if desired.** Produce a classic-script core exposing `window.Markian` and separately loadable prebuilt extension/dependency assets. A modular distribution is compatible with a vanilla JavaScript runtime API and requires no consumer bundler. Rollup is MIT; TypeScript is Apache-2.0.
- **Testing: Vitest and Playwright.** Use unit tests for source transformations and browser tests for selections, clipboard interactions, focus, and visual states. Their licenses are MIT and Apache-2.0 respectively. Real-device checks remain necessary for mobile keyboards and IME input.

Do not introduce a general UI framework, a full spreadsheet grid, or another code-editing library beyond CodeMirror initially. None is required by the requested integration contract.

## Alternative Editor Foundations

| Foundation | Pros | Cons for these requirements | Assessment |
| --- | --- | --- | --- |
| CodeMirror 6 plus Markian live editing | Source-oriented interaction and custom plain-text syntax are natural; code editing is already covered. | Highest ownership of visual editing behavior, especially tables and selection across rendered blocks. Exact source preservation is no longer a deciding benefit. | Fallback if true in-place source editing is essential and rich-text candidates fail the UX gate. |
| [Milkdown / Crepe](https://milkdown.dev/docs/guide/why-milkdown), MIT | Markdown-oriented ProseMirror/remark foundation; Crepe offers an assembled visual editor; can be integrated without React. | Custom nodes and import/export mappings remain necessary for HTML, comments, and generated regions. Does not automatically provide Obsidian's interaction model. | Preferred candidate under the revised normalization contract, conditional on comment and fallback tests. |
| [Tiptap](https://tiptap.dev/docs/editor/markdown), MIT open-source editor core | Structured rich-text editing, extensible commands, tables, custom views, and a vanilla JavaScript API. | Markdown bridges into a JSON document and back. Upstream currently documents early-release caveats and comment limitations; placeholder preservation needs explicit proof. Some ecosystem products/extensions have separate commercial terms. | Main alternative, especially for conventional Word-like interaction; normalization does not waive the comment preservation gate. |
| [ProseMirror directly](https://prosemirror.net/docs/guide/), MIT | Maximum schema and transaction control; reusable rich-text commands and table modules. | More assembly than Tiptap/Milkdown, including Markdown integration and custom schema mappings. | Prefer only when wrapper constraints are demonstrably limiting. |
| Extend Toast UI Editor | Existing integrations and familiar toolbar reduce migration work. | Does not by itself resolve the observed mode inconsistencies and extension difficulties. Maintenance concerns need verification rather than assumption. | Useful as a migration fallback, not the recommended new foundation. |
| Hand-written `contenteditable` editor | Complete control with few direct dependencies. | Markian would own browser selection, composition, clipboard, history, and accessibility behavior from scratch. | Reject; use a proven editing engine. |

No candidate should be treated as a finished match merely because it advertises Markdown support. Compare behavior using the same documents and interaction tests.

## How the Features Fit

### Toolbar and Ordinary Writing

Create one command registry used by the pinned toolbar, selection toolbar, contextual menus, and keyboard shortcuts. Configure pinned and floating layouts independently through JSON, including a floating-only preset. Group headings H1-H6, list variants, templates, and quote variants into compact menus; include undo/redo, raw-mode switching, and maximize/restore.

Formatting commands should understand their context: use selected text when present, the current word for inline formatting when appropriate, and the current block for headings, lists, or quotes. At an empty insertion point, allow continued typing in a selected format. Define and test the ambiguous word-boundary cases rather than relying on incidental browser selection behavior.

Render task checkboxes as controls that update task nodes and serialize as `[ ]` or `[x]`. Block task toggling when the editor is disabled/read-only; host display widgets own any separate interaction policy. Test leaving inline code at the end of a line using arrows, touch, and subsequent typing, without inserting invisible characters into saved Markdown.

### Tables and Clipboard

Reuse Milkdown/ProseMirror table capabilities for cell editing, row/column operations, alignment, and navigation, then add the required keyboard/touch-accessible controls. Restrict the schema to what the Markdown exporter can represent. Cell edits participate in the main history; no source-range-backed table widget or independent cell document model is required. Verify missing interactions in the library before estimating custom work.

Parse HTML clipboard tables after sanitization, with a TSV fallback for Excel. Preserve the rectangle and cell text, not styles or formulas. Escape pipes and define handling of embedded newlines. GFM tables require a header row and do not support merged cells: choose an explicit first-row/header policy and reject or visibly flatten unsupported structures. Do not silently discard cells. General rich-text paste conversion is a separate, optional feature.

### Links and Images

Use one link dialog for insert/edit, with URL, label, and a separate heading field for Markdown targets. Store relative URLs as relative; resolve them against a configurable document base only for previews, validation, and navigation. Offer Ctrl/Cmd-click and an accessible explicit open action, including on mobile.

Define asynchronous host providers for link/image suggestions and link inspection. Inspection should return existence status and heading IDs, not just heading labels. Debounce queries, cancel obsolete requests, and ignore stale results. Cross-origin validation may be unavailable due to CORS; report unknown rather than falsely reporting a broken link. Server-side inspection must not become an unrestricted URL-fetching proxy.

Image URL insertion and clipboard image insertion should produce normal Markdown images. Convert pasted raster images to data URIs, with explicit type and size limits and clear errors. Keep the data URI in Markdown as requested, without requiring extraction or upload. Ask for alternative text. Large embedded images increase document size and history memory; this needs representative testing. Do not enable arbitrary `data:` URLs or unsanitized SVG images to achieve this feature.

### Mermaid and Code Blocks

Render a Mermaid code node as a diagram with edit, zoom, pan, and reset controls; export it as a standard fenced block. Open a dedicated workspace within the editor's maximized overlay: code and preview side by side on desktop, switchable panes on narrow screens. Apply commits one undoable node update; Cancel leaves the main document untouched. Detect if the node changed or was deleted while the workspace was open rather than overwriting newer content. Invalid diagrams remain editable code with a clear preview error.

Reuse CodeMirror for this workspace and for an expanded code-block editor, including language selection, line numbers, Tab support, and configurable tab width. Inline code blocks should remain directly editable too; expansion is an aid, not a mandatory detour. Postpone a visual Mermaid shapes sidebar: it is another substantial authoring product and cannot round-trip every Mermaid language construct automatically.

Accept a host-supplied Mermaid renderer/instance first, and a configurable local loader second. Define an adapter contract and supported version range. Do not scan or reconfigure unrelated host diagrams or silently weaken the host's security settings. Stale asynchronous renders must not replace newer previews.

### Templates, Mentions, and Generated Blocks

Templates and stencils are configured Markdown imported into the editor model. Wrapping with `<kbd>` applies a supported mark/node that exports just the intended HTML tags and escaped text, without editor-specific wrappers. Provide a template menu and parameterized custom-link commands through the shared command registry.

Mention definitions should configure matching syntax, priority, style, suggestion provider, click event, and hover provider. Resolve the more specific `#TC` prefix before the generic `#` prefix. Match only valid text contexts, not fenced code, inline code, URLs, or heading syntax. Highlight through presentation decorations and export plain text by default; link conversion is an explicit per-mention option. Hover cards must also work through keyboard focus or a touch action.

Import paired placeholder comments as an explicit container node holding delimiter payloads and generated content. Export the same comment convention around ordinary Markdown, never proprietary visible delimiters. Show the content inside an outlined region with an Edit Tags action and a configured insertion menu. Recommend protecting generated content from accidental visual edits, with an explicit policy for raw-mode editing. Preserve marker meaning and body content; Markdown layout may normalize. Retain unknown comment metadata when a provider is unavailable and report malformed pairs without deleting them. Rendering the existing body is distinct from regenerating it: regeneration belongs to an authorized host provider, not the standalone editor.

The table of contents should come from parsed headings, not DOM queries. Show it only when headings remain after excluding a heading starting on line 1, as requested. Use a collapsible side outline on desktop and a drawer on mobile, sharing heading IDs with links and display rendering.

## Public API, Configuration, and Integration

Expose a small imperative API: create/mount, `get`, `set`, focus, execute command, change mode/theme, subscribe/unsubscribe to events, resize/refresh, and destroy. Support textarea and div hosts; define initial content explicitly as Markdown text, not inferred HTML. Preserve textarea form submission behavior and restore the host on destruction.

Emit a change event for every committed document-changing transaction, including undo/redo and programmatic changes, with an origin indicator. Presentation changes must not trigger content-change events. Hosts can debounce autosave independently. Define whether `set` resets history; recommend reset for a new document and a separate transactional replacement operation when history must be retained.

Keep settings JSON-serializable: toolbar arrays, feature flags, colors, templates, mention rules, endpoint descriptions, and named provider/command IDs. Register actual callback functions separately in trusted JavaScript. Never evaluate JavaScript embedded in JSON. Validate configurations and report unknown extension IDs clearly.

Keep Markian's core independent of Power UI, jQuery, OpenUI5, and Codiware. Integration adapters own framework-specific lifecycle and configuration translation. Codiware supplies repository file providers; ExFace/Power UI Core supplies the optional prebuilt `docsPlaceholders` extension and DocsFacade grammar. The IDE app configures that extension and adds IDE-specific links/callbacks, without duplicating the grammar. The host loads/registers the external factory and opts in per editor; Markian neither packages it nor requires Core, and no consumer build is needed. Inventory current `InputMarkdown` mentions, stencils, and event semantics before migration, then add contract tests and translation adapters rather than assuming similarly named features are compatible.

Use the same approach for display widgets and jQuery comments. Pilot integrations one at a time, retaining a host-level switch back to Toast UI during rollout. Syntax may normalize during migration, but do not introduce a new proprietary storage format or change existing placeholder conventions.

## Packaging and Visual Design

Publish a prebuilt core and optional extension JavaScript/CSS in the distributed package. Consumers, including Composer installations, must not need npm, a bundler, or compilation. Core provides ordinary Markdown editing, basic raw editing, parsing/sanitization, and core controls. Mermaid, programming-language highlighting, language packs, and expanded-code features are optional. An ESM distribution can be added alongside, not instead of, ordinary script/link-tag delivery.

The modular decision supersedes the earlier single-file promise. Hosts explicitly load/register extension factories and enable them per instance. Enabled extensions may load declared prebuilt dependencies through documented local/configurable URLs; absent/disabled extensions must not trigger those downloads, including when corresponding fences exist. Reuse host-supplied dependencies, deduplicate compatible loads, retain instance-local state, and preserve plain-code fallback. No hidden chunk discovery or implicit CDN requests. Offline installations serve/preload the selected files locally. Pin dependencies, retain notices, and verify all core/optional artifacts in deterministic builds and packages.

Use scoped Markian CSS classes and theme variables for both editor and display rendering. Match GitHub-like document typography while keeping the editor frame and toolbar visually clear. Provide programmatic light/dark switching and selected MDI icons. Avoid global resets that affect host frameworks.

Mobile needs an overflow menu, touch-sized controls, an optional bottom toolbar, safe-area/virtual-keyboard handling, and no hover-only functionality. Maximization should preserve the same editor instance, selection, history, focus, and scroll state in a reversible overlay, restoring host layout afterward. Inside an iframe, the available screen is normally the iframe viewport; expanding beyond it requires explicit parent integration and cannot be guaranteed by CSS alone.

Keyboard navigation, accessible names and pressed states, dialog focus handling, screen-reader behavior, contrast, and a way to leave Tab-indenting code editors are baseline requirements. Test IME composition, spellcheck, bidirectional text, and mobile selection handles early, especially around hidden syntax and rich widgets.

## Security Boundaries

Preserving content and safely displaying it are separate concerns. Dangerous HTML must never execute. Preserve unsupported input as inert opaque content where the import/export contract permits, or explicitly reject/report it before replacing the document. Normalization is not permission to silently delete content. Placeholder metadata is data, never executable code, even when it resembles a directive. Browser rendering sanitization must not erase the persisted comment markers required by the storage contract.

- Sanitize every untrusted HTML entry point before insertion: rendered Markdown HTML, allowed raw HTML, clipboard HTML, and AJAX hover-card HTML. Allow only the required tags/attributes. Do not permit arbitrary styles merely to support the color palette.
- Apply separate URL policies for navigation and images. Permit configured safe relative/absolute links and narrowly allowed raster-image data URIs; reject executable schemes and unsafe embeds. Escape code as text, so JavaScript examples remain visible but inert.
- Render Mermaid under a strict security policy and sanitize produced SVG under a separately tested SVG policy before mounting it. Do not attach source-defined executable callbacks. Coordinate configuration with the host; use an isolated rendering boundary when the shared instance cannot meet the policy.
- Treat template configuration, provider registration, and extension code as trusted integration inputs, not arbitrary document content. Placeholder execution and remote lookup remain subject to host authorization.
- Bound document size, image size, nesting, regex complexity, and diagram complexity. Handle failures without losing the source. Support CSP integration, including CodeMirror's dynamically injected styles and nonce configuration, without requiring `eval` or inline event handlers.
- Client sanitization does not secure server-rendered Markdown. Every host rendering path needs an equivalent security policy and independent enforcement.

## Delivery and Decision Gates

1. **Prove the foundation.** Validate Milkdown/Crepe with inline-code exit, word-at-caret formatting, nested lists, table editing, a comment placeholder, `<kbd>` import/export, in-place raw-mode switching with a working toolbar, and undo. Include script-tag embedding and mobile/IME checks. Verify the requested UX with Markdown-experienced and nontechnical users, and render exported placeholders independently without loading any add-ons. Compare Tiptap if Milkdown fails; revisit CodeMirror if in-place source exposure is essential. Reject candidates that lose required comments or produce visible syntax debris.
2. **Deliver the baseline editor and display renderer.** Complete standard formatting, lists/tasks, links/images, pinned/floating toolbars, normalized Markdown import/export, themes, events, accessibility, and maximize/restore. Establish the extension and adapter contracts at this stage, without building every optional extension.
3. **Add advanced content.** Complete visual table operations and Excel paste, Mermaid/code workspaces, mentions, templates/stencils, generated blocks, and the heading outline. Treat each as a tested extension using the shared commands and transactions.
4. **Integrate and migrate.** Pilot Codiware, then framework widgets and other consumers, with explicit preservation and configuration compatibility checks. Add IDE-specific providers separately. Keep strict Word-like mode deferred until ordinary users' feedback justifies its additional scope.

Acceptance tests should cover semantic import/export preservation and stable normalized serialization, including line endings, comments, unsupported-input handling, inline HTML, reference-link meaning, Unicode, meaningful whitespace, and undo/redo. For every add-on, test import/edit/export, rendering without that add-on in an independent renderer, and re-import into Markian. Assert that placeholder metadata survives but remains invisible, generated content stays readable, and no escaped delimiters, obscure characters, or required editor-only wrappers appear. Include unknown-provider and malformed-marker cases. Browser tests must cover copy/paste, cross-widget selection, inline-code boundaries, table navigation, in-place raw-mode switching and toolbar commands, raw downloads and history boundaries, failed imports retaining source, stale provider responses, diagram errors, multiple instances, destruction/remounting, and overlay restoration.

Use a shared rendering corpus for editor/display parity and GitHub/GitLab compatibility, plus malicious HTML/URL/SVG fixtures. Measure startup, typing, rendering, and memory on representative long documents and data-URI-heavy documents before setting performance budgets; no performance advantage is claimed here without a runtime measurement.

Before implementation, confirm the browser/device baseline, required code languages and Mermaid versions, document/image limits, normalization and unsupported-content policy, existing placeholder grammar, color/alert/data-image portability policy, iframe maximization expectations, and required fidelity to Obsidian's in-place source editing. These are scope decisions, not reasons to delay focused foundation validation.

## Conclusion

Markian should own its extensions and integration contract, not reinvent visual editing mechanics. With normalized Markdown accepted, Milkdown/Crepe plus shared Markdown conversion/rendering, DOMPurify, and an injected Mermaid dependency is the preferred candidate. Keep CodeMirror for raw/code workspaces and evaluate Tiptap as the main alternative. The decisive gates are the requested UX, preservation of supported meaning and invisible placeholder comments, and graceful degradation in ordinary Markdown software, not identical source strings.