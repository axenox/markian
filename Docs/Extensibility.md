# Extensibility

Start with configuration, then add a host callback or a public API contribution. Package repeated contributions as an extension. Applications and extensions use the same API; neither should edit engine DOM or private state.

See [configuration](Configuration.md) for options, [API](API.md) for signatures, and [writing extensions](Development/Writing_extensions.md) for contributor guidance.

## Toolbar and Commands

Configure the pinned toolbar and prose-selection toolbar independently. Both reference registered command IDs. Hiding a command is not an authorization boundary: use read-only/disabled state and enforce permissions in host services.

After readiness, register a command and place it in a toolbar group:

```javascript
await editor.ready;
const removeCommand = editor.getCommands().insert({
  id: 'review:example',
  label: 'Insert example block',
  icon: 'codeblock',
  views: ['visual'],
  mutates: true,
  run: instance => instance.insertCodeBlock('Example pending', 'text'),
});
const removeButton = editor.getToolbar().insert(
  { id: 'review:example' }, 'insert', 'rule'
);
```

Use stable prefixed IDs and only supported views. `mutates: true` lets Markian block the command in read-only state. Command code must use public operations with their own permission and history checks. Arbitrary selection insertion is not currently a public helper; do not imitate it by replacing the whole document for every keystroke.

The toolbar insertion signature is `insert(item, group?, beforeId?)`. Other registries use `insert(item, beforeId?)`. Placement is group-local; omitted ordering appends. Existing configured ID references keep their placement. Missing groups are not created. To remove the example, call `removeButton()` before `removeCommand()`.

## Host Callbacks

Callbacks are flat JavaScript options, not a nested callbacks object or strings evaluated from configuration. Local data requires no network service:

```javascript
const pages = [
  { label: 'Guide', destination: 'guide.md' },
  { label: 'Reference', destination: 'reference.md' },
];
const editor = Markian.create(host, {
  markdown: '# Notes',
  onLinkSuggest: ({ query }) => pages.filter(page =>
    page.label.toLowerCase().includes(query.toLowerCase())
  ),
  onLinkInspect: ({ destination }) => ({
    status: pages.some(page => page.destination === destination) ? 'exists' : 'unknown',
  }),
});
```

| Callback | Purpose |
| --- | --- |
| `onFullscreenEnter` | Replace built-in maximize behavior and return a restore function. |
| `onImageInsert` | Persist a raster blob and return `{ destination, alt? }`. |
| `onImageSuggest` | Return image destinations. |
| `onLinkInspect` | Return existence status and optional heading targets. |
| `onLinkOpen` | Navigate through the host application using the original destination. |
| `onLinkSuggest` | Return link destinations. |

