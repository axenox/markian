# Markian Style Guide

## Purpose and Status

Markian should feel like a focused writing tool: a readable document, compact recognizable controls, and enough structure to navigate without turning the page into a dashboard. The approved prototype is the visual baseline, not a license to copy its demonstration shell into every integration.

This is the living reference for look-and-feel, shared UI patterns, and interaction presentation. Update it in the same change whenever a reusable visual or interaction pattern changes. Internal ownership belongs in the [architecture](Architecture.md); feature scope and implementation status belong in the [plan](Requirements/Plan.md).

The implementation is in [style.css](../src/style.css), with engine-independent typography in [content.css](../src/render/content.css). The original prototype is archived. Current controls use scoped light/dark surfaces, selected MDI icons with native tooltips, stable 32px targets, measured More overflow, selection/table toolbars, and shared search/destination panels. Below 480px of editor container width, targets become 40px, the toolbar defaults below the work area, and status is hidden. Fullscreen keeps the same root; a host callback can replace the built-in viewport overlay. Complete accessibility and real-device/IME acceptance remain unverified.

The public root is `[data-markian]` with `data-theme`, `data-view`, and (after a permission change) `data-readonly`. `.markian-document` is the content styling hook; do not depend on Milkdown DOM. All library selectors are scoped under `.markian` or the explicit content hook; demo page styles are separate and no fonts are requested remotely. Current variables use the `--markian-` prefix: `surface`, `text`, `muted`, `line`, `accent`, `soft`, `code`, `font`, and `mono`. The unprefixed prototype tokens below are historical reference, not the current customization API.

### Global layout

Base editor CSS removes outer paragraph margins inside list items and table cells, so paragraph wrappers do not add accidental spacing when a host supplies external Markdown CSS. Consecutive paragraphs have a 16px fallback gap, which content stylesheets may customize. This structural normalization applies to `.markian-document` surfaces independently of the theme; table-cell padding, list-item spacing, and ordinary paragraph typography remain content-stylesheet concerns. Host themes must not duplicate these rules.

Hosts configure `markdownCssUrls` for rendered content and `themeCssUrls` for editor chrome overrides. Omitted content URLs load the separately packaged `dist/markdown-github.css`; an explicit list replaces it, including `[]` for no content stylesheet. Theme URLs default to `[]` and follow content stylesheets in the cascade. Load base `markian.css` separately. Scope host rules to a wrapper and `.markian-document` or `.markian`: these are ordinary external stylesheets, not isolated CSS. The packaged content stylesheet uses a default-only instance marker so its typography does not leak into custom-styled instances. Readiness waits for the configured stylesheets, and destruction removes their instance-owned links.

The editor consists of 
- toolbar
- main work area
- status bar

### Toolbar

The toolbar is positioned on the top on larger screens and moves to the bottom on smartphones (to be better accessible for fingers). 

Toolbar buttons depend on the view. The mermaid toolbar shows different buttons than the markdown-toolbar. Howerrver, the toolbar always has the same structure (from left to right):

- back button - swith to previous view (not shown in regular markdown view)
- undo/redo
- one or more view-specific groups
- overflow-button - only visible of the width was not enough to show all buttons
- search button - opens an anchored search/replace panel
- full-screen button
- outline button - rightmost in the default layout

Toolbar items are buttons. They can either execute a command or show a dropdown with more buttons. 

The default layout contains history (Undo, Redo), formatting (Headings, Formatting, Lists, Indent, Outdent), insertion (Inline code, Code block, Quote, Link, Image, Table, Horizontal rule), document (View mode, Clear formatting, Copy, Help), and utility (Search, Maximize, Outline) groups. Formatting contains bold/italic/strike; Lists contains ordered/bullets/tasks; View mode contains Visual/Source/Preview. Separators are generated between nonempty groups, never configured as standalone items. The utility group is opposite-aligned and stays outside overflow, with Outline last. All other groups default to left alignment. Custom top-level menus/groups use the same alignment setting; preserve declaration order within each side and never infer alignment from command names. More appears automatically before opposite-aligned containers, or at the end when none exist. Empty or inapplicable groups leave no dangling separators. Secondary views retain the same relative control order, including extension-owned Undo/Redo in the history position. Views with Back begin with Back and a separator and omit the View mode menu. Headings provides H1-H6; the legacy H2 toggle remains available for custom configurations. Outline uses a right-sidebar icon. Table actions have distinct row/column insertion/deletion icons. Expand code appears only in the floating toolbar when the caret is in a code block, including read-only inspection, rather than in the pinned toolbar.

