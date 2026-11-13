# Examples

Serve the package directory with a static HTTP server and open the [example index](../Examples/index.html). Core examples use prebuilt `dist` assets and require no framework, remote service, remote font, npm install, or consumer build.

| Page | Demonstrates |
| --- | --- |
| [Minimal editor](../Examples/minimal-editor.html) | Textarea mounting, change subscription, form value, native reset, and destruction. |
| [Editor workspace](../Examples/editor-workspace.html) | Themes, read-only inspection, and optional Code workspace. |
| [Code blocks](../Examples/code-blocks.html) | Independently enabled Code, lazy offline JavaScript/SQL/Python highlighting, expanded source, language changes, local history, and four-space indentation. |
| [Templates and HTML](../Examples/templates.html) | Automatic regular-toolbar registration, custom SVG icons held in variables, fixed checklist insertion, literal selection wrappers, keyboard-key/highlight CSS shared with a synchronized standalone viewer, source output, themes and permissions. |
| [Mentions and tags](../Examples/mentions.html) | Competing prefixes: `#12` suggests tickets; `#TC` and `#tc` suggest test cases using a shared provider and explicit case aliases. Separate local user/topic callbacks, plain/link storage, legacy mentions, accessible details, delayed/error results and read-only inspection. |
| [Mermaid diagrams](../Examples/mermaid-diagrams.html) | Explicit Mermaid activation, multiple diagrams, themes, read-only inspection, pan/zoom, and source/preview workspace. |
| [Editor/viewer comparison](../Examples/viewer.html) | Shared Markdown/theme with equal desktop panes and stacked narrow-screen panes. |

Each named page keeps mount sizing, configuration, sample Markdown, and initialization JavaScript inline. All seven runnable pages include an additional standalone Markian viewer containing that actual initialization source as a highlighted JavaScript code block. Shared [demo.js](../Examples/demo.js) reads the marked script rather than duplicating its configuration, removes the outer HTML indentation, and follows the selected page theme. Its viewer renderer loads the bundled JavaScript grammar and Code stylesheet locally, without requiring the editor Code extension, and builds syntax spans without changing the source text. If highlighting fails, the viewer retains the plain code block. Shared [demo.css](../Examples/demo.css) provides the page shell, branding, controls, local font, and bounded reference surface. Demo assets are not library dependencies. Examples are included in package archives.

## Mermaid Runtime

Pele is not bundled. The diagram page's inline `source` configuration points to `/host-assets/pele.global.js`. The development server supplies this route from the development-only Pele dependency. On a static host, provide that route or set `source` to a trusted Pele global runtime exposing `pele.render()`. Mermaid.js is no longer used.

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