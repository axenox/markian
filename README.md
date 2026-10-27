# Markian

A framework-independent Markdown editor. This checkout contains a fresh, testable W0-W3 implementation slice, not a stable release or completion of all four work packages. The former demonstration and its tests are archived under [Prototype](Prototype/README.md); no library build imports them.

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
| `on(name, handler)` | Returns unsubscribe. Names: change, ready, mode, focus, blur, error, save-request. Events include instance, origin, revision, view. |
| `focus()` / `resize()` / `destroy()` | Active-view focus/measurement and idempotent host restoration. |

Textarea hosts retain their name/form association. Values track active drafts synchronously; native form reset loads `defaultValue` and resets history. Disabled editing does not change native textarea disabled/submission semantics.

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

Place the caret inside a code block and use Expand. The draft has local undo/redo; Back commits once. Help suspends the task without losing draft/history. The public `createSourceEditor` handle reuses core CodeMirror; the extension ships no duplicate engine or language parsers. This is W1's proof slice, not the complete W14 extension.

Different host replacements during a block session require `pending: 'commit'`, `'discard'`, or `'reject'`. Identical host echoes do not need a policy. Unlock a modified read-only block session before applying it with Back, or explicitly discard it through host replacement.

## Content Policy And Limits

- CommonMark/GFM parsing, tables, tasks, strikethrough, and autolinks use established remark/Milkdown foundations. Visual import compares semantic parse trees before accepting content. Meaningful breaks, ordered-list starts, comments, and fence contents are part of that comparison.
- Original source remains byte-for-byte unchanged until an actual edit. Visual edits can normalize Markdown syntax. Raw mode retains exact text, including incomplete syntax.
- Unknown HTML comments are invisible in visual mode and retained in Markdown. Other HTML is inert source in the visual engine and omitted from sanitized Preview. Rich allowed-HTML mapping is unfinished.
- Front matter and constructs that fail the visual fidelity check remain editable in raw mode. Reference-link documents may conservatively fall back to source because visual serialization resolves references. No unsupported document is silently overwritten by the fallback.
- Preview uses a rendering-only sanitization pipeline. Unsafe schemes, protocol-relative URLs, SVG data URIs, and backslash destinations are rejected for visual import; source remains available. Relative destinations are not rewritten.
- Document import is bounded to 1,000,000 characters; raster data-URI URL validation is bounded to 2,000,000 characters. These are initial safeguards, not measured performance budgets or the full W9 limits.
- Output targets modern ES2022 browsers. Automated checks currently exercise Chromium on Windows, not Safari/Firefox, real mobile devices, or complete accessibility/CSP conformance.

No Mermaid renderer, programming-language pack, provider, upload transport, or host integration is included. Search, floating/configurable toolbars, complete table controls, link/image dialogs, mentions, and the standalone viewer remain later work. Do not use this slice to migrate production documents yet.

## Build And Package Checks

```powershell
npm run verify
npm run hooks:install
```

`verify` runs unit tests, strict type checking, import boundaries, clean deterministic IIFE builds, declarations/notices/manifest, browser tests against `dist`, and an actual npm archive install/browser startup with lifecycle scripts disabled. Source maps are deliberately not published. Only small public type dependencies are installed by npm consumers; Milkdown/CodeMirror and build tooling are development dependencies.

The opt-in commit hook builds even on documentation-only commits. It refuses unstaged/partially staged build inputs and asks for review/staging of changed distribution files; it stages nothing. CI rebuilds on Windows/Linux and checks tracked, deleted, and untracked distribution output. Repository administrators still need to configure required branch checks; this checkout cannot establish branch protection or certify intermediate commits automatically.

Direct Composer metadata uses `axenox/markian`; npm metadata uses `markian`. Publication rights, tagged Composer installation, npm publication, and Asset Packagist discovery/install remain unverified. No credentials or publishing operations are part of this change.

See the [architecture](Docs/Architecture.md), [style guide](Docs/Styleguide.md), and [work-package status](Docs/Requirements/Plan.md) for boundaries and remaining acceptance gates.