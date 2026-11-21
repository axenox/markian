# Extensibility

Start with configuration, then add a host callback or a public API contribution. Package repeated contributions as an extension. Applications and extensions use the same API; neither should edit engine DOM or private state.

See [configuration](Configuration.md) for options, [API](API.md) for core signatures, the [extension guides](Extensions/index.md) for extension usage and helpers, and [writing extensions](Development/Writing_extensions.md) for contributor guidance.

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

Extensions share the editor's [translation API](API.md#translations). Third-party extensions supply English defaults in a unique namespace and ship flat JSON files that hosts list in [translation configuration](Configuration.md#translations). See [writing translatable extensions](Development/Writing_extensions.md#translations).

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

See the [Code guide](Extensions/Code.md) for setup, expanded editing, language choices, XML highlighting and public helpers. Options and defaults remain in [Configuration](Configuration.md#code).

### Mermaid

See the [Mermaid guide](Extensions/Mermaid.md) for setup, diagram editing, templates, snippets, public helpers and limitations. Options and defaults remain in [Configuration](Configuration.md#mermaid).

## Views, Renderers, and Schema

Use registries to add commands, toolbar items, views, fence renderers, help sections, and construction-time structural node mappings. Contributions return removal functions. Registries do not expose engine objects or an unrestricted HTML grammar.

A custom view receives an owned mount element, abort signal, and optional block session. It returns cleanup and may expose focus, resize, and read-only hooks. Use `createSourceEditor` to share core CodeMirror instead of loading another editor. Help and other views must not mutate suspended sessions. Large tasks belong in the work area, not large dialogs.

Editor renderer definitions select a fence language. `visual: true` explicitly opts into visual code-block presentation; omitted means Preview-only rendering. Renderer code is trusted and owns the DOM it produces: use text content or sanitize untrusted output. The public renderer registry is not an automatic sanitizer for arbitrary extension DOM.

Schema mappings must register during extension initialization, before engine construction. The current bridge supports atomic nodes over existing mdast types. Arbitrary Markdown grammars, nested structural serialization, and general HTML mappings are not complete public contracts. See the [extension guide](Development/Writing_extensions.md).

## Viewer Renderers

The viewer is separate from editor extensions. Supply `renderers: { language: callback }` in viewer options. A callback receives source, language, theme, full Markdown, revision, document base, and abort signal; it returns HTML/SVG text or a promise.

Viewer output is limited to 2,000,000 characters, sanitized, stripped of active controls and direct external resource references, and given scoped SVG IDs. Extension-specific rendering policies are documented in the [extension guides](Extensions/index.md). Failure leaves plain code and reports through `onError`. Stale results cannot replace a newer document. Load any trusted highlighting CSS yourself; no language pack loads implicitly.

### Viewer Mermaid

See [Mermaid viewer setup](Extensions/Mermaid.md#viewer-setup) and [viewer adapter defaults](Configuration.md#viewer-mermaid-adapter).

## Planned Customization

Templates, selection stencils, mention/tag rules, general allowed HTML, and generated-region providers are approved topics in the [plan](Requirements/Plan.md), not current editor options. The planned `docsPlaceholders` extension belongs to ExFace/Power UI Core, not Markian. Do not configure invented callbacks or asset methods such as `onPlaceholderRegenerate`, `getScripts`, or `getHelpForHotkeys` as if they were current API.