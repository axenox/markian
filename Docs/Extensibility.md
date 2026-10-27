# Customizing Markian

## Status and Principles

Markian is intended to adapt to different writing workflows without changing its Markdown storage format or depending on a particular host framework. Prefer configuration, then a host callback, then a reusable extension. Change the editing foundations only when those boundaries cannot meet an agreed requirement.

The repository currently contains an interaction prototype. The options and initialization examples in this guide describe the proposed library contract in the [implementation plan](Requirements/Plan.md), not current prototype exports. Callback bodies marked as pseudocode must be supplied by the host. W0/W1 will finalize types, result shapes, and executable examples before these become supported public API documentation.

Use the [architecture](Architectur.md) for ownership and security boundaries and the [style guide](Styleguide.md) for shared appearance and interaction patterns. Update this guide alongside changes to customization contracts or examples; keep planned capabilities clearly distinguished from implemented behavior.

## Choose the Smallest Customization

| Need | Customization boundary | Example use case |
| --- | --- | --- |
| Fewer or differently grouped tools | Independent pinned/floating toolbar layouts referencing command IDs. | A compact comments field versus a technical documentation editor. |
| A workflow-specific action | A registered command with supported modes and `onExecute`. | Insert a date or a standard review section. |
| Repeated content | Markdown templates or allowed HTML selection stencils. | Test cases, meeting notes, and keyboard key notation. |
| Mentions | Mention rules with local suggestion, details, and click handlers. | Ticket numbers or customer references stored as text. |
| Application destinations and assets | Link/image callbacks with structured results. | Suggest documentation files or save pasted images beside a document. |
| Embedded diagrams | Explicitly supplied Mermaid instance/adapter or configured loader. | Reuse the host's supported renderer rather than load another copy. |
| Generated content or a special block | A trusted render/placeholder extension. | Documentation sections refreshed by an explicit host action. |
| Host layout integration | Fullscreen entry callback returning restoration logic. | Maximize within a panel, dialog, or iframe layout. |
| Brand or density changes | Scoped styling and documented theme properties. | Match a host application's typography and light/dark surfaces. |

Toolbar configuration controls discoverability, not authorization. Hiding a command does not prevent keyboard, paste, source, or programmatic edits. Use the instance's permission contract and enforce authorization in host services.

## Toolbars and Custom Commands

Pinned and floating toolbars are configured independently. Reference the same command IDs across surfaces instead of implementing separate behavior for each button. A custom command must preserve the active view's selection, respect read-only/disabled state, and participate in its history. Do not manipulate the DOM or a hidden editor to insert content.

Proposed configuration sketch; `onExecute` is pseudocode:

```javascript
const options = {
  toolbar: {
    pinned: ['bold', 'italic', 'insertDate', 'templates'],
    floating: ['bold', 'italic'],
  },
  commands: [{
    id: 'insertDate',
    label: 'Insert date',
    icon: 'calendar',
    modes: ['visual', 'raw'],
    onExecute: ({ instance, selection }) => { /* insert date through active-view commands */ },
  }],
};
```

Icon names resolve through the supported icon registry. Declare only the modes the command actually supports; unsupported commands must not silently operate on another view. Exact command insertion helpers remain to be finalized rather than invented by individual integrations.

## Templates and Safe HTML Stencils

Use templates when the result is ordinary document content, not a new editing behavior. Every template uses a `markdown` string. Include `{{selection}}` where the selected text should appear; for example, `<kbd>{{selection}}</kbd>` wraps it in an allowed HTML element without a separate wrapping object.

Substitute selected text literally, escaping it for the supported Markdown or HTML text context rather than treating it as executable template content or raw HTML. Without a selection, substitute an empty string and place the caret at the placeholder position. A template without the placeholder inserts its fixed body, replacing the current selection when present. Apply insertion as one undoable command in the active view. Only `{{selection}}` is defined here: do not evaluate expressions or recursively expand placeholders in selected text. Reject placeholder locations outside supported text contexts, such as HTML attributes or link destinations, rather than interpolating them unsafely. Allowed-HTML and sanitization policies still apply to the template itself.

