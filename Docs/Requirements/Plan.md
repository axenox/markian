# Markian Library Implementation and Migration Plan

## 1. Purpose and Decisions

Deliver a reusable, framework-independent Markdown editor with the approved look and feel, implementing the [requirements](Requirements.md) using the architecture in [Approach.md](Approach.md). Then replace Toast UI Editor in Power UI and Codiware without changing Markdown into a proprietary storage format or requiring front-end builds on consumer installations. Plan a separate lightweight viewer in W16 after the Codiware integration; establish its shared rendering boundaries from the beginning. Power UI retains ownership of display-widget adapters.

This is an implementation plan, not a blanket completion claim. The starting inventory below was checked on 2026-10-26. A fresh testable W0-W3 slice was implemented on 2026-10-27; current APIs and limitations are documented in the [README](../../README.md), and partial work-package progress is recorded below. No consumer integration was changed.

Decisions for implementation:

- Keep Milkdown/ProseMirror and its remark-based Markdown model for visual editing. The initial UX gate has passed; do not restart editor selection unless a concrete preservation or interaction blocker emerges.
- Treat Milkdown as a replaceable wiring layer, not a foundation. Markian exists because Toast UI became unmaintained; ProseMirror, remark/mdast, and CodeMirror are the long-term foundations. Confine Milkdown to one internal engine adapter (W1), so leaving it would mean rewriting that adapter's Markdown bridge and plugin wiring and vendoring the MIT-licensed preset schemas, not the commands, views, sessions, extensions, or public API. Do not abstract over ProseMirror itself.
- Keep CodeMirror for raw Markdown, expanded code editing, and Mermaid editing. Each view owns its toolbar, sidebar, selection, and scrolling behavior.
- Write the library source in TypeScript with `strict` enabled. Milkdown, ProseMirror, CodeMirror, and Mermaid are TypeScript too, and the compiler is the main fast feedback loop for the AI agent maintaining the library (W18). Declarations are generated, not hand-written. Consumers still receive prebuilt JavaScript and need no TypeScript. Host-side snippets, such as facade code, remain plain JavaScript under their own conventions.
- Start all migrated integrations in the regular WYSIWYG-like visual mode, including Power UI and Codiware. Keep an optional raw-start setting in the standalone library, but do not use it in the current integrations; users can still switch to raw mode after opening.
- Persist ordinary Markdown with documented normalization, not editor JSON or rendered HTML. Preserve meaningful whitespace, invisible extension comments, and readable generated bodies.
- Keep disabled/read-only editors with their nonmutating controls distinct from the separate W16 display viewer. The viewer supersedes the earlier editor-only product decision, not disabled-editor behavior. Host applications own their display-widget adapters and may use the viewer once delivered.
- Implement no AJAX/data-request transport in Markian. Accept callbacks in configuration; the host callback may use AJAX, local data, generated results, or any other source.
- Publish a prebuilt classic-script JavaScript file plus CSS in the GitHub repository and release tags. Consumer use must not require Node.js, npm, Vite, import maps, or a build step.
- Replace the earlier all-features/single-bundle approach with a core plus optional prebuilt extensions/dependencies. Comment editors must not load Mermaid or programming-language highlighting. Keep factory registration explicit and allow declared dependency loading only for enabled extensions, with host-controlled asset URLs and multi-instance deduplication.
- Publish the direct Composer package as `axenox/markian` and the npm package as `markian`. Also publish npm metadata/artifacts so Asset Packagist can expose the browser package as `npm-asset/markian`.
- Run `npm run build` before every normal developer commit and verify committed artifacts in mandatory CI. Local Git hooks are a convenience/enforcement layer, not an unbypassable security boundary.
- Keep the current Mermaid interaction: a dedicated code/preview view with a Back button that applies changes. Do not add Apply/Cancel controls by default merely because the earlier approach suggested them.
- Introduce a separate Core `MarkianTrait` alongside the unchanged `ToastUIEditorTrait`. Each facade migrates independently; installing the new Core must not force all facades to switch. jEasyUI directly replaces its editor and displays without a Toast UI selector or fallback, as explicitly requested for W11. Do not bulk-rewrite existing stored Markdown during installation.

The scope is the complete required library and migration, not only packaging the current demonstration page. A strict Word-like typing preset and a visual Mermaid shapes authoring sidebar remain discussion/optional items, not blockers for the required v1 scope.

## 2. Starting Point

### 2.1 Library Evidence

The current suite exercises instance ownership, Markdown preservation, and distribution against built library assets. These checks do not establish full production, real-device, or host-integration conformance; remaining acceptance gates are listed below.

### 2.2 What Must Change Before Library Use

The package builds classic-script assets, declarations, notices, and a manifest. Distribution is tracked in `dist`. Full distribution/publication acceptance is still pending below.

Preserve instance ownership, scoped styles, a stable public API, explicit renderer injection, deterministic library builds, and distribution tests. Examples consume the public API; their page shell and assets must not become library dependencies.

### 2.3 Evidence and Scope of the Toast UI Inventory

The parity inventory covers the integrations actually used in this workspace, plus standard controls exposed by their Toast UI toolbars. It is not a claim to implement every upstream Toast UI plugin or undocumented internal API. Working integrations, documented limitations, and TODOs are distinguished below.

| Integration surface | Evidence inspected | Migration significance |
| --- | --- | --- |
| Shared editor/viewer construction | [ToastUIEditorTrait](../../../../exface/core/Facades/AbstractAjaxFacade/Elements/ToastUIEditorTrait.php) | Modes, toolbar, change events, live values, mentions, HTML stencils, counters, newlines, Mermaid, image restrictions, and legacy mention repair. |
| Widget configuration | [InputMarkdown](../../../../exface/core/Widgets/InputMarkdown.php) | Existing `editor_mode`, `allow_images`, mentions, stencils, and Mermaid flags must keep their UXON meanings. |
| UI5 editing | [UI5InputMarkdown](../../../../exface/ui5facade/Facades/Elements/UI5InputMarkdown.php) | Model bindings, prefill timing, invalid-state UI, rerenders, resizing, and fullscreen handling. |
| UI5 viewing | [UI5Markdown](../../../../exface/ui5facade/Facades/Elements/UI5Markdown.php), [UI5DisplayMarkdown](../../../../exface/ui5facade/Facades/Elements/UI5DisplayMarkdown.php) | Preserve-area stale DOM, reused dialog IDs, runtime value restoration, and viewer-specific initialization. |
| jEasyUI editing | [EuiInputMarkdown](../../../../exface/jeasyuifacade/Facades/Elements/EuiInputMarkdown.php) | Assets, value/validation hooks, live references, and disabled-input viewer selection. Runtime disabling is currently a TODO, not proven parity. |
| Codiware Markdown adapter | [MarkdownEditor](../../../../kabachello/codiware/public/js/editors/MarkdownEditor.js) | Loader, raw/split default, image upload/externalization, relative assets, file navigation, save requests, dirty baselines, and teardown. |
| Codiware delivery/settings | [Composer manifest](../../../../kabachello/codiware/composer.json), [extension defaults](../../../../kabachello/codiware/config/defaults.config.json), [shell](../../../../kabachello/codiware/public/index.html) | Composer-only startup, configured asset paths, preview CSS, and editor dependencies. |
| ExFace/Codiware bridge | [IDEFacade](../../../ide/Facades/IDEFacade.php) | Overrides Toast UI's bundle path, provides Core's Mermaid, and applies documentation preview CSS. |
| Server-side rendering | [MarkdownDataType](../../../../exface/core/DataTypes/MarkdownDataType.php) | Existing softbreak policy, alerts, autolinks, front matter, and a separate server security boundary. |
| Documentation placeholders | [DocsTemplateRenderer](../../../../exface/core/Facades/DocsFacade/DocsTemplateRenderer.php) | Actual `BEGIN`/`END` comments and additional print/image metadata, not the demonstration's invented placeholder convention. |
| UI test coupling | [UI5MarkdownNode](../../../bdt/Behat/Contexts/UI5Facade/Nodes/UI5MarkdownNode.php) | Tests currently identify `.toastui-editor-contents`; selectors must move to a supported host/Markian contract. |

## 3. Product Contract

### 3.1 Public API and Lifecycle

Define and document this contract before implementing dependent features. Names below describe the v1 target; check the current API reference for implemented exports.

Default editor startup to visual mode. Provide an optional `initialMode: 'raw'` setting for standalone callers, with `initialMode: 'visual'` as the default. All current integration adapters use visual startup, regardless of legacy raw/split startup settings. This changes the initial presentation, not the stored Markdown or the availability of user-initiated raw-mode switching.

| API | Required behavior |
| --- | --- |
| `Markian.create(element, options)` | Return an independently owned editor handle with a `ready` promise; take initial Markdown explicitly. Support textarea and div hosts. |
| `get()` | Return current Markdown synchronously after initialization, including active raw or specialized-view drafts; never require DOM scraping or hidden mode switches. |
| `set(markdown, options)` | Validate/import before replacing content. Specify origin, history reset, and pending-workspace policy; failures retain the old value. Identical host echoes must not disturb selection or history. |
| `execute(commandId, payload)` | Run a registered command in the active view or report that it is unsupported there. Do not silently apply commands to a hidden editor. |
| `setMode(mode)` | Transfer between visual/raw views at defined boundaries; preserve pending source on validation failure. Support a host-forced mode where required. |
| `setTheme(theme)` | Change light/dark presentation without content events or history changes; do not modify unrelated host instances. |
| `setReadOnly(value)` / `setDisabled(value)` | Both prevent user document changes, not all interaction. Retain search without replace, selection, copying complete Markdown, safe navigation, Help, fullscreen, and diagram pan/zoom. Block editing commands, undo/redo, replace, source/draft edits, paste/drop, task toggles, uploads, and regeneration, including asynchronous results. Preserve drafts/history through state changes; trusted host `set()` remains available under its explicit replacement policy. Do not infer native HTML disabled/form-submission semantics. |
| `on(event, callback)` / returned unsubscribe | Support change, ready, mode, focus/blur, error, tag-click, and host save-request integration. Event payloads identify instance, origin, revision, and active view. |
| `focus()` / `resize()` | Focus the active view and remeasure after hidden tabs or host layout changes, without resetting the value. |
| `destroy()` | Cancel providers/renders, remove listeners/observers/overlays/styles owned by the instance, release engine views, and restore the original host. Be safe when called twice. |

For textareas, preserve name/form association and synchronize the submitted value, including raw/Mermaid drafts. Restore visibility and host attributes on destruction. Define form reset behavior. Initial content is Markdown text, never inferred trusted HTML.

Create an instance root with instance-scoped queries, unique generated IDs, and no singleton document state. Repeated mount/unmount, multiple editable/read-only editors, and editors in iframes must not collide. Share immutable dependencies or a library-loader promise only where safe; providers, histories, selections, URL bases, and themes belong to instances.

### 3.2 Content, History, and Events

Separate the complete editor document, editing sessions, and views. A view is the visible main work area with its appropriate toolbar, not the owner of the Markdown value. Editing sessions modify either the whole document or a specific target: visual editing uses a ProseMirror document, raw editing a CodeMirror buffer, and Mermaid/expanded-code sessions a block draft plus stable target identity and source revision. Help modifies nothing. The document controller projects the complete current Markdown, including pending session drafts even when another view is visible. Views supply presentation, available actions, toolbar/sidebar descriptions, focus, and measurement; sessions retain edits, selection, and history independently of visibility. Applications and extensions use the same public view APIs, without a separate category or privileged interface for nonediting views.

Substantial tasks replace the main work area and its view-specific toolbar within a stable editor shell rather than opening large dialogs. Keep shell navigation, overflow, and fullscreen consistent, and allow small transient menus/prompts. Route commands only to supported actions for the visible task; Help must not edit a hidden session.

Rules:

1. `get()` reflects user-visible edits in every mode, including incomplete Markdown or diagram syntax. Entering a workspace is not a content edit.
2. Emit `change` for actual value changes, including typing, paste, checkbox changes, table edits, undo/redo, and programmatic replacement with an origin. Do not emit duplicate changes just because a draft is committed to its parent model.
3. Host adapters can suppress dirty-state reactions to `origin: host-load`, but normalization and callback timing must never create feedback loops. Host echoes of the current projected value are no-ops.
4. Raw mode uses source-local history and commits changed source to visual mode as one undoable replacement. Preserve raw buffer/history through unchanged round trips; refresh after actual visual document changes.
5. Mermaid and expanded-code sessions use local undo/redo. Back applies one parent-document update; unchanged Back adds no undo step. Invalid Mermaid remains editable and may be saved as a normal code fence with an error preview.
6. Detect target deletion or revision conflicts before applying specialized drafts. For a genuinely different host replacement, require an explicit commit/discard/reject policy; never overwrite a newer document silently. Host permissions may change while a workspace is open.
7. New-record loads reset history; intentional replacement within the same document can be transactional. Presentation, resizing, maximization, and diagram pan/zoom do not enter content history.
8. Opening Help or Preview suspends the prior editing presentation without committing or discarding its session. Test Mermaid draft -> Help -> Back: draft, selection, local history, dirty state, and the complete `get()` value remain unchanged by navigation. Back from Help restores Mermaid; Back from Mermaid applies the block update under rule 5. Help content and preview HTML must never become the editor value.

### 3.3 Configuration and Extensions

Keep declarative settings JSON-serializable: modes, toolbar groups, feature flags, palettes, tab width, templates, matching rules, limits, locale, and URL base. Allow actual callback functions directly in the JavaScript configuration. General handlers are top-level `on<Subject><Action>` options, such as `onLinkInspect` and `onLinkSuggest`, so alphabetical sorting groups related handlers. Mention-specific handlers remain first-level `onSuggest`, `onHover`, and `onClick` options on each `tags[]` entry, beside its matching and storage rules. Do not nest either set under a `callbacks` object. JSON/UXON cannot contain functions: host adapters combine those declarative settings with trusted JavaScript callbacks before creating the instance. Named callback IDs resolved by a trusted host registry are an optional serialization bridge, not a requirement for standalone callers. Never evaluate function strings from UXON or document comments.

Define one typed/documented public instance API used equally by applications, built-in extensions, and third-party extensions for commands, toolbar groups, views, renderers, mentions, help, and other customization. Extensions package ordinary public calls, such as `markian.getToolbar().insert(...)`, rather than using a separate privileged customization API or overwriting configuration. Validate callback types, registered IDs, returned data, and malformed options with actionable errors; do not expose Milkdown or CodeMirror internals as the required host contract. In this plan, a data provider means a configured callback, not a built-in HTTP client.

