# Mermaid Extension

This contributor guide covers runtime loading, source ownership, workspace styling and SVG safety in the editor extension and viewer adapter. User-facing setup, behavior and public helpers live in the [Mermaid usage guide](../../Extensions/Mermaid.md); all options and defaults remain in [Configuration](../../Configuration.md#mermaid).

## Runtime Loading

Pele is host-supplied through a `source` URL pointing to `pele.global.js` or a `{ render }` adapter. The loader requires `window.pele.render` and validates its SVG result. Mermaid.js is no longer supported by the source loader. There is no guessed CDN or sibling-framework path. The former `asset` object is rejected, not translated. Fence, extension and adapter names remain `mermaid`.

Loads of the same resolved URL are shared within a bundle; editor and viewer bundles have independent caches. A common host renderer can share one runtime across both. The loader keeps the runtime global in a retained iframe, not an untrusted-script sandbox: load only trusted scripts. Pele renders synchronously with per-call options; no global configuration or render queue is needed. It receives a unique ID prefix, a 20,000-character source limit, a 2,000,000-character output limit and a 500-edge limit. Links, images and automatic direction switching are disabled. Existing cancellation and stale-result checks remain in the editor/viewer.

The shared loader and renderer contract live in [mermaid-runtime.ts](../../../src/mermaid-runtime.ts). The [editor extension](../../../src/extensions/mermaid.ts) owns diagram controls and block editing; the [viewer adapter](../../../src/viewer-mermaid.ts) only renders diagrams.

## Workspace Snippets and Templates

[mermaid-snippets.ts](../../../src/extensions/mermaid-snippets.ts) owns ordinary source templates, grouped literal fragments and declaration detection. The extension mounts an instance-owned sidebar, updates it on draft events and disposes that subscription with the view. Unknown declarations use only generic comments. A normal comment distinguishes the flowchart-based use-case template; it is not removed from saved Markdown.

Template and snippet commands use core `SourceHandle.select` and `replaceSelection`, so CodeMirror remains authoritative for selection and local history. Commands are restricted to the active editable Mermaid view. The read-only hook disables sidebar buttons as well as source editing; the command dispatcher also guards mutations. See [workspace usage](../../Extensions/Mermaid.md#editing-diagrams) for replacement and fragment limits.

## Syntax Highlighting

[mermaid-language.ts](../../../src/extensions/mermaid-language.ts) defines a small lexical Highlight.js grammar, bundled with the extension. It reuses [code-language.ts](../../../src/extensions/code-language.ts) to produce source-offset tokens; it does not import the Code extension runtime or load a separate language asset. The grammar covers the supported templates and common standalone fragments, not semantic parsing.

The source handle applies tokens as CodeMirror decorations. Refreshes are debounced and use the current source, not a captured older draft. Workspace teardown clears the pending timer before destroying its source handle. Character/line bounds share the Mermaid configuration; failures clear decorations and show a source-side diagnostic without replacing text. Highlighting is synchronous after the debounce, so no outstanding provider results can outlive a revision or disposal.

Sidebar fragments use the same grammar and the shared [literal token renderer](../../../src/extensions/highlight-tokens.ts), which builds text nodes and static spans rather than inserting highlighted HTML. [syntax.css](../../../src/extensions/syntax.css) supplies the same light/dark token palette used by Code. Include it through Mermaid CSS so Code assets are not required. The render-only viewer adapter remains independent of Highlight.js.

## Workspace Layout and Styling

The extension owns [mermaid.css](../../../src/extensions/mermaid.css), distributed as `dist/extensions/mermaid.css`. Keep its layout values here rather than in the core visual-editor guide.

| Surface | Dimension or rule |
| --- | --- |
| Workspace above 600px container width | `.markian-mermaid` uses a 180px snippet sidebar followed by equal constrained source and preview columns. |
| Workspace at 600px or less | A 132px sidebar spans both rows; source and preview stack beside it with minimum row heights of 120px and 160px. |
| Snippet sidebar | 12px vertical/8px horizontal padding; independent vertical scrolling. |
| Section headings | 1px top border using `--markian-line`, 12px top padding and 16px top margin. |
| Snippet buttons | Shared `.markian-button` controls that grow to their content, with 8px vertical/4px horizontal padding and 12px labels. |
| Code fragments | 11px monospace at 1.5 line height; wrap within the button. Use `--markian-code` and `--markian-text`, with the background fitted to the fragment. |
| Highlighting diagnostic | Outside the source scroller, with 8px vertical/12px horizontal padding and 12px text; no space when empty. |

Use the shared toolbar menu for Diagram type and shared `.markian-floating`/`.markian-button` controls for preview actions. Preview controls overlay the top right without reserving a fixed strip and scroll horizontally when needed. Hover/focus reveals them; touch and error states keep them visible. Avoid extra card wrappers around diagrams or boxed snippet sections.

Keep loading/errors outside the pannable surface. Retain the previous SVG while rendering; replace it only when the current request succeeds or fails. Transient loading messages must not reflow the document and are hidden while the owning editor has focus. Failures remain visible. Rendering, controls, draft subscriptions and cancellation remain instance-local and must be released with their owning view or preview.

## SVG Styling and Safety

The loader returns Pele SVG without rebuilding its nodes. Editor and viewer preserve inline styles, data attributes and unique IDs. Active SVG content and direct external SVG references are still removed. Shared diagram CSS maps Pele variables to each instance's Markian theme; custom diagram colors remain intact.

Default shape fills use the code surface and borders use muted text. Sequence, flowchart and state notes use pale-yellow folded paper, with subdued amber in dark mode. The Pele source loader adds missing note folds without changing note bounds or text positions. Explicit shape colors remain intact. Fonts and geometry come from Pele rather than Mermaid.js.

Pele has its own layout and does not support arbitrary HTML labels or JavaScript click callbacks. Mermaid themes no longer apply. Supplied adapters remain trusted integration code; their style tags and inline CSS are preserved and are not a CSS sandbox.