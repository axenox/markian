# Markian Library Implementation and Migration Plan

## 1. Purpose and Decisions

Turn the approved look-and-feel prototype into a reusable, framework-independent Markdown editor, implementing the [requirements](Requirements.md) using the architecture in [Approach.md](Approach.md). Then replace Toast UI Editor in Power UI and Codiware without changing Markdown into a proprietary storage format or requiring front-end builds on consumer installations. Markian has no separate lightweight viewer API; Power UI owns separate display-only widgets.

This is an implementation plan, not a statement that the described library, packages, hooks, or adapters already exist. The inventory below was checked against the workspace on 2026-10-26. No consumer code or package configuration is changed by this document.

Decisions for implementation:

- Keep Milkdown/ProseMirror and its remark-based Markdown model for visual editing. The prototype has passed the initial UX gate; do not restart editor selection unless a concrete preservation or interaction blocker emerges.
- Keep CodeMirror for raw Markdown, expanded code editing, and Mermaid editing. Each view owns its toolbar, sidebar, selection, and scrolling behavior.
- Start all migrated integrations in the regular WYSIWYG-like visual mode, including Power UI and Codiware. Keep an optional raw-start setting in the standalone library, but do not use it in the current integrations; users can still switch to raw mode after opening.
- Persist ordinary Markdown with documented normalization, not editor JSON or rendered HTML. Preserve meaningful whitespace, invisible extension comments, and readable generated bodies.
- Keep Markian an editor, including in disabled/read-only mode. Prevent document changes while retaining search, selection, Markdown copying, safe navigation, and other nonmutating controls. Separate display-only widgets belong to Power UI/host applications, not a Markian viewer product.
- Implement no AJAX/data-request transport in Markian. Accept callbacks in configuration; the host callback may use AJAX, local data, generated results, or any other source.
- Publish a prebuilt classic-script JavaScript file plus CSS in the GitHub repository and release tags. Consumer use must not require Node.js, npm, Vite, import maps, or a build step.
- Replace the earlier all-features/single-bundle approach with a core plus optional prebuilt extensions/dependencies. Comment editors must not load Mermaid or programming-language highlighting. Keep factory registration explicit and allow declared dependency loading only for enabled extensions, with host-controlled asset URLs and multi-instance deduplication.
- Publish the direct Composer package as `axenox/markian` and the npm package as `markian`. Also publish npm metadata/artifacts so Asset Packagist can expose the browser package as `npm-asset/markian`.
- Run `npm run build` before every normal developer commit and verify committed artifacts in mandatory CI. Local Git hooks are a convenience/enforcement layer, not an unbypassable security boundary.
- Keep the current Mermaid interaction: a dedicated code/preview view with a Back button that applies changes. Do not add Apply/Cancel controls by default merely because the earlier approach suggested them.
- Introduce a separate Core `MarkianTrait` alongside the unchanged `ToastUIEditorTrait`. Each facade opts in independently, with a facade-local fallback to Toast UI; installing the new Core must not force all facades to switch. Do not bulk-rewrite existing stored Markdown during installation.

The scope is the complete required library and migration, not only packaging the current demonstration page. A strict Word-like typing preset and a visual Mermaid shapes authoring sidebar remain discussion/optional items, not blockers for the required v1 scope.

## 2. Starting Point

### 2.1 What the Prototype Already Proves

The [prototype guide](../../README.md) describes the implemented behavior. The current browser suite has 36 passing tests, including standard formatting, typing shortcuts, task controls, basic table edits, raw-mode toolbar commands and history, comment preservation, mode-specific outlines, Mermaid editing, safe URL rejection, and desktop/mobile layouts.

Useful implementation foundations:

- A custom MDI toolbar and visual editor with Markdown-oriented typing behavior.
- In-place raw mode whose buffer is authoritative while active, with independent CodeMirror history.
- A visual outline and a source outline that scrolls CodeMirror rather than the outer document.
- Mermaid diagrams stored as ordinary fences, rendered using Core's bundled Mermaid, with a dedicated live editing view and one-step visual history on return.
- Explicit mappings for hidden comments rather than proprietary visible delimiters.

These tests prove a prototype slice, not full library conformance, production sanitization, real-device behavior, or parity with every existing integration.

### 2.2 What Must Change Before Library Use

The current [entry point](../../src/main.js) uses page-global state, fixed IDs, demonstration controls, and a single `window.Markian` instance. Its CSS affects the entire page. The [package manifest](../../package.json) is private and builds an application rather than the promised library distribution. The [ignore rules](../../.gitignore) currently exclude `dist/`. Mermaid's [prototype adapter](../../src/mermaid-view.js) imports a sibling Core asset and initializes a shared global renderer.

Replace these assumptions with instance ownership, scoped styles, a stable public API, explicit renderer injection, deterministic library builds, and distribution tests. Keep the existing example as a demo consuming the public API; do not turn its masthead, download button, sample photo, or Google Fonts requests into library dependencies.

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

Define and document this contract before moving prototype functions. Names below are proposed v1 API names, not current exports.

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

Proposed configuration sketch, not the current prototype API. Highlight ticket references such as `#32132` while storing them as plain Markdown text. Callback bodies below are pseudocode; the host supplies their logic and any requests.

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

Core and extensions must work through ordinary `<script src>`/`<link>` delivery without consumer compilation, import maps, or an implicit CDN dependency. Hosts load/register extension factories before enabling them per instance. Enabled extensions may load their declared prebuilt dependency assets on demand through documented host-controlled URLs; explicit script/CSS loading is allowed and is not an AJAX data-service feature. No hidden bundler chunk discovery or guessed asset locations. An ESM build may supplement, not replace, this delivery contract.

Mermaid is one optional extension, not the sole exception to a single-file rule. Accept a host renderer adapter/supplied instance first and a configured dependency loader second. Do not import a sibling Core filesystem path; Power UI passes its existing Mermaid. Publish supported versions and resolve third-party assets through explicit host configuration or documented prebuilt package paths with notices/version metadata. Treat language packs similarly. Disabled/absent extensions must not request their optional dependencies even if matching fences occur in the document. Preserve fenced source/plain-code fallback; failed requested rendering must not prevent unrelated editing.

Deduplicate compatible script/CSS/dependency loads across editors; validate incompatible versions and retain independent extension instances, sessions, themes, and callbacks. Do not unload shared assets when one instance is destroyed. Document loading order, CSP and asset-base behavior, and provide offline tests serving selected assets locally. The complete modular distribution remains committed and publishable without a consumer build; an all-features aggregate must never be mandatory for comment-editor use.

