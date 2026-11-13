# Mermaid Extension

This guide covers Pele loading and SVG handling for Mermaid fences in the editor extension and viewer adapter. For host setup, see [configuration](../../Configuration.md#mermaid) and [extensibility](../../Extensibility.md#mermaid).

## Runtime Loading

Pele is host-supplied through a `source` URL pointing to `pele.global.js` or a `{ render }` adapter. The loader requires `window.pele.render` and validates its SVG result. Mermaid.js is no longer supported by the source loader. There is no guessed CDN or sibling-framework path. The former `asset` object is rejected, not translated. Fence, extension and adapter names remain `mermaid`.

Loads of the same resolved URL are shared within a bundle; editor and viewer bundles have independent caches. A common host renderer can share one runtime across both. The loader keeps the runtime global in a retained iframe, not an untrusted-script sandbox: load only trusted scripts. Pele renders synchronously with per-call options; no global configuration or render queue is needed. It receives a unique ID prefix, a 20,000-character source limit, a 2,000,000-character output limit and a 500-edge limit. Links, images and automatic direction switching are disabled. Existing cancellation and stale-result checks remain in the editor/viewer.

The shared loader and renderer contract live in [mermaid-runtime.ts](../../../src/mermaid-runtime.ts). The [editor extension](../../../src/extensions/mermaid.ts) owns diagram controls and block editing; the [viewer adapter](../../../src/viewer-mermaid.ts) only renders diagrams.

## SVG Styling and Safety

The loader returns Pele SVG without rebuilding its nodes. Editor and viewer preserve inline styles, data attributes and unique IDs. Active SVG content and direct external SVG references are still removed. Shared diagram CSS maps Pele variables to each instance's Markian theme; custom diagram colors remain intact.

Pele has its own layout and does not support arbitrary HTML labels or JavaScript click callbacks. Mermaid themes no longer apply. Supplied adapters remain trusted integration code; their style tags and inline CSS are preserved and are not a CSS sandbox.