Menus share `.markian-menu` / `.markian-menu-items`, native details/summary disclosure, native popover surfaces, and arrow/Home/End/Escape navigation. Home/End stay inside the active disclosure; Escape closes it and restores focus to its summary, retaining an open parent menu. Right/Left enters/leaves a submenu. Pinned group buttons have a small dropdown cue. Submenus open beside the parent as independent flyouts, flipping left and clamping to the viewport when necessary; they never expand inside a parent's scrolling surface. On very narrow viewports a clamped flyout may partially overlap its parent, but each surface has just one scrollbar. Bottom toolbars open their first-level menus upward. Overflow uses full-width icon-and-label rows with submenu chevrons. Outside clicks and toolbar command activation dismiss the open disclosures. Pinned and floating layouts are independently configurable; pointer interaction preserves engine selection. Use the same recursive layout entries for host configuration and registered groups, not custom per-group rendering code.

Toolbar items have a toggled-state. E.g. the `bold` item should appear toggled when the cursor is placed on a bold word. 

All quote choices are mutually exclusive toggles in Visual and Source views, with the current type shown as pressed like the heading choices. Selecting the active type removes the quote wrapper and alert marker while retaining its content and inline formatting. Selecting another type changes the existing quote without nesting; selecting plain Quote on an alert removes only the alert marker. There is no separate Remove quote button. Note, Tip, Important, Warning, and Caution use distinct information, lightbulb, message-alert, warning-triangle, and caution-octagon icons. Visual view uses the MDI file-edit-outline icon; Preview keeps its eye icon. Opening toolbar menus by pointer retains the document text selection, including its visible highlight, until a command is chosen.

Toolbar containers declare `type: 'group'` for inline items or `type: 'menu'` for a disclosure, both using recursive `items`. Nested inline groups create separated menu sections using the same controls and keyboard navigation. Alignment applies only to top-level containers. Responsive collapsing groups are a possible future type, not an implemented interaction. Live toolbar insertion uses explicit container IDs and optional group-local `beforeId` targets; append is the default. Without a group, additions go to the last top-level default-aligned inline group, never an opposite-aligned group or menu. Mermaid explicitly targets the insertion group before Horizontal rule, after Table and in the same group as Image. History and indentation contributions target their respective groups rather than deriving placement from icons. Explicit host ID references retain precedence, and absent groups are not created implicitly.

Alert quotes show a readable type label and a type-colored border in Visual and Preview: Note is blue, Tip green, Important magenta, Warning amber, and Caution red, with brighter dark-theme colors. The `[!TYPE]` source marker is hidden only in rendered presentation and remains in saved Markdown and Source view. Toolbar commands enforce a real line break after the marker, keeping it on its own line as required by GitHub alert syntax; inline marker text remains an ordinary quote. The quote menu marks only the detected type as active, including after loading Markdown or returning from Source.

When the screen is to narrow to house all items, the toolbar must overflow into a `...`  dropdown. 
### Status bar

The status bar is small. Its contents depends on the current view. It is hidden on smartphones to save some space. It must not contain critical information. 

Typical contents:
- current view name: Visual, Source, or Code (Help and Preview for nonediting views); display labels are distinct from internal API identifiers
- character count 
- max length if set

### Main work area

Contents depends on the view:

- WYSIWYG: editable markdown render + sidebar
- Raw: editable code editor + sidebar
- Mermaid: split editor with code and preview

## Views

**A view is the visible content of the main work area together with its appropriate toolbar, not a separate Markdown value.** Views are task-specific and use the same shell whether supplied by Markian, an extension, or a host application.

The editor retains the complete Markdown document. Editing sessions can modify the whole document or one target, such as a Mermaid/code block; Help modifies nothing. Switching presentation does not implicitly commit or discard a session. Opening Help from Mermaid preserves the draft, local undo history, and selection, and Back restores that task. The editor's `get()` still returns the complete document including the unfinished draft, never the displayed help text or just the code block.

Avoid large dialogs for substantial tasks. Instead, replace the main work area and align the toolbar with that view, keeping the editor shell in place. Small transient menus and simple prompts may remain popups. View navigation alone is not a content edit and must not reset history or mark a document dirty.

