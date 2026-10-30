# Style Guide

Markian is a focused writing tool: the document is dominant, controls are compact, and navigation stays predictable. This guide defines shared appearance and interaction patterns for integrators and contributors. See [configuration](Configuration.md) for options and [architecture](Architecture.md) for concepts.

## Layout

The editor has a toolbar, a bounded main work area, and a small status bar. The main work area contains the active view and, for document editing, an adjacent outline. Each scrollable surface owns its scrolling; navigation must not scroll the surrounding host page.

Substantial tasks replace the work area inside the same shell rather than opening large dialogs. Small menus and transient forms use shared popovers. Avoid decorative cards, nested panels, oversized tool headings, heavy shadows, and marketing elements inside the editor.

Give the host an explicit usable height. The editor fills it while retaining a usable minimum height. Keep pane tracks, controls, icons, and status regions stable so dynamic labels or loading states do not shift the layout. Exact dimensions, spacing, and breakpoints belong in the [visual editor component guide](Development/Components/Visual_editor.md).

## Shared Components

| Component | Purpose and shared pattern |
| --- | --- |
| Button | Executes one command. Use `.markian-button`, an accessible name, a tooltip, and an existing icon. Pressed and disabled states must be distinct. |
| Button group | Related inline commands. Toolbar `type: "group"` uses shared controls and generated separators, not a separately styled panel. |
| Menu | A disclosed option set using `.markian-menu` and `.markian-menu-items`. Use labels and icons, nested flyouts, and visible selection state. |
| Toolbar | The active view's commands. `.markian-toolbar` owns pinned controls; `.markian-floating` is used for contextual controls. |
| Transient panel | A compact form in `.markian-popup` with `.markian-panel`, labels, status output, and `.markian-panel-actions`. Search and destination forms share this pattern. |
| Suggestion list | `.markian-suggestions` with keyboard/pointer selection and distinct loading, empty, failure, and selected states. |
| Outline | `.markian-outline`, parsed heading buttons, compact title, and `aria-current="location"`. |
| Status bar | `.markian-status` for view name and character count. Never put critical information only here; compact layouts hide it. |
| Diagnostic | Bounded readable text describing a failure without replacing editable source or rendering error text as HTML. |
| Color swatch | Compact labeled hex-color choice. Do not use text pills or an unrestricted CSS input. |

Use selected MDI icons; search replacement uses the existing Codicon outlines. Do not introduce a second icon system or duplicate similar-looking controls. Use text for clear actions where appropriate, not as a substitute for familiar formatting symbols.

## Toolbar and Menus

The default groups are History, Format, Insert, Document, and opposite-aligned Utilities. Utilities contains Search, Maximize, and Outline, with Outline last. Other groups can overflow into More. Alignment comes from top-level configuration, never a command's name. More precedes opposite-aligned controls.