Public customization methods modify live instance state without mutating original user options or silently replacing host callbacks. Define stable IDs, explicit ordering, collision errors, and explicit host-authorized replacement of existing items/exclusive handlers; notification listeners compose independently. Return removal handles or equivalent cleanup for owned additions. Extension `init(markian)` returns a disposer, and failed initialization must roll back completed additions. Cleanup is idempotent and must not remove unrelated additions or overwrite newer host changes. Enforce permissions, active-view routing, and lifecycle checks equally for applications and extensions. W0/W1 must finalize and test these shared public contracts, including host and extension calls to the same methods.

Markian must not implement `fetch`, XMLHttpRequest, jQuery AJAX, upload requests, endpoint configuration, request headers, credentials, retries, or response-format knowledge for these features. Callbacks own any transport and can instead return in-memory, cached, computed, or worker-generated results. Hosts own authentication, authorization, CSRF headers, and endpoint access. Normal browser resource loading, such as configured script/CSS includes and image URLs, is distinct from this data-request boundary.

Callbacks accept a documented context containing the relevant query/value, document identity/base, instance revision, and an abort signal, and return a structured value or a promise of that value. Markian normalizes both forms, handles synchronous exceptions and rejected promises, debounces invocations where appropriate, and presents loading/empty/error states. It signals obsolete work and ignores late results after newer queries, document switches, permission changes, or destruction. Actual request cancellation is the callback's responsibility if it uses a cancellable transport; Markian remains correct even when the callback ignores the signal.

| Proposed config callback | Responsibility and result |
| --- | --- |
| `onFullscreenEnter` | Optionally replace built-in maximize behavior with host-owned layout/overlay logic. Receive instance, root element, and abort signal; return a restore function or a promise of that function. Markian invokes restoration on exit or destruction. |
| `onImageInsert` | Optionally handle an image blob and return its Markdown destination/alt text; any upload belongs to the callback. Without this callback, use the bounded local data-URI behavior. |
| `onImageSuggest` | Return structured image destination suggestions for the supplied query. |
| `onLinkInspect` | Return existence/unknown status and heading IDs/labels for a destination. |
| `onLinkOpen` | Delegate link navigation to the host without assuming a network request. |
| `onLinkSuggest` | Return structured link destination suggestions for the supplied query. |
| `onPlaceholderRegenerate` | Optionally return an authorized generated body after an explicit user action; never execute automatically on import. |
| `tags[].onClick` | Delegate a mention-type-specific host action without assuming a network request. |
| `tags[].onHover` | Return accessible details for that mention type, with its matching rule in context. Invoke for keyboard focus and touch details too. |
| `tags[].onSuggest` | Return suggestions for that mention type, with its matching rule in context. |

For example, a standalone caller can supply suggestions entirely from local data, without registering an endpoint or using AJAX:

```javascript
const options = {
  onLinkSuggest: ({ query }) => [
    { label: 'Guide', url: 'guide.md' },
    { label: 'Reference', url: 'reference.md' },
  ].filter(link => link.label.toLowerCase().includes(query.toLowerCase())),
};
```

The same callback may return a promise supplied by the host's existing API service. Neither the callback name nor the library contract dictates how its result is produced. These callback names and result shapes must be finalized and covered by declarations during W0/W1.

#### Example: Ticket Mentions

Proposed configuration sketch, not the current library API. Highlight ticket references such as `#32132` while storing them as plain Markdown text. Callback bodies below are pseudocode; the host supplies their logic and any requests.

```javascript
const editor = Markian.create(document.querySelector('#notes'), {
  markdown: 'Follow up on #32132.',
  tags: [{
    id: 'ticket', 
    prefix: '#', 
    pattern: '#[0-9]+', 
    storage: 'text',
    onSuggest: ({ query }) => { /* return matching ticket suggestions */ },
    onHover: ({ value }) => { /* return ticket title and status */ },
    onClick: ({ value }) => { /* open the ticket in the host application */ },
  }],
});
```

#### Example: Custom Toolbar Items

All following examples are proposed configuration sketches, not current exports. Toolbar arrays reference command IDs; pinned and floating layouts are independent. Custom commands use the active-view command contract, including selection preservation and undo grouping. Icon names resolve through the supported icon registry.

```javascript
const editor = Markian.create(document.querySelector('#notes'), {
  markdown: '',
  toolbar: {
    pinned: ['bold', 'italic', 'insertDate', 'templates'],
    floating: ['bold', 'italic', 'template:kbd'],
  },
  commands: [{
    id: 'insertDate',
    label: 'Insert date',
    icon: 'calendar',
    modes: ['visual', 'raw'],
    onExecute: ({ instance, selection }) => { /* insert today's date at selection */ },
  }],
});
```

#### Example: Templates and HTML Stencils

The built-in `templates` command opens the configured menu; `template:<id>` exposes one template directly. All templates use a `markdown` string, with optional `{{selection}}` substitution rather than a separate wrapping object. Safe HTML stencils use the same format, for example `<kbd>{{selection}}</kbd>`, without editor-only wrappers.

Substitute the selected text literally with context-appropriate Markdown/HTML text escaping; do not evaluate expressions, recursively expand selected text, or interpolate raw HTML. With no selection, insert an empty string at the placeholder and place the caret there. Templates without a placeholder insert their fixed body, replacing any selection. Execute insertion as one undoable active-view command. Reject placeholders in unsupported contexts such as HTML attributes or link destinations, and apply the allowed-HTML policy to the template itself.

```javascript
const editor = Markian.create(document.querySelector('#notes'), {
  markdown: '',
  toolbar: { pinned: ['templates', 'template:kbd'] },
  templates: [
    {
      id: 'testCase', label: 'Test case', icon: 'clipboard-check',
      markdown: '## Test case\n\n### Steps\n\n1. \n\n### Expected result\n\n',
    },
    {
      id: 'kbd', label: 'Keyboard key', icon: 'keyboard',
      markdown: '<kbd>{{selection}}</kbd>',
    },
  ],
});
```

#### Example: Host Services and Render Extensions

Callback bodies are pseudocode. Load extension code and register trusted factories once by ID before editor creation. `hostMermaid` is a supplied supported renderer instance; `docsPlaceholderExtension` implements the proposed placeholder contract, not executable configuration from Markdown. Registration alone does not activate an extension or create shared editor state. Each enabled factory creates an independent extension instance. Omitted or `enabled: false` entries have no initialization, contributions, or optional dependency loading; an enabled unknown ID is a configuration error. Instance entries contain `enabled` and `config`, not a code-loading `source`; optional dependency loaders belong to documented extension-specific configuration. Host services own requests; image insertion returns a saved destination, and fullscreen entry returns its restore function.

```javascript
Markian.registerExtension('mermaid', mermaidExtension);
Markian.registerExtension('docsPlaceholders', docsPlaceholderExtension);

const editor = Markian.create(document.querySelector('#notes'), {
  markdown: '',
  extensions: {
    mermaid: { enabled: true, config: { renderer: hostMermaid } },
    docsPlaceholders: { enabled: true, config: {} },
  },
  onFullscreenEnter: ({ element, signal }) => { /* expand host layout; return restore */ },
  onImageInsert: ({ blob, signal }) => { /* save file; return { url, alt } */ },
  onImageSuggest: ({ query, signal }) => { /* return image suggestions */ },
  onLinkInspect: ({ value, signal }) => { /* return status and heading IDs/labels */ },
  onLinkOpen: ({ value }) => { /* navigate using the host application */ },
  onLinkSuggest: ({ query, signal }) => { /* return destination suggestions */ },
  onPlaceholderRegenerate: ({ value, signal }) => { /* return authorized generated body */ },
});

await editor.ready;
```

W0/W1 must finalize these option/result shapes and turn the sketches into tested public-API examples; they do not authorize engine-internal access or built-in AJAX.

## 4. Packaging and Repository Policy

### 4.1 Deliverables

Develop modules internally, but make these stable paths the public installation contract:

```text
dist/
  markian.min.js
  markian.css
  markian.d.ts
  markian-viewer.min.js
  markian-viewer.css
  markian-viewer.d.ts
  extensions/
    mermaid.min.js
    code.min.js
    code.css
    languages/
      ...
  manifest.json
  THIRD_PARTY_NOTICES.txt
```

The core script is a classic-script IIFE exposing the library factory as `window.Markian`, not a live editor instance. It provides ordinary visual Markdown editing, basic raw-source editing, conversion/rendering, sanitization, and core controls/icons. Optional extensions supply Mermaid and programming-language highlighting/expanded-code features through separately loadable prebuilt files. The paths above illustrate the modular layout; W0/W2 finalize exact optional filenames and language assets. Do not include an entire programming-language parser collection or Mermaid renderer in the core. Reuse the raw editor's CodeMirror foundation rather than shipping a second competing runtime.

The separate viewer JS/CSS/declarations are W16 deliverables, not requirements for the initial W2 editor package. From W1-W3 onward, keep Markdown parsing/rendering, sanitization, URL/heading rules, and content typography/theme tokens reusable without imports from editor engines, sessions, commands, or controls. W16 builds those modules through a rendering-only entry point: it must work without the editor script or CSS, and neither entry point may overwrite the other's globals. Shared source does not require runtime chunk loading or zero duplication when both bundles are present; finalize that tradeoff and the viewer export in W16 using measured artifacts.

Core and extensions must work through ordinary `<script src>`/`<link>` delivery without consumer compilation, import maps, or an implicit CDN dependency. Hosts load/register extension factories before enabling them per instance. Enabled extensions may load their declared prebuilt dependency assets on demand through documented host-controlled URLs; explicit script/CSS loading is allowed and is not an AJAX data-service feature. No hidden bundler chunk discovery or guessed asset locations. An ESM build may supplement, not replace, this delivery contract.

Mermaid is one optional extension, not the sole exception to a single-file rule. Accept a host renderer adapter/supplied instance first and a configured dependency loader second. Do not import a sibling Core filesystem path; Power UI passes its existing Mermaid. Publish supported versions and resolve third-party assets through explicit host configuration or documented prebuilt package paths with notices/version metadata. Treat language packs similarly. Disabled/absent extensions must not request their optional dependencies even if matching fences occur in the document. Preserve fenced source/plain-code fallback; failed requested rendering must not prevent unrelated editing.

Deduplicate compatible script/CSS/dependency loads across editors; validate incompatible versions and retain independent extension instances, sessions, themes, and callbacks. Do not unload shared assets when one instance is destroyed. Document loading order, CSP and asset-base behavior, and provide offline tests serving selected assets locally. The complete modular distribution remains committed and publishable without a consumer build; an all-features aggregate must never be mandatory for comment-editor use.

This distribution covers Markian-owned assets, not every external extension. ExFace/Power UI Core supplies the planned `docsPlaceholders` extension as prebuilt assets in its own package, with supported Markian versions, dependency metadata, and notices. Hosts resolve/load those assets and register the factory before per-instance opt-in, composing the packages' metadata without adding a mandatory Core dependency or sibling filesystem import to Markian. Core packaging/build gates cover its extension artifacts; Markian's manifest need not hash files it does not ship. Neither package may require a consumer build. Exact Core browser paths and factory exports must be finalized during integration, not assumed from the example variable names.

Make CSS entirely Markian-scoped, with documented custom properties and local theme state. Do not ship the demo's global selectors, remote fonts, image requests, or fixed page dimensions. Embed required selected MDI paths; preserve licenses. Provide stable class/data-attribute hooks for editor/Preview styling and tests without promising editor-engine internals.

`manifest.json` records library/extension versions, declared core/extension/dependency assets, their relationships, and artifact hashes; it must not embed changing build timestamps, machine paths, or Git commit hashes that make rebuilding the same source produce different bytes. Check Windows/Linux determinism for all core and optional outputs. Decide source-map publication explicitly and exclude local absolute paths.

### 4.2 Commit the Ready-to-Use Distribution

Remove `dist/` from the ignore rules and commit the complete required distribution. Keep `node_modules/`, test output, caches, and temporary artifacts ignored. Separate the demo build/output from the library output so the current Vite-generated HTML and hashed application assets do not become the library contract.

Every source/dependency/configuration change that affects the build must include its resulting distribution in the same commit. Release tags point to commits already containing the verified build. GitHub release downloads may mirror those files, but must not be their only location. Do not use an npm lifecycle script or a Composer post-install script as the only way consumers obtain compiled assets.

Retain one pinned lockfile and a documented Node/npm/TypeScript toolchain. Type checking (`tsc --noEmit`) is separate from the Vite build, which strips types without checking them. Use a clean output directory and deterministic core/extension build configuration. Start with the existing Vite toolchain's library/Rollup-compatible output if it satisfies modular script-tag delivery and declared-asset tests; change bundlers only for a demonstrated build constraint. Include transitive license notices and an upgrade policy for security-sensitive dependencies.

### 4.3 Build on Every Commit

Implement a versioned Git hook plus a cross-platform Node runner, installed by a documented `npm run hooks:install` bootstrap after `npm ci`. The hook invokes `npm run build` on every normal commit, including documentation-only commits, and fails the commit on build failure. It must work with Git for Windows and Git GUIs rather than requiring PowerShell-only or Unix-only business logic.

The default hook policy is **build and verify**, not broad automatic staging:

1. Check that the index and working tree agree for build inputs, including tracked source, the lockfile, package/build configuration, and build scripts. Refuse ambiguous partially staged build inputs; explain how to finish staging or postpone the unrelated edits. Never silently stage source files.
2. Run the type check and the deterministic library build.
3. Check that tracked, staged, unstaged, deleted, and newly generated distribution files match the exact build being committed. A plain `git diff -- dist` alone misses some of these states.
4. If distribution changes are not staged, stop and ask the developer to review/stage them and retry. Rebuilding on the retry must be byte-identical. Never auto-stage the whole repository or modify unrelated user changes.
5. Optionally provide an explicit `npm run build:stage` convenience command that stages only the reviewed distribution; it is not a substitute for input/index checks.

Git hooks are not installed by cloning and can be bypassed with `--no-verify`, a GUI setting, or altered Git configuration. Therefore:

- Add required GitHub Actions checks: `npm ci`, type check, build, artifact parity, unit tests, browser smoke tests against **dist**, and packaging validation. Run source tests as appropriate too.
- Artifact parity must catch untracked output as well as changed/deleted tracked files, using a clean checkout and a structured status check scoped to `dist/`.
- Protect the integration/release branches and require these checks; restrict unchecked direct pushes. Do not rely on a hook to protect a release.
- If every individual commit in a merged history must be certified, run a lightweight artifact rebuild for each newly introduced commit, not just the PR head. Alternatively enforce squash merging and certify the final merge result. A head-only check must not be described as proof that all intermediate commits contain valid assets.
- Run the build again at release verification and refuse publishing if it changes committed files. Publish the verified artifacts; do not create an uncommitted release-only build.

### 4.4 npm and Asset Packagist

The npm package name is `markian`, with the Asset Packagist mapping `npm-asset/markian`. The direct Composer package name is `axenox/markian`. These names are decided; confirm publishing access and registry availability, and verify the Asset Packagist mapping in an installation test.

