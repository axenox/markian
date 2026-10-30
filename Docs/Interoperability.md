# Interoperability

Markian stores ordinary Markdown and exchanges clipboard content with other applications. This guide describes smart paste, copying, and compatibility limits for users and integrators. For editor options and host callbacks, see [configuration](Configuration.md); for reading and saving documents, see the [API](API.md).

## Clipboard Formats and Smart Paste

An application can put several representations of the same content on the clipboard, such as plain text, HTML, and an image. Markian uses the content and the paste destination to choose how to insert it.

| Content and destination | Behavior |
| --- | --- |
| Spreadsheet data in a Visual table | Fill cells from the current cell or the upper-left cell of a selected range. |
| Tab-separated spreadsheet data outside a Visual table | Create a Markdown table. |
| HTML table in Visual view | Import table values into Markdown cells rather than retain the source application's styling. |
| Spreadsheet values with an accompanying clipboard image | Paste the values without also inserting the image. |
| Image-only clipboard content | Use normal image insertion. |
| Text in a code block | Keep it literal rather than create a table. |

Use Source view to paste literal Markdown rather than import rich-text formatting. Read-only and disabled editors do not accept document-changing pastes.

## Excel and Other Spreadsheets

### Pasting Into a Table

Copy a rectangular range in Excel, place the caret in the destination cell in Markian's Visual view, and paste. The clipboard's rows and columns replace destination values starting at that cell. Markian grows the table if the incoming rectangle extends beyond its current size. Cells outside that rectangle remain unchanged.

You can also select a range of destination cells before pasting. A matching-size paste replaces that range, regardless of the direction in which it was selected. Selecting only body rows leaves the header unchanged. The pasted cells remain selected so that you can paste another set of values into the same range. Undo restores the previous values.

Tab-separated text supports quoted cells, including values containing tabs or quotation marks. Multirow single-column text fills a column when pasted inside an existing table. HTML table clipboard content is also accepted.

### Creating a Table

Pasting tab-separated spreadsheet data outside an existing table creates a Markdown table. The first copied row becomes the header. Markian keeps at least one body row, adding an empty one when only a single row was copied.

### Copying Back to a Spreadsheet

Select the table cells in Visual view and copy them normally. Markian supplies both HTML and quoted tab-separated values so that spreadsheet applications can retain the rows and columns.

The **Copy Markdown** command has a different purpose: it copies the complete document as Markdown, not the selected cells as spreadsheet data.

Excel may include an image of the copied range alongside its text and HTML values. Once Markian has handled the cell paste, it ignores that accompanying image rather than inserting it below the table.

### Limits

- The exchange preserves table structure and cell text, not spreadsheet styling, formulas, or workbook features.
- Line breaks inside cells become spaces because portable Markdown table rows are single-line.
- Values such as `001` remain text in Markian. A destination spreadsheet may apply its own number or date conversion when receiving pasted content.
- Clipboard formats vary by application, browser, and operating system. Other spreadsheets can use the same text and HTML formats, but this is not a claim that every application has been tested.

Browser regression tests cover table creation and growth, selected-range replacement, text and HTML clipboard formats, copying table data, and mixed spreadsheet/image payloads. These checks do not certify a round trip through desktop Excel or every spreadsheet version.

## Images

Image-only clipboard pastes use Markian's image insertion workflow. Without an `onImageInsert` callback, supported raster images are embedded as data URIs in the Markdown. A host can supply that callback to store the image elsewhere and return its saved destination instead.

The host owns storage and transport; Markian has no built-in upload endpoint. Before saving, integrators should await `whenIdle()` and then read `get()` so that pending image insertion has completed. See [configuration](Configuration.md) and the [API](API.md) for callback and save behavior.

An image that accompanies a handled spreadsheet paste does not start a separate image insertion or upload.

## Markdown and Rich-Text Editors

Markdown is the exchange format for whole documents. Source view is the appropriate place to paste literal Markdown, including syntax that Visual view cannot represent. Visual import checks Markdown round-trip compatibility and retains source when content cannot be represented safely. See [Markdown and safety](Architecture.md#markdown-and-safety).

Rich HTML from other editors can only retain formatting supported by Markian's Markdown model. Fonts, page layout, and application-specific document features are not a portable Markdown contract. Clipboard support is not a full document importer for Word, Google Docs, or their native file formats.

Rendering also depends on the receiving Markdown implementation. For example, tables and task lists require compatible Markdown extensions, and a Mermaid fence requires a renderer. Markian does not save generated preview HTML in place of Markdown.