Proposed options for test documentation:

```javascript
const options = {
  toolbar: { pinned: ['templates', 'template:kbd'] },
  templates: [
    {
      id: 'testCase',
      label: 'Test case',
      icon: 'clipboard-check',
      markdown: '## Test case\n\n### Steps\n\n1. \n\n### Expected result\n\n',
    },
    {
      id: 'kbd',
      label: 'Keyboard key',
      icon: 'keyboard',
      markdown: '<kbd>{{selection}}</kbd>',
    },
  ],
};
```

The `templates` command opens the template menu; `template:<id>` exposes an individual template. HTML support depends on the allowed-element policy and the destination renderer. Do not promise styling or HTML support that other Markdown renderers do not provide.

## Allowed HTML Tags

Control permitted raw HTML explicitly through `htmlTagsAllowed`, independently of templates. Configure an object whose keys are allowed HTML tag names and whose values are plain-text descriptions used as tooltips for the corresponding toolbar menu items. The object defines which supported HTML elements a document may use; templates only make content insertion convenient. This remains a proposed library option, not implemented prototype behavior.

```javascript
const options = {
  htmlTagsAllowed: {
    kbd: 'Keyboard input or key name',
    sub: 'Subscript text',
    sup: 'Superscript text',
  },
  toolbar: { pinned: ['bold', 'italic', 'htmlTags'] },
};
```

The proposed `htmlTags` toolbar command opens a menu showing supported, allowed elements so users can discover the available markup. Each item's tooltip uses its configured description; make that description available to keyboard and touch users too, and never interpret it as HTML. Simple text-wrapping elements use the same safe selection-insertion logic as templates. Prefer this separate menu over automatically adding entries to the user's template collection. More complex elements need a supported insertion workflow rather than assuming every HTML tag can wrap text. Hiding or omitting the menu must not change the content policy.

Apply these boundaries consistently:

- The object's keys control raw HTML, not HTML generated from ordinary Markdown; descriptions are presentation metadata only. An explicit `htmlTagsAllowed: {}` permits no raw HTML elements but does not disable Markdown headings, links, or other native syntax. The omitted-option default must be documented when the API is finalized.
- Allowing an element does not allow arbitrary attributes, styles, or URLs. A separate sanitization policy still applies. Reject unsafe or unsupported tag names with configuration errors rather than treating the allowlist as permission to execute arbitrary HTML.
- Apply the same effective policy to import, paste, templates, raw-mode transitions, and editor Preview rendering. A template cannot grant permission to use an element excluded by the allowlist.
- Disallowed existing content must not silently disappear from saved Markdown. Preserve it as inert source where supported, or report the incompatibility before replacing the value or leaving raw mode. Sanitized display output is not the saved document.
- Hidden extension comments remain a separate preservation mechanism, not entries in the element allowlist. Their delimiters and payloads must survive without executing providers.

Allowed HTML still has portability limits: other Markdown renderers may omit or style it differently. The menu exposes Markian's effective capabilities, not a guarantee of identical rendering elsewhere.

## Mentions and hash-tags

Mentions add contextual behavior to ordinary text, including references such as `@Name` and hash-tags such as `#32132`. Configure mention rules through the `tags` option. Keep handlers on the rule so different mention types do not require one global type-switching callback.

Proposed ticket-note configuration; handler bodies are pseudocode:

```javascript
const options = {
  tags: [{
    id: 'ticket',
    prefix: '#',
    pattern: '#[0-9]+',
    storage: 'text',
    onClick: ({ value }) => { /* open ticket in the host */ },
    onHover: ({ value }) => { /* return authorized title and status */ },
    onSuggest: ({ query }) => { /* return matching tickets */ },
  }],
};
```