Views expose only applicable actions: Mermaid uses session-local undo and diagram controls, while Help offers navigation but no document editing undo or replace. Keep shared Back, overflow, search, and fullscreen placement consistent; disable or omit unsupported actions rather than applying them to a hidden session. Back from Help restores the previous task; Back from Mermaid itself applies its block draft as specified by the editing-session contract.

By default Markian includes the following built-in views:

- Markdown view (rendered, editable)
- Source view (raw markdown) - open from the Markdown button in the visual toolbar. Source shows Back instead of that button; Back validates and returns to visual editing without duplicating content events. Failed imports retain the source draft and show a diagnostic. Back from Help or Preview opened over source restores source first.
- Preview view (rendered, not editable) - used for the editor's disabled/read-only presentation. Retain search, selection, safe navigation, and a Copy Markdown action; do not make the entire toolbar inert. This is a view within the editor, not a standalone lightweight viewer.
- Help view (rendered, not editable) - very short manual for the editor. It shall have a chapter describing hotkeys and a separate chapter for each extension. Extensions shall contribute help as markdown via `getHelp()` and `getHelpForHotkeys()`

Other views can be added through the ordinary public instance API, equally by extensions and host applications. They follow the same presentation/session boundary and toolbar conventions.

### Disabled / Read-Only Editor

Markian remains an editor when editing is disabled. The separate W16 lightweight viewer renders display-only content directly; host widget adoption remains integration work. It is not a disabled editor with hidden controls. For editors, disabled/read-only means document mutation is blocked, not that focus, selection, or the whole toolbar is disabled.

Keep search (without replace), text selection, copying text or the complete current Markdown, safe link/outline navigation, Help, fullscreen, and diagram pan/zoom available. Disable or omit typing, paste/drop, insertion/formatting, undo/redo, replace, task-checkbox changes, uploads, and regeneration. Source/code views, if accessible, must be noneditable too. Apply the same rules to keyboard shortcuts, extension commands, and asynchronous results, not just visible buttons.

Entering or leaving this state must retain the current document, drafts, selection/history, and pending-workspace policy without implicitly committing edits or marking the document dirty. Do not copy Help content or only a block draft when Copy Markdown is used; copy the editor's complete current value. The host can still supply an intentional new value through its normal value-setting API.

### Lightweight Viewer

`[data-markian-viewer].markian-viewer` owns its `data-theme` and the same scoped
`.markian-document` typography as Preview. Load `markian-viewer.css` alone; it
includes content styling and viewer light/dark tokens without editor frames,
controls, engines, or a separately requested content stylesheet. The viewer is
unframed, constrained to its host width, and uses the existing 480px container
spacing rule. Long code and wide tables scroll locally, images scale within the
document, and keyboard links have visible focus. Task checkboxes are disabled.
Dark alert colors resolve from the content stylesheet's scope root. Viewer
content uses the same border-box sizing as the editor, including table cells.
Default table headings align left; explicit Markdown column alignment is retained.
Shared task styling retains identical checked colors and dimensions when disabled;
viewer tasks remain noninteractive. Comment-only visual paragraphs occupy no space
but remain in the editor document and saved Markdown. Mixed text/comment paragraphs
are not hidden.

The optional `extensions/viewer-mermaid.css` shares trusted SVG styling from
`src/render/mermaid.css` with W13, using scoped theme tokens and centered node
labels rather than renderer-supplied CSS. It adds no editing/pan/zoom toolbar.
Missing, disabled, pending, and failed renderers retain readable plain code.
Host display widgets supply their own surrounding UI. Chromium screenshots and
checks cover light/dark 1100px/360px viewports, real image decoding, focus,
overflow, and editor coexistence; real-device and screen-reader acceptance remain
open. The comparison example reuses `.demo-actions` and the shared stacked-header
pattern via `.demo-viewer`. Shared `.demo-comparison` and `.demo-pane` classes
provide equal-width desktop columns, compact headings, independently scrolling
surfaces, and vertically stacked narrow-screen panes. Editor mount sizing stays
inline in the example. Both panes share the Markdown value and theme; only the
editor exposes editing controls.

## Controls and Shared Patterns

