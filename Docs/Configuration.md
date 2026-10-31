# Configuration

Pass editor options to `Markian.create(host, options)` and await `ready`. Viewer options belong to the separate `MarkianViewer.create(host, options)` factory. This reference describes library defaults, not host-specific presets.

## Default Editor Configuration

This JSON is the default declarative configuration with an empty required document and the built-in toolbar expanded. Omitted optional keys have the effective defaults listed below. JSON cannot contain callbacks or `undefined`; add trusted callback functions in JavaScript when creating the instance.

```json
{
  "markdown": "",
  "templates": [],
  "allowedHtml": [],
  "tags": [],
  "initialMode": "visual",
  "sidebarVisible": true,
  "theme": "light",
  "markdownCssClasses": [],
  "themeCssUrls": [],
  "readOnly": false,
  "disabled": false,
  "softbreaks": false,
  "label": "Markdown editor",
  "toolbar": [
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
  ],
  "floatingToolbar": ["bold", "italic", "code", "strike", "link", "clear"],
  "toolbarPlacement": "top",
  "allowTextColors": false,
  "textColors": ["#262c2b", "#a82736", "#a65b00", "#227761", "#16669a", "#754491"],
  "extensions": {}
}
```

## Editor Options

| Option              | Default                                         | Description                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown`          | Required                                        | Initial Markdown string, at most 1,000,000 characters. An empty string is valid; omission is not.                                                                                            |
| `templates` | `[]` | Fixed Markdown or literal selection wrappers; adds a Templates menu when nonempty. See below. |
| `allowedHtml` | `[]` | Attribute-free inline tags selected from `kbd`, `sub`, `sup`, `mark`. Shared with editor Preview and the viewer. Other HTML stays opaque in Visual and is omitted from rendered output. |
| `tags` | `[]` | Up to 30 instance-local mention rules. Visual suggestions and accessible details do not rewrite existing Markdown. |
| `initialMode`       | `"visual"`                                      | `"visual"` or `"raw"`. An unsupported visual import can fall back to raw mode without discarding source.                                                                                     |
| `sidebarVisible`    | `true`                                          | Start with the document outline open. Specialized views hide it temporarily without resetting this choice.                                                                                   |
| `theme`             | `"light"`                                       | `"light"` or `"dark"`, per instance.                                                                                                                                                         |
| `markdownCssUrls`   | `markdown-github.css` beside the classic script | Ordered HTTP(S) content stylesheets. An explicit array replaces the default; `[]` loads none. Non-classic loading must provide this option. Relative URLs use the browser document base URI. |
| `markdownCssClasses` | `[]` | Additional classes on the Markdown document wrapper in Visual, Preview and Help. Each array entry must be one nonempty class name without whitespace. Classes are copied at construction; editor controls and source editors are unaffected. |
| `themeCssUrls`      | `[]`                                            | Ordered HTTP(S) theme overrides after content CSS. Base `markian.css` must still be host-loaded. Readiness waits for configured CSS; destruction removes owned links.                        |
| `readOnly`          | `false`                                         | Block user edits while retaining selection, navigation, copying, search, Help, and fullscreen.                                                                                               |
| `disabled`          | `false`                                         | Also block user edits without making the editor inert or changing native textarea disabled/submission semantics.                                                                             |
| `softbreaks`        | `false`                                         | Display ordinary soft line breaks as hard breaks in Preview/Help without rewriting source or code fences.                                                                                    |
| `label`             | `"Markdown editor"`                             | Accessible editor-region name.                                                                                                                                                               |
| `toolbar`           | Layout above                                    | Ordered recursive entries. `[]` removes pinned document controls. Layout controls visibility, not permissions.                                                                               |
| `floatingToolbar`   | Array above                                     | Prose-selection command IDs. Table and code-caret contexts have separate controls.                                                                                                           |
| `toolbarPlacement`  | `"top"`                                         | `"top"` or `"bottom"`; embedded editors retain this placement at every width. Maximized editors use bottom controls on viewports at 480px or less. |
| `documentBase`      | Unset; browser base for relative resources      | Base for resource resolution and provider context. Relative configured bases resolve against the browser document. Saved destinations are not rewritten.                                     |
| `allowTextColors`   | `false`                                         | Enable bounded six-digit hex text colors, not arbitrary CSS or HTML.                                                                                                                         |
| `textColors`        | Six colors above                                | Palette of 5-10 distinct `#rrggbb` values.                                                                                                                                                   |
| `onFullscreenEnter` | Built-in viewport maximize                      | Sync/async callback returning a restore function.                                                                                                                                            |
| `onImageInsert`     | Bounded raster data URI                         | Sync/async callback returning `{ destination, alt? }` after host persistence. Custom results cannot be data/blob URLs.                                                                       |
| `onImageSuggest`    | No suggestions                                  | Sync/async callback returning destination suggestions.                                                                                                                                       |
| `onLinkInspect`     | No inspection                                   | Sync/async callback returning existence status and optional headings.                                                                                                                        |
| `onLinkOpen`        | Browser navigation                              | Sync/async callback receiving the original destination for host navigation.                                                                                                                  |
| `onLinkSuggest`     | No suggestions                                  | Sync/async callback returning destination suggestions.                                                                                                                                       |
| `extensions`        | `{}`                                            | Activation/configuration map for registered factories, described below.                                                                                                                      |