Groups generate separators only when they have visible content. Custom layouts and live contributions use the same recursive `group`/`menu` structure. Insertion targets explicit group IDs and optional direct-child ordering IDs. Missing groups are not created implicitly. See [toolbar configuration](Configuration.md#toolbar).

Pinned controls reflect active state at the caret or selection. The floating prose toolbar offers Bold, Italic, Inline code, Strikethrough, Link, and Clear formatting by default. Table actions and code expansion use their own contextual controls. Code expansion is caret-contextual, not a default pinned command.

Floating controls must not cover selected text.

Views with Back place it first, followed by a separator, and omit the document View mode menu. View-specific Undo/Redo stays in the history position. Unsupported actions are omitted or disabled rather than applied to a hidden session.

Menus use native details/summary disclosure and native popover surfaces. Pointer interaction preserves document selection. Flyouts open beside the parent, flip and clamp to the viewport, and have one scrollbar each. Bottom toolbars open first-level menus upward. Outside clicks and command activation dismiss menus.

Keyboard navigation follows these rules:

- Up/Down and Home/End move within the active menu, including its submenu headings.
- Right enters a submenu; Left leaves it.
- Escape closes the active menu and returns focus to its summary, retaining an open parent.

For technical details - see [toolbar component guide](Development/Components/Toolbars.md).

## Views and Permissions

Visual, Source, Preview, and Help share the editor shell. Code and Mermaid add task-specific workspaces. Display names such as Source are distinct from API IDs such as `raw`.

View navigation is not a document edit. Opening Help preserves the suspended draft, selection, and local history. Back from Help restores the prior task; Back from a block workspace applies that draft once. Copy Markdown always copies the complete projected document, not Help text or just one block.

Read-only/disabled editors retain selection, copying, search without replacement, safe links, outline navigation, Help, fullscreen, and diagram inspection. They block typing, paste/drop, task toggles, insertion, formatting, replacement, uploads, and undo/redo. Preserve pending drafts and history through permission changes. Preview is a nonediting view, not a mandatory mode switch when permissions change.

The standalone viewer has no editor controls or frame. Its root is `[data-markian-viewer].markian-viewer`, with instance-local theme and shared `.markian-document` typography. Tasks are always disabled. Long code and wide tables scroll locally, images fit the host, and links show keyboard focus. Viewer Mermaid adds no editing or pan/zoom toolbar.

## Panels and Outline

Search, link, and image forms are anchored to their visible toolbar button with a small pointer. Commands from More point to More after it closes. Panels flip above bottom controls or when space is limited, clamp to the viewport, and scroll internally without clipping the pointer.

Stack full-width labeled inputs vertically; keep checkbox options together and actions below fields. Destination fields share consistent dimensions. The image form orders Image URL, Upload new image, and alternative text; an empty status occupies no row. Use focus containment, Escape/Close restoration, and outside dismissal that does not steal focus from the clicked destination or another editor.

Search offers previous/next, count, case/word options, and replacement only when permitted. Help/Preview highlighting is disposable presentation. Destination suggestions and heading inspection show pending/error states rather than fabricated success. Dismissal aborts lookups but does not silently cancel an already-started upload. Pending images offer Cancel; failed insertions offer Retry and Remove.

The outline is visible by default and starts with a compact Outline title. It omits a document title starting on source line 1. Its button reflects visibility with `aria-pressed`. Heading navigation retains visibility and scrolls the active visual/source surface. Specialized views hide it temporarily without resetting the choice. Even in narrow layouts, document and outline remain adjacent independently scrolling areas, not an overlapping drawer.

## Document Presentation

Use consistent spacing in Visual, Preview, and viewer output. Code is monospaced and preserves meaningful whitespace. Hidden comments remain invisible without deleting source. Comment-only visual paragraphs occupy no space; mixed text/comment paragraphs remain visible.

Base editor CSS removes accidental outer paragraph margins inside lists and table cells. Content CSS can refine the fallback paragraph spacing. Packaged content styling keeps lists and tables compact, with clear indentation and separation between items and paragraphs. Hosts should not duplicate structural normalization in a theme.

Tasks use native checkboxes aligned to the first text line. Disabled viewer tasks retain the same dimensions and checked colors. Column alignment follows Markdown; default table headings align left. Contextual row/column controls share the same command buttons as menus.

Table range pastes retain the pasted selection. Clipboard formats, smart paste, and compatibility with other applications are described in [interoperability](Interoperability.md).

Delete at the end of the paragraph before a table, or Backspace at the start of the paragraph after it, removes the whole table in one undoable edit. Read-only and disabled editors block these edits.

Alert quotes retain ordinary `> [!TYPE]` source markers. Presentation hides the marker and shows a type label and colored border: Note blue, Tip green, Important magenta, Warning amber, Caution red, with corresponding dark colors. Quote choices are mutually exclusive toggles; selecting the active type removes the wrapper, while changing type does not nest quotes.

Backtick inline-code typing and submitted backtick/tilde fences should behave like ordinary Markdown editing, without invisible inserted characters. Enter continues lists; Enter on an empty item exits or lifts it. Code-block typing stays literal.

## Mermaid Workspace

Use separate `dist/extensions/mermaid.css` styling. The Mermaid workspace has equal constrained source and preview columns when space permits; narrower workspaces stack bounded rows. Back is the default apply/return action; do not add redundant Apply/Cancel buttons.

Diagram labels are centered. Controls reuse `.markian-floating` and `.markian-button`, overlaid at the top right on hover/focus without reserving a fixed strip. Touch and error states keep controls visible. Loading/errors stay outside the pannable surface; failures never replace source. Avoid an extra card wrapper around a normal diagram.

Diagrams retain Mermaid's native `default`/`dark` theme colors, fonts, strokes, label backgrounds and supplied diagram colors. Markian styles only the workspace and controls, not SVG nodes or text. Original Mermaid style tags and inline styles remain intact, without CSS isolation or rewriting; see the accepted risks in the [Mermaid extension guide](Development/Extensions/Mermaid_extension.md#svg-styling-and-safety). Viewer diagrams fit the host with a responsive maximum.

Pointer/touch dragging pans. A focused preview uses arrows to pan, plus/minus to zoom, and Home to reset; Ctrl/Cmd-wheel also zooms. Labeled controls provide equivalent actions. Read-only inspection retains these presentation controls.

Backspace/Delete at the adjacent visual paragraph boundary removes a rendered diagram as one object rather than merging text into its hidden source. Undo restores it; read-only state blocks removal. Ordinary unrendered fences retain regular code editing.

## Stylesheets and Themes

Load base `markian.css` explicitly. `markdownCssUrls` replaces content CSS, including `[]` for none; omission loads `markdown-github.css` beside the classic script. The viewer accepts the same replacement option; omission retains its built-in content styling. `markdownCssClasses` adds host classes only to document wrappers in Visual, Preview, Help and viewer output, including replacement renders. It does not theme controls or disable default typography by itself. `themeCssUrls` appends editor theme overrides. Readiness waits for these instance-owned links; destruction removes them.

These are ordinary page stylesheets. Scope document rules to `.markian-document` inside a host wrapper and chrome rules to that wrapper or `.markian`. Avoid Milkdown DOM selectors in integrations. The default content stylesheet uses a default-only instance marker so it does not restyle custom-content instances.

The current editor root exposes `[data-markian]`, `data-theme`, and `data-view`. Shared theme variables are:

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--markian-surface` | `#fff` | `#202524` | Tool surfaces. |
| `--markian-text` | `#262c2b` | `#e5ece8` | Text and icons. |
| `--markian-muted` | `#59645f` | `#a7b5ae` | Secondary labels. |
| `--markian-line` | `#dce3df` | `#414c46` | Borders and dividers. |
| `--markian-accent` | `#227761` | `#8bd7b7` | Links, focus, active controls. |
| `--markian-focus-color` | Falls back to `--markian-accent` | Falls back to `--markian-accent` | Focused editor border; hosts can match their input focus color. |
| `--markian-soft` | `#e8f3ee` | `#30483d` | Selected/hover surfaces. |
| `--markian-code` | `#f1f3f4` | `#2b3330` | Code surfaces. |
| `--markian-font` | `'Public Sans', 'Segoe UI', sans-serif` | Same | Local UI font stack. |
| `--markian-mono` | `'IBM Plex Mono', Consolas, monospace` | Same | Local code font stack. |

Viewer CSS provides its own scoped theme values. Neither library requests remote fonts. Use complete light/dark palettes, visible focus, and distinguishable loading/error/disabled states. A theme change must not restyle another instance or the host. Do not use viewport-scaled type or negative letter spacing.

Focus anywhere inside the editor highlights its existing outer border without changing its size. Visual editing has no inset focus bar. Set `--markian-focus-color` on the editor root in a host theme to match surrounding input controls; individual toolbar controls retain their keyboard-focus outlines.

## Responsive Layout and Accessibility

Respond to editor container width, not only viewport width. Compact layouts enlarge touch targets, move the toolbar below the work area, and hide status. Wider layouts use compact controls; pinned controls retain their own sizing. Menus and panels must remain reachable without overlapping text.

Fullscreen preserves the same root and task. Use Maximize with outward arrows and Restore original size with inward arrows; pressed state follows actual expansion, including Escape restoration. Restore host layout and focus on exit.

Provide meaningful names, visible keyboard focus, predictable traversal, and focus restoration. Do not rely on hover or color alone. Respect reduced motion. Current checks do not establish full accessibility, screen-reader, real-device, or cross-browser conformance.

## Examples and Verification

Example pages use [demo.css](../Examples/demo.css) for shared branding, headers, controls, page layouts, and output. Editor mount sizing and configuration stay inline in each named HTML file. The local Space Grotesk demo font and masthead are not library dependencies. The editor/viewer comparison uses shared `.demo-comparison` and `.demo-pane` equal columns that stack on narrow screens.

When changing UI, inspect the affected interactions in the smallest relevant theme/viewport selection: focus, overflow, scrolling, text fitting, and instance isolation where relevant. Use screenshots and actual interaction checks, not only DOM presence. Follow [focused validation rules](Development/index.md#validation); documentation-only changes do not require browser tests.
