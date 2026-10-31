# Configuration

Pass editor options to `Markian.create(host, options)` and await `ready`. Viewer options belong to the separate `MarkianViewer.create(host, options)` factory. This reference describes library defaults, not host-specific presets.

## Default Editor Configuration

This JSON is the default declarative configuration with an empty required document and the built-in toolbar expanded. Omitted optional keys have the effective defaults listed below. JSON cannot contain callbacks or `undefined`; add trusted callback functions in JavaScript when creating the instance.

```json
{
  "markdown": "",
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
| `icon`    | Command icon        | Existing icon ID override.                                                                               |
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

### Live Toolbar Insertion

`editor.getToolbar().insert(item, group?, beforeId?)` returns an idempotent removal function without rewriting configured arrays.

| Argument   | Default                                     | Description                                                                                                         |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `item`     | Required                                    | A toolbar definition with a unique registration ID.                                                                 |
| `group`    | Last top-level default-aligned inline group | Target menu/group ID; default layout resolves to `document`. Menus and opposite groups are not fallback candidates. |
| `beforeId` | Append                                      | Direct-child ID inside the target container, not an item from another group.                                        |

Existing configured references to the ID keep their placement. Missing target groups are not created; the item remains registered for explicit references. Append calls keep insertion order. Removing a contribution removes only its owned registration and placement. Other registries use `insert(item, beforeId?)` instead.

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
