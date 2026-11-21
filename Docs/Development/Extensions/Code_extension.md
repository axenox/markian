# Code Extension

This contributor guide describes the Code extension's highlighting boundary. Setup, editing behavior and public helpers are in the [usage guide](../../Extensions/Code.md); options and defaults remain in [Configuration](../../Configuration.md#code).

## Ownership and Assets

[code.ts](../../../src/extensions/code.ts) owns the language catalogue, optional asset loading, renderer registrations and expanded workspace. It uses public source handles and block sessions rather than another editing engine.

UI text uses `instance.translate` with `CODE.*`, shared `TOOLBAR.*`, and `HELP.CODE` keys from the core dictionaries. No translation loader or dictionary is bundled in the extension. Language catalogue labels and source remain literal; host/highlighter errors keep their supplied diagnostic text.

[code-language.ts](../../../src/extensions/code-language.ts) wraps an isolated Highlight.js instance and converts highlighted output into ordered source-offset tokens. Language scripts contain the selected grammar and token extraction only. [build.mjs](../../../Scripts/build.mjs) maps both HTML and XML assets to the installed XML grammar while keeping their public language IDs separate. Keep the catalogue, build inputs, artifact manifest and package checks synchronized when adding languages.

## Presentation and Lifecycle

The extension validates external token results before applying them. Source handles own CodeMirror decorations; [highlight-tokens.ts](../../../src/extensions/highlight-tokens.ts) renders static spans using literal text nodes for code previews. The Mermaid extension reuses that renderer and token extraction without importing the Code extension runtime.

[syntax.css](../../../src/extensions/syntax.css) owns the shared light/dark token palette and is included by each extension's stylesheet. [code.css](../../../src/extensions/code.css) owns the Code workspace and preview controls.

Highlighting is bounded and debounced. Revision, disposal and lifetime checks reject late asynchronous results. Language-load failures show a diagnostic and Retry without replacing source. Destroying a workspace cancels its pending highlighting and destroys its source handle; language URL caches retain successful compatible assets.