Maintain publishable library metadata, with SPDX license, repository information, supported engines for contributors, version, browser/type entry points, and a `files` allowlist including all core/extension assets under `dist`, the license, and required documentation. Keep demo/test tooling in development dependencies; published runtime use must not install/build Milkdown or CodeMirror. Required runtime code is prebuilt into the appropriate core/extension assets; optional language/dependency files remain selectable without npm installation on the runtime host.

Asset Packagist indexes npm/Bower metadata; committing files to an arbitrary GitHub repository does not by itself register an asset package. Publish the corresponding npm version and verify Asset Packagist discovery, version metadata, downloaded archive contents, and installed paths. Use the same semantic version for npm, Git tags, direct Composer, and the artifact manifest. Tag naming must be recognized by both ecosystems.

Validate `npm pack` output before publishing and install the resulting archive in an empty browser fixture. Never depend on consumers running `prepare`, `postinstall`, or a compiler to create `dist`. Verify installation with lifecycle scripts disabled and without Node on the final PHP runtime host.

### 4.5 Direct Composer Package for Power UI

Add a root `composer.json` to the Markian repository and register it with Packagist, so Power UI can require Markian directly rather than going through Asset Packagist. Proposed minimal metadata:

```json
{
  "name": "axenox/markian",
  "description": "Framework-independent Markdown editor with prebuilt browser assets",
  "type": "library",
  "license": "MIT"
}
```

Use real repository/support metadata when publishing; do not hard-code a Composer `version` field when tags supply it. This is a JavaScript/CSS library: no PHP bootstrap or PHP dependency on ExFace is required. Do not represent it as an ExFace metamodel app merely to make its assets installable. Core/facade includes must explicitly reference the installed assets.

Expected direct installation path is `vendor/axenox/markian/dist/markian.min.js` and its stylesheet. Add version constraints to the packages that actually consume Markian, and ensure the application's resolved graph includes it. Decide which shared facade component owns the common dependency rather than relying accidentally on another facade to install it.

Keep the direct Composer package free of mandatory `npm-asset/*` dependencies: it supplies prebuilt core/extension assets, while external optional dependencies such as Mermaid are explicitly supplied/configured by the host. This lets Power UI install Markian without adding Asset Packagist solely for this editor. A consuming application's root Composer configuration, not a dependency's `repositories` section, controls any additional repositories it needs.

Both routes install the same artifact contents:

| Route | Intended consumer | Asset path to configure |
| --- | --- | --- |
| `axenox/markian` through Packagist | Power UI and Composer-first integrations; recommended for Codiware too | `vendor/axenox/markian/dist/...` |
| npm package | JavaScript consumers or a conventional npm installation | Package `dist/...` |
| Asset Packagist npm mapping | Hosts standardizing browser dependencies under `npm-asset` | Verify `vendor/npm-asset/markian/dist/...` in a clean install. |
| GitHub/tag checkout | Script-tag consumers and development checkouts | Committed `dist/...` directly. |

Do not require both Composer routes in the same host by default. Asset URL configuration resolves the selected route, not a hard-coded vendor prefix. If temporarily both are installed, deduplicate loading by configured URL/version and fail clearly on incompatible duplicate globals.

## 5. Implementation Work Packages

Work-package IDs are used by the coverage and migration tables. Each package has explicit deliverables and an acceptance gate; complete adjacent packages incrementally rather than performing an untestable application-wide rewrite.

Track completed work and remaining tasks below as implementation proceeds. The # column gives the planned sequence; WP IDs remain stable for references. Mermaid and Code precede the Codiware integration. The Done and ToDo columns are intentionally empty initially; an empty cell is not a completion claim.

| # | WP | Description | Done | ToDo |
| --- | --- | --- | --- | --- |
| 1 | W0 | Freeze Contracts and Compatibility Fixtures | Initial typed API, bounded preservation corpus, conservative raw fallback and URL policy. | Final browser/device and normalization policies, full fixture inventory, publication access and compatibility decisions. |
| 2 | W1 | Extract the Instance-Based Library and Demo | Fresh strict-TS core; independent div/textarea instances, forms, histories, lifecycle/events, public registries, atomic schema fixture and optional Code proof. | Full structural grammars/nested mappings, command/view hardening, complete read-only search/navigation and remaining acceptance matrix. |
| 3 | W2 | Establish Build, Distribution, and Packages | Prebuilt IIFEs/CSS/types/notices/hash manifest; npm/Composer metadata, index-aware opt-in hook, Windows/Linux CI definition, real npm archive install/browser check with scripts disabled. | Run CI/cross-OS parity, configure required branch checks, verify tagged Composer install, npm/Packagist access/publication and Asset Packagist mapping. |
| 4 | W3 | Complete Markdown Import, Export, and Viewing | Shared engine-free GFM parsing/sanitization/anchors/softbreak policy; semantic import guard, comment preservation, safe Preview, source-preserving fixture checks. | Rich allowed-HTML/front-matter visual mappings, reference-link normalization policy, full interoperability corpus and independent GitHub/GitLab/host-renderer comparison. |
| 5 | W4 | Complete Editing Controls and Responsive UI | Configurable pinned/floating/overflow menus, command state, H1-H6/lists/tasks/alerts, word-at-caret formatting, backtick/tilde rules, bounded color preset, view-scoped search/replace, paired cancellable fullscreen callbacks. | Full raw-command parity, independent query histories for separate sessions sharing a view ID, real-device/IME, screen-reader and host overlay/iframe acceptance. |
| 6 | W5 | Finish Tables | GFM insertion, row/column edits including final-row/column deletion, header promotion, column alignment, ProseMirror navigation/selection, touch controls and undo/mode checks. | Broader keyboard selection/navigation and mobile-device acceptance; external spreadsheet paste remains W17. |
| 7 | W6 | Links, Images, and Repository Providers | Destination/heading panels, relative URL base, local/promise suggestions/inspection/opening, stale-result rejection, raster paste/drop/file path, callback save gate, cancel/retry/removal and native form protection. | Actual Codiware image-file creation/save/reopen and authenticated resource resolver integration in W10/M2; broader existing-link edit/remove fixtures. |
| 8 | W7 | Shared View Navigation and Outlines | Public view/session fixtures, suspended draft projection/events, hidden-session mutation guards, explicit raw/block replacement policy and baseline conflicts, parsed visual/raw outlines with current section and compact drawer. | Nested structural block targets beyond current top-level code fences; broader destroyed-target and real-device navigation acceptance. |
| 9 | W8 | Templates and Mentions | | |
| 10 | W9 | Security, Accessibility, and Release Hardening | | |
| 11 | W13 | Deliver the Mermaid Extension | Separate optional IIFE/CSS/types and external Mermaid 12.2.x metadata/notices; host-configured URL or versioned supplied adapters, deduplicated isolated loader, sanitized/scoped SVG, centered labels, floating controls, insertion/editing sessions, history/indent/help/draft saving, pan/zoom, retry/error and separate packaged example; focused Chromium/distribution fixtures. | Real-device touch, screen-reader, cross-browser and restrictive-CSP acceptance remain applicable W9 gates; block-session targeting retains W7's top-level-fence limitation. |
| 12 | W14 | Deliver the Code Extension | | |
| 13 | W10 | Integrate Markian in Codiware | | |
| 14 | W16 | Deliver the Lightweight Viewer | Separate rendering-only IIFE/CSS/types and MarkianViewer lifecycle; shared semantics/security, exact source, safe resource callbacks, scoped themes, cancellable sanitized fence adapters, disabled-by-default lazy Mermaid adapter without editing UI; measured raw/gzip/Brotli budgets and import-graph gate; Chromium corpus/coexistence/desktop-mobile checks and installed offline/subdirectory archive fixture. | W9 cross-browser, restrictive-CSP, screen-reader and real-device gates; W11/W12 own display-widget bindings/adoption. Publication/cross-OS parity retain W2 gates. |
| 15 | W11 | Integrate Markian in JEasyUIFacade | Additive Core trait/host bridge; direct replacement of EuiInputMarkdown and EuiMarkdown plus explicit DisplayMarkdown viewer, with no Toast UI option; prebuilt assets/dependency, readiness-safe values, disabled transitions, validation/lifecycle hooks; seven focused Chromium bridge checks including AJAX factory replacement, real New/Edit message startup, description loading, editing, disabled transitions, clearing and close/reopen. | Remaining real form/validation/fullscreen/iframe and mixed-facade acceptance, W8 mention/stencil controls (configured widgets warn but remain editable), strict source-image permissions and remaining W9 gates; host PHPUnit runner unavailable for added pure trait tests. |
| 16 | W12 | Integrate Markian in UI5Facade | | |
| 17 | W15 | Deliver Core's DocsPlaceholders Extension | | |
| 18 | W17 | Rich Paste from HTML, Word, and Excel | | |
| 19 | W18 | Set Up the DevMan Maintenance Agent | | |

### W0. Freeze Contracts and Compatibility Fixtures

Deliver a versioned browser/device baseline, initial language/Mermaid version list, normalization policy, unsupported-content policy, and default limits. Confirm publishing access for Composer `axenox/markian` and npm `markian`; keep publication credentials outside source control.

Build anonymized fixture documents from current use cases: short comments/errors, rich tickets, documentation with actual placeholder pairs, mentions, HTML stencils, large tables, images/data URIs, alerts, front matter, relative links, and Mermaid. Include malformed/unknown comments, empty links, reference links, Unicode headings, ordered-list starts, nested lists, escaped pipes, code fences longer than their content, hard breaks, and indentation. Keep known defects as explicit fixtures, not behaviors to copy blindly.

Resolve compatibility policy for colors, data-URI publishing, allowed HTML, host display-widget task interactions, and existing softbreak settings. Markian's own disabled/read-only mode must never toggle tasks. Security must not be relaxed to emulate an unsafe old renderer. Record any intentional visible differences before migrating a consumer.

Freeze extension initialization order: resolve enabled factories and required construction-time assets, collect structural contributions through the shared public API, validate collisions/compatibility, then construct the engines and import the initial document before resolving readiness. Structural contributions include schema and Markdown parser/serializer mappings; close their registration before engine construction and reject late structural additions explicitly. Live commands, controls, views, and renderers follow their documented runtime lifecycle. Define asynchronous initialization, failure rollback, and destruction during initialization without exposing engine internals or silently rebuilding the document. Optional language assets may load later without changing the schema.

Acceptance: every requirement and each gap-table row maps to a work package and a test or explicit product decision. No source compatibility claim relies only on a screenshot.

### W1. Extract the Instance-Based Library and Demo

Separate the document controller, engines, mode views, command registry, toolbar/dialog components, provider manager, rendering pipeline, themes, and host adapters. Keep related logic together; do not invent a plugin layer for every small helper. Write extracted modules in strict TypeScript and add the `typecheck` script; do not keep parallel JavaScript copies of migrated modules.

Prepare W16's boundary now: shared render/policy/content-style modules must not import Milkdown/ProseMirror, CodeMirror, editor state, or toolbar/session code. Editor-specific schema/engine adapters depend on those modules, not the reverse. Establish a rendering-only import-graph check or minimal fixture during extraction; this does not require delivering the viewer API before W10.

Isolate Milkdown behind one internal engine adapter during the same extraction:

- Only the adapter module imports `@milkdown/*`. It owns editor creation, Milkdown's context and plugin registration, the mdast-to-ProseMirror parser and serializer, and teardown. It exposes Markian-owned operations: create, parse Markdown to a ProseMirror document, serialize a document to Markdown, access the ProseMirror view, and destroy.
- Describe nodes in a Markian-owned format, conceptually `{ id, schema, fromMarkdown, toMarkdown, nodeView, inputRules, keymap }`, using plain ProseMirror and mdast types. The adapter translates these into Milkdown registrations. Use the same format as W0's construction-time structural contribution contract, so extensions never see Milkdown runners.
- Write commands as ProseMirror commands in the Markian command registry, not as Milkdown command keys. Node views, input rules, task controls, block sessions, and the Mermaid/code views use ProseMirror APIs only. Derive change events from ProseMirror transactions rather than Milkdown's listener plugin.
- Import ProseMirror through one internal re-export module, currently backed by Milkdown's re-exports, so a later switch changes one file and the bundle keeps a single ProseMirror instance.
- CodeMirror raw and code views remain independent of the adapter.

Add an import-graph check that fails on `@milkdown/*` imports outside the adapter, next to the rendering-only check. W3's round-trip corpus is the regression net for any future adapter replacement.

Before broad extraction, implement a minimal vertical slice of W14's Code extension as the public-API proof-of-concept. Use one ordinary fenced code block, a target-aware toolbar command, a renderer contribution, and an expanded CodeMirror view with local undo/redo and Back. Verify complete-document draft values, one-step commit, permissions, disposal, and independent enabled/disabled instances without Mermaid or host services. Exercise asynchronous initialization failure/destruction and rollback of owned additions. This slice develops only the necessary W1/W7 foundations; full W14 delivery retains its later dependencies and packaging gates. Reuse the slice in W14 rather than maintaining a separate demonstration implementation.

Code fences already have a core schema, so a passing Code slice does not prove registration of new node types. Keep a focused construction-time contract test for schema/parser/serializer contributions and late-registration rejection before claiming that generated-region extensions are supported; the test does not require implementing DocsFacade grammar. Templates and mentions remain core features, implemented through the same public customization operations rather than privileged extension-only access.

Move the demonstration page onto the new public factory. Support multiple independently themed editable/read-only editors, textarea mounting/submission/reset, hidden-tab remeasurement, compact containers around 300 by 400 pixels, read-only/disabled transitions, and full disposal. Define a stable readiness/error surface for asynchronous asset or renderer failures.

Acceptance: classic-script fixture mounts independent editable and read-only editors without a framework; values, histories, mode changes, focus, overlays, and destruction remain independent. Read-only search/copy/navigation work while every user mutation path is blocked, including extension and asynchronous paths; permission changes retain drafts/history. Verify visual startup by default and explicit raw startup for standalone callers. Demo-specific network/assets are absent from library startup. The import-graph check confirms that only the engine adapter imports Milkdown, and node definitions, commands, and node views use the Markian-owned format and ProseMirror APIs.

### W2. Establish Build, Distribution, and Packages

Implement Section 4 before adding a large advanced feature surface. Commit the first real library build, declarations, notices, and manifest. Add hook installation, index-aware verification, clean CI artifact checks, package validation, direct Composer metadata, and npm publication metadata.

Acceptance: a clean Git tag checkout, an npm package installation, and direct Composer installation all supply ready-to-use assets. Also verify Asset Packagist installation once the version is published. Browser fixtures run only against packaged `dist`, with no dev-server module resolution or sibling Core import. Required branch checks reject a stale or missing build.

### W3. Complete Markdown Import, Export, and Viewing

