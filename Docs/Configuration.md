# Configuration

This reference covers every public editor/viewer option and every configuration option
of the bundled Code, Mermaid, and viewer-Mermaid adapters. It describes Markian itself, not
host-specific defaults such as Codiware's automatic extension activation.

Pass options to `Markian.create(host, options)` and await `editor.ready` before
using the instance. `markdown` is required. All other options are optional.
`undefined` below means that the option can be omitted; its effective behavior
is described in the tables. Callbacks are JavaScript functions, not JSON strings.

## Default Configuration

```javascript
const defaultConfiguration = {
  markdown: '',
  initialMode: 'visual',
  sidebarVisible: true,
  theme: 'light',
  markdownCssUrls: undefined,
  themeCssUrls: [],
  readOnly: false,
  disabled: false,
  softbreaks: false,
  label: 'Markdown editor',
  toolbar: undefined,
  floatingToolbar: ['bold', 'italic', 'code', 'strike', 'link', 'clear'],
  toolbarPlacement: 'top',
  documentBase: undefined,
  allowTextColors: false,
  textColors: ['#262c2b', '#a82736', '#a65b00', '#227761', '#16669a', '#754491'],
  onLinkOpen: undefined,
  onLinkSuggest: undefined,
  onImageSuggest: undefined,
  onLinkInspect: undefined,
  onImageInsert: undefined,
  onFullscreenEnter: undefined,
  extensions: {},
};
```

An empty Markdown string creates an empty document; it is not an implicit value
for a missing `markdown` option. Extensions are omitted and disabled by default;
their individual defaults are shown in the chapters below.

## Editor Options

| Option | Default | Behavior |
| --- | --- | --- |
| `markdown` | Required | Initial ordinary Markdown string, at most 1,000,000 characters. |
| `initialMode` | `'visual'` | `'visual'` or `'raw'`; the Source toolbar command is named `source`, not `raw`. Unsupported visual content can fall back to raw mode without discarding the source. |
| `sidebarVisible` | `true` | Initial document-outline visibility. `false` starts collapsed. Its button reflects visibility; heading navigation keeps it open. Specialized views hide it temporarily without resetting the choice. |
| `theme` | `'light'` | `'light'` or `'dark'`, scoped to the instance. |
| `markdownCssUrls` | Derived from the classic script URL | Ordered HTTP(S) content stylesheet URLs. Omitted loads `markdown-github.css` beside the core script; `[]` disables that default. Non-classic loading must provide this option explicitly. Relative URLs resolve against the document base URI. |
| `themeCssUrls` | `[]` | Ordered HTTP(S) editor-theme overrides, after content stylesheets. Base `markian.css` is still loaded separately by the host. Readiness waits for configured CSS; destruction removes owned links. |
| `readOnly` | `false` | Prevents user content changes while retaining nonmutating navigation, selection, search, copying, and inspection. |
| `disabled` | `false` | Also prevents user edits; does not make the entire editor inert or change the original textarea's disabled/submission semantics. |
| `softbreaks` | `false` | Render ordinary soft line breaks as hard visual breaks in Preview/Help; does not rewrite Markdown or fenced code. |
| `label` | `'Markdown editor'` | Accessible name of the editor region. |
| `toolbar` | Built-in layout below | Recursive toolbar entries. Explicit layouts are authoritative; extension buttons are not automatically inserted into a custom layout. |
| `floatingToolbar` | `['bold', 'italic', 'code', 'strike', 'link', 'clear']` | Prose-selection command IDs, including Clear formatting. Table and code-block contexts use their own controls; code blocks offer only Code expansion when available. |
| `toolbarPlacement` | `'top'` | `'top'` or `'bottom'`. At container widths of 480px or less, the toolbar moves below the work area. |
| `documentBase` | Unset; browser document base for relative URLs | Base URL for document resources and provider context. Relative configured bases resolve against the browser document base. Does not rewrite stored destinations. |
| `allowTextColors` | `false` | Enables the bounded hexadecimal text-color feature. Arbitrary CSS is not accepted. |
| `textColors` | Six-color palette shown above | Optional 5-10 unique `#rrggbb` values. Omit to use the built-in palette when colors are enabled. |
| `onLinkOpen` | Browser navigation | Optional sync/async callback receiving provider context plus `destination`; handles host-specific navigation. |
| `onLinkSuggest` | No suggestions | Optional sync/async callback returning destination suggestions. |
| `onImageSuggest` | No suggestions | Optional sync/async callback returning image destination suggestions. |
| `onLinkInspect` | No host inspection | Optional sync/async callback receiving provider context and the destination, returning link existence status and optional headings. |
| `onImageInsert` | Bounded raster data URI | Optional sync/async callback receiving provider context plus `blob`, returning a saved image destination and optional alternative text. Custom callbacks must not return embedded data URIs. Hosts await `whenIdle()` before saving. |
| `onFullscreenEnter` | Built-in viewport fullscreen | Optional sync/async callback receiving `instance`, `element`, and an abort `signal`; must return a restore/disposal function. |
| `extensions` | `{}` | Per-instance activation/configuration of previously registered factories. Registration alone does not enable an extension. Unknown enabled IDs are errors. |

