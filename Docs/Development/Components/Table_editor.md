# Table Editing Tools

This guide covers table controls, selection behavior, and their implementation in the visual editor. Shared control appearance belongs in the [style guide](../../Styleguide.md); general floating-toolbar placement belongs in the [toolbar guide](Toolbars.md).

## Selection and Floating Controls

Inside a table, selected text shows only the configured prose floating toolbar. A caret or highlighted cell range never opens that toolbar, even on right-click. Instead, compact plus/minus panels attach to the active cell's bottom edge for row actions and right edge for column actions. Plus inserts a row below or column to the right; minus uses the existing deletion command, including highlighted-range deletion. Buttons preserve the document selection and dispatch the same registered commands as the pinned table menu, with the same permission checks and error reporting.

While the editable table has focus, separate dotted grips appear beside the active cell's row and above its column. They follow the caret (or the head cell of a range), not the pointer. Clicking a grip selects its entire row or column. Dragging it shows an insertion line and moves that row or column on release. Escape cancels a drag. A keyboard-focused grip supports Alt+Up/Down for rows or Alt+Left/Right for columns. Each reorder is one undo step; rows moved into or out of the first position adopt the required header/body type without losing their contents.

Partial multi-cell selections hide all grips and panels. Full-width row selections show only the row grip and row minus button; full-height column selections show only the column grip and column minus button. A whole-table selection hides everything. The matching grip is centered on the selected group rather than one row or column. Clicking it retains that group. Dragging or Alt+Arrow reorders the complete group while preserving its internal order and selected range, including backward selections. Dropping inside the group does nothing. Minus deletes the complete selection through the existing command. Single-cell selections without a complete row/column keep the ordinary controls.

The grips and cell panels are absolute overlays clipped to the visual pane, with no table wrappers, added margins, or document decorations. Their background uses the shared table-border color (`--markian-line`), with rounded outer corners and flush attached edges. Showing, hiding and moving them must not resize the table or change scrolling. They hide when focus leaves the document/controls, when changing views, and in read-only or disabled state. Cell panels hide during dragging. A scrolled-off header's column grip remains at the visual pane's top edge. There is no large table-wide side "+" control.

The floating toolbar distinguishes ProseMirror text selections from `CellSelection`. Cell selections never show prose formatting controls. The prose toolbar layers above all table controls so overlapping grips cannot cover its icons or intercept clicks. Cell panels use DOM cell bounds, including empty cells, rather than a potentially zero-sized native selection range.

At a pane edge, panels clamp inward to remain reachable without scrolling or resizing the document. Panels hide when their active cell is completely outside the pane.

## Row and Column Operations

Delete row and Delete column remove every row or column covered by a highlighted cell range. Without a cell range, they affect the current row or column. Deleting the header promotes the first remaining row. If deletion leaves fewer than two rows or no columns, the table is removed. Each deletion is one undo step.

Column alignment follows Markdown; default table headings align left.

Delete at the end of the paragraph before a table, or Backspace at the start of the paragraph after it, removes the whole table in one undoable edit. Read-only and disabled editors block these edits.

## Clipboard and Layout

Table range pastes retain the pasted selection. Clipboard formats, smart paste, and compatibility with other applications are described in [interoperability](../../Interoperability.md).

Cell dimensions and spacing remain in the [visual editor guide](Visual_editor.md#document-spacing).

## Implementation

Selection-toolbar positioning is implemented in [editor.ts](../../../src/editor.ts). Table commands live in [editing.ts](../../../src/editing.ts). The visual engine's [table-controls plugin](../../../src/engines/table-controls.ts) owns the grips, cell-action panels, pointer capture, reorder transactions, focus/scroll listeners and resize observer; its teardown releases all of them. An editor-owned callback routes panel commands through normal command execution. A document change or permission change during a drag cancels that drag rather than applying stale positions.

Deletion commands use ProseMirror's `selectedRect` for row and column limits, including backward selections. The row command preserves Milkdown's separate header/body types when promoting a remaining row; the column command delegates partial deletion to ProseMirror and removes the table when every column is selected.

Row insertion inserts only the new row through a ProseMirror transaction. It retains existing table DOM and maps the current selection instead of replacing the whole table, avoiding transient scroll resets in long tables.