Define CommonMark plus the required GFM subset: tables, tasks, strikethrough, and extended autolinks. Preserve ordered-list start values, nested structures, hard/soft breaks, code indentation, reference-link meaning, fence contents, inline code boundaries, and extension comments. Make export/import idempotent after normalization. Preserve supported HTML as explicit mapped content; retain unsupported constructs as inert opaque source or refuse visual import without losing the raw buffer.

Automatically detect bare URLs, `www` destinations, and email addresses in eligible editor text, including disabled/read-only presentation. Autolinking is always enabled, not a configuration option; adapters must not expose or translate an `extendedAutolinks` toggle. Apply the URL safety policy, handle surrounding punctuation, and exclude code and existing links. Do not rewrite raw Markdown merely to make detected destinations clickable in rendered content.

Create consistent dialect and sanitization definitions across editable/read-only editor presentation and W16's future viewer, including headings/anchors and extension fallbacks. Implement the shared rendering/policy boundary now; defer the viewer factory and packaging to W16 after W10. Support a configurable softbreak rendering policy for Power UI's `enable_newlines`; do not rewrite stored text merely to change presentation. Preserve front matter and define its presentation in the Power UI preset, checking host widgets and the existing server converter for compatibility.

Test GitHub and GitLab independently with a conformance corpus. Neither a GFM label nor rendering through the same library twice proves interoperability. Extension metadata must remain invisible and generated content readable in an independent renderer without the extension.

Acceptance: semantic round trips, comments and unsupported-input handling, editable/read-only presentation consistency, host-widget compatibility fixtures, and independent rendering pass before any production data is saved through Markian.

### W4. Complete Editing Controls and Responsive UI

Create a shared command registry with active-view applicability, enabled state, labels, shortcuts, and history grouping. Complete pinned/floating/contextual toolbars, independently configurable layouts, custom buttons and dropdowns, floating-only presets, H1-H6, inline styles, list/task conversion, indent/outdent, horizontal rules, quote variants, links, images, raw mode, undo/redo, and clear formatting.

Toolbar containers use explicit `type: 'menu' | 'group'` with shared recursive `items`. All default pinned items belong to groups; separators derive from nonempty group boundaries. Top-level containers accept `align: 'default' | 'opposite'` for left overflowable and right pinned placement, preserving order within each side. Explicit separator/overflow entries and command-name-based alignment are replaced by this contract. Public toolbar insertion is `insert(item, group?, beforeId?)`: target a named container, append when `beforeId` is omitted, and use the last top-level default-aligned inline group when `group` is omitted. Existing configured ID references retain precedence; missing groups do not create implicit containers. A group that collapses into a menu on narrow screens remains a possible future container type, outside the current implementation.

Preserve word-at-caret formatting and typing out of inline code without invisible sentinels. Test punctuation, empty selections, nested lists, composition, paste, and literal Markdown characters. Fix supported input rules rather than normalizing away typing defects; cover both backtick and tilde code fences deliberately.

Provide compact text-color swatches for a configurable 5-10 color palette. Store color metadata only through an explicit allowed-HTML extension/preset; GitHub may strip colors. Portable mode must not promise color fidelity or emit visible proprietary syntax. Provide ordinary quotes as the baseline and documented GitHub-style alert syntax for compatible presets.

Implement overflow menus, optional bottom/mobile placement, touch controls, focus-preserving dialogs, keyboard menus, accessible tooltips, and a reliable maximize/restore overlay. Keep the same instance, history, selection, and scroll state, and restore host layout and focus. Define iframe viewport limits; parent-level expansion requires a host bridge. Do not use global body state that one editor can accidentally undo for another.

Implement search and replace as a view-scoped panel in the main work area, as described in the style guide. Search applies to the visible view's session: rendered text in visual mode, Markdown source in raw mode, and the block draft in code/Mermaid sessions; Help and Preview search their own presented text without replace. Provide match highlighting, a current/total count, next/previous navigation with scrolling into view, and case-sensitive and whole-word options. Regular expressions are optional; if offered, bound their execution under W9's limits and report invalid patterns without blocking editing. Keep search state per instance and session; switching views must not apply a stale query or replacement to a hidden session.

In visual mode, matches stay within one textblock and may cross inline formatting; a replacement inherits the formatting at the match start. Replace never edits invisible extension comments, protected generated bodies, or mention/HTML-stencil boundaries it cannot represent safely; skip or report such matches instead. Replace one and replace all are each a single undoable step and emit one `change`. Disabled/read-only editors keep search but hide or disable replace, including its shortcut. Bind Ctrl/Cmd+F and the replace shortcut only while the editor has focus, so the browser's page search remains available otherwise; Escape closes the panel and restores focus/selection. Search works in compact, fullscreen, and mobile layouts.

Make fullscreen behavior configurable through `onFullscreenEnter({ instance, element, signal })`. Without the callback, use Markian's built-in maximize/restore behavior within the current document viewport; this does not require the browser Fullscreen API. With the callback, delegate layout, reparenting, host overlays, stacking, and any parent-frame bridge to trusted host code instead of also applying the built-in overlay. The callback returns a synchronous, idempotent restore function, directly or through a promise; this is the paired exit/cleanup operation, not merely a fullscreen notification.

Markian owns the fullscreen command/control state, duplicate-request prevention, exit/Escape handling, and remeasurement after transitions; the host owns reversal of its layout changes. Enter fullscreen state only after successful callback completion. Report exceptions/rejections without changing content or losing the prior state; a failing callback must undo any partial host changes before rejecting. On exit or destruction, invoke the returned restore function once and report cleanup errors. Abort pending entry on destruction or a cancelled request; if an obsolete entry still resolves, immediately invoke its restore function rather than leaving an orphan overlay. Keep restoration independent of document history and test focus/selection/scroll preservation without recreating the editor.

Acceptance: command parity in visual/raw views, separate selection toolbar configuration, keyboard/screen-reader checks, and real-device mobile/IME tests pass in small embedded hosts as well as fullscreen. Search/replace tests cover each view's scope, matches across inline formatting, single-step undo for replace one/all, skipped protected content, read-only search without replace, focus-bound shortcuts, and no replacement in hidden sessions. Cover default behavior and custom synchronous/asynchronous fullscreen callbacks, rejected/cancelled entry, repeated toggles, Escape, destruction during entry, and multiple independently maximized instances.

### W5. Finish Tables

Reuse ProseMirror table primitives and finish row/column insertion/deletion, header/alignment controls, keyboard navigation, selection, and touch/context menus. Avoid unsupported merged-cell promises in a GFM table model. Include undo/redo for every operation and mode round trips. Pasting tables from Excel and other external sources belongs to W17.

Acceptance: table commands, keyboard/touch navigation, and mode round trips pass browser tests; deleting the final row/column and undoing remain stable.

### W6. Links, Images, and Repository Providers

Finish insert/edit/remove links, separate target-heading selection, a configurable document base, stable heading anchors, duplicate/Unicode slug policy, and Ctrl/Cmd-click plus a mobile-accessible open action. Store relative destinations unchanged. Render/open through a host URL resolver that does not replace Markdown with transport/download URLs.

Add link/image suggestion and link-inspection callbacks returning structured results or promises, including existence/unknown status plus heading IDs. Show loading/empty/error states; reject stale results. Markian only invokes callbacks; it makes no AJAX requests. Codiware callbacks use its API service for repository lookup, allowed-file navigation, and guarded image URLs. A host inspection endpoint must not become a generic remote-URL fetcher that creates SSRF risk.

Support paste/drop/file-selection of bounded raster images, alt text, and URL images. The standalone default stores data URIs as required. An optional configured image callback can instead save the image through host-owned code and return a regular destination URL. Codiware must use this callback: successful paste saves an image file in a host-selected location and inserts ordinary `![alt](url)` Markdown, never the image binary or a data URI. The existing hooks, neighboring `images` folder convention, deduplication, and save-time externalization are implementation choices, not compatibility requirements.

Markian tracks the pending callback result, not an upload transport. Keep temporary previews and pending image blobs outside persisted Markdown. Explicitly handle pending results, deleted image nodes, cancellation signals, and save ordering. In Codiware, wait for image-file creation before saving the document; on failure, report it and allow retry/removal of the pending paste, without silently falling back to embedded binary or dropping the paste. Never save a temporary blob URL or a destination whose file creation failed. Reject unsafe SVG/data schemes rather than accepting arbitrary `data:` targets.

Acceptance: relative path/query/fragment behavior survives both modes; synchronous/local and promise-based callbacks work without library AJAX. Test standalone data-image persistence separately from Codiware paste-to-file behavior: an actual file exists, saved Markdown contains a regular image destination and no pasted binary/data URI, and the image renders after reopening. Pending/failed pastes cannot yield a falsely successful document save.

### W7. Shared View Navigation and Outlines

Deliver the shared public view/session operations used equally by applications and extensions. Views own presentation, not separate document values. Complete target-revision conflict handling, active-draft API/events, view-local toolbars/sidebars, and Back navigation. Opening Help suspends presentation without committing or losing drafts, selection, or history; returning restores the prior task. Block sessions apply one parent-document update when their own Back action completes, with no history entry for unchanged content. Extension-specific views belong to W13-W15, not this shared package.

Finish the view-owned outline: parsed ATX/Setext headings, exclude the title heading starting on line 1, shared slug rules, current-section indication, collapse on desktop and a usable mobile drawer. Visual navigation targets rendered content; raw navigation targets the actual code scroller and line, not the page. Specialized code/Mermaid views have their own relevant sidebar contract; they do not inherit a stale document outline.

Acceptance: host-created public-API view/session fixtures verify suspended drafts, complete-document values, history/events, no-op Back, conflicting host updates, destroyed targets, and permission changes. Desktop/mobile outline navigation works in visual/raw views without stale sidebars in specialized views. No optional extension dependency is required to exercise the shared contract.

### W8. Templates and Mentions

Implement Markdown templates/stencils and parameterized insertion menus. Use `markdown` strings with optional literal `{{selection}}` substitution for both fixed templates and selection wrappers, including empty-selection caret placement and context-safe escaping. Add safe mapped HTML stencils, especially `<kbd>`, that serialize only the intended HTML element and escaped content. Preserve configured captions, hints, icons, and restricted presentation styles; do not serialize editor-only wrappers.

Implement mention rules with prefix priority, bounded matching, distinct styles, structured suggestions, click events, and accessible hover/focus/touch details. Exclude code, URLs, and other invalid contexts. Store plain text by default or ordinary links by explicit configuration. The Power UI preset must recognize existing `[@label]()` and linked mentions without converting them to visible private widget syntax. Host callbacks translate filter/display attributes, page limits, headers, and action metadata into any required requests; do not pass this backend-specific transport configuration into the standalone library.

Keep each mention type's `onSuggest`, `onHover`, and `onClick` handlers directly on its configuration object in `tags[]`. Dispatch to the matched rule directly, without a nested callback object or a required global mention-type switch. Use `onHover` for accessible focus/touch details as well as pointer hover. Scope pending suggestions/details to that rule and query; test distinct ticket/user handlers and stale results when the active mention type changes.

Acceptance: template selection substitution, empty-selection caret placement, literal/nonrecursive escaping, unsupported substitution contexts, single-step undo, HTML stencils, existing mention forms, competing prefixes, and mention-provider failures pass round-trip/browser tests. DocsFacade-specific markers, controls, and regeneration belong to W15; generic comment preservation remains W3.

### W9. Security, Accessibility, and Release Hardening

Apply a shared explicit HTML/URL policy to import, pasted HTML, rendering, hover cards, templates, image destinations, and Mermaid SVG. Preserve inert unsupported source or reject before replacement; sanitization of disposable output must not erase persisted placeholder comments. Test script-closing text during PHP-to-JavaScript bootstrapping as well as normal DOM XSS cases. No `eval`, inline event-handler generation, or document-supplied executable configuration.

Support CSP nonce/style requirements, subdirectory asset URLs, offline assets, and host-controlled dependency loading. Define limits for documents, images, nesting, regex matching, tables, provider responses, and Mermaid. Errors retain content and expose structured diagnostics rather than failing silently.

Check ARIA, validation states, contrast, focus order/traps/restoration, task controls, menu/dialog keyboard use, touch-only operation, IME, bidirectional text, and mobile keyboards on the agreed browsers. Add explicit locale dictionaries and host label overrides rather than baking English into extension controls.

Measure initialization, typing, large tables/diagrams, serialization, data-image history memory, and repeated disposal on representative documents before establishing performance budgets. This plan makes no unmeasured speed or memory claims. Use the host's required profiling process when optimizing integration code; remove temporary instrumentation before shipping.

Acceptance: security/accessibility gates, documented compatibility limits, measured budgets, source and distribution suites, and clean installation tests pass before the first stable release.

### W10. Integrate Markian in Codiware

Implement the Codiware-owned adapter and pilot described in M2 after M0 package preparation and M1 document inventory. Start once W1-W3 and the pilot's required W4-W8 features are available, plus W13/W14 for any enabled Mermaid/code features. W15 is needed only for a Core/IDE-hosted placeholder scenario, not standalone Codiware. Pass the applicable W9 gates before changing consumer defaults. Keep the existing editor descriptor and shell contract, visual startup, dirty/load/save semantics, active-view drafts, and Monaco alternative.

Deliver Composer-ready assets, host-owned link/image callbacks, paste-to-file image insertion without binary fallback, relative-resource resolution/navigation, theme/fullscreen integration, and complete tab disposal. Keep standalone Codiware independent of ExFace. Coordinate IDE asset overrides under M4 without moving framework-specific logic into Codiware or Markian.

Acceptance: M2's real tab/load/save/failure/rename/navigation scenarios pass in standalone and embedded deployments. Verify pasted image files and ordinary Markdown URLs after save/reopen, clean state only after successful writes, and recoverable pending work. Update Codiware documentation/configuration and demonstrate backend fallback without losing unsaved drafts or saved assets.

### W11. Integrate Markian in JEasyUIFacade

Implement the facade-owned migration described in M4, using the additive Core `MarkianTrait` and shared widget translation contract from M3. Depend on M0/M1, the required W1-W9 parity subset, and W13-W15 only where the migrated consumer enables those extensions, not on completion of the UI5 migration. Deliver the shared trait before either facade opts in; do not rename, redirect, or change `ToastUIEditorTrait`.

Migrate asset injection, editor/value/change wiring, validation, prefill/live references, visual startup, and resizing/disposal in a direct jEasyUI replacement release. Implement runtime read-only/disabled behavior explicitly. Use the lightweight viewer for Markdown display widgets, independently of server-rendered paths and M4's separate server security gate, rather than assuming UI5's display-widget implementation applies.

Acceptance: real jEasyUI forms cover get/set, explicit clearing, validation, live references, permission changes, hidden-container sizing, and teardown. Verify supported widget configuration, editable/read-only editor semantics and independent asset loading; check separate display widgets for compatibility. jEasyUI directly replaces Toast UI without a selector or fallback. Test jEasyUI/Markian alongside unchanged UI5/Toast UI. Update facade documentation and add focused PHP coverage where feasible plus owning-app browser/BDT scenarios.