## Viewer Options

The independent `MarkianViewer.create(host, options)` entry point uses
`dist/markian-viewer.min.js` and `dist/markian-viewer.css`, not editor assets.
Its generated declarations are `dist/types/viewer.d.ts`.

| Option | Default | Behavior |
| --- | --- | --- |
| `markdown` | `''` | Exact Markdown string, at most 1,000,000 characters. Rendering never rewrites it. |
| `theme` | `'light'` | `'light'` or `'dark'`, instance-local. |
| `softbreaks` | `false` | Render ordinary line breaks as `<br>` without changing source or code fences. |
| `allowTextColors` | `false` | Preview's bounded hexadecimal color syntax; not arbitrary HTML/CSS. |
| `documentBase` | Browser document base URI | HTTP(S) base for relative link/image destinations; a relative configured base resolves against the browser document. |
| `mermaid` | `false` | Gate invocation of `renderers.mermaid`. False/omitted means no Mermaid callback or runtime loading, even when fences exist. True alone supplies no renderer; no matching fence means no runtime request. |
| `renderers` | `{}` | Language-to-callback map for optional fence rendering. Each callback returns HTML/SVG text or a promise, sanitized and bounded before display. Missing/failed adapters leave plain code. No implicit highlighter or editing extensions. |
| `onResourceResolve` | Safe browser URL resolution | Synchronous callback returning a URL string or `null`; original and resolved URLs must be safe. Hosts own resource routing/authentication. |
| `onLinkOpen` | Native navigation; instance-local fragments | Synchronous host navigation callback. Return value is unused; Markian prevents native navigation when supplied. |
| `onError` | `console.error` | Notification callback for current optional-renderer/navigation errors. Renderer failures retain plain code and resolve readiness/replacement. Synchronous validation/resource-resolution errors throw without replacing the old value. |

Shared viewer callback context contains `markdown`, `revision`, `theme`,
`documentBase`, and an abort `signal`. Resource/navigation context also contains
the original `destination` and `kind: 'link' | 'image'`; navigation adds `event`.
Fence context adds `language` and `source`. Obsolete rendering is aborted/ignored
on replacement, theme changes, or destruction. Functions are trusted JavaScript,
never strings evaluated from Markdown or serialized configuration.

All options are construction-time settings. Use `set(markdown)`, `setTheme(theme)`,
and `destroy()` for live operations; `get()` returns the supplied Markdown.
`ready`, `set`, and `setTheme` provide render promises; identical `set` returns the
current promise without rebuilding. Destroy is idempotent and restores original
host children. The viewer has no editor toolbar, permission state, providers,
history, stylesheet URL loader, form integration, or task-toggle option. Style it
through the standalone CSS and scoped host overrides.

