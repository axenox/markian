# Markian

A framework-independent Markdown editor. This checkout implements W0-W3 foundations and W4-W7 editing, table, provider, and navigation features described below. It is not a stable release: remaining parity, device, and integration gates are tracked in the plan. The former demonstration and its tests are archived under [Prototype](Prototype/README.md); no library build imports them.

## Try It

From a checkout, use Node.js 24 and npm:

```powershell
npm ci
npm run build
npm run dev -- --port 5177 --strictPort
```

Open <http://127.0.0.1:5177/> for the library workspace, or the [minimal form example](Examples/index.html). Both use ordinary script/link tags loading the built distribution, not source-module imports. Documents live in memory; no storage or data requests are implemented.

Consumers need only a static HTTP server and the prebuilt assets. No npm, Node.js, compiler, import map, remote fonts, or sibling Core package is required at runtime.

## Script-Tag API

```html
<link rel="stylesheet" href="dist/markian.css">
<div id="notes"></div>
<script src="dist/markian.min.js"></script>
<script>
  const editor = Markian.create(document.querySelector('#notes'), {
    markdown: '# Notes\n\nReady for review.',
    theme: 'light',
  });
  editor.ready.then(() => {
    editor.on('change', event => console.log(event.origin, editor.get()));
  });
</script>
```

Await `ready` before commands, replacement, or view navigation. Initialization rejection restores the host. A preservation fallback to raw mode instead resolves readiness and reports an `error` event plus an inline diagnostic.

| API | Current behavior |
| --- | --- |
| `get()` | Synchronous complete Markdown, including raw/code drafts while Help or Preview is open. |
| `set(markdown, options)` | Host replacement; identical projected values are no-ops. `origin` defaults to `host-load`; `resetHistory` defaults to true. Visual import validates before replacement. |
| `setMode('visual' / 'raw')` | Independent histories; edited source returns as one visual replacement. Failed visual import retains source. |
| `execute(id, payload)` | Promise of false for unsupported-view/read-only commands; unknown IDs throw. |
| `setTheme('light' / 'dark')` | Instance-local presentation. |
| `setReadOnly(bool)` / `setDisabled(bool)` | Prevent user edits while retaining source selection, Help, Preview, copying, and maximize. Host `set()` is still permitted. |
| `on(name, handler)` | Returns unsubscribe. Names: change, draft, ready, mode, focus, blur, error, save-request. Events include instance, origin, revision, view; draft identifies source/session edits. |
| `search(options)` / `selectSearch(index)` / `replaceSearch(text, all?)` | Literal view-scoped search with optional caseSensitive/wholeWord. Help/Preview and read-only views cannot replace. Offsets belong to the active engine, not necessarily Markdown. |
| `insertImage(blob)` / `whenIdle()` | Insert a bounded raster image; await pending results before host saves. Failed/cancelled insertions require retry or explicit removal. |
| `getActiveSession()` | Current or suspended block draft, or null; get() still projects the complete document. |
| `focus()` / `resize()` / `destroy()` | Active-view focus/measurement and idempotent host restoration. |

Textarea hosts retain their name/form association. Values track active drafts synchronously; native form reset loads `defaultValue` and resets history. Pending/failed image insertion prevents native form submission until resolved or explicitly removed; submission is not automatically retried. Disabled editing does not change native textarea disabled/submission semantics.

`getCommands()`, `getToolbar()`, `getViews()`, `getRenderers()`, and `getSchema()` expose typed registries: `insert(item, beforeId?)` returns an idempotent removal function; IDs and explicit ordering targets must be unique/present. Applications and extensions use the same methods. Schema contributions close before engine construction. The initial structural bridge supports atomic node mappings over existing mdast node types; custom Markdown grammars, nested structural serialization, and block-HTML normalization are not yet a complete extension contract.

## Optional Code Slice

Load `dist/extensions/code.min.js` after the core. Register once, then opt in per editor:

```javascript
Markian.registerExtension('code', MarkianCode.codeExtension);
const editor = Markian.create(host, {
  markdown: '```text\nhello\n```',
  extensions: { code: { enabled: true } },
});
```