This distribution covers Markian-owned assets, not every external extension. ExFace/Power UI Core supplies the planned `docsPlaceholders` extension as prebuilt assets in its own package, with supported Markian versions, dependency metadata, and notices. Hosts resolve/load those assets and register the factory before per-instance opt-in, composing the packages' metadata without adding a mandatory Core dependency or sibling filesystem import to Markian. Core packaging/build gates cover its extension artifacts; Markian's manifest need not hash files it does not ship. Neither package may require a consumer build. Exact Core browser paths and factory exports must be finalized during integration, not assumed from the example variable names.

Make CSS entirely Markian-scoped, with documented custom properties and local theme state. Do not ship the demo's global selectors, remote fonts, image requests, or fixed page dimensions. Embed required selected MDI paths; preserve licenses. Provide stable class/data-attribute hooks for editor/Preview styling and tests without promising editor-engine internals.

`manifest.json` records library/extension versions, declared core/extension/dependency assets, their relationships, and artifact hashes; it must not embed changing build timestamps, machine paths, or Git commit hashes that make rebuilding the same source produce different bytes. Check Windows/Linux determinism for all core and optional outputs. Decide source-map publication explicitly and exclude local absolute paths.

### 4.2 Commit the Ready-to-Use Distribution

Remove `dist/` from the ignore rules and commit the complete required distribution. Keep `node_modules/`, test output, caches, and temporary artifacts ignored. Separate the demo build/output from the library output so the current Vite-generated HTML and hashed application assets do not become the library contract.

Every source/dependency/configuration change that affects the build must include its resulting distribution in the same commit. Release tags point to commits already containing the verified build. GitHub release downloads may mirror those files, but must not be their only location. Do not use an npm lifecycle script or a Composer post-install script as the only way consumers obtain compiled assets.

Retain one pinned lockfile and a documented Node/npm toolchain. Use a clean output directory and deterministic core/extension build configuration. Start with the existing Vite toolchain's library/Rollup-compatible output if it satisfies modular script-tag delivery and declared-asset tests; change bundlers only for a demonstrated build constraint. Include transitive license notices and an upgrade policy for security-sensitive dependencies.

### 4.3 Build on Every Commit

Implement a versioned Git hook plus a cross-platform Node runner, installed by a documented `npm run hooks:install` bootstrap after `npm ci`. The hook invokes `npm run build` on every normal commit, including documentation-only commits, and fails the commit on build failure. It must work with Git for Windows and Git GUIs rather than requiring PowerShell-only or Unix-only business logic.

The default hook policy is **build and verify**, not broad automatic staging:

1. Check that the index and working tree agree for build inputs, including tracked source, the lockfile, package/build configuration, and build scripts. Refuse ambiguous partially staged build inputs; explain how to finish staging or postpone the unrelated edits. Never silently stage source files.
2. Run the deterministic library build.
3. Check that tracked, staged, unstaged, deleted, and newly generated distribution files match the exact build being committed. A plain `git diff -- dist` alone misses some of these states.
4. If distribution changes are not staged, stop and ask the developer to review/stage them and retry. Rebuilding on the retry must be byte-identical. Never auto-stage the whole repository or modify unrelated user changes.
5. Optionally provide an explicit `npm run build:stage` convenience command that stages only the reviewed distribution; it is not a substitute for input/index checks.

Git hooks are not installed by cloning and can be bypassed with `--no-verify`, a GUI setting, or altered Git configuration. Therefore:

- Add required GitHub Actions checks: `npm ci`, build, artifact parity, unit tests, browser smoke tests against **dist**, and packaging validation. Run source tests as appropriate too.
- Artifact parity must catch untracked output as well as changed/deleted tracked files, using a clean checkout and a structured status check scoped to `dist/`.
- Protect the integration/release branches and require these checks; restrict unchecked direct pushes. Do not rely on a hook to protect a release.
- If every individual commit in a merged history must be certified, run a lightweight artifact rebuild for each newly introduced commit, not just the PR head. Alternatively enforce squash merging and certify the final merge result. A head-only check must not be described as proof that all intermediate commits contain valid assets.
- Run the build again at release verification and refuse publishing if it changes committed files. Publish the verified artifacts; do not create an uncommitted release-only build.

### 4.4 npm and Asset Packagist

The npm package name is `markian`, with the Asset Packagist mapping `npm-asset/markian`. The direct Composer package name is `axenox/markian`. These names are decided; confirm publishing access and registry availability, and verify the Asset Packagist mapping in an installation test.

Convert the private prototype manifest to publishable library metadata, with SPDX license, repository information, supported engines for contributors, version, browser/type entry points, and a `files` allowlist including all core/extension assets under `dist`, the license, and required documentation. Keep demo/test tooling in development dependencies; published runtime use must not install/build Milkdown or CodeMirror. Required runtime code is prebuilt into the appropriate core/extension assets; optional language/dependency files remain selectable without npm installation on the runtime host.

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

Track completed work and remaining tasks below as implementation proceeds. The Done and ToDo columns are intentionally empty initially; an empty cell is not a completion claim.

| WP | Description | Done | ToDo |
| --- | --- | --- | --- |
| W0 | Freeze Contracts and Compatibility Fixtures | | |
| W1 | Extract the Instance-Based Library and Demo | | |
| W2 | Establish Build, Distribution, and Packages | | |
| W3 | Complete Markdown Import, Export, and Viewing | | |
| W4 | Complete Editing Controls and Responsive UI | | |
| W5 | Finish Tables and Clipboard | | |
| W6 | Links, Images, and Repository Providers | | |
| W7 | Production Mermaid, Code Workspaces, and Outlines | | |
| W8 | Templates, Mentions, and Placeholders | | |
| W9 | Security, Accessibility, and Release Hardening | | |
| W10 | Integrate Markian in Codiware | | |
| W11 | Integrate Markian in JEasyUIFacade | | |
| W12 | Integrate Markian in UI5Facade | | |

### W0. Freeze Contracts and Compatibility Fixtures

Deliver a versioned browser/device baseline, initial language/Mermaid version list, normalization policy, unsupported-content policy, and default limits. Confirm publishing access for Composer `axenox/markian` and npm `markian`; keep publication credentials outside source control.

Build anonymized fixture documents from current use cases: short comments/errors, rich tickets, documentation with actual placeholder pairs, mentions, HTML stencils, large tables, images/data URIs, alerts, front matter, relative links, and Mermaid. Include malformed/unknown comments, empty links, reference links, Unicode headings, ordered-list starts, nested lists, escaped pipes, code fences longer than their content, hard breaks, and indentation. Keep known defects as explicit fixtures, not behaviors to copy blindly.