### W12. Integrate Markian in UI5Facade

Implement the UI5-owned migration described in M3 after additive delivery of Core's separate `MarkianTrait`, M0/M1 preparation, and the required W1-W9 parity subset, plus W13-W15 where the migrated consumer enables those extensions. UI5 opts in independently of JEasyUIFacade; shared configuration translation belongs in the trait while UI5 retains model bindings, asset registration, validation, and overlay lifecycle ownership.

Migrate editor input elements, preserving widget configuration, visual startup, value/change semantics, prefill/live references, and permission behavior. Disabled inputs remain Markian editors with search/copy/navigation available. Separate display-only controls use host-owned adapters to W16's viewer once its gates pass, retaining the existing renderer until then. Handle rerenders, preserve-area stale DOM, reused dialog IDs, explicit empty values, model echoes, pending drafts, fullscreen restoration, and listener disposal as specified in M3. Update BDT selectors to support documented roots for both backends during rollout.

Acceptance: real UI5 form/dialog/prefill/validation workflows pass, including repeated rerenders, record switches, empty-value restoration, independent instances, and permission changes. Verify UI5/Markian with jEasyUI/Toast UI and unchanged legacy consumers after the additive Core release. Demonstrate facade-local rollback without losing drafts; update UI5 documentation and add focused PHP coverage where feasible plus browser/BDT lifecycle scenarios.

### W13. Deliver the Mermaid Extension

Owner: Markian. Depend on W1-W4's public API, rendering, and modular packaging foundations, W7's view/session contract, and applicable W9 security/accessibility gates. Package a separately prebuilt optional factory with tested runtime releases, assets, dependency metadata, notices, and help. Use the same public API available to host applications; do not require W14 or a private engine API.

Use a `source` URL string or a `{ render }` adapter contract, without requiring a version declaration. The loader checks callable `initialize()` and `render()` methods and validates the returned SVG text. Reject the old `asset` object rather than translating it. Reuse host Mermaid without global DOM scans or repeatedly changing another application's configuration. Isolate rendering when a shared instance cannot satisfy required security/theme behavior. Sanitize generated SVG, never bind source-defined executable callbacks, and bound diagram text/complexity. Scope IDs, rendering state, and cleanup per diagram/instance; reject stale asynchronous results. Standard Mermaid fences and their source remain intact when rendering is unavailable.

Add the insert-diagram toolbar command with a simple flowchart, diagram edit affordances, and mouse/keyboard/touch pan/zoom/reset. Retain the dedicated code-left/preview-right view with Back, undo/redo, and indent controls. Back applies the block session; use responsive stacked/switchable panes without restoring document-wide split preview. Cancel and extra snippet controls require separate approval.

Acceptance: browser/distribution fixtures cover multiple diagrams, themes, rapid edits, invalid syntax, no-op Back, Help suspension, conflicts/deleted targets, active-draft saving, permissions, pan/zoom, and teardown. Verify supplied renderers and explicit local/offline loading, failure/retry, missing runtime APIs, rejection of the old asset option, and URL-based multi-instance deduplication without shared state. Core-only/disabled fixtures, including Mermaid fences, request no Mermaid assets. Ordinary editing remains usable on renderer failure.

Implemented independently of the other pending WPs. The [separate example](../../Examples/mermaid-diagrams.html) opts in through the [documented renderer/source contract](../../README.md#optional-mermaid-extension), with a `source` URL in its inline host configuration; the main demo and minimal example remain Mermaid-free. Mermaid itself is host-provided, never bundled in the distribution; missing configuration displays an error while preserving editable source. Focused built-distribution Chromium fixtures cover the acceptance behaviors above, including centered Mermaid output labels, floating hover/focus controls and desktop/mobile pane geometry. npm archive verification includes the optional extension artifacts and runs the example with an independently supplied host asset after installation with lifecycle scripts disabled. These checks do not certify real devices, other browsers, screen readers, or restrictive host CSP, and do not complete W9 or any integration WP.

### W14. Deliver the Code Extension

Owner: Markian. Depend on W1-W4's public API and modular packaging foundations, W7's view/session contract, and applicable W9 gates; do not require W13. Ship the optional factory and selected prebuilt language/highlighting assets with metadata, notices, help, and a supported-language policy. Reuse the raw editor's CodeMirror foundation rather than shipping a competing runtime or loading all language parsers in the core.

Build on W1's early public-API Code proof-of-concept. Do not postpone the first extension-boundary check until this full work package or treat the early slice as completion of W14.

Add code-block highlighting and a toolbar command enabled for the current code-block target. Supply the expanded code view with Back, undo/redo, language selection, indent controls, configurable Tab width, line numbers, and an accessible way out of Tab trapping. Preserve ordinary fenced source, direct basic editing without the extension, and source on unavailable/failed highlighting. Load declared language assets only when enabled/needed or supplied by the host.

Acceptance: independent enablement without Mermaid, language changes, literal fence contents, Tab/indent/escape, history, no-op Back, Help suspension, active-draft values/save, conflicts/deleted targets, permissions, and disposal pass browser tests. Packaged tests cover selected offline languages, loading failures/retry, version/deduplication behavior, and independent instances. Core-only/disabled fixtures request no programming-language assets, even with code fences present.

### W15. Deliver Core's DocsPlaceholders Extension

Owner: ExFace/Power UI Core, not Markian or IDE. Depend on W1-W4's public customization/rendering/packaging contracts and W3's generic comment preservation; use W8's insertion primitives and W7 if a dedicated marker view is approved. Apply W9's security/lifecycle gates. This extension must not depend on Mermaid or Code. Core ships the prebuilt `docsPlaceholders` factory and its own asset/version/dependency metadata and notices; finalize public asset paths/exports and supported Markian versions without introducing a mandatory Core dependency into Markian or requiring consumer builds.

Implement the actual DocsFacade grammar, preserving paired `<!-- BEGIN ... -->` / `<!-- END ... -->` delimiters and exact payloads, unrelated/unknown comments, print/image metadata, and readable generated bodies. Add placeholder toolbar buttons, an Edit Tags action, and a configurable insertion menu with bordered generated regions. Define protected-body/raw-override policies and malformed/nested/unknown-pair handling without dropping content. A dedicated boundary/marker view remains a separate design decision, not a prerequisite implied by this package.

Use only the ordinary public API. The host resolves Core's assets, loads/registers the factory, and enables it per editor. IDE configures presets/links and authorized regeneration callbacks without owning or duplicating the grammar. Never execute providers on opening/rendering; explicit regeneration checks authorization, revision, and lifetime before applying output. Generated Markdown must render independently after saving. Coordinate actual host adoption under M4, separately from delivery of the Core extension.

Acceptance: verify exact DocsFacade delimiter/body round trips against its server renderer, marker edits, insertion, body policies, malformed pairs, host callback failure/cancellation, stale/unauthorized results, and independent fallback rendering. Test a Core-free install and side-by-side enabled/disabled editors, routed/subdirectory/offline assets, registration order, missing/incompatible assets, deduplicated loads, independent state, and cleanup. Absent/disabled extensions preserve comments/bodies without Core requests or provider execution; enabled unknown IDs fail explicitly without discarding Markdown.

### W16. Deliver the Lightweight Viewer

Implemented slice (2026-10-28): `MarkianViewer.create` mounts directly without an
editor; `ready`, `get`, `set`, `setTheme`, and `destroy` own independent rendering
and exact Markdown. `MarkianViewer.headings` shares the anchor policy. Viewer
CSS, declarations, manifest, and live editor/viewer [comparison](../../Examples/viewer.html)
are built and packaged. `mermaid: false` is the explicit default; only true plus
a configured renderer and matching fence may load a Mermaid runtime. The optional
viewer-Mermaid JS/CSS supplies no editing extension. The bounded raster-image
policy is applied after reference resolution and survives HTML sanitization.

The [size report](../../dist/sizes.json) records core-only editor/viewer JS and
CSS, additive combined costs, the optional viewer adapter, and external Mermaid.
Viewer JS/CSS is about 24% of editor gzip bytes. Build gates cap JS at
250,000/80,000/70,000 raw/gzip/Brotli bytes, CSS at 6,000/1,800/1,600 bytes, and
viewer/editor totals at 35% in each encoding. The actual bundled import graph
rejects editor dependencies. Focused Chromium checks cover semantic/security
fixtures against active Preview, source/lifecycle/stale-result safety, resources,
independent viewers/editor coexistence, and light/dark desktop/mobile layout,
real image decoding, focus, and lazy Mermaid. The archive fixture installs with
scripts disabled and checks viewer-only offline/subdirectory delivery. This is
not a claim that W9, W10, publication, or host display-widget adoption is complete.

Owner: Markian. Schedule immediately after W10's Codiware integration and before display-widget adoption in W11/W12. W10 does not depend on W16. W1-W3 must already have separated shared rendering/policy/content styles from editor engines and UI; W16 depends on those boundaries, W2's packaging, and applicable W9 security/accessibility gates, not on Core's W15 extension.

Deliver a separate prebuilt viewer JS/CSS entry point and declarations using the shared Markdown/rendering modules. Include Markdown parsing, sanitization, URL resolution, heading anchors, content typography, and light/dark themes. Exclude Milkdown/ProseMirror, CodeMirror, editor sessions/history, toolbars, dialogs, insertion, and data-provider UI. Rendering must not construct a disabled editor or mutate Markdown. Keep a small lifecycle API for mounting, readiness, replacing Markdown, theme changes, safe host link/image resolution/navigation, and destruction; finalize names and compatibility in this package rather than implying current exports.

Support multiple independent viewers and coexistence with editors without duplicate globals, conflicting CSS, or shared mutable document state. Retain safe native selection/copy/link navigation; tasks are nonmutating. Generated bodies render as ordinary Markdown and invisible comments remain invisible without Core, marker editing, or provider execution. Mermaid and code highlighting remain explicit optional rendering capabilities: separate render-only adapters/assets from W13/W14 editing UI where necessary and do not load a full editing extension to display a fence. Missing/disabled renderers use safe plain-code fallback. No AJAX, implicit CDN, consumer build, or editor CSS dependency.

Acceptance: publish a rendering-only proof build and measure editor versus viewer minified, gzip/Brotli JS and CSS under equivalent options, listing optional dependencies and combined editor/viewer costs separately. Inspect the built import graph and browser requests for prohibited editor dependencies. Set a reviewed quantitative size budget from those measurements and require a substantially smaller viewer before accepting the lightweight claim; this plan makes no measured size/performance claim. If the result fails that gate, revisit the dependency boundary rather than shipping an editor wrapper under a viewer name.

Run the shared semantic/security corpus through editor Preview and viewer, checking meaningful rendering rather than identical DOM. Browser/distribution tests cover viewer-only startup without editor assets, packaged/offline/subdirectory paths, themes, desktop/mobile overflow, safe links/images, rapid replacements/stale rendering, destruction, multiple viewers, and editor coexistence. Add a standalone viewer example to Chapter 11 and document the small API, render-only extension boundaries, and measured artifact sizes. W11/W12 own actual display-widget binding, rerender, disposal, fallback, and rollout tests.

### W17. Rich Paste from HTML, Word, and Excel

Owner: Markian. Depend on W3's dialect, allowed-HTML and unsupported-content policies, W5's table model, W6's image insertion and callbacks, and W9's HTML/URL policy and limits. This package is sequenced last. Until it is delivered, paste uses Markian-internal copy/paste and the `text/plain` clipboard flavor only; external HTML is not interpreted. Toast UI already pastes simple Excel tables: a consumer that needs this parity before W17 either waits or records a temporary, accepted difference under W0's compatibility policy before migrating.

Build one paste pipeline for the visual view. Select the clipboard flavor deliberately (Markian-internal content, then HTML, then spreadsheet TSV, then plain text), sanitize with the shared W9 policy before conversion, and map the result onto the editor's supported schema. A generic HTML-to-Markdown converter such as Turndown may assist paste only; it never processes existing documents. Each paste is one undoable step and emits one `change`. Provide an explicit paste-as-plain-text action and shortcut. In visual mode, plain text is parsed as Markdown and pasted as formatted content; paste as plain text inserts it literally. Raw, code, and Mermaid sessions always insert plain text. Disabled/read-only editors block paste as specified in W1.

Web HTML: map headings, paragraphs, emphasis, strikethrough, inline code, preformatted code, nested and task lists, quotes, rules, line breaks, links, and tables. Drop styles, classes, scripts, event handlers, embedded frames, and forms; unsupported elements degrade to their text content. Keep only safe link schemes and define handling of relative links copied from another page. Map allowed-HTML elements such as `<kbd>` only when the active preset permits them.

Word and Outlook: recognize Office HTML, including list paragraphs with nesting levels, heading styles, conditional comments, Office namespaces, and empty spacer paragraphs. Convert them to ordinary lists, headings, and paragraphs without `mso-` or style debris. Define policies for non-breaking spaces, smart quotes, soft hyphens, and Word footnotes/comments. Route pasted images through W6's insertion path (bounded data URIs by default, or the host's `onImageInsert` callback) and respect image permissions. Report local `file:` or other unresolvable image references instead of saving them as links.

Excel and spreadsheets: parse sanitized HTML tables with a TSV fallback. Use displayed cell text, not formulas or styling. Define the header-row policy and handling of merged cells, embedded line breaks, pipes, empty and ragged rows, and oversized ranges. GFM cells cannot contain block content: flatten it visibly or reject it with an explanation, never silently drop cells. Define pasting into an existing table, such as filling cells from the cursor or inserting a separate table, rather than nesting tables.

Bound clipboard size, node count, nesting depth, table dimensions, and conversion time. Over-limit content is rejected with a message or offered as plain text; it must not freeze the editor. Mention rules apply to pasted text as ordinary decorated text.

Acceptance: an anonymized fixture corpus of captured clipboard payloads (HTML, plain text, and image items) from Word desktop and online, Outlook, Google Docs, typical web pages, Excel desktop and online, Google Sheets, and LibreOffice, captured in the agreed browsers. Converted Markdown matches the expected output, renders on GitHub and GitLab, and contains no style or Office debris, scripts, `file:` images, or HTML outside the active preset. The malicious-HTML corpus, single-step undo, Markdown parsing of pasted plain text, literal paste as plain text, read-only blocking, image callback success and failure, limits, and paste into existing tables pass. Real clipboard browser workflows cover representative Word and Excel pastes, not only synthetic events.

### W18. Set Up the DevMan Maintenance Agent

Owner: Markian for repository tooling; DevMan/Power UI for the agent configuration and the Apache test page. Depend on W1's TypeScript module layout, W2's build/verification scripts and committed `dist`, and Chapter 11's examples index. The package is listed last but may start once W2's gates pass; continuous agent maintenance needs it before the long feature tail rather than after it. Chapter 12 describes the resulting workflow.

Deliver in the Markian repository:

- Scripts `typecheck`, `test:unit`, `test:browser`, and a composite `verify` (type check, build, unit and browser tests, `dist` parity), usable without a long-running dev server.
- A Playwright configuration whose base URL comes from an environment variable. With an external URL, tests run against the Apache-served packaged assets and no `webServer` starts; without it, the existing Vite dev server remains the VS Code default.
- A test-bench entry page that loads `dist` through classic script/link tags and links the examples index and ticket scenario pages. Append the manifest version or hash to asset URLs so browsers never show a stale build.

Deliver in DevMan/Power UI:

- A Power UI facade route serving the Markian test bench and `dist` through Apache. Confirm that the `vendor/axenox/markian` path is reachable or proxied, needs no Node.js on the request path, and is limited to development/test installations.
- The agent configuration: instructions that point to this repository's Copilot instructions, architecture, and plan; file access limited to `vendor/axenox/markian`; a command tool restricted to the allowlist in Chapter 12; the ticket handoff report format.
- A decision whether the agent commits to a ticket branch or leaves reviewed changes uncommitted for the human. It never pushes and never bypasses hooks.

Acceptance: dry-run tickets covering a documentation change, a bug fix with a focused test, and a UI change pass through the full cycle: the agent changes code, runs `verify`, writes the handoff report, and a human tests the result on the Apache page. Forbidden commands are rejected by the tool, not merely discouraged by instructions. A failing `verify` produces a failure report rather than a ready-to-test handoff. The tester sees the new build without clearing caches. The VS Code dev-server workflow keeps working unchanged.

## 6. Existing Toast UI Features and Newly Identified Gaps

The following are features/behaviors found in the current integrations that need explicit migration coverage. They are assigned in this plan. This is the migration parity checklist, not a list of features already implemented in Markian.

| Existing capability or behavior | Evidence/current reality | Gap or decision | Required action and owner |
| --- | --- | --- | --- |
| Horizontal-rule toolbar action | Present in both configured Toast UI toolbars. | Require a dedicated action in addition to rendering rules. | Add a mode-aware command/control and history tests: W4. |
| List indent/outdent controls | Exposed by shared and Codiware toolbar definitions. | Basic list conversion is not parity with nesting/unnesting. | Implement buttons/shortcuts and nested-list round trips: W3-W4. |
| Automatic URL detection | Both integrations enable Toast UI's extended autolinks. | Markian automatically detects URLs without an autolink configuration option. | Always detect/test bare URLs, `www`, email, punctuation, code/link exclusions, and safe schemes in editable/read-only editor presentation; no adapter toggle: W3/W9. |
| Configurable softbreak rendering | Trait maps `MarkdownDataType.enable_newlines`; preview/viewer differ from TUI WYSIWYG. | A single default CommonMark policy would change existing display. | Carry the host setting into editor/Preview rendering and verify separate host display widgets; preserve hard breaks and document intentional consistency changes: W3/M3. |
| Character counter based on max length | Shared trait adds a live `length/max` item from the data type. | Require character counting and maximum-length context, not only word counting. | Add a configurable status/counter contract; reconcile Unicode counting with server validation: W4/M3. |
| Required/max-length validation UI | UI5 bridges value state, tooltip text, and `aria-invalid`. | Styling and validation cannot depend on TUI DOM. | Bind supported Markian root/input accessibility states to existing validators: W1/W9/M3. |
| Existing mode defaults | `InputMarkdown` defaults to `markdown`; Codiware starts in raw/split mode. | Intentional change: all migrated integrations start in the regular WYSIWYG-like visual mode. Raw startup remains an optional library setting only, unused by current integrations. | Configure visual startup in Power UI/Codiware adapters; do not carry legacy raw/split startup settings forward. Test visual opening and user-initiated raw switching: W1/M2-M4. |
| Document-wide write/preview split | Used in Codiware and fullscreen Toast UI logic. | Intentionally omitted by the new requirements, not accidentally missing. | Record accepted UX change; provide raw/visual switching and dedicated Mermaid preview. Keep Monaco for source-oriented file editing; do not rebuild a general split mode without a new decision: W4/M2. |
| Image paste and toolbar file selection | Codiware currently uses `addImageBlobHook`, an `images/...` path, and inline fallback. | Preserve the outcome, not those internals: pasted images become files and ordinary `![alt](url)` links, with no binary embedded in saved Markdown. | Use a host-owned image callback; choose storage location/logic freely, with explicit pending/failure handling and no inline fallback: W6/M2. |
| Data-image externalization before saving | Codiware currently uploads unique data URIs in `beforeSave()` and replaces links. | This mechanism is not required if pasted images are saved as files before insertion/save. | Keep, replace, or remove the internal externalization/deduplication flow as appropriate; define handling of legacy data images separately, without changing Markian's standalone default: M2. |
| Relative images including raw `<img>` | Codiware rewrites preview/WYSIWYG DOM only, keeping stored relative destinations. | A plain URL base is insufficient for guarded download routes and allowed HTML images. | Add render-time resource resolver and safe raw-HTML policy; do not save resolved transport URLs: W3/W6/M2. |
| Relative document links open IDE tabs | Codiware intercepts relative preview links through `Codiware.openFile`. | Browser navigation would leave the IDE or lose the target fragment. | Public link-opening provider with workspace identity and heading navigation: W6/M2. |
| Ctrl/Cmd+S save request | Codiware captures the shortcut ahead of TUI commands. | The editor must cooperate with the host's save lifecycle in every view. | Preserve `save-request`; include active raw/code/Mermaid drafts and pending image work: W1/M2. |
| Dirty tracking and normalized-load baseline | Codiware suppresses load changes, baselines serialized content, exposes `markClean`. | Normalization can falsely dirty tabs or save without deliberate edits. | Keep a canonical baseline and explicit origin semantics; clean only after successful write: W1/M2. |
| UI5 model/live-reference integration | Trait/facades implement get/set, binding changes, prefill, and change scripts. | A new factory alone is not a drop-in widget implementation. | Translate values/events with echo protection, reset semantics, and readiness: M3-M4. |
| UI5 rerenders and reused dialog IDs | Viewer/editor code explicitly repairs wiped or preserved stale DOM. | Global IDs or DOM-presence-only checks can show stale records. | Tie instance ownership to control/controller lifecycle and restore the correct current value, including empty values: W1/M3. |
| Viewer/disabled-input behavior | Legacy integrations have a separate viewer factory; jEasyUI chooses it initially for disabled input. | Disabled inputs remain editors; W16 supplies a distinct lightweight renderer for host-owned display widgets. | Retain disabled-editor search/copy/navigation and block mutations. Adopt the viewer only after its size/security gates; verify display-widget bindings separately: W1/W3/W16/M3-M4. |
| Image permission flag | `allow_images` defaults false; current trait only partly strips/disables image paths. | Copying the old regex would both miss paths and silently alter content. | Enforce insertion permissions across paste/drop/URL/source; preserve or explicitly reject existing content per policy, never silently strip it: W6/W9/M3. |
| Mention presentation and existing link/empty-link storage | Trait decorates `[@label](url)` and `[@label]()`; getter switches mode to avoid `$$widget` wrappers. | Plain-text-only mentions do not cover existing saved values. | Import old ordinary mention forms; no hidden mode switching/new wrappers; add narrowly recognized legacy repair tooling: W8/M1. |
| Mention suggestion request semantics | Trait sends action/object/resource/element metadata, filters, display attribute, page size, and AJAX headers. | A generic autocomplete without adapter translation would break existing models. | Preserve request semantics inside host callbacks; Markian receives only structured results and ignores stale results: W8/M3. |
| HTML-tag stencils with captions/icons/hints/styles | Trait supports `HtmlTagStencil` insertion and custom inline rendering. | Keeping `<kbd>` as inert text is not feature parity. | Safe explicit HTML mapping and configuration translation, not direct selection DOM surgery: W3/W8/M3. |
| Fullscreen behavior integrated with host overlays | Shared/UI5 code changes size, parents, preview style, and z-index. | Built-in maximize needs an optional host replacement rather than hard-coded framework behavior. | Configure `onFullscreenEnter` with paired restoration for host overlays/iframe bridges; test state/focus restoration, failures, disposal, and multiple instances: W4/M3. |
| Host preview styles, theme, asset URLs/cache busting | Codiware supports preview CSS/class configuration; facades inject assets; IDE overrides URLs. | Global demo styles and hard-coded Core paths cannot replace this contract. | Scoped themes, supported render-root classes, deduplicated configurable assets, cache/version policy: W1-W2/M2-M4. |
| Table editing beyond insertion | Toast UI is exposed with table editing. | Require deletion, alignment, menus, and Excel workflows as well as row/column insertion. | Verify actual required controls on migration fixtures and implement/test GFM-compatible operations: W5. Excel and HTML table paste: W17. |
| Locale and command labels | Shared trait explicitly selects English; hosts provide translated messages. | The library needs configurable labels even if initial default remains English. | Locale dictionaries, safe host overrides, translated provider errors: W9/M2-M4. |
| Teardown and hidden-tab sizing | Codiware disconnects observers/destroys; UI5 registers resize callbacks. | Require a reusable disposal/resize contract. | Cancel all owned resources and remeasure without reloading Markdown: W1/M2-M4. |

Do not misclassify unfinished old features as established parity: generic text stencils currently throw for unsupported types; mention click URLs include a TODO; runtime jEasyUI disabling is incomplete. Markian must implement the new requirements for templates and mention clicks, but those are extensions beyond the verified old implementation.

Do not remove `npm-asset/tui-image-editor` when removing Toast UI **Markdown** Editor. Codiware's separate image editor is another feature and remains out of scope.

## 7. Power UI and Codiware Migration

### M0. Package and Dependency Preparation

Complete W1-W3's baseline and package gates before changing consumer defaults. Publish a prerelease with committed distribution, then validate a direct Composer install in a clean Power UI fixture. Add configurable Markian JS/CSS asset keys and facade-local backend selection while preserving current Toast UI keys for fallback. Shipping Core's new trait must not change existing facade behavior or load Markian assets into consumers that still select Toast UI. Resolve assets under subdirectories, behind facade routers, and in iframes; test browser cache invalidation on version changes.

Use direct `axenox/markian` Composer delivery for Power UI. Prefer the same route for Codiware to avoid duplicate copies in the combined installation; maintain an Asset Packagist example/install test for other consumers. Do not make Codiware depend on ExFace merely to find Markian or Mermaid.

Deliver a compatibility matrix of Core, both facades, IDE, Codiware, BDT, Markian, and supported Mermaid versions. Assign one owner per repository and release in a coordinated order; a new asset key must not land before the installation can supply the asset.

### M1. Inventory Real Documents and Legacy Markup

Use anonymized copies of representative stored widget values and repository Markdown. Classify ordinary GFM, mentions/empty links, HTML stencils, generated comments/bodies, data images, unsafe/unsupported HTML, and actual proprietary Toast UI wrappers. Measure how many documents need attention before promising automatic conversion.

Opening a value must not update its database row or file. Normalization is allowed on deliberate save, not an excuse for a migration-wide rewrite. Back up originals and compare semantic rendering plus comment payloads. Existing ordinary Markdown requires no schema migration.

If saved `$$widget...$$` debris exists, implement a separate narrowly recognized converter with dry-run/report mode, backups, idempotence, and ambiguous-case refusal. Do not globally regex-delete dollar-delimited text: it can be legitimate Markdown/math/code. The compatibility importer may recognize proven legacy nodes, but must never execute them.

### M2. Pilot Codiware

Replace the implementation behind the existing `codiware.markdown` editor descriptor, not the shell's editor/tab contract. Follow Codiware's [architecture](../../../../kabachello/codiware/Docs/Architecture.md) and [style guide](../../../../kabachello/codiware/Docs/Styleguide.md), including its shared popup/menu and local-panel behavior.

Required adapter work:

- Preserve `load`, `getContent`, `beforeSave`, `isDirty`, `markClean`, `focus`, `on`, and `destroy`. Extend the shell/editor save contract with explicit snapshot acknowledgment rather than retaining the unsafe no-argument `markClean()` save path. Maintain `.md`/`.markdown` acceptance, editor selection priority, and Monaco as an alternate text editor.
- Replace the ESM/UMD Toast UI detection/import-map workaround with one deduplicated Markian script/CSS loader and readiness handling. Translate extension settings and support old keys for a documented deprecation interval.
- Start every newly opened Markdown editor in visual mode, not the legacy raw/split mode. Do not use the library's raw-start option or restore a legacy raw-start preference; switching modes in an already open tab remains available without resetting its state.
- Preserve programmatic-load suppression and normalized baseline behavior. Emit the shell's change notification after load only to reevaluate dirty status, not as a user edit. A successful disk write acknowledges only the exact saved snapshot; recompute dirty state against that baseline instead of unconditionally clearing the tab's dirty indicator.
- Capture Ctrl/Cmd+S in visual, raw, Mermaid, and expanded-code views. Await image/pre-save work and save the active document projection; do not require users to press Back first. Keep dirty state and source on write failure.
- Preserve image paste and toolbar file selection as paste-to-file workflows: host-owned code saves the image in an appropriate location and returns a URL for ordinary `![alt](url)` Markdown. Keep collision-safe naming, authorized storage/access, and applicable file-tree notifications. The location, hooks, and internal save/upload flow may change; retaining `addImageBlobHook`, the neighboring `images` convention, or pre-save deduplication/externalization is not required. Do not fall back to binary/data-URI Markdown on failure. Keep pending paste recoverable and prevent save from reporting success until the image is stored or the user explicitly removes the pending paste. Define an explicit compatibility policy for preexisting data images rather than making the old externalization mechanism mandatory.
- Resolve relative images through the existing guarded file route, retaining original Markdown destinations. Open relative Markdown targets in editor tabs with the correct root and fragment; retain query/fragment semantics and encoded filenames. Never allow client path resolution to replace server authorization/path guards.
- Supply repository file/image suggestion and heading-inspection callbacks in Markian configuration. Codiware owns any AJAX through its existing API service and middleware, or can supply local/cached results. Use existing guarded file/search/upload facilities where suitable; any new bounded, authenticated endpoint belongs to Codiware, not Markian.
- Translate theme changes and preview CSS/class settings into supported Markian options, not `.toastui-*` observers. Remove old DOM-rewrite observers only when the replacement resource resolver/render hooks cover their behavior.
- Use built-in maximize where appropriate, or configure `onFullscreenEnter` to integrate with Codiware's panel/iframe layout and return its restoration function. Keep this host logic outside the library.
- Dispose editor/provider/observer resources when closing or switching tabs, and remeasure hidden editors when reactivated. Keep extension IDs stable so saved shell preferences remain useful.

#### Save Snapshots and Local Ordering

This is required host-owned save behavior, not a Markian transport feature. Apply the shell contract consistently to Markdown and other editable backends; do not fix only Markian while the shared shell still clears dirty state unconditionally. Finalize method names during integration, but retain these invariants:

1. Serialize preparation and writes per resource, identified by workspace/root and normalized path, not by the active tab. Permit one in-flight save and coalesce repeated requests into at most one trailing requested save. Prepare and capture that trailing snapshot when its turn starts; typing alone does not request another save.
2. Await image/pre-save work, then synchronously capture an immutable snapshot containing document identity/load generation, destination, complete projected Markdown or backend save payload, and editor revision. Check identity again after asynchronous preparation; a record switch must not redirect an old save to the new document. Newly pending image work must block capture or leave the document explicitly dirty and unsaved.
3. Keep editing available during the write. Send the captured payload, never a later getter result. On success, pass the saved snapshot to an explicit acknowledgment operation, conceptually `acknowledgeSaved(snapshot)`. The acknowledged content becomes the disk baseline; compare the current complete value with it and account for pending work. Later edits remain dirty, including edits in raw/code/Mermaid sessions. An undo back to the saved value may become clean; revision equality alone is not the dirty-state rule.
4. A response may update only its matching document/load generation. Closing, reloading, switching records, or replacing the editor cannot let an old acknowledgment clean a new instance. Coordinate rename/move/delete with outstanding saves before changing resource identity, and invalidate obsolete queued requests. Destroying a client or aborting a request does not prove that the server cancelled its write.
5. On write failure, retain the previous acknowledged baseline and current edits; pause queued saves and report the failure. A request whose outcome is unknown must be reconciled with server state before retrying or running the next save. Resume only through an explicit retry or conflict-resolution action, not an automatic overwrite.

Required delayed-write tests: capture A, type B, acknowledge A, and verify disk A/current B/dirty; explicitly save B and verify clean only after its acknowledgment. Cover repeated save shortcuts without overlapping preparation/writes, a failed first save with a queued successor, undo to the saved value, active specialized drafts, new image work, close/reopen or record replacement during a write, and rename/move while saving. Verify editor baseline and tab indicator agree.

#### Proposed External-Conflict Policy

Local serialization cannot prevent another browser, user, or process from changing the file. The proposed Codiware-owned solution is optimistic concurrency; this requires a separate host API/storage implementation and is not existing functionality or a Markian API:

- Return an opaque content version with file reads and successful writes. Send the expected version with each save; distinguish a missing file from an empty file. After a successful queued save, use its returned version for the next save.
- Check the expected version and replace the file within one server-side critical section shared by cooperating writers. Use an atomic replacement strategy appropriate to the filesystem; a separate unchecked read-then-write is insufficient. A mismatch or unexpected deletion returns a structured conflict without writing. Do not rely only on timestamps, whose precision can miss changes.
- On conflict, pause that resource's save queue and retain the base snapshot, current local value/drafts, and latest remote content/version. Offer compare/merge, reload with explicit confirmation of local-edit loss, or save a separate copy. Prefer the existing Monaco/diff facilities for comparison; never silently merge overlapping changes or replace the active Markian session.
- Save a user-approved merge against the remote version used for that comparison. Any later remote change must conflict again. An explicit overwrite action, if authorized by the host, also confirms a known remote version rather than bypassing concurrency checks. If editing continues during resolution, reject stale resolution results or reconcile them before replacing local content.
- Locks coordinate only participating writers. Document the guarantees for external tools/filesystems that do not honor that lock; do not claim universal conflict prevention from content hashes alone. If the deployment cannot provide conditional writes, report that limitation rather than presenting local save ordering as cross-client protection.

Before enabling this policy, add host tests for two clients saving from the same base, remote deletion/recreation, another change during conflict resolution, uncertain write outcomes, and independent resources saving concurrently. The final API, filesystem guarantees, and conflict UI need Codiware's own architecture/style documentation and compatibility review.

Pilot behind the backend flag. Test opening without edits, switching modes/tabs, saving, save failures, image upload failures, closing dirty tabs, rename/move/base changes, multiple roots, theme changes, and iframe/subdirectory deployment. Include the required snapshot/ordering tests above; external-conflict handling must pass its host tests before claiming cross-client protection. For image paste, verify the stored file, regular Markdown URL without pasted binary/data URIs, and successful rendering after save/reopen; include pending-save, retry/removal, and deleted-target cases. Record the intentionally changed raw/split-preview UX with reviewers.

Update Codiware's architecture, editor documentation, style patterns if needed, default extension config, shell asset loading, and Composer dependencies in the implementation change. Keep standalone Codiware usable immediately after Composer install.

### M3. Shared Power UI Adapter and UI5

Add `MarkianTrait` in Core at `Facades/AbstractAjaxFacade/Elements/MarkianTrait.php`, in the namespace `exface\Core\Facades\AbstractAjaxFacade\Elements`. Keep it separate from the existing `ToastUIEditorTrait`: do not rename, replace, alias, or redirect the old trait to Markian, and do not make the new trait depend on Toast UI internals. Facades still using the old trait continue to compile and behave as before.

`MarkianTrait` owns shared Markian editor construction (including disabled/read-only editors), configuration translation, current-value access, change/callback wiring, and disposal snippets. Separate display-only widgets remain host-owned. Facade-specific elements retain their framework binding, asset registration, validation, and overlay lifecycle responsibilities. Translate UXON to declarative settings, then attach trusted function callbacks to the JavaScript configuration passed to Markian. These callbacks use Power UI's request/action infrastructure if needed; the library knows neither the AJAX endpoints nor their payload format.

Deliver the trait additively before migrating its first facade. UI5 and jEasyUI adopt it in separate changes/releases; either can remain on Toast UI while the other uses Markian. Backend selection belongs to each facade's element implementation/registration, not a global switch in Core's old trait. Prefer separate backend-specific element implementations where coexistence is needed rather than importing both traits into one class with colliding method names. Preserve the existing widget-level value/validation contracts without requiring identical private trait helpers.

Keep distinct engine instance references and asset/module keys during coexistence. Never overwrite the `toastui` global or reinterpret a Toast UI handle as a Markian handle. A Core/Markian dependency upgrade alone must not opt a facade into the new backend.

Preserve widget contracts for `allow_images`, `render_mermaid_diagrams`, required/max-length data-type validation, newline settings, mentions, stencils, value defaults, prefill, live references, and OnChange actions. Do not require existing app models to rename properties. The intentional exception is startup presentation: keep accepting legacy `editor_mode` properties for model compatibility, but the Markian adapters always start in visual mode rather than carrying `markdown`/raw startup forward. Document this change and retain user-initiated raw-mode switching. Facades still using Toast UI retain their existing behavior.

UI5 implementation must:

- Register Markian and CSS through the facade's module/asset mechanisms without AMD/global-export collisions. Supply the host's configured Mermaid through the adapter, once per appropriate loader scope.
- Own the instance per UI5 control/controller, not merely infer liveness from a CSS selector. Handle `sap.ui.core.HTML` rerenders, preserve-area stale DOM, notification/dialog ID reuse, and teardown.
- Restore the correct model value after rerender, including an intentional empty string. Distinguish unavailable first-load model state from an explicit clear. Cancel stale delayed prefill callbacks when the record/control changes.
- Prevent change/model echo loops and retain active draft/history during host echoes. On real record replacement, use the explicit pending-edit policy and reset the correct history.
- Map validation text, error styling, and `aria-invalid` through stable Markian APIs/root attributes. Match the server's length semantics; a cosmetic counter is not validation.
- Replace resize/reparent/set-value workarounds with measurement and `onFullscreenEnter` where UI5 needs a custom overlay lifecycle. Return a restore function for host layout changes; preserve dialogs' z-index, focus, and scrolling without recreating the editor. Deregister resize/model listeners on destruction.
- Keep `UI5Markdown` and `UI5DisplayMarkdown` as separate host-owned display widgets and adapt them to W16's lightweight viewer after its gates pass, retaining the existing renderer until opt-in. Verify value binding, rerender/disposal, content compatibility, and permission policies separately. Disabled Markian inputs remain editors with nonmutating controls and cannot toggle tasks or change the value.

Gate the change on real form/dialog/prefill/validation workflows, not only isolated JS tests. Verify that each migrated integration starts visually, including models/settings that previously requested raw mode, while users can still switch to raw mode. Add a compatibility scenario with UI5 using `MarkianTrait` and jEasyUI still using `ToastUIEditorTrait`, plus an unchanged legacy consumer after the additive Core release. Verify engine assets, get/set, events, read-only editor behavior, and disposal remain independent; separate host display widgets must continue to work. Update the BDT Markdown node to identify documented Markian roots/content rather than `.toastui-editor-contents`, while supporting both backends during rollout. PHP adapter logic needs focused PHPUnit coverage where feasible under the Core testing rules; UI lifecycles belong in browser/BDT scenarios.

### M4. jEasyUI, IDE-Specific Extensions, and Other Consumers

Migrate jEasyUI asset injection and shared editor/value/validation/live-reference behavior to `MarkianTrait`, independently of the UI5 migration. The W11 decision is a direct replacement in the existing element classes, with no Toast UI backend switch or fallback. Implement correct runtime read-only/disabled handling instead of retaining its TODO. Replace the host-owned Markdown and DisplayMarkdown paths with Markian's lightweight viewer instead of PHP rendering.

Update `axenox.IDE` configuration so Codiware receives Markian asset URLs rather than the jEasyUI Toast UI bundle path. Preserve Core Mermaid reuse and documentation preview presentation, but replace renderer-specific CSS where necessary. Load/register Core's prebuilt `docsPlaceholders` factory and enable it only for selected editors; configure insertion presets, custom documentation links, and authorized host generation in the IDE layer without taking ownership of the DocsFacade grammar. Keep generic repository suggestions in Codiware.

Validate the exact DocsFacade delimiter/options/print metadata and generated body behavior with its server renderer. Add the required jQuery-comments integration through a small lifecycle/value adapter if that host is selected for rich comment editing; the inspected comments feed is not itself evidence of a current Toast UI dependency. Avoid rewriting an unrelated comments backend as part of this migration.

Compare browser output with server-rendered `MarkdownDataType`/DocsFacade output for alerts, softbreaks, front matter, links, HTML, and placeholders. Reuse semantic fixtures without requiring identical HTML trees.

**Separate security gate:** the inspected server converter explicitly allows raw HTML and unsafe links. A safe Markian client does not fix that path. Inventory trusted documentation versus untrusted user comments, define the appropriate server sanitization boundary, and implement/test it with its own compatibility review before claiming end-to-end safe rendering. Do not silently loosen Markian's policy to match this legacy behavior or globally break trusted docs HTML.

### M5. Rollout, Rollback, and Retirement

Roll out in this order: internal Codiware pilot, representative editable/read-only UI5 editors with host display-widget compatibility checks, jEasyUI, IDE documentation extensions, then remaining applications. Advance per consumer only after its parity and security gates pass; advanced requirements W4-W9 and extension packages W13-W15 must be complete before declaring the full planned scope delivered. W15 ships in Core, not Markian's v1 artifact; a core-only Markian release does not wait for external extension adoption.

Keep independent facade/consumer configuration selecting Markian or Toast UI during the migration window, not one mandatory platform-wide switch. Both operate on Markdown, but test that each consumer's newly saved documents remain readable by the fallback. Keep new optional formatting within the agreed fallback subset until retirement. Switching backends is a controlled reopen/remount using the current value, not two engines editing one DOM simultaneously.

Rollback must preserve unsaved drafts first, retain original files/values where conversion occurred, and restore the prior dependency/configuration set. Do not roll back by regex-converting every document. Verify image files referenced by saved Markdown remain accessible after rollback.

Retire Toast UI only after all consumers pass: remove Markdown-editor dependencies, both facade-bundled TUI scripts, old CSS/config keys/module registrations, TUI DOM workarounds, temporary wrappers, and selector fallbacks. Check repository-wide references and the resolved Composer dependency graph. Do not remove the separate TUI image editor or unrelated Mermaid use. Remove the compatibility flag in a later announced release, not in the initial pilot.

Retiring the bundled integrations does not automatically authorize removing Core's public `ToastUIEditorTrait`. Retain and deprecate it until supported external facades have migrated; removal needs an announced compatibility-breaking release under Core's policy. `MarkianTrait` remains the separate implementation throughout, never a forced replacement behind the legacy trait name.

## 8. Requirement Coverage Matrix

| Requirement group | Work packages | Completion evidence |
| --- | --- | --- |
| Vanilla script/CSS include; textarea/div; framework neutrality | W1-W2 | Offline script-tag, multi-instance, form submission/reset, destruction, Composer install fixtures. |
| Normalized portable Markdown; meaningful whitespace; unknown syntax | W0/W3 | Semantic/idempotent corpus, retained source on failed import, GitHub/GitLab comparison. |
| Invisible metadata and independently readable generated bodies | W3/W15 | Exact comment payload checks, unknown-provider/malformed-pair fixtures, independent rendering without extensions. |
| Word-friendly visual editing and Markdown-pro typing | W4 | Caret/selection/shortcuts, inline-code exit, lists, fences, IME and ordinary-user review. |
| MDI, themes, GitHub-like output, programmatic theme switching | W1/W4/W9 | Scoped CSS, two themes in one page, host stylesheet coexistence, icon/contrast review. |
| Search and replace in visual, raw, and block views; read-only search | W4/W9 | View-scoped matching, single-step undo, protected-content skipping, bounded patterns, focus-bound shortcuts, disabled replace in read-only editors. |
| Configurable pinned/floating/mobile/custom toolbars | W4 | Separate layouts, floating-only preset, dropdowns, overflow and keyboard/touch tests. |
| Formatting, headings, lists/tasks, code, quotes, links/images, colors | W3-W4/W6/W14 | Command/history parity; explicit color portability and image-policy tests. |
| Raw mode, separate view toolbars/sidebars, history/events | W1/W3-W4/W7/W13-W14 | Active-value/draft events, no-op mode transitions, failed imports, conflict tests. |
| Small embedded editors, maximize/restore, mobile support | W1/W4/W9 | Compact host, default/custom fullscreen callback lifecycle, overlay/iframe tests, keyboard/viewport restoration, real devices. |
| Tables, add/remove rows/columns | W5 | Table command/navigation suite and mode round trips. |
| Rich paste from web HTML, Word/Outlook, and Excel tables | W17/W6/W9 | Captured clipboard fixture corpus, Office list/heading mapping, HTML/TSV table conversion, image routing, paste as plain text, limits, and malicious-HTML fixtures. |
| Pasted images and image-URL autocomplete | W6/M2 | Standalone bounded raster data URIs; Codiware paste-to-file callback with regular Markdown URLs and no pasted binary, pending/failure tests, alt text, and repository suggestions. |
| Relative/absolute links, heading targets, URL validation | W3/W6 | Slugs/base preservation, inspector cancellation, Ctrl/Cmd/mobile opening, safe schemes. |
| Mermaid render/edit/pan/zoom; configurable renderer | W13 | Host-injected renderer, no global scans, SVG policy, Back commit, touch controls. |
| Code language, Tab width, line numbers, expanded editing | W14 | Optional prebuilt language assets, offline selected-feature loading, local history, Tab escape, source-preserving expansion. |
| HTML templates, `<kbd>`, configurable stencils/custom links | W3-W4/W8 | Portable HTML exports, parameter validation, host label/icon translation. |
| Mentions, multiple prefixes, suggestions/click/hover | W8-W9 | Plain/link export, existing empty-link mentions, accessible providers and context exclusions. |
| Generated placeholders, marker editor, insertion menu | W15/M4 | Real DocsFacade grammar, body policy, no automatic provider execution, re-import. |
| TOC except heading on first line; desktop/mobile access | W3/W7 | Shared anchors, parsed outline, collapse/drawer and raw-scroller navigation. |
| Security including HTML/JS/SVG, callbacks and providers | W9/M4 | Malicious corpus, CSP, bounded work, separate server-rendering security gate. |
| Callback-only data integration; no library AJAX | W1/W6/W8/W15/M2-M3 | Direct config functions, local/synchronous and promise results, exceptions/rejections, cancellation/stale-result handling, and no hidden data requests. |
| Power UI widgets, Codiware, IDE and comments integration | W10-W12/M0-M5 | Adapter contracts and real host scenarios, parity table signed off per consumer. |
| Additive Core `MarkianTrait`; independent facade migration | W11-W12/M0/M3-M5 | Legacy trait unchanged, facade-local opt-in, mixed Markian/Toast UI scenario, and no automatic backend change on Core upgrade. |
| Committed dist, asset delivery, Composer, commit builds | W2/W13-W15 | Tracked deterministic artifacts, required CI, package/archive/install tests in each owning package. |
| Lightweight viewer for display widgets | W1-W3/W16/W11-W12 | Shared render-only import boundary from extraction; measured separate bundle, no editor assets, semantic/security parity, and real host lifecycle checks. |
| Runnable feature examples for new users | W1-W2/W4-W8/W13-W15 | Chapter 11 index, focused public-API examples, packaged-asset browser smoke tests, and explicit external prerequisites. |

