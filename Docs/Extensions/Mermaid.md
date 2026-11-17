# Mermaid Diagrams

The optional Mermaid extension renders ordinary `mermaid` fenced blocks and provides a source/preview workspace. The host supplies Pele to render Mermaid syntax; Pele is not bundled with Markian. A separate viewer adapter renders diagrams without loading the editor.

See [editor configuration](../Configuration.md#mermaid) and [viewer adapter configuration](../Configuration.md#viewer-mermaid-adapter) for all options and defaults. Contributors should use the separate [implementation guide](../Development/Extensions/Mermaid_extension.md).

## Editor Setup

Load the extension script and CSS after core, then register and enable its factory:

```html
<link rel="stylesheet" href="dist/markian.css">
<link rel="stylesheet" href="dist/extensions/mermaid.css">
<div id="diagrams" style="height: 560px"></div>
<script src="dist/markian.min.js"></script>
<script src="dist/extensions/mermaid.min.js"></script>
<script>
  Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
  const diagrams = Markian.create(document.querySelector('#diagrams'), {
    markdown: '```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```',
    extensions: { mermaid: { enabled: true, config: {
      source: '/assets/pele.global.js',
    } } },
  });
</script>
```

The host must serve a trusted Pele global runtime at the configured URL. The loader requires `window.pele.render`; Mermaid.js is not supported by this loader. There is no guessed CDN or sibling-framework path. Registration alone does not activate the extension or load its renderer.

Pele can be supplied separately through `npm-asset/pele` on PHP hosts. Consumers can use prebuilt assets without Node.js or a build step. See the [runnable example](../../Examples/mermaid-diagrams.html) and its [host asset requirements](../Examples.md).

## Editing Diagrams

Use Insert diagram to add a simple flowchart, or Edit diagram on an existing rendered block to open the workspace. It has a left snippet sidebar, source editor and live preview. Source and preview use equal constrained columns when space permits; narrow hosts stack them beside the sidebar. Each surface scrolls independently.

The workspace provides local Undo/Redo, indentation, search and Back. Tab inserts indentation; Shift+Tab outdents. Press Escape then Tab to leave source Tab handling. Help suspends the workspace without losing its draft, selection or history.

Source and sidebar fragments have syntax colors for declarations, keywords, connections, labels, strings, comments, numbers and hex colors. Highlighting works without the Code extension and even when diagram rendering is unavailable. It is lexical help, not syntax validation or complete coverage of every Mermaid feature. Incomplete drafts remain editable and saveable. Colors follow the editor's light/dark theme without changing source, selection or history.

Workspace highlighting uses the configured character and line limits. Oversized source stays editable with a highlighting diagnostic; shortening it restores colors. Rendering failures do not disable highlighting.

Back applies the draft as one parent-document undo step; unchanged Back adds no edit. There are no separate Apply/Cancel buttons. The editor's `get()` and textarea value include pending diagram source before Back, including while Help is visible. See the shared [block-session contract](../API.md#views-and-block-sessions) for host replacement and conflict policies.

Diagrams remain ordinary `mermaid` fences. Invalid syntax can still be saved as source; rendered HTML/SVG never becomes the saved value. Nested diagrams render, but block-edit sessions currently target only top-level fences.

Backspace/Delete at an adjacent visual paragraph boundary removes a rendered diagram as one object instead of merging text into its hidden source. Undo restores it. Ordinary unrendered fences retain regular code editing.

### Diagram Templates

The Diagram type toolbar menu replaces the current block source with a simple template:

| Choice | Template |
| --- | --- |
| Class | Classes, members and inheritance. |
| Flowchart | Shapes, a decision and labeled arrows. |
| Sequence | Participants, a request and a response. |
| State | States, transitions, start and finish. |
| Use case | A portable flowchart with an actor, oval use case and system boundary. |
| ERD | Entities, attributes, keys and a relationship. |
| Git graph | Commits, a feature branch and a merge. |

Choosing a template replaces even an existing diagram. Undo restores the previous source in one step. Use case is not native UML syntax: its ordinary `%% Markian use case` comment selects the matching sidebar. Removing that comment shows flowchart snippets instead.

### Snippet Sidebar

The sidebar follows the source declaration, including manual type changes and undo/redo. Choose a fragment to insert it at the cursor or replace selected text. Insertion is one local undo step.

Names, labels and hex colors are examples: edit them directly in source and add line breaks where needed. Fragments are not a visual diagram builder or syntax-aware completion. Each type offers supported shapes/entities, connections and notes/comments. Color fragments appear where supported; Git graph offers commits, branches, tags and comments instead of unsupported shape/color controls. Unknown or unfinished declarations retain all source and offer comments only.

Snippet buttons show a short label and a wrapped, syntax-colored monospaced fragment. The fragment uses the regular inline-code background, fitted to the code rather than the whole button. Thin horizontal lines separate section headings; sections are not boxed panels.

### Preview Controls and Permissions

Drag with a pointer or touch to pan. A focused preview supports:

| Input | Action |
| --- | --- |
| Arrow keys | Pan. |
| Plus/minus | Zoom. |
| Home | Reset. |
| Ctrl/Cmd-wheel | Zoom. |

Labeled floating buttons provide zoom, reset and retry. They appear at the top right on hover/focus without reserving a fixed strip; touch and error states keep them visible. Narrow control strips scroll horizontally.

Pan, zoom and reset change only presentation, not Markdown. Read-only/disabled editors retain inspection controls, selection, copying and search, but block typing, snippets, template replacement, indentation, history edits and diagram removal. Permission changes retain pending drafts and history.

## Appearance and Rendering Failures

Diagram labels are centered. Loading and errors stay outside the pannable surface and never replace source. The previous diagram remains visible during refresh until a new result or an error is available, avoiding layout collapse. Transient loading messages are hidden while focus is inside the owning editor; failures remain visible. Missing configuration or a failed render shows an error with Retry while retaining editable source.

Pele uses its own fonts and layout rather than Mermaid.js geometry or themes. Diagram colors follow the owning Markian instance, so light/dark themes remain independent and custom colors remain intact. Default shapes use the gray code surface and muted-text borders. Sequence, flowchart and state notes use pale-yellow folded paper, with subdued amber in dark mode. Viewer diagrams fit the host with a responsive maximum and have no editing or pan/zoom toolbar.

## Public Helpers and Host Renderers

These helpers come from optional scripts, not core:

| Helper | Arguments | Return |
| --- | --- | --- |
| `MarkianMermaid.mermaidExtension` | Register this `ExtensionFactory` with `Markian.registerExtension`. | A new extension for each enabled editor. |
| `MarkianMermaid.loadMermaid` | `document: Document, source: string` | `Promise<MermaidRenderer>` |
| `MarkianViewerMermaid.createRenderer` | `document: Document, options: ViewerMermaidOptions` | `(context: ViewerRendererContext) => Promise<string>` |

`loadMermaid` loads the trusted Pele global script URL, checks `pele.render()` and returns a `{ render }` adapter. Compatible loads are deduplicated and retained after instances are destroyed. Editor and viewer bundles have separate loader caches; supply a common host renderer to share a runtime.

Instead of a URL, supply `config.renderer: { render }`. Its `render({ source, id, theme, signal })` returns SVG text or a promise. A raw Pele object is not this adapter contract. Host adapters must isolate settings and DOM ownership, emit SVG text labels, bound layout work, use the supplied unique `id` and never bind source-defined callbacks. Markian does not reconfigure a supplied host renderer.

## Viewer Setup

Load viewer core JS/CSS and the render-only adapter, not the editor extension:

```html
<link rel="stylesheet" href="dist/markian-viewer.css">
<link rel="stylesheet" href="dist/extensions/viewer-mermaid.css">
<article id="viewer"></article>
<script src="dist/markian-viewer.min.js"></script>
<script src="dist/extensions/viewer-mermaid.min.js"></script>
<script>
  const renderer = MarkianViewerMermaid.createRenderer(document, {
    source: '/assets/pele.global.js',
  });
  const viewer = MarkianViewer.create(document.querySelector('#viewer'), {
    markdown: '```mermaid\nflowchart LR\n  A --> B\n```',
    mermaid: true,
    renderers: { mermaid: renderer },
  });
</script>
```

Viewer Mermaid defaults to false. Even a registered renderer is not called without `mermaid: true`; enabling with no matching fence loads nothing. The adapter requires an explicit source URL or supported host renderer. Its runtime checks, bounds and isolation policy match editor Mermaid, but it supplies no editing or pan/zoom UI.

## Limits and Safety

Rendering defaults to 20,000 characters and 500 lines. Settings can lower but not raise these limits. Configuration directives, front matter and executable links are refused for rendering. SVG output is bounded and sanitized. Unlike other optional rendered content, Mermaid retains its original SVG IDs, style tags and inline CSS.

Pele does not support arbitrary HTML labels or JavaScript click callbacks. Load only trusted scripts: the retained runtime iframe is not a sandbox for untrusted scripts. Supplied adapters are trusted integration code; preserving their CSS is not a CSS sandbox. A host-supplied adapter is an alternative for CSP-controlled environments, but full CSP, screen-reader, real-device and cross-browser acceptance remain unverified. See the [developer safety boundary](../Development/Extensions/Mermaid_extension.md#svg-styling-and-safety) for implementation details.