| Pattern | Presentation and behavior |
| --- | --- |
| Command button | Use selected MDI icons, accessible names, and tooltips. Replace and Replace All use the official VS Code Codicon SVG outlines with their native 16px viewBox, matching familiar editor search controls without loading an icon font. The prototype uses 20px icons. Use text for explicit actions such as Back, not labels in place of familiar formatting icons. |
| Pinned toolbar | Group document commands predictably. Route every action to the active view and reflect its availability. |
| Selection toolbar | Stay near the selection without obscuring it; share command identities and state styling with the pinned toolbar. Default prose controls are Bold, Italic, Inline code, Strikethrough, Link, and Clear formatting. Preserve selection when interacting. |
| Option set | Use a menu for headings, lists, templates, or language choices; use recognizable selection state. |
| Mode choice | Clearly identify visual/raw or workspace mode. Switching mode must not resemble saving, discarding, or creating a new document. |
| Binary/numeric setting | Use a checkbox/toggle for binary settings and an appropriate input/stepper/slider for numeric values. |
| Dialog | Use shared field, label, error, action, and focus patterns for links, images, and similar tasks. Escape closes transient UI and focus returns to its origin. |
| Suggestion list | Use consistent loading, empty, error, and selected states with keyboard and pointer navigation. Never fabricate a successful result while work is pending. |
| Details/hover content | Provide the same information through keyboard focus and an explicit touch-accessible action, not hover alone. |

New patterns must be documented here and implemented through shared classes/components before being repeated elsewhere. Keep normal, hover, focus-visible, active, disabled, loading, and error states distinguishable. Individual disabled controls must not appear actionable, but the editor's disabled/read-only state must leave permitted nonmutating controls usable.

## Content and Specialized Views

Search and destination dialogs are compact `.markian-panel` surfaces in instance-owned `.markian-popup` native popover wrappers. Place them beneath the corresponding Link, Image/file, or Search button, clamped to the viewport, with a speech-bubble tip pointing to that button. Commands inside overflow point to More after the menu closes. Bottom toolbars open panels above their button, and limited viewport space may also flip placement upward. Only the inner panel scrolls, leaving the tip visible. Stack full-width labeled inputs vertically; keep checkbox options together and group actions in `.markian-panel-actions` below the fields. Search includes previous/next, count, case/word options, and replacement controls only when permitted. Help/Preview highlights are presentation-only. Destination dialogs share field/suggestion styling, target-heading selection, file selection, and a focus trap. Escape and explicit Close return focus to editing; an outside pointer press dismisses the popup without stealing focus from the clicked destination, including another instance. Dismissal aborts destination lookups, but does not silently cancel an already-started image insertion. Suggestions show loading/empty/error states; do not make a pending result look saved.

The image dialog stacks Image URL, Upload new image, and Tooltip (alternative text), in that order. Destination input controls share a 34px height; the file-picker button fits inside that height instead of enlarging its field. All three labels use the same grid gap, and empty status output occupies no row. Hosts may override the shared field height to match their native form density.

Link properties prefill the destination for a caret inside a link or selected text wholly within one link, including inline formatting. The floating toolbar preserves that selection when opening the dialog. Applying a destination without changing the label preserves the existing inline formatting. Mixed linked/unlinked text and selections with different destinations leave the destination empty rather than choosing an arbitrary link.

Table caret/touch controls use `.markian-floating` and the same commands as context/overflow menus, without requiring right-click. Tasks render actual checkboxes, disabled when editing is forbidden. Opt-in colors use compact labeled hex swatches, not text pills; arbitrary style controls are not supported.

The `.markian-outline` sidebar uses parsed headings and `aria-current="location"`; it excludes the title beginning on line 1 and starts with a compact "Outline" heading. It is visible by default; `sidebarVisible: false` starts collapsed. Its toolbar toggle reflects visibility through `aria-pressed` and the shared pressed styling. Document and outline are adjacent independently scrolling areas, including narrow layouts, never an overlapping drawer. Heading navigation keeps the sidebar open and scrolls the active visual/source surface, never the outer page. Specialized views hide the document outline without losing its visibility choice. Presentation changes do not change Markdown. Pending image panels offer Cancel; failure panels offer Retry and Remove pending image. Both themes reuse these same classes.

