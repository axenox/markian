# Runnable Examples

Serve this package directory with a static HTTP server, then open the [example index](index.html). Each example is one readable HTML file containing its markup, editor sizing styles, configuration, sample Markdown, and JavaScript. Shared header, branding, page layout, controls, and output styling live in [demo.css](demo.css), keeping the editor setup easy to find. The prebuilt library/extension assets and any declared third-party renderer remain external imports; editor-specific JavaScript and CSS stay inline.

| Example And Source | Demonstrates |
| --- | --- |
| [Minimal editor](minimal-editor.html) | A textarea editor, synchronized form value, native reset, and destruction. Loads only core assets. |
| [Editor workspace](editor-workspace.html) | Independent editor instances, themes, read-only controls, Markdown values, and the optional Code slice. |
| [Mermaid diagrams](mermaid-diagrams.html) | Optional diagram rendering, centered labels, floating controls, themes, read-only inspection, and the code/preview workspace. |

All three pages and the index are included in npm/Composer archives. The checkout's root URL redirects to the editor workspace. No framework, remote font, or consumer build is needed for the minimal editor or workspace; the branded examples use the included font file.

The Mermaid page declares the host-provided renderer URL/version in its inline `mermaidConfig` object. `npm run dev` serves the development-only Mermaid 12.2.0 dependency at `/host-assets/mermaid.min.js`; the renderer is not included in the package. For static hosting, supply that route yourself or update `mermaidConfig.asset.url` to a trusted supported Mermaid URL. Missing configuration or loading failures display an error without losing fenced source. The minimal editor and workspace do not request Mermaid.

Provider services, host integrations, and the standalone viewer are not implemented by these examples. See the [API and renderer contract](../README.md#optional-mermaid-extension) for supported versions, safety limits, loading, and remaining device/CSP gates.