Resolve compatibility policy for colors, data-URI publishing, allowed HTML, host display-widget task interactions, and existing softbreak settings. Markian's own disabled/read-only mode must never toggle tasks. Security must not be relaxed to emulate an unsafe old renderer. Record any intentional visible differences before migrating a consumer.

Acceptance: every requirement and each gap-table row maps to a work package and a test or explicit product decision. No source compatibility claim relies only on a screenshot.

### W1. Extract the Instance-Based Library and Demo

Separate the document controller, engines, mode views, command registry, toolbar/dialog components, provider manager, rendering pipeline, themes, and host adapters. Keep related logic together; do not invent a plugin layer for every small helper.

Move the demonstration page onto the new public factory. Support multiple independently themed editable/read-only editors, textarea mounting/submission/reset, hidden-tab remeasurement, compact containers around 300 by 400 pixels, read-only/disabled transitions, and full disposal. Define a stable readiness/error surface for asynchronous asset or renderer failures.

Acceptance: classic-script fixture mounts independent editable and read-only editors without a framework; values, histories, mode changes, focus, overlays, and destruction remain independent. Read-only search/copy/navigation work while every user mutation path is blocked, including extension and asynchronous paths; permission changes retain drafts/history. Verify visual startup by default and explicit raw startup for standalone callers. Demo-specific network/assets are absent from library startup.

### W2. Establish Build, Distribution, and Packages

Implement Section 4 before adding a large advanced feature surface. Commit the first real library build, declarations, notices, and manifest. Add hook installation, index-aware verification, clean CI artifact checks, package validation, direct Composer metadata, and npm publication metadata.

Acceptance: a clean Git tag checkout, an npm package installation, and direct Composer installation all supply ready-to-use assets. Also verify Asset Packagist installation once the version is published. Browser fixtures run only against packaged `dist`, with no dev-server module resolution or sibling Core import. Required branch checks reject a stale or missing build.

### W3. Complete Markdown Import, Export, and Viewing

Define CommonMark plus the required GFM subset: tables, tasks, strikethrough, and extended autolinks. Preserve ordered-list start values, nested structures, hard/soft breaks, code indentation, reference-link meaning, fence contents, inline code boundaries, and extension comments. Make export/import idempotent after normalization. Preserve supported HTML as explicit mapped content; retain unsupported constructs as inert opaque source or refuse visual import without losing the raw buffer.

Automatically detect bare URLs, `www` destinations, and email addresses in eligible editor text, including disabled/read-only presentation. Autolinking is always enabled, not a configuration option; adapters must not expose or translate an `extendedAutolinks` toggle. Apply the URL safety policy, handle surrounding punctuation, and exclude code and existing links. Do not rewrite raw Markdown merely to make detected destinations clickable in rendered content.

Create consistent editor dialect and sanitization definitions across editable and disabled/read-only presentation, including headings/anchors and extension fallbacks. Do not add a separate viewer factory. Support a configurable softbreak rendering policy for Power UI's `enable_newlines`; do not rewrite stored text merely to change presentation. Preserve front matter and define its editor presentation in the Power UI preset, checking separate host widgets and the existing server converter for compatibility.

Test GitHub and GitLab independently with a conformance corpus. Neither a GFM label nor rendering through the same library twice proves interoperability. Extension metadata must remain invisible and generated content readable in an independent renderer without the extension.

Acceptance: semantic round trips, comments and unsupported-input handling, editable/read-only presentation consistency, host-widget compatibility fixtures, and independent rendering pass before any production data is saved through Markian.

### W4. Complete Editing Controls and Responsive UI

Create a shared command registry with active-view applicability, enabled state, labels, shortcuts, and history grouping. Complete pinned/floating/contextual toolbars, independently configurable layouts, custom buttons and dropdowns, floating-only presets, H1-H6, inline styles, list/task conversion, indent/outdent, horizontal rules, quote variants, links, images, raw mode, undo/redo, and clear formatting.

Preserve word-at-caret formatting and typing out of inline code without invisible sentinels. Test punctuation, empty selections, nested lists, composition, paste, and literal Markdown characters. Fix supported input rules rather than normalizing away typing defects; cover both backtick and tilde code fences deliberately.

Provide compact text-color swatches for a configurable 5-10 color palette. Store color metadata only through an explicit allowed-HTML extension/preset; GitHub may strip colors. Portable mode must not promise color fidelity or emit visible proprietary syntax. Provide ordinary quotes as the baseline and documented GitHub-style alert syntax for compatible presets.

Implement overflow menus, optional bottom/mobile placement, touch controls, focus-preserving dialogs, keyboard menus, accessible tooltips, and a reliable maximize/restore overlay. Keep the same instance, history, selection, and scroll state, and restore host layout and focus. Define iframe viewport limits; parent-level expansion requires a host bridge. Do not use global body state that one editor can accidentally undo for another.

Make fullscreen behavior configurable through `onFullscreenEnter({ instance, element, signal })`. Without the callback, use Markian's built-in maximize/restore behavior within the current document viewport; this does not require the browser Fullscreen API. With the callback, delegate layout, reparenting, host overlays, stacking, and any parent-frame bridge to trusted host code instead of also applying the built-in overlay. The callback returns a synchronous, idempotent restore function, directly or through a promise; this is the paired exit/cleanup operation, not merely a fullscreen notification.

Markian owns the fullscreen command/control state, duplicate-request prevention, exit/Escape handling, and remeasurement after transitions; the host owns reversal of its layout changes. Enter fullscreen state only after successful callback completion. Report exceptions/rejections without changing content or losing the prior state; a failing callback must undo any partial host changes before rejecting. On exit or destruction, invoke the returned restore function once and report cleanup errors. Abort pending entry on destruction or a cancelled request; if an obsolete entry still resolves, immediately invoke its restore function rather than leaving an orphan overlay. Keep restoration independent of document history and test focus/selection/scroll preservation without recreating the editor.

Acceptance: command parity in visual/raw views, separate selection toolbar configuration, keyboard/screen-reader checks, and real-device mobile/IME tests pass in small embedded hosts as well as fullscreen. Cover default behavior and custom synchronous/asynchronous fullscreen callbacks, rejected/cancelled entry, repeated toggles, Escape, destruction during entry, and multiple independently maximized instances.

### W5. Finish Tables and Clipboard

Reuse ProseMirror table primitives and finish row/column insertion/deletion, header/alignment controls, keyboard navigation, selection, and touch/context menus. Avoid unsupported merged-cell promises in a GFM table model. Include undo/redo for every operation and mode round trips.

