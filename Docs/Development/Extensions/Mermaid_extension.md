# Mermaid Extension

This guide covers Mermaid loading and SVG handling in the editor extension and viewer adapter. For host setup, see [configuration](../../Configuration.md#mermaid) and [extensibility](../../Extensibility.md#mermaid).

## Runtime Loading

Mermaid is host-supplied through a `source` URL string or a `{ render }` adapter. No version declaration is required: the loader checks for callable `initialize` and `render` methods at runtime and validates the rendered SVG result. There is no guessed CDN or sibling-framework path. The former `asset` object is rejected, not translated.

Loads of the same resolved URL are shared within a bundle; editor and viewer bundles have independent caches. A common host renderer can share one runtime across both. The loader isolates configuration in an iframe, not untrusted script execution: load only trusted scripts.

The shared loader and renderer contract live in [mermaid-runtime.ts](../../../src/mermaid-runtime.ts). The [editor extension](../../../src/extensions/mermaid.ts) owns diagram controls and block editing; the [viewer adapter](../../../src/viewer-mermaid.ts) only renders diagrams.

## SVG Styling and Safety

The shared browser-side Mermaid runtime returns Mermaid's SVG without reconstructing its styling. Editor and viewer preserve its style tags, inline styles, data attributes and original IDs so native theme selectors keep working. Active SVG content and direct external SVG references are still removed.

Mermaid CSS is not isolated or filtered: interference with host styles and CSS resource loading are accepted risks. Markian adds no replacement SVG palette.