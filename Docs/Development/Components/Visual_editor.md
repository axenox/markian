# Visual Editor

This guide records layout dimensions, spacing, and responsive thresholds for contributors maintaining the visual editor. Shared controls and document styling also affect other editor views, Preview, and the viewer. For design and interaction principles, see the [style guide](../../Styleguide.md).

These are implementation values, not separate host configuration options. Keep them synchronized with the owning styles, including [base editor CSS](../../../src/style.css). Hosts should use the supported [stylesheet configuration](../../Configuration.md) rather than duplicate structural normalization in a theme.

## Editor Layout

| Element | Dimension or rule |
| --- | --- |
| Editor shell | Fills the host and has a 260px minimum height. The host supplies an explicit usable height. |
| Built-in fullscreen shell | Follows visual viewport size and offsets with 12px insets, or window dimensions when the Visual Viewport API is unavailable. No minimum height, so the on-screen keyboard can reduce it below 260px. Viewport resize/scroll listeners are removed on restoration or destruction. |
| Pane tracks, controls, icons, and status regions | Keep their dimensions stable when labels, content, or loading states change. |
| Shared desktop buttons | 32px targets; pinned toolbar controls retain their own compact dimensions. |
| Destination fields | Shared 34px height in transient forms. |
| Mention suggestions | Up to 320px wide, with 8px viewport side clearance; height bounded by 240px and 40vh. Reuse regular dropdown 4px padding/radius, no row gaps, and shared menu-row sizing. |
| Mention details | Up to 320px wide, with 8px viewport side clearance; height bounded by 240px and 40vh, 12px padding, 6px row gaps and 6px radius. Text aligns at the start. |

Floating-control placement is described in the [toolbar component guide](Toolbars.md).

## Document Spacing

Base editor CSS removes accidental outer paragraph margins inside lists and table cells. Content CSS can refine the fallback spacing. The packaged content styling uses these values:

| Element | Value |
| --- | --- |
| Consecutive paragraphs | 16px fallback gap. |
| List indentation | 24px. |
| List outer margins | 8px. |
| List item spacing | 2px. |
| Table cell padding | 4px vertically and 8px horizontally. |
| Table cell minimum width | 72px. |
| Table cell line height | 1.5. |
| Additional paragraphs inside list items or table cells | 4px gap. |
| Task checkboxes | 16px, aligned to the first text line. Disabled viewer tasks retain the same dimensions and checked colors. |
| Mention chips | Inline with inherited font/line height, zero vertical and 0.35em horizontal padding, no border, and a 999px pill radius. Background mixes the configured color (or theme accent) at 18% with transparency; text color is inherited. Wrapped fragments clone their decoration without raising line boxes. |
| Keyboard keys | Inline-block, 1px vertical/5px horizontal padding; monospace at 0.85em and 1.5 line height. 1px border with a 2px lower edge, 3px radius and a 1px lower shadow. Template CSS may override this shared default. |
| Example initialization references | Full-width track below the primary experience, 24px top margin and a code block bounded to 480px height with internal scrolling. No extra document-wrapper padding. Demo-only styling, not an editor option. |

Keep document presentation consistent across Visual, Preview, and viewer output. Shared structural resets belong in base styling, not look-alike host overrides.

## Responsive Thresholds

Use editor container width rather than only viewport width.

| Surface | Threshold | Behavior |
| --- | --- | --- |
| Editor shell | 480px or less | Controls grow to 40px and status is hidden; configured toolbar placement is retained. |
| Editor shell | Above 480px | Use the desktop control layout. |
| Maximized editor | Viewport width at 480px or less | Toolbar moves below the work area, including when a host callback owns fullscreen sizing. |
| Mermaid workspace | Above 600px | `.markian-mermaid` uses equal constrained source and preview columns. |
| Mermaid workspace | 600px or less | Source and preview stack as bounded rows. |

The Mermaid workspace uses separate `dist/extensions/mermaid.css` styling. Its rendering and lifecycle are covered by the [Mermaid extension guide](../Extensions/Mermaid_extension.md).

At every size, menus and panels must stay reachable, text must fit, and each scrollable surface must own its scrolling. Follow the [focused validation guidance](../index.md#validation) when changing these values.