Implement sanitized HTML-table paste and TSV fallback for Excel. Preserve cell text and shape, not styling/formulas. Define header policy and handling of merged cells, embedded line breaks, pipes, ragged input, and oversized clipboard content. Report explicit flattening/rejection instead of silently losing cells. General sanitized rich-text paste is separate from table parsing.

Acceptance: representative Excel clipboard fixtures and actual clipboard browser workflows produce readable portable tables; deleting the final row/column and undoing remain stable.

### W6. Links, Images, and Repository Providers

Finish insert/edit/remove links, separate target-heading selection, a configurable document base, stable heading anchors, duplicate/Unicode slug policy, and Ctrl/Cmd-click plus a mobile-accessible open action. Store relative destinations unchanged. Render/open through a host URL resolver that does not replace Markdown with transport/download URLs.

Add link/image suggestion and link-inspection callbacks returning structured results or promises, including existence/unknown status plus heading IDs. Show loading/empty/error states; reject stale results. Markian only invokes callbacks; it makes no AJAX requests. Codiware callbacks use its API service for repository lookup, allowed-file navigation, and guarded image URLs. A host inspection endpoint must not become a generic remote-URL fetcher that creates SSRF risk.

Support paste/drop/file-selection of bounded raster images, alt text, and URL images. The standalone default stores data URIs as required. An optional configured image callback can instead save the image through host-owned code and return a regular destination URL. Codiware must use this callback: successful paste saves an image file in a host-selected location and inserts ordinary `![alt](url)` Markdown, never the image binary or a data URI. The existing hooks, neighboring `images` folder convention, deduplication, and save-time externalization are implementation choices, not compatibility requirements.

Markian tracks the pending callback result, not an upload transport. Keep temporary previews and pending image blobs outside persisted Markdown. Explicitly handle pending results, deleted image nodes, cancellation signals, and save ordering. In Codiware, wait for image-file creation before saving the document; on failure, report it and allow retry/removal of the pending paste, without silently falling back to embedded binary or dropping the paste. Never save a temporary blob URL or a destination whose file creation failed. Reject unsafe SVG/data schemes rather than accepting arbitrary `data:` targets.

Acceptance: relative path/query/fragment behavior survives both modes; synchronous/local and promise-based callbacks work without library AJAX. Test standalone data-image persistence separately from Codiware paste-to-file behavior: an actual file exists, saved Markdown contains a regular image destination and no pasted binary/data URI, and the image renders after reopening. Pending/failed pastes cannot yield a falsely successful document save.

### W7. Production Mermaid, Code Workspaces, and Outlines

Extract the prototype renderer dependency into a versioned adapter contract. Reuse host Mermaid without global DOM scans or repeatedly changing another application's configuration. Isolate rendering when a shared instance cannot satisfy required security/theme behavior. Sanitize generated SVG with a tested SVG policy and never bind source-defined executable callbacks.

Add explicit diagram edit affordances and pan/zoom/reset controls with mouse, keyboard, and touch support. Scope IDs, rendering state, and cleanup to the diagram/instance; ignore stale asynchronous results. Bound diagram text/complexity. Mermaid code remains a standard fence; missing renderers, invalid syntax, and render failures preserve source.

Retain the dedicated code-left/preview-right view with a Back-only default toolbar. Back is the Apply action. Use responsive stacked/switchable panes as appropriate; no document-wide split preview is required. Add Cancel only as a separately approved optional action. Complete target-revision conflict handling and active-draft API/event behavior.

Provide an optional code extension with an expanded ordinary code editor, language choice, Tab handling, configurable tab width, line numbers, highlighting, and a way to leave a Tab-trapping editor. Keep ordinary blocks directly editable without it. Supply programming-language support as declared prebuilt extension assets loaded only when enabled/needed or preloaded by the host; offline use serves selected files locally without hidden imports. Missing highlighting must not remove code or prevent basic editing.

Finish the view-owned outline: parsed ATX/Setext headings, exclude the title heading starting on line 1, shared slug rules, current-section indication, collapse on desktop and a usable mobile drawer. Visual navigation targets rendered content; raw navigation targets the actual code scroller and line, not the page. Specialized code/Mermaid views have their own relevant sidebar contract; they do not inherit a stale document outline.

Acceptance: multiple diagrams, theme changes, rapid edits, no-op Back, conflicting host updates, destroyed targets, large-diagram controls, expanded code history, and desktop/mobile outline navigation pass browser tests. Core-only comment fixtures request no Mermaid or programming-language highlighting assets; enabled extension fixtures verify local/offline dependencies, deduplicated loading, failures/retry, and independent state across instances.

### W8. Templates, Mentions, and Placeholders

Implement Markdown templates/stencils and parameterized insertion menus. Use `markdown` strings with optional literal `{{selection}}` substitution for both fixed templates and selection wrappers, including empty-selection caret placement and context-safe escaping. Add safe mapped HTML stencils, especially `<kbd>`, that serialize only the intended HTML element and escaped content. Preserve configured captions, hints, icons, and restricted presentation styles; do not serialize editor-only wrappers.

Implement mention rules with prefix priority, bounded matching, distinct styles, structured suggestions, click events, and accessible hover/focus/touch details. Exclude code, URLs, and other invalid contexts. Store plain text by default or ordinary links by explicit configuration. The Power UI preset must recognize existing `[@label]()` and linked mentions without converting them to visible private widget syntax. Host callbacks translate filter/display attributes, page limits, headers, and action metadata into any required requests; do not pass this backend-specific transport configuration into the standalone library.

Keep each mention type's `onSuggest`, `onHover`, and `onClick` handlers directly on its configuration object in `tags[]`. Dispatch to the matched rule directly, without a nested callback object or a required global mention-type switch. Use `onHover` for accessible focus/touch details as well as pointer hover. Scope pending suggestions/details to that rule and query; test distinct ticket/user handlers and stale results when the active mention type changes.

Implement the actual DocsFacade placeholder grammar as a Core-owned, Core-supplied optional `docsPlaceholders` extension, not hard-coded ExFace behavior in Markian or a duplicate IDE-owned grammar. Core ships prebuilt assets; the host loads/registers its factory and opts in per instance. Preserve paired `<!-- BEGIN ... -->` / `<!-- END ... -->` delimiters and their exact payloads, plus unrelated/unknown comments and print/image metadata. The prototype's `markian:placeholder` example is not a migration grammar.