Stylesheet failures reject readiness and restore the host. CSS is trusted and page-wide; scope custom rules as described in the [style guide](Styleguide.md#stylesheets-and-themes).

For a host stylesheet that targets `.markdown-body`, pass both `markdownCssUrls: ['/assets/github-markdown-light.css']` and `markdownCssClasses: ['markdown-body']`. The same options work in the viewer. Classes alone do not replace the default content theme; an explicit `markdownCssUrls` array does.

## Toolbar

Strings reference toolbar registrations or command IDs. Objects use these fields:

| Field     | Default             | Description                                                                                              |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`      | Required            | Unique nonempty item ID.                                                                                 |
| `command` | Item ID             | Command for a leaf item; forbidden on containers.                                                        |
| `label`   | Command label       | Accessible/menu label override.                                                                          |
| `icon`    | Command icon        | Built-in icon ID or sanitized raw SVG string. See [icons](#icons).                                         |
| `type`    | Unset, meaning leaf | `"group"` for inline controls or `"menu"` for a disclosure.                                              |
| `items`   | Unset               | Required recursive array for a container; forbidden on leaves.                                           |
| `align`   | `"default"`         | Top-level containers only: default-aligned, overflowable controls or `"opposite"` controls outside More. |

Arrays allow at most 200 entries and eight nesting levels. Groups generate separators only when nonempty. Order is retained within each alignment side. More appears automatically before opposite containers, or at the end if none exist. Command names never imply pinning or alignment.

```javascript
toolbar: [
  { id: 'format', type: 'menu', label: 'Formatting', icon: 'bold', items: ['bold', 'italic'] },
  { id: 'utilities', type: 'group', align: 'opposite', items: ['search', 'fullscreen'] },
]
```

### Icons

All command, toolbar-item and template `icon` properties accept a built-in icon alias or a raw SVG string. Existing aliases such as `bold`, `templates`, `outline` and `key` continue to work. Put custom SVG in a variable and reference that variable in configuration:

```javascript
const keyIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 5h18v14H3zM5 7v10h14V7z" fill-rule="evenodd"/></svg>';
const templates = [
  { id: 'key', label: 'Keyboard key', icon: keyIcon, markdown: '<kbd>{{selection}}</kbd>' },
];
```

SVG strings must contain a standalone `svg` root in the SVG namespace, at most 20,000 characters and 100 descendant elements. A supplied `viewBox` must have four finite numbers and positive width/height; omission uses `0 0 24 24`. Malformed, oversized or shapeless SVG is rejected.

The sanitizer retains static `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline` and `polygon` content, geometry, transforms and basic paint/stroke attributes. Scripts, event handlers, embedded HTML/images, links, `use`, animation, styles, IDs, filters and URL references are removed. Paint accepts plain colors, `currentColor`, `none` and numeric RGB/HSL forms, not CSS variables or paint-server references. Prefer `currentColor` for theme-aware icons. Root width/height are removed so controls retain shared dimensions. SVG titles and accessible attributes are replaced by the control's label/tooltip; icons themselves are hidden from assistive technology and are not separately focusable. Icons remain UI configuration, never saved Markdown.

### Live Toolbar Insertion

`editor.getToolbar().insert(item, group?, beforeId?)` returns an idempotent removal function without rewriting configured arrays.

| Argument   | Default                                     | Description                                                                                                         |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `item`     | Required                                    | A toolbar definition with a unique registration ID.                                                                 |
| `group`    | Last top-level default-aligned inline group | Target menu/group ID; default layout resolves to `document`. Menus and opposite groups are not fallback candidates. |
| `beforeId` | Append                                      | Direct-child ID inside the target container, not an item from another group.                                        |

Existing configured references to the ID keep their placement. Missing target groups are not created; the item remains registered for explicit references. Append calls keep insertion order. Removing a contribution removes only its owned registration and placement. Other registries use `insert(item, beforeId?)` instead.

## Templates and Inline HTML

Templates are core features, not separately loaded extensions. Each entry requires a unique `id` (1-60 word/hyphen characters), nonempty `label`, and `markdown` string. Optional `icon` accepts a built-in alias or raw SVG through the shared [icon policy](#icons); `hint` supplies the tooltip. Optional `css` is a trusted CSS string, omitted by default, of at most 100,000 characters per template. HTML attributes and executable HTML remain unsupported.

```javascript
allowedHtml: ['kbd', 'mark'],
templates: [
  { id: 'review', label: 'Review checklist', icon: 'task', markdown: '- [ ] Review\n- [ ] Approve' },
  { id: 'key', label: 'Keyboard key', icon: 'key', hint: 'Wrap a keyboard key', markdown: '<kbd>{{selection}}</kbd>', css: 'kbd { background: var(--markian-soft); border-color: var(--markian-accent); }' },
  { id: 'strong', label: 'Strong emphasis', icon: 'bold', markdown: '**{{selection}}**' },
]
```

`template:<id>` inserts at the active Visual/Source selection as one undoable edit. Fixed bodies replace the selection. `{{selection}}` inserts selected text literally, with Markdown/HTML escaping and no recursive substitution. Empty selections place the caret at the first placeholder. An empty pure HTML wrapper establishes the corresponding typing mark; its HTML appears in the value once text is typed. Code-template selections cannot contain backticks or line breaks. Placeholders in HTML attributes, link/image destinations, or metadata are rejected. Unsupported visual content fails before insertion rather than dropping source.

With at least one template, a Templates control appears automatically in the regular `insert` toolbar group, before Horizontal rule when present. Its MDI format-textbox icon opens the template choices; no separate extension or toolbar configuration is needed. The `key` icon is MDI button-pointer. With no templates, the control is absent. Explicit custom placements of `templates` are preserved without duplicates. Custom layouts without the `insert` group must explicitly reference `templates` or `template:<id>`. Read-only/disabled state prevents insertion.

Template CSS accepts flat selector/declaration rules, such as `kbd { border-radius: 3px; }`; imports, other at-rules and nested rules are unsupported. The browser parses declarations and may discard invalid CSS. Selectors are scoped to this instance's document surfaces, never its toolbar, source editor or sibling instances. CSS is mounted even before a template is inserted, survives view/value/theme changes, and is removed on destruction. Rules style all matching elements, not a hidden per-template identity; later matching rules participate in the ordinary CSS cascade. Prefer shared `--markian-*` colors for light/dark themes. Keyboard keys have a shared default border, raised lower edge and monospace text even without custom template CSS.

Pass the same template array and `allowedHtml` to `MarkianViewer.create(...)` to reproduce the presentation. The viewer consumes only `css`, adds no commands and renders allowed `<kbd>` elements using its base stylesheet. Neither CSS nor template IDs enter saved Markdown. Template CSS must come from trusted host configuration, not document/provider content. Selector scoping is not a CSS security sandbox; trusted rules can reference resources or affect layout. This uses instance-owned inline styles and requires a CSP that permits them. The allowed HTML setting maps editable inline formatting and sanitizes disposable output; it is not permission for arbitrary HTML. See [portability limits](Interoperability.md#templates-and-mentions) and the [runnable example](../Examples/templates.html).

## Mentions and Tags

Every `tags[]` entry uses these fields. Rules are copied at construction; callbacks stay trusted host code.

| Field | Default | Meaning |
| --- | --- | --- |
| `id` | Required | Unique 1-60 word/hyphen-character rule ID. |
| `prefix` | Required | Literal non-whitespace prefix, 1-8 characters; no backslash, backtick, or angle brackets. |
| `textRegex` | Unset | Optional JavaScript regex source, without delimiters, up to 500 characters. Must match the complete bounded tag body, excluding the prefix. Use `\\d*` for numbers and an empty query immediately after the prefix. It does not expand the allowed body characters. |
| `priority` | `0` | Integer from -1000 to 1000. Higher wins; ties prefer longer prefixes, then configuration order. |
| `maxLength` | `64` | Body limit, 1-100 characters, excluding the prefix. Bodies contain Unicode letters/numbers, underscores and hyphens. |
| `color` | Theme accent | Optional six-digit hex background tint for the compact Visual chip. Text retains its regular prose/link color; presentation never enters Markdown. |
| `storage` | `"plain"` | Suggestions insert ordinary text; `"link"` requires a safe destination and inserts an ordinary Markdown link. |
| `legacyLinks` | `false` | Recognize existing prefixed empty/ordinary links without converting their source. Enable for Power UI-style `[@label]()` mentions. |
| `suggestOnClick` | `false` | In an editable Visual view, pointer or keyboard tag activation opens suggestions using the complete tag body as `query`. Click events/handlers still run; read-only activation keeps details without insertion suggestions. |
| `onSuggest` | Unset | Sync/async structured suggestions during Visual typing. |
| `onHover` | Unset | Sync/async text details for pointer hover, keyboard focus and touch activation. |
| `onClick` | Unset | Rule-specific host action for pointer/touch or Enter/Space activation. |

```javascript
tags: [
  { id: 'ticket', prefix: '#', onSuggest: ({ query }) => [
    { label: 'Ticket 123', value: '#123' },
  ].filter(item => item.value.includes(query)) },
  { id: 'user', prefix: '@', storage: 'link', legacyLinks: true,
    onSuggest: () => [{ label: 'Alex', value: '@alex', destination: 'people/alex' }],
    onHover: ({ value }) => ({ title: value, description: 'Team member' }),
    onClick: ({ value }) => console.log(value),
  },
]
```

Each callback receives the shared provider context plus `{ rule, value, destination? }`; `query` excludes the prefix. There is no nested callback object, global type switch, or built-in request transport. Suggestions return up to 100 `{ label, value, destination? }` entries. Labels are bounded to 500 characters; values must match the rule's prefix, body characters, optional `textRegex` and length limit. Details return `{ title, description? }`, bounded to 500/2000 characters and rendered as text, not HTML. `onClick` returns void or a promise of void.

Visual matching excludes code, inline HTML stencils, URL/email text and ordinary links, except explicitly recognized legacy mentions. A mention starts at a text boundary, not inside a word. Visual suggestions debounce by 150ms; Up/Down chooses and Enter inserts, while Escape dismisses. Loading, empty and failure states retain document text. Results are rejected after query/rule/revision/view/permission changes or destruction, even if a callback ignores its signal. Read-only/disabled editors keep details and host actions but not suggestions or insertion. Source view edits the literal Markdown; it has no mention popup. Preview/viewer use ordinary text/link rendering without mention callbacks.

Host adapters translate filter/display attributes, limits, headers and action metadata into their own callbacks. Those backend settings do not belong in `tags[]`. See the [local-data example](../Examples/mentions.html).
Accepted suggestions add one unlinked space and leave the caret in ordinary prose; this belongs to the same undoable insertion.

## Host Callback Values

Suggestion, inspection, navigation, and insertion callbacks receive this shared context:

| Field          | Type                | Meaning                        |
| -------------- | ------------------- | ------------------------------ |
| `instance`     | `MarkianInstance`   | Calling editor.                |
| `query`        | `string`            | Current query.                 |
| `documentBase` | `string` or omitted | Configured base.               |
| `revision`     | `number`            | Captured document revision.    |
| `signal`       | `AbortSignal`       | Cancellation/staleness signal. |

`onLinkInspect` and `onLinkOpen` also receive `destination: string`. `onImageInsert` also receives `blob: Blob`.

| Callback result        | Fields and limits                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Link/image suggestions | `{ label: string, destination: string }[]`; at most 100 displayed.                                                  |
| Link inspection        | `{ status: "exists" \| "missing" \| "unknown", headings?: { id: string, label: string }[] }`; at most 500 headings. |
| Image insertion        | `{ destination: string, alt?: string }`; destination names an already-persisted image.                              |
| Link navigation        | No result value.                                                                                                    |

`onFullscreenEnter` instead receives `{ instance, element, signal }` and returns `() => void` or a promise of that function. It must restore its own partial changes on failure. Markian pairs successful entry with one restoration on exit/destruction, including late cancelled entry.

Callbacks own transport and authorization. They may return local values or promises; function strings are never evaluated. Use `Markian.headings(markdown)` to build heading suggestions without mounting another editor.

Raster insertion accepts PNG, JPEG, GIF, or WebP up to 1,000,000 bytes, one current-document insertion at a time. The built-in fallback embeds a data URI; a custom callback has no such fallback. Await `whenIdle()` before host saves; failed insertion must be retried or explicitly removed.

## Bundled Editor Extensions

Load the extension script after core and register its factory before creating editors. Each `extensions` entry has the same structure:

| Field     | Default                        | Description                                        |
| --------- | ------------------------------ | -------------------------------------------------- |
| `enabled` | Disabled unless exactly `true` | Activate the registered factory for this instance. |
| `config`  | Omitted                        | Factory-specific configuration.                    |

An omitted/disabled entry contributes nothing. Loading and registration alone do not enable it. Enabled unknown IDs are errors. There is no `source` option or public runtime activation API.

### Code

Script: `dist/extensions/code.min.js`. Factory: `MarkianCode.codeExtension`, normally registered as `code`.

```json
{ "enabled": false, "config": {} }
```

There are no local options; the current factory ignores `config`. It supplies expanded top-level code-block editing, not language packs. It requires no additional stylesheet or renderer URL.

### Mermaid

Script: `dist/extensions/mermaid.min.js`. CSS: `dist/extensions/mermaid.css`. Factory: `MarkianMermaid.mermaidExtension`, normally registered as `mermaid`.

```json
{
  "enabled": false,
  "config": { "maxCharacters": 20000, "maxLines": 500 }
}
```

Both `renderer` and `source` are omitted by default; there is no default runtime URL. Option names below are local to `config`.

| Option             | Default                | Description                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `renderer`         | Omitted                | Host `{ render }` adapter; takes precedence over `source`. |
| `renderer.render`  | Required with renderer | Function returning SVG text or a promise.                                |
| `source`           | Omitted                | Trusted HTTP(S) Mermaid script URL string for the isolated runtime loader. Relative URLs use the browser document base. |
| `maxCharacters`    | `20000`                | Positive integer, at most 20,000 characters per diagram.                 |
| `maxLines`         | `500`                  | Positive integer, at most 500 lines per diagram.                         |

With neither renderer nor source, editor activation succeeds but diagrams show a missing-renderer error. A loaded runtime must expose callable `initialize()` and `render()` methods, and `render()` must return an object containing SVG text. No version is declared or allowlisted. Rendering limits and sanitization still apply with a custom renderer. The former `asset` option is rejected even when `source` is also present; there is no compatibility fallback.

The renderer receives `{ source: string, id: string, theme: "light" | "dark", signal: AbortSignal }`. It must emit SVG text labels, isolate its configuration, and avoid source-defined callbacks. See [Mermaid usage and safety](Extensibility.md#mermaid).

The source loader preserves Mermaid's native `default` theme for light instances and its native `dark` theme for dark instances. Markian does not recolor nodes or replace diagram fonts. Mermaid style tags, inline styles and IDs are preserved, including those returned by custom adapters. See the [CSS risk boundary](Development/Extensions/Mermaid_extension.md#svg-styling-and-safety).

## Viewer Options

Load `dist/markian-viewer.min.js` and `dist/markian-viewer.css`. These defaults are independent of editor settings:

```json
{
  "markdown": "",
  "theme": "light",
  "markdownCssClasses": [],
  "softbreaks": false,
  "allowTextColors": false,
  "mermaid": false,
  "allowedHtml": [],
  "templates": [],
  "renderers": {}
}
```

Omitted callbacks and `documentBase` use the effective defaults below.

| Option              | Default                                        | Description                                                                                                                                                     |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown`          | `""`                                           | Exact supplied Markdown, at most 1,000,000 characters.                                                                                                          |
| `theme`             | `"light"`                                      | `"light"` or `"dark"`, per instance.                                                                                                                            |
| `markdownCssUrls` | Built-in viewer content theme | Ordered HTTP(S) content stylesheets. Omission retains built-in typography; an explicit array replaces it, including `[]` for none. Readiness waits for owned links; destruction removes them. |
| `markdownCssClasses` | `[]` | Additional document-wrapper classes, with the same validation as the editor. Applied again on every render, value update and theme change. The viewer root is unaffected. |
| `softbreaks`        | `false`                                        | Display ordinary soft breaks as `<br>` without changing source.                                                                                                 |
| `allowTextColors`   | `false`                                        | Render the bounded hex-color syntax, not arbitrary HTML/CSS.                                                                                                    |
| `allowedHtml` | `[]` | Same bounded, attribute-free inline HTML tags as the editor. No mention callbacks or editor controls are loaded. |
| `templates` | `[]` | Shared template definitions or objects containing optional `css`. Only CSS is consumed, with the same validation, content scoping and cleanup as the editor; no insertion commands are loaded. Enable matching tags through `allowedHtml` and load the base viewer CSS. |
| `documentBase`      | Browser document base URI                      | HTTP(S) base for relative resources; relative configured values use the browser base.                                                                           |
| `mermaid`           | `false`                                        | Gate invocation of `renderers.mermaid`. True supplies no renderer by itself.                                                                                    |
| `renderers`         | `{}`                                           | Fence-language-to-callback map; missing/failed renderers leave plain code.                                                                                      |
| `onResourceResolve` | Safe browser URL resolution                    | Synchronous callback returning a URL string or `null` to suppress the resource. Original and returned destinations must pass URL policy.                        |
| `onLinkOpen`        | Native navigation and instance-local fragments | Synchronous host navigation callback; supplying it prevents native navigation. Return value is unused.                                                          |
| `onError`           | `console.error`                                | Notification of current renderer/navigation failures. Renderer failure leaves plain code and settles rendering; synchronous validation/resource failures throw. |

Viewer callback context contains `{ markdown, revision, theme, documentBase, signal }`. Resource callbacks add `{ destination, kind: "link" | "image" }`; navigation also adds `event: MouseEvent`. Renderer callbacks add `{ language, source }` and return HTML/SVG text or a promise. They are bounded and sanitized as described in [viewer renderers](Extensibility.md#viewer-renderers).

All options are construction-time settings. Use `set`, `setTheme`, and `destroy` for live operations. The viewer has no editor toolbar, history, form integration, or mutable task controls. Configured content stylesheets are instance-owned; load the base viewer CSS separately.

### Viewer Mermaid Adapter

Load `dist/extensions/viewer-mermaid.min.js` and `dist/extensions/viewer-mermaid.css`. Call `MarkianViewerMermaid.createRenderer(document, options)` and pass the result as `renderers.mermaid` with `mermaid: true`.

Default local settings, before adding a required renderer or source:

```json
{ "maxCharacters": 20000, "maxLines": 500 }
```

| Option             | Default                | Description                                                                         |
| ------------------ | ---------------------- | ----------------------------------------------------------------------------------- |
| `renderer`         | Omitted                | Host `{ render }` adapter; preferred over `source`. |
| `renderer.render`  | Required with renderer | Receives source, unique ID, theme, and abort signal; returns SVG text or a promise. |
| `source`           | Omitted                | Trusted HTTP(S) Mermaid script URL string; relative to browser document base. At least renderer or source is required. |
| `maxCharacters`    | `20000`                | Positive integer up to 20,000.                                                      |
| `maxLines`         | `500`                  | Positive integer up to 500.                                                         |

Unlike editor Mermaid activation, creating this adapter without a renderer or source throws. Loading its script alone does not load Mermaid. The same runtime API checks and rejection of the old `asset` option apply as for the editor extension. Viewer loads of the same resolved URL share a retained cache; editor and viewer bundles have separate caches. See [viewer Mermaid usage](Extensibility.md#viewer-mermaid).

## Per-Operation Options

These configure methods, not construction:

| Option                 | Default       | Description                                                                                                                                                                 |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set.origin`           | `"host-load"` | Event origin for host replacement.                                                                                                                                          |
| `set.resetHistory`     | `true`        | Reset history when replacing the visual document.                                                                                                                           |
| `set.pending`          | Omitted       | `"reject"`, `"discard"`, or `"commit"`. Different replacement during a block session or dirty raw draft requires an explicit policy. Identical projected values are no-ops. |
| `search.query`         | Required      | Literal string up to 1,000 characters; empty clears search.                                                                                                                 |
| `search.caseSensitive` | `false`       | Match letter case.                                                                                                                                                          |
| `search.wholeWord`     | `false`       | Match complete Unicode-aware words.                                                                                                                                         |

See [API behavior](API.md) for replacement, session, and save-gate rules.