Place the caret inside a code block and use Expand in the floating toolbar. It is not a pinned or overflow toolbar item. The draft has local undo/redo; Back commits once. Help suspends the task without losing draft/history. The public `createSourceEditor` handle reuses core CodeMirror; the extension ships no duplicate engine or language parsers. This is W1's proof slice, not the complete W14 extension.

Different host replacements during a block session or dirty raw draft require `pending: 'commit'`, `'discard'`, or `'reject'`. Identical host echoes do not need a policy. Unlock a modified read-only block session before applying it with Back, or explicitly discard it through host replacement. Hidden source handles and suspended block sessions cannot mutate through public editing operations. Block targets currently support top-level code fences only.

## Editing And Host Callbacks

Controls include H1-H6, word-at-caret inline formatting, lists/tasks, indentation, rules, quotes/GitHub alerts, clear formatting, links/images, and GFM tables. Table controls cover insertion, row/column deletion, header promotion, column alignment, and Tab navigation; merged cells and external spreadsheet paste are not supported. Source controls operate on literal Markdown; rich cell operations and visual clear-formatting are not raw-source commands.

`toolbar` is an ordered layout of registered toolbar IDs, command IDs, or inline `ToolbarItem` objects. Existing string arrays remain supported, now in the supplied order. `menu` accepts the same entries recursively, so any available command can be placed in any group. Objects have a unique `id`, optional `label`/`icon`, and either a `command`, a `menu`, `separator: true`, or `overflow: true`. An overflow boundary keeps every following item pinned; `fixed: true` also pins an individual item. Without a boundary, More is inserted before Maximize/Search, which remain fixed. Unknown commands, recursive menus, and malformed layouts are rejected.

```javascript
const editor = Markian.create(host, {
  markdown: '',
  toolbar: [
    'undo', 'redo',
    { id: 'divider', separator: true },
    { id: 'format', label: 'Formatting', icon: 'bold', menu: [
      'bold', 'italic', 'strike',
      { id: 'insert', label: 'Insert', icon: 'image', menu: ['image', 'link'] },
    ] },
    { id: 'more', overflow: true }, 'fullscreen', 'search',
  ],
});
```

The [default layout](src/ui/toolbar.ts) groups headings, inline formatting, lists, and Visual/Source/Preview modes. The outline uses a right-sidebar icon; table actions use distinct row/column insertion/deletion icons. With the default layout, extra registry toolbar contributions are included before More. Explicit layouts place those contributions by ID. `floatingToolbar` independently selects command IDs; an empty pinned list enables a floating-only layout. `toolbarPlacement: 'bottom'` overrides desktop placement; compact containers use bottom controls by default. Table caret/touch controls share registered commands, while code expansion is code-caret-contextual. Custom commands can use `views: ['*']`, `enabled(instance)`, and `active(instance)`.

Menus and transient panels use the native Popover API in supported modern browsers. Submenus are separate flyouts, flip left when needed, and clamp to the viewport without creating nested scrollbars. Right/Left opens/closes nested menus; Home/End stays within the current menu. Link, Image/file, and Search panels point to their visible toolbar button with a speech-bubble tip. Commands invoked from More point to More after it closes; bottom toolbars open panels upward. Providers, focus, permission checks, and outside dismissal remain instance-local.

Search uses the toolbar or focus-bound Ctrl/Cmd+F/H. Queries are literal and limited to 1,000 characters. Visual replacements inherit formatting at the match start; replace-all is one undo step and opaque content is excluded. Outlines share Preview's parsed ATX/Setext anchors, omit a title starting on line 1, and navigate the active scroller.

Provider options are trusted functions, never strings or endpoint configuration:

| Option | Result |
| --- | --- |
| `onLinkSuggest` / `onImageSuggest` | `{ label, destination }[]`, locally or through a promise; at most 100 displayed results. |
| `onLinkInspect` | `{ status: 'exists' / 'missing' / 'unknown', headings?: [{ id, label }] }`; at most 500 headings. |
| `onLinkOpen` | Host navigation using the original destination. Ctrl/Cmd-click opens in visual editing; Preview/read-only links and Open link provide nonmodifier/touch access. |
| `onImageInsert` | `{ destination, alt? }`, locally or through a promise, after host-owned file creation succeeds. Callback results must not be data/blob URLs. |