Show generated bodies in bordered regions with an Edit Tags action and a configurable insertion menu. Define protected-body editing and raw-mode override policies. Detect malformed/nested/unknown pairs without dropping their bodies. Authorized host regeneration is separate from viewing/editing markers; do not execute a provider just because a document was opened. After regeneration, the saved body must render independently without the provider.

Acceptance: template selection substitution, empty-selection caret placement, literal/nonrecursive escaping, unsupported substitution contexts, single-step undo, HTML stencils, existing mention forms, competing prefixes, provider failures, unknown placeholders, marker edits, body protection, regeneration permissions, and independent fallback rendering pass round-trip/browser tests.

### W9. Security, Accessibility, and Release Hardening

Apply a shared explicit HTML/URL policy to import, pasted HTML, rendering, hover cards, templates, image destinations, and Mermaid SVG. Preserve inert unsupported source or reject before replacement; sanitization of disposable output must not erase persisted placeholder comments. Test script-closing text during PHP-to-JavaScript bootstrapping as well as normal DOM XSS cases. No `eval`, inline event-handler generation, or document-supplied executable configuration.

Support CSP nonce/style requirements, subdirectory asset URLs, offline assets, and host-controlled dependency loading. Define limits for documents, images, nesting, regex matching, tables, provider responses, and Mermaid. Errors retain content and expose structured diagnostics rather than failing silently.

Check ARIA, validation states, contrast, focus order/traps/restoration, task controls, menu/dialog keyboard use, touch-only operation, IME, bidirectional text, and mobile keyboards on the agreed browsers. Add explicit locale dictionaries and host label overrides rather than baking English into extension controls.

Measure initialization, typing, large tables/diagrams, serialization, data-image history memory, and repeated disposal on representative documents before establishing performance budgets. This plan makes no unmeasured speed or memory claims. Use the host's required profiling process when optimizing integration code; remove temporary instrumentation before shipping.

Acceptance: security/accessibility gates, documented compatibility limits, measured budgets, source and distribution suites, and clean installation tests pass before the first stable release.

### W10. Integrate Markian in Codiware

Implement the Codiware-owned adapter and pilot described in M2 after M0 package preparation and M1 document inventory. Start once W1-W3 and the pilot's required W4-W8 features are available; pass the applicable W9 gates before changing consumer defaults. Keep the existing editor descriptor and shell contract, visual startup, dirty/load/save semantics, active-view drafts, and Monaco alternative.

Deliver Composer-ready assets, host-owned link/image callbacks, paste-to-file image insertion without binary fallback, relative-resource resolution/navigation, theme/fullscreen integration, and complete tab disposal. Keep standalone Codiware independent of ExFace. Coordinate IDE asset overrides under M4 without moving framework-specific logic into Codiware or Markian.

Acceptance: M2's real tab/load/save/failure/rename/navigation scenarios pass in standalone and embedded deployments. Verify pasted image files and ordinary Markdown URLs after save/reopen, clean state only after successful writes, and recoverable pending work. Update Codiware documentation/configuration and demonstrate backend fallback without losing unsaved drafts or saved assets.

### W11. Integrate Markian in JEasyUIFacade

Implement the facade-owned migration described in M4, using the additive Core `MarkianTrait` and shared widget translation contract from M3. Depend on M0/M1 and the required W1-W9 parity subset, not on completion of the UI5 migration. Deliver the shared trait before either facade opts in; do not rename, redirect, or change `ToastUIEditorTrait`.

Migrate asset injection, editor/value/change wiring, validation, prefill/live references, visual startup, and resizing/disposal in a facade-local opt-in release. Implement runtime read-only/disabled behavior explicitly. Review host-owned display-Markdown rendering separately, including server-rendered paths and M4's separate server security gate, rather than assuming UI5's display-widget implementation applies.

Acceptance: real jEasyUI forms cover get/set, explicit clearing, validation, live references, permission changes, hidden-container sizing, and teardown. Verify supported widget configuration, editable/read-only editor semantics, independent asset loading, and fallback to Toast UI; check separate display widgets for compatibility. Test jEasyUI/Markian alongside UI5/Toast UI, and the reverse combination during rollout. Update facade documentation and add focused PHP coverage where feasible plus owning-app browser/BDT scenarios.

### W12. Integrate Markian in UI5Facade

Implement the UI5-owned migration described in M3 after additive delivery of Core's separate `MarkianTrait`, M0/M1 preparation, and the required W1-W9 parity subset. UI5 opts in independently of JEasyUIFacade; shared configuration translation belongs in the trait while UI5 retains model bindings, asset registration, validation, and overlay lifecycle ownership.

Migrate editor input elements, preserving widget configuration, visual startup, value/change semantics, prefill/live references, and permission behavior. Disabled inputs remain Markian editors with search/copy/navigation available. Separate display-only controls retain a host-owned rendering implementation; do not require Markian viewer instances. Handle rerenders, preserve-area stale DOM, reused dialog IDs, explicit empty values, model echoes, pending drafts, fullscreen restoration, and listener disposal as specified in M3. Update BDT selectors to support documented roots for both backends during rollout.

Acceptance: real UI5 form/dialog/prefill/validation workflows pass, including repeated rerenders, record switches, empty-value restoration, independent instances, and permission changes. Verify UI5/Markian with jEasyUI/Toast UI and unchanged legacy consumers after the additive Core release. Demonstrate facade-local rollback without losing drafts; update UI5 documentation and add focused PHP coverage where feasible plus browser/BDT lifecycle scenarios.

## 6. Existing Toast UI Features and Newly Identified Gaps

The following are features/behaviors found in the current integrations that were missing, insufficiently explicit, or intentionally different in the previous prototype/approach. They are now assigned in this plan. This is the migration parity checklist, not a list of features already implemented in Markian.