- Document links remain recognizable and preserve ordinary Markdown destinations. Mentions may receive subtle highlighting, but their stored value remains text.
- Task checkboxes use 16px native controls aligned with the first text line, a clear gap before the text, and consistent item spacing in editing and Preview. List-type changes apply to all selected items and remove obsolete task markers when switching to bullets or numbering. Table controls are contextual and compact; editing a cell must not unexpectedly open a different surface.
- Enter continues nonempty bullet, numbered, and task list items; Enter on an empty item exits or lifts the list using ProseMirror list behavior. Code blocks retain their ordinary newline behavior.
- Visual typing supports backtick-delimited inline code and typing between a pair of backticks. Right Arrow or a closing backtick at the inline-code boundary resumes ordinary text without inserting invisible characters. At a paragraph's start, three or more backticks or tildes with an optional language become a code block on Space or Enter, not on the final fence character. Typing inside code blocks stays literal.
- Hidden comments and extension delimiters remain invisible in the normal document view. Do not render metadata as badges or private syntax without a specific approved interaction.
- Raw mode uses CodeMirror, source-local selection/history, and its own outline. Keep the toolbar and surrounding frame consistent with visual mode rather than introducing a separate application aesthetic.
- Mermaid uses a dedicated code/preview workspace. On desktop show both panes; on narrow layouts stack them without overlap. Keep Back as the default return/apply action; do not add redundant Apply/Cancel controls.
- Diagram previews must expose useful loading and syntax-error states without replacing editable source. Pan/zoom/reset controls affect only presentation.
- In Visual view, Backspace at the start of the paragraph immediately after a rendered diagram, or Delete at the end of the paragraph immediately before it, removes the entire diagram, like an image, instead of joining text into its hidden source. This includes an empty adjacent paragraph. Surrounding text remains editable, Undo restores the diagram, and read-only state prevents deletion. Ordinary unrendered code fences retain normal code editing.
- W13 ships its styling separately in `dist/extensions/mermaid.css`. `.markian-mermaid` uses two equal constrained columns above 600px of container width and stacked, independently bounded source/preview rows below that width. Diagram controls reuse `.markian-floating` and `.markian-button`, with Edit, Zoom in/out, Reset, and Retry icons. The toolbar floats at the top right on hover/focus without reserving layout space; touch devices and error states keep it visible. Insert diagram uses the MDI `sitemap-outline` icon. The focusable preview supports arrows, plus/minus and Home, as well as dragging and Ctrl/Cmd-wheel. Loading/error messages remain outside the pannable surface; missing host configuration shows an error instead of a diagram or source preview. SVG node labels remain centered and scoped token-based shapes remain legible without accepting renderer-supplied CSS. Default diagrams have no extra card wrapper. Read-only inspection retains diagram controls while source mutations and history controls are blocked. The separate example provides theme/read-only controls without adding Mermaid to the main workspace.
- Images retain alternative text and show bounded pending/error presentation. Temporary upload state must not look like confirmed persisted content.

## Example Pages

Keep each example's markup, editor-related styles, configuration, sample Markdown, and JavaScript together in one clearly named HTML file with consistent indentation and one CSS declaration per line. Import the built library styles/scripts rather than pasting their implementation into the example. Reuse [demo.css](../Examples/demo.css) for the neutral page shell, fonts, headers, branding, page layouts, demo controls, and output styling. Page classes select layout variants; shared class names keep brand, workspace labels, and controls consistent. Only editor mount sizing and editor-specific overrides belong inline. Neither page-shell nor example-only styles become part of the reusable library contract. The example index is a simple list of named pages, not an all-features application.

## Visual Language

- Keep the document visually dominant. Use restrained borders and tonal surfaces to separate toolbar, writing area, outline, and specialized workspaces.
- Avoid decorative cards around ordinary sections, nested panels, oversized headings in tools, heavy shadows, and marketing-style elements inside the library.
- Use a neutral surface palette with a restrained green/teal accent. Reserve distinct feedback colors for warnings and errors; do not communicate state by color alone.
- Use spacing and alignment consistently. Related commands form compact groups, not individually styled buttons scattered around the frame.
- Preserve host layouts. The library must not impose the demo's page width, masthead, background, fonts, or external asset requests on the containing application.

## Theme Tokens

The prototype uses these CSS variables. Evolve this shared token system rather than adding unrelated literal colors for individual widgets.