Each provider receives `{ instance, query, documentBase, revision, signal }`; inspection/opening also receive `destination`, insertion receives `blob`. `documentBase` resolves displayed images and default navigation without rewriting stored relative URLs. Arbitrary authenticated resource resolution remains host integration work. Debounced queries and insertion results are checked against revision, view, permissions, cancellation, and lifetime. Hosts own transport, authorization, and actual request cancellation.

Paste, drop, file selection, and `insertImage()` accept PNG/JPEG/GIF/WebP blobs up to 1 MB, one current-document insertion at a time. Without a callback they become raster data URIs. With a callback there is no binary fallback: loading, cancellation, retry, and explicit removal stay outside persisted Markdown. Programmatic host saves must await the gate before reading the value:

```javascript
await editor.whenIdle();
const markdown = editor.get();
```

The host must also serialize or recheck edits during its own asynchronous storage operation. Markian implements no storage transaction.

`onFullscreenEnter({ instance, element, signal })` optionally replaces the built-in viewport overlay. Return a restore function or a promise of one. Restoration runs once on exit/destruction, including late cancelled entry. A rejecting callback must undo its own partial changes. Parent-iframe expansion requires a host bridge.

Colors are opt-in through `allowTextColors: true` and an optional `textColors` palette of 5-10 distinct six-digit hex values. They serialize as bounded `<span style="color:#rrggbb">` HTML; GitHub may strip the color. Portable mode provides no color controls or color-fidelity promise. This is not a general allowed-HTML/stencil implementation.

## Content Policy And Limits

- CommonMark/GFM parsing, tables, tasks, strikethrough, and autolinks use established remark/Milkdown foundations. Visual import compares semantic parse trees before accepting content. Meaningful breaks, ordered-list starts, comments, and fence contents are part of that comparison.
- Original source remains byte-for-byte unchanged until an actual edit. Visual edits can normalize Markdown syntax. Raw mode retains exact text, including incomplete syntax.
- Unknown HTML comments are invisible in visual mode and retained in Markdown. Other HTML is inert source in the visual engine and omitted from sanitized Preview. Rich allowed-HTML mapping is unfinished.
- Front matter and constructs that fail the visual fidelity check remain editable in raw mode. Reference-link documents may conservatively fall back to source because visual serialization resolves references. No unsupported document is silently overwritten by the fallback.
- Preview uses a rendering-only sanitization pipeline. Unsafe schemes, protocol-relative URLs, SVG data URIs, and backslash destinations are rejected for visual import; source remains available. Relative destinations are not rewritten.
- Document import is bounded to 1,000,000 characters; raster data-URI URL validation is bounded to 2,000,000 characters. These are initial safeguards, not measured performance budgets or the full W9 limits.
- Output targets modern ES2022 browsers. Automated checks currently exercise Chromium on Windows, not Safari/Firefox, real mobile devices, or complete accessibility/CSP conformance.

No Mermaid renderer, programming-language pack, repository service, upload transport, or host integration is included. Templates/mentions, general allowed HTML, rich external paste, and the standalone viewer remain later work. Real-device/IME and screen-reader acceptance, full raw command parity, and Codiware's actual image-file/reopen workflow remain unverified. Do not use this slice to migrate production documents yet.

## Build And Package Checks

```powershell
npm run verify
npm run hooks:install
```

`verify` runs unit tests, strict type checking, import boundaries, clean deterministic IIFE builds, declarations/notices/manifest, browser tests against `dist`, and an actual npm archive install/browser startup with lifecycle scripts disabled. Source maps are deliberately not published. Only small public type dependencies are installed by npm consumers; Milkdown/CodeMirror and build tooling are development dependencies.

The opt-in commit hook builds even on documentation-only commits. It refuses unstaged/partially staged build inputs and asks for review/staging of changed distribution files; it stages nothing. CI rebuilds on Windows/Linux and checks tracked, deleted, and untracked distribution output. Repository administrators still need to configure required branch checks; this checkout cannot establish branch protection or certify intermediate commits automatically.

Direct Composer metadata uses `axenox/markian`; npm metadata uses `markian`. Publication rights, tagged Composer installation, npm publication, and Asset Packagist discovery/install remain unverified. No credentials or publishing operations are part of this change.

See the [architecture](Docs/Architecture.md), [style guide](Docs/Styleguide.md), and [work-package status](Docs/Requirements/Plan.md) for boundaries and remaining acceptance gates.