| Existing capability or behavior | Evidence/current reality | Gap or decision | Required action and owner |
| --- | --- | --- | --- |
| Horizontal-rule toolbar action | Present in both configured Toast UI toolbars. | Sample Markdown supports rules, but the prototype toolbar has no dedicated action. | Add a mode-aware command/control and history tests: W4. |
| List indent/outdent controls | Exposed by shared and Codiware toolbar definitions. | Basic list conversion is not parity with nesting/unnesting. | Implement buttons/shortcuts and nested-list round trips: W3-W4. |
| Automatic URL detection | Both integrations enable Toast UI's extended autolinks. | Markian automatically detects URLs without an autolink configuration option. | Always detect/test bare URLs, `www`, email, punctuation, code/link exclusions, and safe schemes in editable/read-only editor presentation; no adapter toggle: W3/W9. |
| Configurable softbreak rendering | Trait maps `MarkdownDataType.enable_newlines`; preview/viewer differ from TUI WYSIWYG. | A single default CommonMark policy would change existing display. | Carry the host setting into editor/Preview rendering and verify separate host display widgets; preserve hard breaks and document intentional consistency changes: W3/M3. |
| Character counter based on max length | Shared trait adds a live `length/max` item from the data type. | Prototype only has a word count. | Add a configurable status/counter contract; reconcile Unicode counting with server validation: W4/M3. |
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
| Viewer/disabled-input behavior | Legacy integrations have a separate viewer factory; jEasyUI chooses it initially for disabled input. | Intentional change: Markian is an editor only, including when disabled/read-only. Separate display widgets remain host-owned. | Retain disabled-editor search/copy/navigation; block all user document changes, including task toggles. Verify host display-widget compatibility separately: W1/W3/M3-M4. |
| Image permission flag | `allow_images` defaults false; current trait only partly strips/disables image paths. | Copying the old regex would both miss paths and silently alter content. | Enforce insertion permissions across paste/drop/URL/source; preserve or explicitly reject existing content per policy, never silently strip it: W6/W9/M3. |
| Mention presentation and existing link/empty-link storage | Trait decorates `[@label](url)` and `[@label]()`; getter switches mode to avoid `$$widget` wrappers. | Plain-text-only mentions do not cover existing saved values. | Import old ordinary mention forms; no hidden mode switching/new wrappers; add narrowly recognized legacy repair tooling: W8/M1. |
| Mention suggestion request semantics | Trait sends action/object/resource/element metadata, filters, display attribute, page size, and AJAX headers. | A generic autocomplete without adapter translation would break existing models. | Preserve request semantics inside host callbacks; Markian receives only structured results and ignores stale results: W8/M3. |
| HTML-tag stencils with captions/icons/hints/styles | Trait supports `HtmlTagStencil` insertion and custom inline rendering. | Keeping `<kbd>` as inert text is not feature parity. | Safe explicit HTML mapping and configuration translation, not direct selection DOM surgery: W3/W8/M3. |
| Fullscreen behavior integrated with host overlays | Shared/UI5 code changes size, parents, preview style, and z-index. | Built-in maximize needs an optional host replacement rather than hard-coded framework behavior. | Configure `onFullscreenEnter` with paired restoration for host overlays/iframe bridges; test state/focus restoration, failures, disposal, and multiple instances: W4/M3. |
| Host preview styles, theme, asset URLs/cache busting | Codiware supports preview CSS/class configuration; facades inject assets; IDE overrides URLs. | Global demo styles and hard-coded Core paths cannot replace this contract. | Scoped themes, supported render-root classes, deduplicated configurable assets, cache/version policy: W1-W2/M2-M4. |
| Table editing beyond insertion | Toast UI is exposed with table editing; the prototype only adds rows/columns. | Delete/alignment/menu and Excel workflows are incomplete. | Verify actual required controls on migration fixtures, implement/test GFM-compatible operations and clipboard: W5. |
| Locale and command labels | Shared trait explicitly selects English; hosts provide translated messages. | The library needs configurable labels even if initial default remains English. | Locale dictionaries, safe host overrides, translated provider errors: W9/M2-M4. |
| Teardown and hidden-tab sizing | Codiware disconnects observers/destroys; UI5 registers resize callbacks. | No reusable disposal/resize contract exists in the prototype. | Cancel all owned resources and remeasure without reloading Markdown: W1/M2-M4. |

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

- Preserve `load`, `getContent`, `beforeSave`, `isDirty`, `markClean`, `focus`, `on`, and `destroy`. Maintain `.md`/`.markdown` acceptance, editor selection priority, and Monaco as an alternate text editor.
- Replace the ESM/UMD Toast UI detection/import-map workaround with one deduplicated Markian script/CSS loader and readiness handling. Translate extension settings and support old keys for a documented deprecation interval.
- Start every newly opened Markdown editor in visual mode, not the legacy raw/split mode. Do not use the library's raw-start option or restore a legacy raw-start preference; switching modes in an already open tab remains available without resetting its state.
- Preserve programmatic-load suppression and normalized baseline behavior. Emit the shell's change notification after load only to reevaluate dirty status, not as a user edit. Clean the tab only after successful disk write.
- Capture Ctrl/Cmd+S in visual, raw, Mermaid, and expanded-code views. Await image/pre-save work and save the active document projection; do not require users to press Back first. Keep dirty state and source on write failure.
- Preserve image paste and toolbar file selection as paste-to-file workflows: host-owned code saves the image in an appropriate location and returns a URL for ordinary `![alt](url)` Markdown. Keep collision-safe naming, authorized storage/access, and applicable file-tree notifications. The location, hooks, and internal save/upload flow may change; retaining `addImageBlobHook`, the neighboring `images` convention, or pre-save deduplication/externalization is not required. Do not fall back to binary/data-URI Markdown on failure. Keep pending paste recoverable and prevent save from reporting success until the image is stored or the user explicitly removes the pending paste. Define an explicit compatibility policy for preexisting data images rather than making the old externalization mechanism mandatory.
- Resolve relative images through the existing guarded file route, retaining original Markdown destinations. Open relative Markdown targets in editor tabs with the correct root and fragment; retain query/fragment semantics and encoded filenames. Never allow client path resolution to replace server authorization/path guards.
- Supply repository file/image suggestion and heading-inspection callbacks in Markian configuration. Codiware owns any AJAX through its existing API service and middleware, or can supply local/cached results. Use existing guarded file/search/upload facilities where suitable; any new bounded, authenticated endpoint belongs to Codiware, not Markian.
- Translate theme changes and preview CSS/class settings into supported Markian options, not `.toastui-*` observers. Remove old DOM-rewrite observers only when the replacement resource resolver/render hooks cover their behavior.
- Use built-in maximize where appropriate, or configure `onFullscreenEnter` to integrate with Codiware's panel/iframe layout and return its restoration function. Keep this host logic outside the library.
- Dispose editor/provider/observer resources when closing or switching tabs, and remeasure hidden editors when reactivated. Keep extension IDs stable so saved shell preferences remain useful.

