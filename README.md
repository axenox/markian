# Markian Prototype 01

A runnable look-and-feel prototype of the [proposed Markdown editor](Docs/Requirements/Approach.md). It uses Milkdown's headless kit (ProseMirror + remark), a custom Material Design Icons toolbar, and CodeMirror for the source workspace. There is no frontend framework or server-side application dependency.

## Run

Use Node.js 24 and npm from this package directory:

```powershell
npm ci
npm run dev -- --port 5176 --strictPort
```

Open <http://127.0.0.1:5176/>. The page loads the predefined [example document](src/example.md). Edits live in memory only; use **Download .md** to keep them. Reloading starts again from the example. Reset asks for confirmation.

## What Works

- Headings H1-H6, bold, italic, strikethrough, inline code, lists, quotes, code blocks, and clear formatting.
- Word-at-caret inline formatting, selection formatting, and Milkdown's Markdown typing shortcuts.
- Pinned and selection toolbars with accessible icon labels, tooltips, and active inline-format states.
- Editable GFM tables, plus insert table, add row, and add column controls. Row/column controls enable inside a table.
- Native task checkboxes with mouse and keyboard interaction, undo/redo, document outline, and maximize/restore.
- Link and image URL dialogs, Markdown download, and in-place source editing. The source button replaces the visual content with CodeMirror while keeping the toolbar and editor frame.
- Light/dark switching and a horizontally scrollable toolbar on narrow screens; source and maximize remain visible.
- Block and inline HTML comments preserved as hidden model nodes and serialized back to comments. Comment-only blocks do not create visible empty paragraphs.
- Rendered Mermaid diagrams with a dedicated source/live-preview view and a Back-only toolbar.

The example's placeholder convention is illustrative, not an integration with a host's existing placeholder grammar. Its body remains ordinary Markdown; no provider is executed. Unknown comments survive import/export. Other raw HTML is shown as inert source, not rendered or executed. URL dialogs and source import reject unsupported URL schemes.

The small development API is available after initialization:

```javascript
window.Markian.get();
window.Markian.set('# A new document\n\nEditable Markdown.');
window.Markian.setTheme('dark');
window.Markian.focus();
```

This is a single-instance prototype API, not the final mount/destroy or host-adapter contract. `set` replaces the document transactionally; Reset starts fresh history.

## Source Mode

The source button toggles between visual editing and plain Markdown inside the same frame, with no popup or split preview. Its pressed state indicates raw mode; its action becomes **Visual editor** while source is active.

Each view owns its sidebar. The visual outline navigates rendered headings; the raw outline shows Markdown headings with source line numbers and scrolls only CodeMirror's internal viewport. It updates as you edit, recognizes ATX and Setext headings, and excludes headings inside fenced examples. A heading on the first line is treated as the document title and omitted. The current section is highlighted. Both outlines remain hidden on narrow screens.

The pinned toolbar edits Markdown directly in raw mode: inline formatting wraps the selection or word, headings and lists update line prefixes, and code/table controls insert portable syntax. Row and column controls work inside parsed Markdown tables. Link/image dialogs insert at the source selection. Undo/redo target CodeMirror's history, not the hidden visual editor. The selection-floating toolbar remains a visual-mode control.

While source is active, `get()` and Download return the exact current source text, including unfinished edits. Theme changes and maximization retain the buffer. Switching back validates links/images and comment preservation before importing; a failed validation keeps the source and shows an error. A successful edited import is one visual undo step. Unchanged mode switches do not create undo steps.

Raw history and selection survive a round trip when the visual document has not subsequently changed. Visual edits or programmatically replacing/resetting the document refresh the raw buffer and its history on the next entry. The modes have separate position systems and undo histories; cursor equivalence across them is not promised. Markdown may normalize when exported from visual mode. Source mode accepts unfinished Markdown; the importer is still not a complete unsupported-syntax validator.

## Mermaid Diagrams

Click a rendered `mermaid` fenced block to edit it. The diagram view replaces the document and its toolbar with CodeMirror on the left, a live preview on the right, and a single **Back** button. Narrow screens stack code above preview. Keyboard undo/redo works within the diagram editor. **Back** returns to the document and commits the edited block as one visual undo step; returning without edits adds none.

The renderer loads Core's existing `Facades/AbstractAjaxFacade/js/mermaid/mermaid.min.js` directly through Vite's asset pipeline, not a CDN or another installed Mermaid package. This prototype therefore needs the sibling `exface/core` package in its current Composer layout. Diagrams use strict rendering without binding click handlers. Syntax errors appear in the preview without discarding source; the latest draft is included in `get()` and Download even before returning. Rendered SVG is never stored in Markdown. Raw document mode continues to expose ordinary Mermaid fences.

## Backtick Typing

Inline code activates when you type an opening backtick, content, and a closing backtick. You can also type two backticks, move Left between them, and type the content; the pair becomes an inline code span. Continue typing inside it, then press Right Arrow or type a closing backtick to return to ordinary text. No invisible characters are added to the Markdown.

For a code block, start a paragraph with three or more backticks and press Enter or Space. An optional language can follow the fence, including names such as `javascript` or `c++`. The fence converts when submitted, not immediately after its last backtick, so longer fences and language names can still be typed. Typing inside an existing code block remains literal. Tilde-fence typing is not covered by this extension because Milkdown's GFM strikethrough input rule intercepts it.

## Review the Experience

Try formatting a word without selecting it, typing Markdown lists, leaving inline code with the arrow keys, editing a table, and switching between visual and source editing. Review toolbar density, typography, focus behavior, and the mobile layout. Check the downloaded Markdown to compare its normalized syntax and retained comments with the visual document.

Automated checks and screenshots support review; they do not establish real-device IME behavior, full accessibility conformance, or independent GitHub/GitLab compatibility.

## Checks

```powershell
npx playwright install chromium
npm test
npm run build
```

The Playwright suite covers the working interactions, raw-mode toolbar commands and history, exact raw downloads, comment round trips, inert HTML, unsafe URLs, and desktop/mobile layout. It captures light, dark, mobile, and in-place source screenshots under the ignored `.prototype-tests` directory. The test runner starts its own server if port 5176 is free, or reuses the running prototype outside CI. Build output goes to the ignored `dist` directory.

## Deliberately Not Included Yet

This is the visual foundation gate, not a production library. It does not implement rich `<kbd>` rendering, mentions, provider execution, generated-region protection, Excel-specific paste, pasted-image conversion, table deletion menus, toolbar configuration, autosave, framework integrations, or a packaged classic-script distribution. The source importer is not a complete unsupported-syntax validator. Do not use it as a production HTML sanitizer or expose it to untrusted documents without the security and interoperability gates in the approach.

Fonts load from Google Fonts with local fallbacks. The sample workspace photo loads from Unsplash; editor functionality does not require either service. No edits are uploaded. Dependencies are pinned in the npm lockfile; the build currently includes the prototype's editing and source-buffer dependencies together rather than optimizing a final distribution.