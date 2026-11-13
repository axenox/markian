# Table Editing Tools

This guide covers table controls, selection behavior, and their implementation in the visual editor. Shared control appearance belongs in the [style guide](../../Styleguide.md); general floating-toolbar placement belongs in the [toolbar guide](Toolbars.md).

## Selection and Floating Controls

Inside a table, a text selection shows the configured prose commands followed by a separate table-action group. A caret or highlighted cell range shows table actions only, without special full-row or full-column controls. Contextual row/column controls share the same command buttons as menus.

The floating toolbar distinguishes ProseMirror text selections from `CellSelection`. Cell selections never show prose formatting controls. Positioning uses the complete highlighted cell bounds rather than the native text range.

In an empty cell, the native selection range can have no height. Use the visual engine's caret coordinates instead: a zero-sized native rectangle must not anchor controls at the top of the work area.

## Row and Column Operations

Delete row and Delete column remove every row or column covered by a highlighted cell range. Without a cell range, they affect the current row or column. Deleting the header promotes the first remaining row. If deletion leaves fewer than two rows or no columns, the table is removed. Each deletion is one undo step.

Column alignment follows Markdown; default table headings align left.

Delete at the end of the paragraph before a table, or Backspace at the start of the paragraph after it, removes the whole table in one undoable edit. Read-only and disabled editors block these edits.

## Clipboard and Layout

Table range pastes retain the pasted selection. Clipboard formats, smart paste, and compatibility with other applications are described in [interoperability](../../Interoperability.md).

Cell dimensions and spacing remain in the [visual editor guide](Visual_editor.md#document-spacing).

## Implementation

Selection-toolbar positioning is implemented in [editor.ts](../../../src/editor.ts). Table commands live in [editing.ts](../../../src/editing.ts).

Deletion commands use ProseMirror's `selectedRect` for row and column limits, including backward selections. The row command preserves Milkdown's separate header/body types when promoting a remaining row; the column command delegates partial deletion to ProseMirror and removes the table when every column is selected.

Row insertion inserts only the new row through a ProseMirror transaction. It retains existing table DOM and maps the current selection instead of replacing the whole table, avoiding transient scroll resets in long tables.