Pilot behind the backend flag. Test opening without edits, switching modes/tabs, saving, save failures, image upload failures, closing dirty tabs, rename/move/base changes, multiple roots, theme changes, and iframe/subdirectory deployment. For image paste, verify the stored file, regular Markdown URL without pasted binary/data URIs, and successful rendering after save/reopen; include pending-save, retry/removal, and deleted-target cases. Record the intentionally changed raw/split-preview UX with reviewers.

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
- Keep `UI5Markdown` and `UI5DisplayMarkdown` as separate host-owned display widgets; choose their rendering implementation within UI5 rather than adding a Markian viewer API. Verify content compatibility and their own permission policies separately. Disabled Markian inputs retain nonmutating editor controls and cannot toggle tasks or change the value.

Gate the change on real form/dialog/prefill/validation workflows, not only isolated JS tests. Verify that each migrated integration starts visually, including models/settings that previously requested raw mode, while users can still switch to raw mode. Add a compatibility scenario with UI5 using `MarkianTrait` and jEasyUI still using `ToastUIEditorTrait`, plus an unchanged legacy consumer after the additive Core release. Verify engine assets, get/set, events, read-only editor behavior, and disposal remain independent; separate host display widgets must continue to work. Update the BDT Markdown node to identify documented Markian roots/content rather than `.toastui-editor-contents`, while supporting both backends during rollout. PHP adapter logic needs focused PHPUnit coverage where feasible under the Core testing rules; UI lifecycles belong in browser/BDT scenarios.

### M4. jEasyUI, IDE-Specific Extensions, and Other Consumers

Migrate jEasyUI asset injection and shared editor/value/validation/live-reference behavior to `MarkianTrait` in its own opt-in change, independently of the UI5 migration. Implement correct runtime read-only/disabled handling instead of retaining its TODO. Review jEasyUI's host-owned display-Markdown path separately; do not assume it shares UI5's display renderer, because Markdown may also be rendered on the server.

Update `axenox.IDE` configuration so Codiware receives Markian asset URLs rather than the jEasyUI Toast UI bundle path. Preserve Core Mermaid reuse and documentation preview presentation, but replace renderer-specific CSS where necessary. Load/register Core's prebuilt `docsPlaceholders` factory and enable it only for selected editors; configure insertion presets, custom documentation links, and authorized host generation in the IDE layer without taking ownership of the DocsFacade grammar. Keep generic repository suggestions in Codiware.

Validate the exact DocsFacade delimiter/options/print metadata and generated body behavior with its server renderer. Add the required jQuery-comments integration through a small lifecycle/value adapter if that host is selected for rich comment editing; the inspected comments feed is not itself evidence of a current Toast UI dependency. Avoid rewriting an unrelated comments backend as part of this migration.

Compare browser output with server-rendered `MarkdownDataType`/DocsFacade output for alerts, softbreaks, front matter, links, HTML, and placeholders. Reuse semantic fixtures without requiring identical HTML trees.

**Separate security gate:** the inspected server converter explicitly allows raw HTML and unsafe links. A safe Markian client does not fix that path. Inventory trusted documentation versus untrusted user comments, define the appropriate server sanitization boundary, and implement/test it with its own compatibility review before claiming end-to-end safe rendering. Do not silently loosen Markian's policy to match this legacy behavior or globally break trusted docs HTML.

### M5. Rollout, Rollback, and Retirement

Roll out in this order: internal Codiware pilot, representative editable/read-only UI5 editors with host display-widget compatibility checks, jEasyUI, IDE documentation extensions, then remaining applications. Advance per consumer only after its parity and security gates pass; advanced requirements W4-W9 must be complete before declaring the full v1 scope delivered.

Keep independent facade/consumer configuration selecting Markian or Toast UI during the migration window, not one mandatory platform-wide switch. Both operate on Markdown, but test that each consumer's newly saved documents remain readable by the fallback. Keep new optional formatting within the agreed fallback subset until retirement. Switching backends is a controlled reopen/remount using the current value, not two engines editing one DOM simultaneously.

Rollback must preserve unsaved drafts first, retain original files/values where conversion occurred, and restore the prior dependency/configuration set. Do not roll back by regex-converting every document. Verify image files referenced by saved Markdown remain accessible after rollback.

Retire Toast UI only after all consumers pass: remove Markdown-editor dependencies, both facade-bundled TUI scripts, old CSS/config keys/module registrations, TUI DOM workarounds, temporary wrappers, and selector fallbacks. Check repository-wide references and the resolved Composer dependency graph. Do not remove the separate TUI image editor or unrelated Mermaid use. Remove the compatibility flag in a later announced release, not in the initial pilot.

Retiring the bundled integrations does not automatically authorize removing Core's public `ToastUIEditorTrait`. Retain and deprecate it until supported external facades have migrated; removal needs an announced compatibility-breaking release under Core's policy. `MarkianTrait` remains the separate implementation throughout, never a forced replacement behind the legacy trait name.

## 8. Requirement Coverage Matrix

