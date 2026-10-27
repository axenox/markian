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
- Apply the same effective policy to import, paste, templates, raw-mode transitions, and viewer rendering. A template cannot grant permission to use an element excluded by the allowlist.
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

## Render Extensions and Generated Regions

Supply trusted extensions through `extensions` and a supported Mermaid renderer through `mermaid: { instance: hostMermaid }`, as illustrated in the plan. These are supplied JavaScript objects, never executable configuration extracted from Markdown. Extension interfaces and supported Mermaid versions remain to be finalized.

Use render extensions for genuinely new block behavior, not simply to inject unsanitized HTML. Built-in and third-party extensions should use the same public contract rather than requiring access to Milkdown or CodeMirror internals.

Generated regions use invisible comment delimiters with readable Markdown bodies. Preserve unregistered markers and existing bodies. Loading or rendering a document must not regenerate it or execute a provider automatically. An explicit authorized regeneration action may call `onPlaceholderRegenerate`; stale results must not replace newer edits.

Mermaid stays a standard fenced code block. Hosts may reuse their existing renderer without Markian reconfiguring unrelated diagrams. Missing/incompatible renderers should produce recoverable preview errors, not prevent ordinary editing.

## Appearance and Embedding

Customize through the scoped token, typography, and supported styling hooks described in the style guide. The current prototype has page-wide CSS; instance-scoped library styling and stable public hooks are extraction work, not an existing theming API to assume. Avoid engine-private selectors as integration contracts.

The proposed instance API supports themes, read-only/disabled states, active-view commands, resizing, and teardown. Use `createViewer` for display-only content rather than mounting an editable document merely to hide its toolbar. Restore host resources on destruction and reject asynchronous work after permission or document changes.

Visual startup is the default and is required by current Power UI/Codiware migrations. Standalone callers may opt into `initialMode: 'raw'`. Raw mode remains available through explicit user switching; a whole-document split preview is not the default editing model.

## Suggested Use-Case Combinations

| Use case | Combine |
| --- | --- |
| Technical documentation | Templates, safe keyboard stencils, relative link suggestions/heading inspection, Mermaid, and optional explicit generated-region refresh. |
| Ticket or review notes | A compact toolbar, ticket mention rules, host navigation, and authorized contextual details. |
| Browser file editor | Visual startup, file-backed image insertion, document-relative URLs, host save/dirty-state handling, and optional layout integration. |
| Embedded business form | Host model binding, permissions, validation, scoped theme, resize/lifecycle handling, and active-draft form values. |
| Display-only article | Shared Markdown rendering, safe links/images, theme, and permitted render extensions without an editing engine. |

These combinations do not change Markdown into a proprietary format or move host I/O into Markian. Core and facade adapters remain separately deployable; introducing a Markian integration must not incidentally change legacy Toast UI integrations.

## Verify a Customization

Check serialized Markdown and reopen it, not just the rendered appearance. Exercise each declared mode, undo/redo, selection preservation, permissions, and error states. For asynchronous callbacks, cover obsolete queries, document switches, failed operations, permission changes, and destruction. Check multiple instances do not share state or styles.

Reuse the existing browser tests and package scripts described in the architecture. For UI additions, verify the style guide's light/dark and desktop/mobile states. As the planned APIs become implemented, replace pseudocode sketches with typed, executable examples and add focused contract tests.