| Token | Light baseline | Use |
| --- | --- | --- |
| `--background` | `#f5f7f6` | Demo/page background; not a global host override. |
| `--surface` | `#ffffff` | Editor and tool surfaces. |
| `--text` | `#262c2b` | Primary text. |
| `--muted` | `#757e7a` | Secondary labels and metadata. |
| `--line` | `#e3e8e5` | Dividers and boundaries. |
| `--accent` | `#227761` | Links, active commands, and emphasis. |
| `--accent-soft` | `#e8f3ee` | Selected/active surface treatment. |
| `--code` | `#f1f3f4` | Inline and block code surfaces. |

Dark mode must define a complete corresponding palette, not merely invert the page; the prototype uses `#8bd7b7` for its dark accent. Check text, icons, selections, menus, code, tables, and diagram previews in both themes. Changing one instance's theme must not restyle another instance or the host.

Scope extracted-library selectors and theme variables to its root. Reuse the same CSS classes/tokens for the same control pattern across visual, raw, and specialized views. Similar-looking duplicate implementations are not a shared design system.

## Typography

The prototype uses Public Sans for ordinary UI/body text, Space Grotesk for display/brand headings, and IBM Plex Mono for code. These establish the baseline character; they are not mandatory remote font dependencies. Library typography must support host overrides and usable local fallbacks.

The current demo and packaged example reuse the prototype's masthead: a green "m." symbol, a thin divider, the lowercase Space Grotesk wordmark, and a small uppercase workspace label. The demo stylesheet serves Space Grotesk locally alongside its OFL license; neither the font nor the masthead belongs to the library assets. Keep the existing demo controls usable when the header stacks on small screens.

- Separate document hierarchy from tool hierarchy. Toolbar labels, outline headings, dialogs, and status text stay compact; demo branding does not set tool heading sizes.
- Use consistent document spacing for headings, paragraphs, lists, quotes, code, and tables in editable and disabled/read-only editor output.
- Lists use 24px indentation, 8px outer vertical margins, and 2px item spacing, without ordinary paragraph bottom margins inside items. Tables use 4px vertical / 8px horizontal cell padding, 72px minimum cell width, and 1.5 line height. Cell paragraphs have no outer margin; additional paragraphs within a list item or table cell keep a 4px gap. Task lists use the same compact item spacing.
- Keep code monospaced, preserve meaningful whitespace, and provide scrolling for long lines where appropriate.
- Do not use viewport-scaled type or negative letter spacing. Allow labels to wrap or constrain their layout without overlapping neighbors.

## Frame and Responsive Layout

The desktop prototype uses a document area with a 212px outline, reduced to 180px at 1200px. At 760px and below, the outline is hidden, the editor becomes a single column, toolbar targets grow, and Mermaid code/preview panes stack. These are current baselines; embedded sizing must ultimately respond to available container space, not assume the full browser width.

- Keep the pinned toolbar discoverable and the active writing surface bounded by its own scroll area.
- Outline navigation scrolls the active editor, not the outer host page. Raw mode uses CodeMirror positions and its own scrolling behavior.
- Give toolbars, icons, pane tracks, and status areas stable dimensions so hover, selection, and loading do not shift the layout.
- Overflow tools through a deliberate horizontal strip or menu. Do not let controls overlap content or become unreachable on narrow screens.
- Fullscreen remains the same editing experience with more space. Restore the prior host layout, focus, and scrolling on exit.
- The fullscreen button shows outward arrows with the name and tooltip "Maximize" normally, and inward arrows with "Restore original size" while expanded. Its pressed state follows fullscreen, including when Escape restores the original size or views change.

## Accessibility and Motion

Support keyboard traversal, visible focus, meaningful accessible names, and sensible focus restoration across menus, dialogs, mode changes, and workspaces. Ensure toolbar and touch targets remain usable; the prototype increases toolbar buttons from 32px to 40px on mobile, which does not by itself establish accessibility conformance.

Check contrast in both themes, including muted labels and disabled states. Respect reduced-motion preferences. The prototype's brief frame entrance is optional decoration; motion must never be needed to understand state or delay editing.

## Visual Verification

For changes to shared presentation, inspect the affected states in light/dark themes at desktop and narrow mobile sizes. Include embedded/hidden-then-shown containers when lifecycle or sizing is touched. Use Playwright checks/screenshots where appropriate and verify actual interaction, focus, overflow, and text fitting, not only a static image.

Update this guide when a pattern changes, and update the architecture only if the change also alters ownership or structural principles. Do not treat a one-off screenshot as a replacement for reusable styling rules.