| Requirement group | Work packages | Completion evidence |
| --- | --- | --- |
| Vanilla script/CSS include; textarea/div; framework neutrality | W1-W2 | Offline script-tag, multi-instance, form submission/reset, destruction, Composer install fixtures. |
| Normalized portable Markdown; meaningful whitespace; unknown syntax | W0/W3 | Semantic/idempotent corpus, retained source on failed import, GitHub/GitLab comparison. |
| Invisible metadata and independently readable generated bodies | W3/W8 | Exact comment payload checks, unknown-provider/malformed-pair fixtures, independent rendering without extensions. |
| Word-friendly visual editing and Markdown-pro typing | W4 | Caret/selection/shortcuts, inline-code exit, lists, fences, IME and ordinary-user review. |
| MDI, themes, GitHub-like output, programmatic theme switching | W1/W4/W9 | Scoped CSS, two themes in one page, host stylesheet coexistence, icon/contrast review. |
| Configurable pinned/floating/mobile/custom toolbars | W4 | Separate layouts, floating-only preset, dropdowns, overflow and keyboard/touch tests. |
| Formatting, headings, lists/tasks, code, quotes, links/images, colors | W3-W4/W6-W7 | Command/history parity; explicit color portability and image-policy tests. |
| Raw mode, separate view toolbars/sidebars, history/events | W1/W3-W4/W7 | Active-value/draft events, no-op mode transitions, failed imports, conflict tests. |
| Small embedded editors, maximize/restore, mobile support | W1/W4/W9 | Compact host, default/custom fullscreen callback lifecycle, overlay/iframe tests, keyboard/viewport restoration, real devices. |
| Tables, add/remove rows/columns, Excel paste | W5 | Table command/navigation suite and HTML/TSV clipboard fixtures. |
| Pasted images and image-URL autocomplete | W6/M2 | Standalone bounded raster data URIs; Codiware paste-to-file callback with regular Markdown URLs and no pasted binary, pending/failure tests, alt text, and repository suggestions. |
| Relative/absolute links, heading targets, URL validation | W3/W6 | Slugs/base preservation, inspector cancellation, Ctrl/Cmd/mobile opening, safe schemes. |
| Mermaid render/edit/pan/zoom; configurable renderer | W7 | Host-injected renderer, no global scans, SVG policy, Back commit, touch controls. |
| Code language, Tab width, line numbers, expanded editing | W7 | Optional prebuilt language assets, offline selected-feature loading, local history, Tab escape, source-preserving expansion. |
| HTML templates, `<kbd>`, configurable stencils/custom links | W3-W4/W8 | Portable HTML exports, parameter validation, host label/icon translation. |
| Mentions, multiple prefixes, suggestions/click/hover | W8-W9 | Plain/link export, existing empty-link mentions, accessible providers and context exclusions. |
| Generated placeholders, marker editor, insertion menu | W8/M4 | Real DocsFacade grammar, body policy, no automatic provider execution, re-import. |
| TOC except heading on first line; desktop/mobile access | W3/W7 | Shared anchors, parsed outline, collapse/drawer and raw-scroller navigation. |
| Security including HTML/JS/SVG, callbacks and providers | W9/M4 | Malicious corpus, CSP, bounded work, separate server-rendering security gate. |
| Callback-only data integration; no library AJAX | W1/W6/W8/M2-M3 | Direct config functions, local/synchronous and promise results, exceptions/rejections, cancellation/stale-result handling, and no hidden data requests. |
| Power UI widgets, Codiware, IDE and comments integration | W10-W12/M0-M5 | Adapter contracts and real host scenarios, parity table signed off per consumer. |
| Additive Core `MarkianTrait`; independent facade migration | W11-W12/M0/M3-M5 | Legacy trait unchanged, facade-local opt-in, mixed Markian/Toast UI scenario, and no automatic backend change on Core upgrade. |
| Committed dist, asset delivery, Composer, commit builds | W2 | Tracked deterministic artifacts, required CI, package/archive/install tests. |

## 9. Test and Release Gates

Use existing Playwright tests as regression coverage, but split pure transformations/policies into focused unit tests as the library boundaries emerge. Test public behavior instead of depending on private editor DOM except where an engine-specific adapter test needs it. Run integration scenarios in their owning repositories.

| Gate | Required checks |
| --- | --- |
| Every implementation change | Relevant unit/browser slice first; no unrelated refactor until the slice passes. |
| Library build/PR | Type/API checks, unit suite, source browser suite, packaged classic-script smoke suite, deterministic artifact parity including new files, licenses and package metadata. |
| Packaging | `npm pack` archive install, Composer validation/install, all declared core/extension assets included, no consumer build scripts, no Node on runtime host, correct stable URLs; published Asset Packagist install verification. |
| Modular loading | Core-only comment fixture loads no Mermaid/programming-language highlighting assets, including with matching fences present. Enabled extensions use declared local/configured assets; test offline operation, CSP, loading failures/retry, supplied dependencies, version conflicts, deduplication, and instance-local state/cleanup. |
| External Core extension | A Core-free Markian installation remains usable. Core supplies prebuilt `docsPlaceholders` assets; routed/local URLs, registration order, supported versions, independent enabled/disabled instances, and missing-asset errors are verified. Preserve exact comments/bodies without the extension; no document-driven Core loading or provider execution. |
| Content compatibility | Import/edit/export/re-import and independent rendering for the fixture corpus, malformed and unknown metadata, intentional portability limits. |
| Callback boundary | Local/synchronous and asynchronous fake callbacks for suggestions, inspection, images, mention details, and regeneration; exceptions, rejection, abort, and late results. With supplied assets and local data, fail unexpected data requests and verify no built-in endpoint/transport dependency. |
| Security | HTML/URL/SVG/clipboard/provider fixtures, PHP inline-script escaping, limits, CSP, lifecycle cancellation, server-output boundary tests. |
| Accessibility/devices | Keyboard/screen reader, touch and mobile keyboards, IME, bidi, focus/overlay restoration, theme contrast. |
| Host migration | Save/load/dirty/prefill/reset/live reference, dialog rerender, disabled/read-only, validation, image policy, relative navigation, iframe and multi-instance scenarios. |
| Facade coexistence | Additive Core trait release leaves legacy consumers working; UI5/Markian and jEasyUI/Toast UI coexist with independent assets, values, events, and rollback selection. |
| Performance | Measured startup/interaction/memory on agreed representative fixtures; documented budgets and no temporary instrumentation in shipping files. |
| Stable release | All required work packages complete, parity decisions signed off, release notes and migration guide, matching npm/Composer/tag/manifest version, verified committed artifacts, rollback rehearsal. |

Do not treat a successful build or 36 prototype tests as completion of these gates. No broad production data conversion, removal of fallback dependencies, or stable release happens merely because the demo renders correctly.

## 10. Delivery Order and Open Decisions

Recommended dependency order:

1. W0 contracts/corpus, then W1 extraction and W2 distribution together.
2. W3 content/rendering/security foundations, then core W4 controls.
3. W5-W8 advanced features in small tested increments; start M0/M1 and the opt-in W10/M2 Codiware pilot once its required subset is ready.
4. W9 hardening runs throughout, with its final gate before stable release.
5. Deliver the additive M3 Core trait, then W12/M3 UI5 and W11/M4 jEasyUI when each parity subset is complete, following M5's recommended rollout order without coupling facade releases. Work-package numbering does not impose a dependency between the facades. Complete the remaining M4 consumers; M5 retirement follows real deployment validation.

Confirm these before finalizing v1 estimates:

- Publishing access for npm `markian` and Composer `axenox/markian`, repository publication permissions, and branch-protection ownership.
- Browser/device minimums, supported Mermaid versions, baseline code languages, locale scope, and document/image/diagram limits.
- Softbreak defaults per host, color/alert portability presets, allowed HTML, host display-widget task policies, and server sanitization ownership; Markian's disabled/read-only mode always blocks task toggles.
- Exact placeholder grammar/options in current documentation, generated-region editing policy, and legacy TUI-wrapper incidence.
- Accepted Codiware change from document-wide split preview to visual/raw mode switching, with Monaco as the source-editing alternative.
- Expected fullscreen boundary inside iframes and whether a parent bridge is required.
- Whether every intermediate commit must be build-certified or squash-merge certification is sufficient; local hook bypasses cannot be prevented absolutely.

These are bounded decisions for implementation and rollout. They do not reopen the approved visual direction or permit silent loss of existing content.