Callbacks may return values or promises as specified in the [configuration reference](Configuration.md#host-callback-values). Forward abort signals when possible and enforce authorization in host services. Markian rejects obsolete results even if cancellation is ignored.

For file-backed images, report success only after the file exists. There is no data-URI fallback when a custom insertion callback fails. Keep temporary upload state outside saved Markdown. Await `editor.whenIdle()` before reading the value for a host save.

Fullscreen callbacks return the paired restore operation. Markian calls it once on exit or destruction, including entry that finishes after cancellation. A failing host callback must undo its own partial changes.

## Editor Extensions

Load an extension's script explicitly, register its factory once, then enable it per editor. Loading or registration alone does not activate a feature. Enabled unknown IDs fail configuration; omitted/disabled entries contribute nothing.

```javascript
Markian.registerExtension('code', MarkianCode.codeExtension);
const editor = Markian.create(host, {
  markdown: '```text\nhello\n```',
  extensions: { code: { enabled: true } },
});
```

Extension settings belong in their `config`, not in an asset `source` option. There is no public runtime enable/disable API. External extensions ship in their owning package and follow the same public contract; Markian does not need to bundle them.

### Code

Load `dist/extensions/code.min.js` after core. The `MarkianCode.codeExtension` factory adds Expand code block to the code-caret floating toolbar and opens a dedicated CodeMirror view. Back commits a changed draft once; unchanged Back adds no history step. Help suspends the workspace without losing its draft or history.

The extension reuses core CodeMirror. It has no configuration options, language packs, language selector, or separate stylesheet. Current block sessions target top-level fences. Enhanced highlighting remains planned rather than implied by this slice.

### Mermaid

Load the factory and CSS after core, then register and enable it:

```html
<link rel="stylesheet" href="dist/extensions/mermaid.css">
<script src="dist/extensions/mermaid.min.js"></script>
<script>
  Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
  const diagrams = Markian.create(document.querySelector('#diagrams'), {
    markdown: '```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```',
    extensions: { mermaid: { enabled: true, config: {
      asset: { url: '/assets/mermaid.min.js', version: '12.2.0' },
    } } },
  });
</script>
```

The example assumes a `#diagrams` host, core assets, and a trusted host runtime at the configured URL. Mermaid is not included in Markian's distribution. The loader runs supported Mermaid **12.2.x** in a configuration-isolated iframe and loads it only when needed. Missing configuration or a failed render shows an error without losing source; Retry remains available.

Alternatively supply `config.renderer: { version, render }`. `render({ source, id, theme, signal })` returns SVG text or a promise. A raw Mermaid object is not this adapter contract. Host adapters must isolate theme/security settings and DOM ownership, emit SVG text labels (`htmlLabels: false`), bound layout work, and never bind source-defined callbacks. Markian does not reconfigure a supplied host renderer.

`MarkianMermaid.loadMermaid(document, { url, version })` returns the same adapter contract. Compatible loads are deduplicated and retained after instances are destroyed. The iframe is not a sandbox for untrusted scripts; use trusted URLs only. A host-supplied adapter is the alternative for CSP-controlled environments; full CSP acceptance remains unverified.

The extension adds Insert diagram, inline diagram presentation, and a source/preview workspace with local undo/redo, indentation, search, and Back. `get()` includes pending diagram edits. Invalid syntax remains saveable as a fence. Nested diagrams render, but block-edit sessions currently target only top-level fences.

Rendering defaults to 20,000 characters and 500 lines. Settings can lower but not raise these limits. Configuration directives, front matter, and executable links are refused for rendering. SVG output is bounded, sanitized, and assigned unique IDs. Renderer CSS and external resources are removed; the extension stylesheet supplies safe theme colors. Pan, zoom, reset, and read-only inspection do not change Markdown.

See [Mermaid configuration](Configuration.md#mermaid) and the [runnable example](Examples.md).

## Views, Renderers, and Schema

Use registries to add commands, toolbar items, views, fence renderers, help sections, and construction-time structural node mappings. Contributions return removal functions. Registries do not expose engine objects or an unrestricted HTML grammar.

A custom view receives an owned mount element, abort signal, and optional block session. It returns cleanup and may expose focus, resize, and read-only hooks. Use `createSourceEditor` to share core CodeMirror instead of loading another editor. Help and other views must not mutate suspended sessions. Large tasks belong in the work area, not large dialogs.

Editor renderer definitions select a fence language. `visual: true` explicitly opts into visual code-block presentation; omitted means Preview-only rendering. Renderer code is trusted and owns the DOM it produces: use text content or sanitize untrusted output. The public renderer registry is not an automatic sanitizer for arbitrary extension DOM.

Schema mappings must register during extension initialization, before engine construction. The current bridge supports atomic nodes over existing mdast types. Arbitrary Markdown grammars, nested structural serialization, and general HTML mappings are not complete public contracts. See the [extension guide](Development/Writing_extensions.md).

## Viewer Renderers

The viewer is separate from editor extensions. Supply `renderers: { language: callback }` in viewer options. A callback receives source, language, theme, full Markdown, revision, document base, and abort signal; it returns HTML/SVG text or a promise.

Viewer output is limited to 2,000,000 characters, sanitized, stripped of active controls and external resource references, and given scoped SVG IDs. Failure leaves plain code and reports through `onError`. Stale results cannot replace a newer document. Load any trusted highlighting CSS yourself; no language pack loads implicitly.

### Viewer Mermaid

Load viewer core JS/CSS and the render-only adapter JS/CSS, not the editor extension:

```html
<link rel="stylesheet" href="dist/markian-viewer.css">
<link rel="stylesheet" href="dist/extensions/viewer-mermaid.css">
<article id="viewer"></article>
<script src="dist/markian-viewer.min.js"></script>
<script src="dist/extensions/viewer-mermaid.min.js"></script>
<script>
  const renderer = MarkianViewerMermaid.createRenderer(document, {
    asset: { url: '/assets/mermaid.min.js', version: '12.2.0' },
  });
  const viewer = MarkianViewer.create(document.querySelector('#viewer'), {
    markdown: '```mermaid\nflowchart LR\n  A --> B\n```',
    mermaid: true,
    renderers: { mermaid: renderer },
  });
</script>
```

Mermaid defaults to false. Even a registered renderer is not called without `mermaid: true`; enabling with no matching fence loads nothing. The adapter requires an explicit runtime asset or supported host renderer. Its version, bounds, and isolation policy match editor Mermaid, but it supplies no editing or pan/zoom UI. Editor and viewer bundles have separate loader caches; supply a common host renderer to share a runtime.

See [viewer-Mermaid defaults](Configuration.md#viewer-mermaid-adapter).

## Planned Customization

Templates, selection stencils, mention/tag rules, general allowed HTML, and generated-region providers are approved topics in the [plan](Requirements/Plan.md), not current editor options. The planned `docsPlaceholders` extension belongs to ExFace/Power UI Core, not Markian. Do not configure invented callbacks or asset methods such as `onPlaceholderRegenerate`, `getScripts`, or `getHelpForHotkeys` as if they were current API.