## 9. Test and Release Gates

Use existing Playwright tests as regression coverage, but split pure transformations/policies into focused unit tests as the library boundaries emerge. Test public behavior instead of depending on private editor DOM except where an engine-specific adapter test needs it. Run integration scenarios in their owning repositories.

| Gate | Required checks |
| --- | --- |
| Every implementation change | Relevant unit/browser slice first; no unrelated refactor until the slice passes. |
| Library build/PR | Type/API checks, unit suite, source browser suite, packaged classic-script smoke suite, deterministic artifact parity including new files, licenses and package metadata. |
| Packaging | `npm pack` archive install, Composer validation/install, all declared core/extension assets included, no consumer build scripts, no Node on runtime host, correct stable URLs; published Asset Packagist install verification. |
| Modular loading | Core-only comment fixture loads no Mermaid/programming-language highlighting assets, including with matching fences present. Enabled extensions use declared local/configured assets; test offline operation, CSP, loading failures/retry, supplied dependencies, version conflicts, deduplication, and instance-local state/cleanup. |
| External Core extension | A Core-free Markian installation remains usable. Core supplies prebuilt `docsPlaceholders` assets; routed/local URLs, registration order, supported versions, independent enabled/disabled instances, and missing-asset errors are verified. Preserve exact comments/bodies without the extension; no document-driven Core loading or provider execution. |
| Lightweight viewer | From W1-W3, verify shared rendering has no editor dependency. W16 measures minified/compressed JS/CSS versus editor under equivalent options and establishes an approved smaller-size budget; inspect artifacts/network for editor-engine/UI imports. Run viewer-only packaged tests, shared semantics/security, optional render-only dependencies, and editor coexistence. |
| Content compatibility | Import/edit/export/re-import and independent rendering for the fixture corpus, malformed and unknown metadata, intentional portability limits. |
| Callback boundary | Local/synchronous and asynchronous fake callbacks for suggestions, inspection, images, mention details, and regeneration; exceptions, rejection, abort, and late results. With supplied assets and local data, fail unexpected data requests and verify no built-in endpoint/transport dependency. |
| Security | HTML/URL/SVG/clipboard/provider fixtures, PHP inline-script escaping, limits, CSP, lifecycle cancellation, server-output boundary tests. |
| Accessibility/devices | Keyboard/screen reader, touch and mobile keyboards, IME, bidi, focus/overlay restoration, theme contrast. |
| Host migration | Save/load/dirty/prefill/reset/live reference, dialog rerender, disabled/read-only, validation, image policy, relative navigation, iframe and multi-instance scenarios. |
| Facade coexistence | Additive Core trait release leaves legacy consumers working; UI5/Markian and jEasyUI/Toast UI coexist with independent assets, values, events, and rollback selection. |
| Examples | Chapter 11's index and links are valid; standalone examples run against packaged assets without a consumer build or framework. Browser checks cover each example's primary interaction, desktop/mobile layout, and optional-dependency isolation. External examples state prerequisites and run in their owning host's suite. |
| Agent handoff | `verify` passes, the handoff report lists commands and results, the Apache test bench loads the new build, and no forbidden command or dependency change occurred. |
| Performance | Measured startup/interaction/memory on agreed representative fixtures; documented budgets and no temporary instrumentation in shipping files. |
| Stable release | All required work packages complete, parity decisions signed off, release notes and migration guide, matching npm/Composer/tag/manifest version, verified committed artifacts, rollback rehearsal. |

Do not treat a successful build or a focused test selection as completion of these gates. No broad production data conversion, removal of fallback dependencies, or stable release happens merely because the demo renders correctly.

## 10. Delivery Order and Open Decisions

Recommended dependency order:

1. W0 contracts/corpus, then W1 extraction and W2 distribution together.
2. W3 content/rendering/security foundations, then core W4 controls.
3. W5-W8 shared features, then independent W13 Mermaid and W14 Code extensions once their foundations are ready. Start M0/M1 and the opt-in W10/M2 Codiware pilot once its required subset is ready; neither optional extension requires the other.
4. W9 hardening runs throughout, with its final gate before stable release.
5. After W10's Codiware integration, deliver W16's separate lightweight viewer using the rendering boundary established in W1-W3. Codiware integration must not wait for the viewer. Complete its size/dependency/security gates before display-widget adoption.
6. Deliver the additive M3 Core trait, then W12/M3 UI5 and W11/M4 jEasyUI when each parity subset is complete, following M5's recommended rollout order without coupling facade releases. Their display-widget adapters use W16; disabled inputs remain editors. Deliver W15 in Core once its public API foundations are available, then enable it in the selected M4 hosts. Work-package numbering does not impose a dependency between the facades or optional extensions. Complete the remaining M4 consumers; M5 retirement follows real deployment validation.
7. Deliver W17 rich paste last. Consumers that need Toast UI's Excel table paste before then follow the parity decision recorded under W0.
8. Set up W18's DevMan agent once W2's build and verification gates pass, even though it is listed last.

Confirm these before finalizing v1 estimates:

- Publishing access for npm `markian` and Composer `axenox/markian`, repository publication permissions, and branch-protection ownership.
- Browser/device minimums, supported Mermaid versions, baseline code languages, locale scope, and document/image/diagram limits.
- Softbreak defaults per host, color/alert portability presets, allowed HTML, host display-widget task policies, and server sanitization ownership; Markian's disabled/read-only mode always blocks task toggles.
- Exact placeholder grammar/options in current documentation, generated-region editing policy, and legacy TUI-wrapper incidence.
- Accepted Codiware change from document-wide split preview to visual/raw mode switching, with Monaco as the source-editing alternative.
- Expected fullscreen boundary inside iframes and whether a parent bridge is required.
- Whether every intermediate commit must be build-certified or squash-merge certification is sufficient; local hook bypasses cannot be prevented absolutely.

These are bounded decisions for implementation and rollout. They do not reopen the approved visual direction or permit silent loss of existing content.

## 11. Runnable Feature Examples

Create a top-level `Examples/` folder so a new user can discover important features, try them, and inspect small working integrations. This describes the target scope, not a claim that every API is implemented. Keep the development demo separate: examples teach supported public contracts and must not depend on page-global editor state or private engine internals.

### Structure and Delivery

Provide `Examples/index.html` as a browsable feature index and `Examples/README.md` with prerequisites, local serving instructions, and links to each example and its source. Use focused, clearly named subfolders with a runnable HTML page, small JavaScript file, and only the local sample assets needed for that feature. Start with a minimal editor rather than an all-features showcase; link related examples instead of duplicating a complete application in each folder.

Examples load the committed prebuilt core/CSS and explicitly selected extension assets through ordinary script/link tags. No consumer bundler, npm install, compilation, CDN, sibling workspace, or backend service is required for standalone examples. A basic static HTTP server is acceptable; explain it in the README rather than promising every browser supports `file:` loading. Use generic sample documents and local images, never real client data, credentials, or installation-specific paths.

Include standalone examples in tagged checkouts and published npm/Composer archives, adjusting W2's package allowlists accordingly. Relative asset paths must work in the distributed package layout. Keep support code small and shared only where it removes real duplication; the feature's configuration and public-API calls should remain easy to find. Do not copy library implementations into examples or ship a second runtime build.

### Initial Example Set

| Example | What a new user can try | Delivery owner |
| --- | --- | --- |
| Minimal editor | Mount an editor, await readiness, get/set Markdown, observe changes, and destroy it. | W1-W2 |
| Lightweight viewer | [Editor/viewer comparison](../../Examples/viewer.html): equal responsive panes share live Markdown, theme changes, replacement, and disposal. This demo loads both bundles; dedicated startup/archive fixtures verify viewer-only asset isolation. Mermaid is disabled by default. | W16 delivered slice |
| Form and disabled editing | Textarea/form values and reset, read-only transitions, retained search/copy/navigation, and blocked mutations. | W1/W4 |
| Multiple instances and themes | Independent values, histories, themes, resizing, and teardown on one page. | W1/W4 |
| Toolbars and host customization | Pinned/floating/compact controls, a host-added public-API command, and paired custom fullscreen restoration. | W4 |
| Templates and allowed HTML | Fixed insertion, `{{selection}}` wrappers, `<kbd>` stencils, and the explicit HTML allowlist. | W3/W8 |
| Mentions and hash-tags | Multiple prefixes with local suggestions and separate click/hover/focus handlers; no backend request needed. | W8 |
| Links and images | Relative destinations, heading suggestions/inspection, local callback results, bounded image insertion, and recoverable callback failure. | W6 |
| Tables | Row/column controls, alignment, keyboard navigation, and undo. | W5 |
| Rich paste | Paste sample web, Word, and spreadsheet clipboard content, paste as plain text, and see rejected unsafe content. | W17 |
| Views, drafts, and navigation | Visual/raw switching, outlines, a small host-created view through the public API, and Help/Back without losing pending work. | W7 |
| Mermaid extension | Explicit factory registration, renderer supply/loading, insert/edit, preview, pan/zoom, and source-preserving errors. | W13 |
| Code extension | Explicit opt-in, selected local language assets, expanded editing, language/Tab settings, and ordinary-code fallback. | W14 |
| Core DocsPlaceholders integration | Actual delimiter/body preservation, marker controls, and explicit authorized regeneration in a Core host. | W15/M4 |

Use local deterministic data/functions for callback demonstrations, with separate success, failure, and stale-result cases where relevant. These are working examples, not pseudocode. Host persistence and AJAX remain outside Markian; do not imply that a local callback demo implements uploads or repository storage.

Mermaid and Code examples load only their declared optional assets. Core's DocsPlaceholders example belongs with Core's extension distribution and host tests; the Markian index links to its maintained documentation/example and states the required Core/Markian versions and setup. Do not bundle Core into Markian or make standalone examples depend on it. If an external example is unavailable, show its prerequisites explicitly rather than leaving a broken runnable link.

### Ownership and Acceptance

W1 establishes the minimal example/index, W2 verifies packaged delivery, and each feature/extension package adds its example alongside the implementation. Keep the examples synchronized with public API declarations, configuration documentation, and asset/version changes in the same change. Documentation-only sketches do not satisfy this deliverable.

Acceptance: a new user can serve a clean distributed package, open the index, run each standalone example without building or editing configuration, and find the corresponding source. Reuse the existing browser-test infrastructure for primary interactions, console/page errors, desktop/mobile overflow, instance isolation, and disabled behavior. Verify that core-only examples request no Mermaid or programming-language assets and that each optional example works with selected local/offline dependencies. External-host examples are verified in their owning integration suites, not counted as passing merely because the index link resolves.

## 12. Development and Agent Maintenance Workflow

An AI agent running in DevMan is planned to maintain Markian continuously: it receives a DevMan ticket, changes the code, and passes the ticket back to a human for testing. Humans also develop directly from VS Code. W18 sets this up; this chapter describes the target workflow, not existing tooling.

### Two Development and Test Approaches

| Approach | Used by | How changes become visible | What is tested |
| --- | --- | --- | --- |
| Vite dev server | Developers in VS Code | `npm run dev`; TypeScript is transformed on the fly, no explicit build | Source modules; fast iteration |
| Apache test bench via a Power UI facade | DevMan agent handoff and human testers | `npm run build` produces `dist`, served by Apache | Packaged classic-script assets, as consumers load them |

Both approaches stay supported. Browser tests run against either, selected by the configured base URL. Release and handoff decisions rely on the packaged assets, not only on the dev server.

### Agent Ticket Lifecycle

1. Start from a clean working tree; stop and report if unrelated changes are present, because the Apache test bench serves the same files.
2. Read the ticket, the Copilot instructions, the architecture, and the relevant plan sections.
3. Change source, tests, examples, and documentation as the instructions require. Never edit `dist` by hand.
4. Run `npm run verify`. On failure, fix and rerun within an iteration limit, or report the failure.
5. Write the handoff report and pass the ticket to a human.
6. The human tests on the Apache test bench and accepts, rejects, or comments on the ticket.

### Command Allowlist

| Allowed | Forbidden |
| --- | --- |
| `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run verify` | `npm run dev`, `vite`, `vite preview`, or any other long-running server |
| `npm ci` with an unchanged lockfile | `npm install <package>`, `npm update`, lockfile edits; dependency changes need human review |
| Read-only Git commands (`status`, `diff`, `log`) | `git push`, `--no-verify`, history rewriting |
| | Arbitrary `npx`/shell commands, edits in `node_modules`, network access beyond npm ci |

The command tool enforces this list; instructions alone are not a security boundary. Credentials never enter the agent's context.

### Handoff Report

Each ticket handoff states: a short summary of the change, changed files, commands run with their results, the test-bench page or scenario to check and the expected behavior, documentation updated, and known limitations or open questions. Add or update an example or scenario page when a change has no testable page yet.
