# Examples

Serve the package directory with a static HTTP server and open the [example index](../Examples/index.html). Core examples use prebuilt `dist` assets and require no framework, remote service, remote font, npm install, or consumer build.

| Page | Demonstrates |
| --- | --- |
| [Minimal editor](../Examples/minimal-editor.html) | Textarea mounting, change subscription, form value, native reset, and destruction. |
| [Editor workspace](../Examples/editor-workspace.html) | Themes, read-only inspection, and optional Code workspace. |
| [Mermaid diagrams](../Examples/mermaid-diagrams.html) | Explicit Mermaid activation, multiple diagrams, themes, read-only inspection, pan/zoom, and source/preview workspace. |
| [Editor/viewer comparison](../Examples/viewer.html) | Shared Markdown/theme with equal desktop panes and stacked narrow-screen panes. |

Each named page keeps mount sizing, configuration, sample Markdown, and JavaScript inline. Shared [demo.css](../Examples/demo.css) provides the page shell, branding, controls, and local font. Neither demo styles nor its masthead are library dependencies. Examples are included in package archives.

## Mermaid Runtime

Mermaid is not bundled. The diagram page's inline `source` configuration points to `/host-assets/mermaid.min.js`, without a version declaration. The development server supplies this route from the development-only Mermaid dependency. On a static host, provide that route or set `source` to a trusted Mermaid runtime exposing `initialize()` and `render()`.

Missing configuration or failed rendering shows an error without losing fenced source. The minimal editor and default workspace do not request Mermaid. The viewer comparison intentionally keeps Mermaid disabled; rendering in the viewer uses its separate [render-only adapter](Extensibility.md#viewer-mermaid), not the editor extension.

## Development Checkout

From the package root:

```powershell
npm ci
npm run build
npm run dev -- --port 5195 --strictPort
```

Open <http://127.0.0.1:5195/>. The root redirects to the workspace. Keep the same preview URL and restart the owned server after rebuilding assets; see [development setup](Development/index.md#setup).

## Scope

Examples keep documents in memory. They do not implement host persistence, upload services, authorization, or framework widget binding. The comparison intentionally loads both editor and viewer bundles; viewer-only hosts need only viewer JS/CSS. Browser demonstrations do not establish production, accessibility, device, CSP, or host-integration acceptance.

For actual integration, use [configuration](Configuration.md), [API](API.md), and [extensibility](Extensibility.md).