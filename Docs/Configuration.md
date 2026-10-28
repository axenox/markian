# Configuration

This reference covers every public editor option and every configuration option
of the bundled Code and Mermaid extensions. It describes Markian itself, not
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

## Toolbar

This is the built-in layout used when `toolbar` is omitted:

```json
[
  "undo", "redo", { "id": "history-divider", "separator": true },
  "headings",
  { "id": "formatting", "label": "Formatting", "icon": "bold", "menu": ["bold", "italic", "strike"] },
  { "id": "lists", "label": "Lists", "icon": "lists", "menu": ["ordered", "bullet", "task"] },
  "indent", "outdent", { "id": "format-divider", "separator": true },
  "code", "codeblock", "quotes", "link", "image", "table", "rule",
  { "id": "insert-divider", "separator": true },
  { "id": "modes", "label": "View mode", "icon": "preview", "menu": ["visual", "source", "preview"] },
  "clear", "copy", "help",
  { "id": "more", "overflow": true }, "search", "fullscreen", "outline"
]
```

A string selects a registered toolbar item or command. An object supports every
field below. Menus are recursive, with at most eight submenu levels and 200
entries per array. The overflow boundary is top-level and unique. Items after it
stay pinned in declaration order. Search and Fullscreen are also kept pinned.

| Option | Default | Behavior |
| --- | --- | --- |
| `toolbar[].id` | Required | Unique nonempty item ID. |
| `toolbar[].command` | Item ID | Command to execute when no separate command is specified. |
| `toolbar[].label` | Command label | Accessible/menu label override. |
| `toolbar[].icon` | Command icon | Registered icon ID override. |
| `toolbar[].menu` | Unset | Array of strings or nested toolbar objects. |
| `toolbar[].separator` | `false` | Render a separator instead of a command; cannot also contain a command or menu. |
| `toolbar[].overflow` | `false` | Define the top-level overflow boundary; cannot also contain a command or menu. |
| `toolbar[].fixed` | `false` | Keep this item outside the overflow menu. |

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