The saved value remains text such as `#32132`, not an embedded application object. Details must also be available through keyboard focus and touch, not hover alone. Hosts must not expose private details just because a document contains a matching reference.

## Host Callbacks

General callbacks are top-level `on<Subject><Action>` options. Subject-first names sort related handlers together; do not add a nested `callbacks` object.

| Option | Host responsibility |
| --- | --- |
| `onFullscreenEnter` | Expand the host layout and return an idempotent restore function, directly or through a promise. |
| `onImageInsert` | Accept an image blob and return its saved Markdown destination/alternative text. |
| `onImageSuggest` | Return image destination suggestions. |
| `onLinkInspect` | Return existence/unknown status and actual heading IDs/labels for a destination. |
| `onLinkOpen` | Navigate using the host application. |
| `onLinkSuggest` | Return link destination suggestions. |
| `onPlaceholderRegenerate` | Return an authorized generated body after an explicit user action. |

Callbacks may use local data, caches, workers, or the host's existing network service. Markian implements no request transport, upload client, endpoint configuration, credentials, or storage. A local documentation index needs no network access:

```javascript
const options = {
  onLinkSuggest: ({ query }) => [
    { label: 'Guide', url: 'guide.md' },
    { label: 'Reference', url: 'reference.md' },
  ].filter(link => link.label.toLowerCase().includes(query.toLowerCase())),
};
```

Callback contexts carry relevant values, instance/document revision information, and an abort signal as specified by the finalized contract. Return structured data, synchronously or through a promise. Handle authorization and transport errors in the host service; Markian presents actionable states and rejects obsolete results. Forward the signal to cancellable host operations when possible, but correctness must not depend on cancellation succeeding.

Keep relative destinations relative in saved Markdown. The host supplies document-base context for resolution and navigation. An unavailable link inspection is unknown, not proof of a broken link. Do not build an unrestricted server-side URL fetcher to provide inspection.

### File-Based Images

Standalone behavior permits bounded raster data URIs. A file editor should supply `onImageInsert` to save the image and return `{ url, alt }`, producing ordinary `![alt](url)` Markdown. The callback owns folder choice, naming, conflict handling, and persistence.

For Codiware, file-backed insertion is the required integration outcome, not an optional binary fallback. Keep temporary previews outside persisted Markdown, wait for file creation before reporting a successful save, and provide retry/removal on failure. Reopening the saved document must resolve the actual file.

### Host-Owned Fullscreen

Without `onFullscreenEnter`, use built-in maximize/restore in the current document viewport. Supply the callback only when the host needs panel reparenting, custom overlays, stacking, or a parent-frame bridge.

The callback returns the paired restore operation, not merely a notification. Markian controls command state, duplicate entry, Escape, measurement, and cleanup. The host must undo partial layout changes on failure. Exit/destruction invokes restoration once, and an obsolete entry resolving late is restored immediately.

## Extensions

An extension is reusable, configurable code that uses Markian’s public API. Host application code could perform the same operations directly, but extensions allow to bundle it nicely and make it plug-and-play.

Each discussed extension has its own implementation work package, separate from shared editor foundations and host adoption:

| Extension | Owner | Work package |
| --- | --- | --- |
| Mermaid | Markian | [W13: Mermaid extension](Requirements/Plan.md#w13-deliver-the-mermaid-extension) |
| Code | Markian | [W14: Code extension](Requirements/Plan.md#w14-deliver-the-code-extension) |
| `docsPlaceholders` | ExFace/Power UI Core | [W15: Core's DocsPlaceholders extension](Requirements/Plan.md#w15-deliver-cores-docsplaceholders-extension) |

Separate extension code registration from per-editor configuration. Register a trusted factory once under an ID with `Markian.registerExtension(id, factory)`, then enable and configure that ID in each editor's `extensions` object. These are proposed APIs, not current prototype exports.

Proposed initialization sketch; the host loads the extension files first, and the callback body is pseudocode:

```javascript
Markian.registerExtension('mermaid', mermaidExtension);
Markian.registerExtension('docsPlaceholders', docsPlaceholderExtension);

const editor = Markian.create(document.querySelector('#notes'), {
  markdown: initialMarkdown,
  extensions: {
    mermaid: {
      enabled: true,
      config: { renderer: hostMermaid },
    },
    docsPlaceholders: {
      enabled: true,
      config: {},
    },
  },
  onPlaceholderRegenerate: ({ value, signal }) => { /* return an authorized generated body */ },
});

await editor.ready;
```

Registration associates an ID with code; it does not activate the extension, load optional dependencies, or create shared editor state. Each enabled factory creates an independent extension instance. Keep the existing general host callbacks top-level; extension-specific settings belong in that extension's `config` object.

Load/register extension code explicitly before creating an editor. Do not put a `source` URL or callback in the instance's extension entry. Optional dependency loading, such as loading Mermaid instead of supplying `config.renderer`, belongs to the extension's documented configuration. It must remain explicit and respect host asset/CSP policy; exact loader options remain to be finalized.

### Modular Assets and Loading

The planned distribution contains a prebuilt core plus optional prebuilt extension/dependency assets, not one mandatory all-features bundle. A comment editor can load the core script and stylesheet without Mermaid or programming-language syntax highlighting. Consumers still need no npm, Node.js, bundler, or compilation: Composer/npm packages and repository releases supply the ready-to-use files.

Hosts explicitly load/register the extension factories they need. Only enabled extensions may request their declared optional dependencies; they may defer those requests until the feature is first used. A host-supplied renderer or preloaded dependency avoids another request. A Mermaid/code fence in the document must not itself enable an extension or trigger optional downloads. Preserve ordinary fenced source and safe plain-code presentation when the extension is absent.

Separate the raw editor foundation from optional programming-language highlighting and expanded-code features. Sharing an existing CodeMirror runtime is appropriate; a comment editor must not download all language parsers merely because raw Markdown editing is available.

Extension `getScripts()`/`getStyles()` declarations identify prebuilt assets under the extension's documented dependency contract. Resolve them through host-controlled paths and an explicit base URL/manifest, not implicit CDN URLs or opaque bundler chunk discovery. Deduplicate compatible script/CSS/dependency loading across instances, validate versions, and report loading failures without discarding Markdown or disabling unrelated editing. Shared assets are not shared extension instances; destroying one editor must not unload a dependency still used by another.

Keep optional files, declarations, dependency metadata, hashes, and notices in the owning package's committed/published distribution. Markian ships its core and first-party extensions; external extensions can be supplied by another package without being copied into Markian's `dist` or becoming a mandatory Markian dependency. Offline hosts can preload or serve every selected asset locally; CSP requirements and script ordering must be documented. This replaces the earlier single-bundle promise, not the no-consumer-build promise. Test both a core-only comment editor with no optional requests and enabled extensions with loading failures, retries, and independent multi-instance state.

Extensions can add (or modify?)
- toolbar items. 
- views
- markdown renderers
- onCallback handlers
- tags
- possibly other things? 

In a specific instance, select extensions by their registered IDs:

```javascript
const options = {
  extensions: {
    mermaid: { enabled: false },
  },
};
```

- An omitted entry or `enabled: false` contributes no UI/renderers, invokes no factory initialization, and loads no optional dependencies for that instance. Previously registered code may still be available to other instances.
- Set `enabled: true` explicitly to activate an extension. An enabled unknown ID is a configuration error, not a silently ignored feature.
- Configuration is instance-local. Disabling Mermaid for one editor does not unregister it globally or disable it in another editor.
- Registration and these initialization options do not imply a runtime enable/disable API; changing active extensions after creation needs a separately defined lifecycle contract.

### One Public API for Applications and Extensions

Extensions package ordinary public-API calls into reusable features. Host applications, built-in extensions, and third-party extensions use the same public instance API. There must not be a second, competing customization API or a privileged set of methods available only to extensions. For example, an extension can call `markian.getToolbar().insert(...)` just as a host application can; it does not rewrite the editor's configuration to add a button.

This boundary is public API versus private internals, not imperative calls versus declarative configuration. Public methods can support commands, toolbar groups, views, renderers, mentions, and help without granting access to private engine state or requiring an extension-only registration mechanism.

An extension-added view owns main-work-area presentation and its toolbar actions, not a separate editor value. The editor retains the complete Markdown document; editing sessions modify that document or a target such as one code block. A view may use such a session or modify nothing, as Help does. Switching to Help preserves the suspended session's draft, selection, and history, while `get()` still includes its pending edits in the complete document. Back restores that presentation without committing; leaving the block editor through its own Back action applies the block update. Use dedicated views for substantial tasks rather than large dialogs, expose only actions supported by the visible task, and follow the [shared view conventions](Styleguide.md#views). These rules apply equally to host-created and extension-created views.

Conceptual extension initialization, assuming its command has already been registered through the public API; exact method signatures remain to be finalized:

```javascript
const extension = {
  init(markian) {
    const toolbarItem = markian.getToolbar().insert({
      id: 'mermaid.insert',
      command: 'mermaid.insert',
      before: 'fullscreen',
    });

    return () => toolbarItem.remove();
  },
};
```

Apply the following rules equally to applications and extensions:

- Public customization methods change live instance state, not the original user configuration. Extensions must not overwrite configured options or callbacks; host configuration retains precedence.
- Use stable, preferably extension-prefixed IDs and explicit positioning such as `before`/`after`. Reject duplicate IDs and invalid positioning targets with actionable errors rather than silently replacing items or depending on accidental initialization order. Replacement of an existing item or exclusive handler requires an explicit public operation and host authorization, not a side effect of extension initialization.
- Multiple notification listeners may subscribe and unsubscribe independently. Adding a listener must not replace the host callback or another listener. Exclusive handlers must not use implicit last-writer-wins behavior.
- Additions need removal handles or equivalent cleanup for controls, commands, views, renderers, and listeners. An extension's initialization returns its disposer; Markian invokes it on destruction and rolls back completed additions if initialization fails. Cleanup removes only that extension's owned additions, is idempotent, and does not restore stale configuration over newer host changes.
- Public methods enforce permission, active-view, and lifecycle rules regardless of caller. Extensions do not bypass read-only/disabled state, mutate a hidden document, or attach work to a destroyed instance.

Extensions allow complex functionality to be added with a single file or function, while keeping the underlying customization operations usable directly by applications.

Extensions must implement a predefined interface/contract. That contract remains stable over time. It may get new methods but older extensions should still work until the next major Markian version. 

W0/W1 must define construction-time versus live contributions within this same public API. Resolve enabled factories and required construction assets, collect and validate schema/parser/serializer mappings, then construct engines and import initial content before readiness. Reject structural registration after that boundary; do not silently rebuild the editor. Live commands, controls, views, and renderers follow their documented lifecycle. Define how initialization awaits asynchronous contributions, rolls back failures, and handles destruction before completion; optional language loading may remain deferred. The interface list below is provisional and does not yet specify these signatures.

- `init(markian)` - called for an enabled instance; uses the ordinary public instance API and returns a cleanup function for its owned additions.
- `getHelp()` 
- `getHelpForHotkeys()`
- Methods to get addition includes:
	- `getStyles()`
	- `getScripts()`

### Mermaid extension

The Mermaid editor is a first-party optional extension delivered as a separate prebuilt JS file, not part of mandatory core loading. Register and enable it only when Mermaid support is required. Supply a compatible host renderer or explicitly configure dependency loading; no Mermaid renderer is fetched merely because a document contains a Mermaid fence. Missing/failed rendering keeps the fenced source editable.

The extension adds the mermaid view and a renderer for mermaid codeblocks. It also adds an insert-diagram button to the main toolbar, that will add a mermaid code block with a very simple example flow chart. 

The mermaid view has a separate toolbar:

- back button
- undo/redo
- indent +/-
- in future more buttons shall offer mermaid snippets

### Code extension

Use a minimal slice of this extension as W1's first public-API proof-of-concept, then extend that same implementation in W14. One ordinary code fence, a target-aware toolbar command, a renderer, and an expanded CodeMirror view with undo/redo and Back are enough for the initial slice. Test draft projection, one-step commit, permissions, independent instances, asynchronous initialization rollback, and teardown without Mermaid or host services. This proves commands/renderers/views, not new-schema registration: code fences already exist in core, so a focused construction-time schema/parser/serializer test remains necessary. Templates and mentions stay core features using the shared public customization operations.

This extension adds code highlighting and a separate code editor view. It also adds a toolbar button, that becomes enabled if the carret is inside a code block. The button opens this code block in the code editor view. 

The code editor view has a different toolbars:
- back button
- undo/redo
- language dropdown
- indent +/-

The code extension reuses the CodeMirror foundation and supplies optional programming-language highlighting and expanded-code editing. Its prebuilt language/highlighting assets load only when the extension is enabled and the relevant support is needed, or are supplied by the host. Do not bundle the entire language collection into the core raw Markdown editor. When highlighting is unavailable, preserve editable code and report any requested-feature failure without changing the saved source.

### Placeholders extension

The planned `docsPlaceholders` extension is owned and supplied by the ExFace/Power UI Core app, which owns DocsFacade and its placeholder grammar. It is not part of Markian's core script or first-party extension distribution. Core must publish ready-to-use browser assets with dependency/version metadata and applicable notices; installing Core or using the extension must not require a consumer build. Exact Core asset paths and supported Markian versions remain to be finalized.

The host loads Markian first, then Core's extension asset, and registers its supplied factory as `Markian.registerExtension('docsPlaceholders', docsPlaceholderExtension)` before creating an editor with `extensions.docsPlaceholders.enabled: true`. That factory name is illustrative, not a current Core export. Resolve Core's assets through host-controlled URLs/base paths, not a sibling filesystem import compiled into Markian. Markian's package/manifest does not need to contain or require those external files; the host composes the packages' asset/dependency metadata and serves the selected files, including offline.

Core supplying the code does not automatically activate it in every editor. Registration alone adds no editor state or optional dependency loading; absent/disabled instances make no extension-driven requests. Keep Core/DocsFacade endpoints and authorization in host callbacks, and use only Markian's ordinary public API for UI/rendering changes. The IDE integration may load/configure the Core extension and add IDE-specific presets, links, or regeneration callbacks, but does not own or duplicate the DocsFacade grammar.

The extension adds placeholder toolbar buttons. A dedicated boundary/marker editing view remains an optional design consideration, not an implemented feature. Without the extension, Markian still preserves unknown paired comments and the readable generated body; merely opening a document never loads Core or runs a placeholder provider.

Verify a Core-free Markian install, a Core-hosted opt-in instance, and a disabled instance alongside it. Cover routed/subdirectory asset URLs, unavailable/incompatible extension assets, deduplicated loading with independent state, and exact DocsFacade comment/body round trips. Missing extension code must leave ordinary editing/content intact; requesting an enabled but unregistered ID remains an explicit configuration error.

## Render Extensions and Generated Regions

Register trusted extension factories by ID, then activate them through the keyed `extensions` configuration above. Supply a supported Mermaid renderer through `extensions.mermaid.config.renderer`, not a separate top-level `mermaid` option. Factories and renderers are trusted JavaScript objects, never executable configuration extracted from Markdown. Detailed extension interfaces and supported Mermaid versions remain to be finalized.

Use render extensions for genuinely new block behavior, not simply to inject unsanitized HTML. Built-in and third-party extensions should use the same public contract rather than requiring access to Milkdown or CodeMirror internals.

Generated regions use invisible comment delimiters with readable Markdown bodies. Preserve unregistered markers and existing bodies. Loading or rendering a document must not regenerate it or execute a provider automatically. An explicit authorized regeneration action may call `onPlaceholderRegenerate`; stale results must not replace newer edits.

Mermaid stays a standard fenced code block. Hosts may reuse their existing renderer without Markian reconfiguring unrelated diagrams. Missing/incompatible renderers should produce recoverable preview errors, not prevent ordinary editing.

## Appearance and Embedding

Customize through the scoped token, typography, and supported styling hooks described in the style guide. The current prototype has page-wide CSS; instance-scoped library styling and stable public hooks are extraction work, not an existing theming API to assume. Avoid engine-private selectors as integration contracts.

Markian's editor API supports themes, disabled/read-only editing, active-view commands, resizing, and teardown. A separate lightweight viewer is planned in [W16](Requirements/Plan.md#w16-deliver-the-lightweight-viewer) after Codiware integration, using shared rendering code separated from editor dependencies from the start. Its smaller lifecycle API and standalone JS/CSS are future deliverables, not current exports. Display-only Power UI widgets remain host-owned adapters that can use this viewer; disabled inputs remain editors.

Do not assume editing extensions can initialize on the viewer. Shared safe rendering policies and explicit render-only Mermaid/highlighting capabilities must not pull in editor sessions, controls, or engines. The viewer displays generated bodies without Core's marker-editing extension or provider execution; exact rendering-only registration contracts belong to W16.

Disabling editing preserves search without replacement, selection, copying text or complete Markdown, safe navigation, Help, fullscreen, and diagram pan/zoom. It blocks document-changing actions, including keyboard/extension commands, typing/paste/drop, raw/code edits, undo/redo, replace, task toggles, image insertion, and regeneration. A read-only editor is not an inert or unfocusable control. Preserve the complete value, drafts, and history through permission changes; trusted host value updates still use the explicit replacement policy. Restore host resources on destruction and reject stale or newly unauthorized asynchronous changes.

Visual startup is the default and is required by current Power UI/Codiware migrations. Standalone callers may opt into `initialMode: 'raw'`. Raw mode remains available through explicit user switching; a whole-document split preview is not the default editing model.

## Suggested Use-Case Combinations

| Use case | Combine |
| --- | --- |
| Technical documentation | Templates, safe keyboard stencils, relative link suggestions/heading inspection, Mermaid, and optional explicit generated-region refresh. |
| Ticket or review notes | A compact toolbar, ticket mention rules, host navigation, and authorized contextual details. |
| Browser file editor | Visual startup, file-backed image insertion, document-relative URLs, host save/dirty-state handling, and optional layout integration. |
| Embedded business form | Host model binding, permissions, validation, scoped theme, resize/lifecycle handling, and active-draft form values. |
| Disabled/read-only document | The same editor with mutation disabled, retaining search, Markdown copying, navigation, and supported preview controls. |

These combinations do not change Markdown into a proprietary format or move host I/O into Markian. Core and facade adapters remain separately deployable; introducing a Markian integration must not incidentally change legacy Toast UI integrations.

## Verify a Customization

Check serialized Markdown and reopen it, not just the rendered appearance. Exercise each declared mode, undo/redo, selection preservation, permissions, and error states. For asynchronous callbacks, cover obsolete queries, document switches, failed operations, permission changes, and destruction. Check multiple instances do not share state or styles.

Reuse the existing browser tests and package scripts described in the architecture. For UI additions, verify the style guide's light/dark and desktop/mobile states. As the planned APIs become implemented, replace pseudocode sketches with typed, executable examples and add focused contract tests.