### Viewer Mermaid Adapter

Load `dist/extensions/viewer-mermaid.min.js` and
`dist/extensions/viewer-mermaid.css` explicitly. Create a callback with
`MarkianViewerMermaid.createRenderer(document, options)` and pass it as
`renderers.mermaid` together with `mermaid: true`. The adapter does not load a
runtime until an enabled viewer renders a matching fence. It returns sanitized,
noninteractive diagram presentation, not the editor's code/pan/zoom UI.

| Adapter Option | Default | Behavior |
| --- | --- | --- |
| `renderer` | Unset | Supplied versioned `{ version, render(context) }` adapter; preferred over `asset`. Supported version is `12.2.x`; result is SVG text or a promise. |
| `asset` | Unset | Explicit `{ url, version }` host asset. At least one of renderer/asset is required. |
| `asset.url` | Required with asset | Trusted HTTP(S) script URL, relative to the browser document base when not absolute. No implicit CDN or editor extension. |
| `asset.version` | Required with asset | Declared supported Mermaid `12.2.x` version. |
| `maxCharacters` | `20000` | Positive integer up to 20,000 diagram characters. |
| `maxLines` | `500` | Positive integer up to 500 diagram lines. |

The supplied renderer receives `source`, unique `id`, `theme`, and abort `signal`.
It may receive the viewer context's additional fields; do not rely on them as a
Mermaid renderer requirement. Compatible viewer URL loads are deduplicated and
retained for reuse. Separate editor/viewer IIFEs have separate caches: provide a
shared host renderer when both should use one runtime. See the
[viewer guide](../README.md#lightweight-viewer) for usage, bounds, size budgets,
and remaining acceptance limits.

## Toolbar

This is the built-in layout used when `toolbar` is omitted:

```json
[
  { "id": "history", "type": "group", "items": ["undo", "redo"] },
  { "id": "format", "type": "group", "items": [
    "headings",
    { "id": "formatting", "type": "menu", "label": "Formatting", "icon": "bold", "items": ["bold", "italic", "strike"] },
    { "id": "lists", "type": "menu", "label": "Lists", "icon": "lists", "items": ["ordered", "bullet", "task"] },
    "indent", "outdent"
  ] },
  { "id": "insert", "type": "group", "items": ["code", "codeblock", "quotes", "link", "image", "table", "rule"] },
  { "id": "document", "type": "group", "items": [
    { "id": "modes", "type": "menu", "label": "View mode", "icon": "preview", "items": ["visual", "source", "preview"] },
    "clear", "copy", "help"
  ] },
  { "id": "utilities", "type": "group", "align": "opposite", "items": ["search", "fullscreen", "outline"] }
]
```

A string selects a registered toolbar item or command. An object supports every
field below. Both container types use `items`, with at most eight nesting levels
and 200 entries per array. A `group` presents its items inline; a `menu` presents
them behind a disclosure button. Separators are generated at nonempty group
boundaries, including grouped sections inside menus. Empty or view-inapplicable
groups produce no separators. Bare command entries remain supported as shorthand.

Top-level containers accept `align`. Default-aligned containers appear on the left;
opposite-aligned containers appear on the right, retaining declaration order within
each side. Opposite containers stay outside More; other controls overflow in order
when space is insufficient. More is automatic and appears before the opposite
containers, or at the end when none are configured. No command receives special
alignment or pinning based on its name. Nested alignment is rejected.

Migration: replace `menu: [...]` with `type: 'menu', items: [...]`, wrap inline
sections in `type: 'group', items: [...]`, and collect formerly fixed controls in
an `align: 'opposite'` container. Remove explicit `separator`, `overflow`, and
`fixed` entries/properties; these legacy fields are rejected. Only `menu` and
`group` are implemented types. Responsive collapsing containers remain a possible
future type, not a current option.

| Option | Default | Behavior |
| --- | --- | --- |
| `toolbar[].id` | Required | Unique nonempty item ID. |
| `toolbar[].command` | Item ID | Command to execute for a leaf item; containers cannot specify it. |
| `toolbar[].label` | Command label | Accessible/menu label override. |
| `toolbar[].icon` | Command icon | Registered icon ID override. |
| `toolbar[].type` | Unset (command item) | `'menu'` for a disclosure or `'group'` for inline items. Required for containers. |
| `toolbar[].items` | Unset | Required array of strings or nested toolbar objects for either container type. |
| `toolbar[].align` | `'default'` | Top-level containers only: `'default'` (left, overflowable) or `'opposite'` (right, pinned). |

### Live Toolbar Insertion

Hosts and extensions use the same `editor.getToolbar().insert(item, group?, beforeId?)`
method. This returns an idempotent disposer and does not edit the configured arrays.
Other registries retain their separate `insert(item, beforeId?)` signature.

```javascript
const remove = editor.getToolbar().insert(
  { id: 'custom:help', command: 'help' },
  'insert',
  'rule'
);
// Later, remove only this registration and its placement.
remove();
```

| Argument | Default | Behavior |
| --- | --- | --- |
| `item` | Required | Toolbar item definition with a unique registration ID. |
| `group` | Last top-level default-aligned inline group | Named menu or inline group receiving the item. The default layout falls back to `document`; omitted `align` means `'default'`. Menus and opposite-aligned groups are excluded from fallback selection. |
| `beforeId` | Append | ID of a direct child in the target container. An ID from another group is rejected. Pass `undefined` as the second argument to use the default group with an explicit ordering target. |

Append calls retain insertion order. Existing references to an item's ID in a host
layout retain their configured placement instead of being duplicated or moved.
If the group is absent, the item remains registered but no container is created;
this keeps custom and floating-only layouts authoritative. A custom layout may
include that registered ID explicitly. Named groups that do exist in a custom
layout receive live additions normally. Removing an addition removes only its
owned registration/placement; it does not restore an old copy of the layout.

Mermaid uses the `insert` group before `rule`. Code and Mermaid history controls
target `history` before `undo`/`redo`; Mermaid indentation controls target `format`
before `indent`/`outdent`. Positioning is explicit, not inferred from icons or
the order of unrelated registry entries.

## Bundled Extensions

Load the extension's prebuilt script after the core and call
`Markian.registerExtension(id, factory)` once before enabling it in instances.
Core-only and disabled instances do not request optional renderer dependencies.

`extensions` maps registered IDs to entries with the following two fields:

```javascript
extensions: {
  code: { enabled: true, config: {} },
  mermaid: { enabled: true, config: { /* Mermaid options below */ } },
}
```

| Option | Default | Behavior |
| --- | --- | --- |
| `enabled` | Disabled unless exactly `true` | Activate a registered factory for this instance. |
| `config` | Unset | Factory-specific configuration; both bundled factories accept omission. |

Each chapter below shows the default entry for its registered ID. Option names
in extension-specific tables are relative to that entry's `config` object.

### Code

Script: `dist/extensions/code.min.js`. Factory: `MarkianCode.codeExtension`.
Register as `code`. It adds caret-contextual code expansion and a dedicated
source view with local undo/redo. No extra renderer URL or stylesheet is required.

Default entry for `code`:

```javascript
const defaultCodeConfiguration = {
  enabled: false,
  config: {},
};
```

Code has no extension-specific options or bundled language packs. Its current
factory ignores `config`.

### Mermaid

Script: `dist/extensions/mermaid.min.js`. Stylesheet:
`dist/extensions/mermaid.css`. Factory: `MarkianMermaid.mermaidExtension`.
Register as `mermaid`. The renderer is not bundled and has no default URL.

Default entry for `mermaid`:

```javascript
const defaultMermaidConfiguration = {
  enabled: false,
  config: {
    renderer: undefined,
    asset: undefined,
    maxCharacters: 20000,
    maxLines: 500,
  },
};
```

| Option | Default | Behavior |
| --- | --- | --- |
| `renderer` | Unset | Host-supplied renderer adapter; takes precedence over `asset`. |
| `renderer.version` | Required with adapter | Declared supported Mermaid version, currently `12.2.x`. |
| `renderer.render` | Required with adapter | Function receiving render context below; returns SVG text synchronously or asynchronously. Output is sanitized. |
| `asset` | Unset | Alternative to an adapter: a host-supplied classic script exposing Mermaid in an isolated runtime. |
| `asset.url` | Required with asset | Nonempty HTTP(S) URL, relative to the document base when not absolute. No implicit CDN or sibling-framework path. |
| `asset.version` | Required with asset | Declared supported version, currently `12.2.x`; no implicit version. |
| `maxCharacters` | `20000` | Positive integer up to 20,000 characters per diagram. |
| `maxLines` | `500` | Positive integer up to 500 lines per diagram. |

With neither `renderer` nor `asset`, activation succeeds but diagrams display a
missing-renderer error without losing source. Limits, executable-link/directive
restrictions, sanitization, and safe styling are not bypassed by a custom renderer.
See the [extension guide](../README.md#optional-mermaid-extension) for an enabled
example. CSS and responsive sizing tokens are in the [style guide](Styleguide.md).

The renderer callback receives these fields; they are supplied by Markian, not
configuration values the host should set:

| Field | Meaning |
| --- | --- |
| `renderer.render.context.source` | Current diagram source. |
| `renderer.render.context.id` | Instance-owned unique render ID. |
| `renderer.render.context.theme` | Current `'light'` or `'dark'` theme. |
| `renderer.render.context.signal` | Abort signal for stale/destroyed rendering work. |

## Host Callback Values

Suggestion/inspection/image callbacks can return values or promises. Respect
abort signals and use `revision` to avoid stale results. These tables enumerate
their shared context and return fields, not additional startup settings.

| Field | Meaning |
| --- | --- |
| `callbacks.context.instance` | Calling editor instance. |
| `callbacks.context.query` | Current suggestion/inspection query. |
| `callbacks.context.documentBase` | Configured document base, if present. |
| `callbacks.context.revision` | Captured document revision. |
| `callbacks.context.signal` | Abort signal. |
| `callbacks.suggestions[].label` | Required suggestion label. |
| `callbacks.suggestions[].destination` | Required destination. |
| `callbacks.inspection.status` | Required `'exists'`, `'missing'`, or `'unknown'`. |
| `callbacks.inspection.headings` | Optional array of `{ id, label }` heading targets. |
| `callbacks.inspection.headings[].id` | Required target heading ID. |
| `callbacks.inspection.headings[].label` | Required heading label. |
| `callbacks.imageResult.destination` | Required saved image destination, or built-in raster data URI when no host callback is used. |
| `callbacks.imageResult.alt` | Optional alternative text. |

`onLinkOpen` and `onLinkInspect` additionally receive `destination`. `onImageInsert` additionally
receives the raster `blob`. `onFullscreenEnter` instead receives only `instance`,
the editor root `element`, and its operation's abort `signal`.

## Per-Operation Options

These are not passed to `Markian.create`. They configure public methods.

| Option | Default | Behavior |
| --- | --- | --- |
| `set.origin` | `'host-load'` | Event origin for `editor.set(markdown, options)`. |
| `set.resetHistory` | `true` | Reset history when replacing the visual document. |
| `set.pending` | Unset | `'reject'`, `'discard'`, or `'commit'`. An open block session or dirty raw draft requires an explicit policy before different host content can replace it. Identical host echoes are no-ops. |
| `search.query` | Required | Literal search string, at most 1,000 characters; empty clears search. |
| `search.caseSensitive` | `false` | Match letter case. |
| `search.wholeWord` | `false` | Match complete Unicode-aware words. |

