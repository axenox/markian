# Visual Editor

This guide records layout dimensions, spacing, and responsive thresholds for contributors maintaining the visual editor. Shared controls and document styling also affect other editor views, Preview, and the viewer. For design and interaction principles, see the [style guide](../../Styleguide.md).

These are implementation values, not separate host configuration options. Keep them synchronized with the owning styles, including [base editor CSS](../../../src/style.css). Hosts should use the supported [stylesheet configuration](../../Configuration.md) rather than duplicate structural normalization in a theme.

## Editor Layout

| Element | Dimension or rule |
| --- | --- |
| Editor shell | Fills the host and has a 260px minimum height. The host supplies an explicit usable height. |
| Pane tracks, controls, icons, and status regions | Keep their dimensions stable when labels, content, or loading states change. |
| Shared desktop buttons | 32px targets; pinned toolbar controls retain their own compact dimensions. |
| Destination fields | Shared 34px height in transient forms. |

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

Keep document presentation consistent across Visual, Preview, and viewer output. Shared structural resets belong in base styling, not look-alike host overrides.

## Responsive Thresholds

Use editor container width rather than only viewport width.

| Surface | Threshold | Behavior |
| --- | --- | --- |
| Editor shell | 480px or less | Controls grow to 40px, the toolbar moves below the work area, and status is hidden. |
| Editor shell | Above 480px | Use the desktop control layout. |
| Mermaid workspace | Above 600px | `.markian-mermaid` uses equal constrained source and preview columns. |
| Mermaid workspace | 600px or less | Source and preview stack as bounded rows. |

The Mermaid workspace uses separate `dist/extensions/mermaid.css` styling. Its rendering and lifecycle are covered by the [Mermaid extension guide](../Extensions/Mermaid_extension.md).

At every size, menus and panels must stay reachable, text must fit, and each scrollable surface must own its scrolling. Follow the [focused validation guidance](../index.md#validation) when changing these values.