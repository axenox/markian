# Markian Style Guide

## Purpose and Status

Markian should feel like a focused writing tool: a readable document, compact recognizable controls, and enough structure to navigate without turning the page into a dashboard. The approved prototype is the visual baseline, not a license to copy its demonstration shell into every integration.

This is the living reference for look-and-feel, shared UI patterns, and interaction presentation. Update it in the same change whenever a reusable visual or interaction pattern changes. Internal ownership belongs in the [architecture](Architecture.md); feature scope and implementation status belong in the [plan](Requirements/Plan.md).

The new implementation is in [style.css](../src/style.css), with engine-independent typography in [content.css](../src/render/content.css). The original prototype is archived. The current slice implements scoped light/dark surfaces, MDI icon controls with native name tooltips, stable 32px toolbar buttons, a horizontally scrolling strip, view-local editing surfaces, status, and an inline diagnostic. Below 480px of editor container width, controls become 40px, the toolbar moves below the work area, and status is hidden. Fullscreen uses the same root within the current document viewport. Advanced overflow menus, floating controls, search, outlines, host-owned fullscreen callbacks, and complete accessibility verification remain planned.

The public root is `[data-markian]` with `data-theme`, `data-view`, and (after a permission change) `data-readonly`. `.markian-document` is the content styling hook; do not depend on Milkdown DOM. All library selectors are scoped under `.markian` or the explicit content hook; demo page styles are separate and no fonts are requested remotely. Current variables use the `--markian-` prefix: `surface`, `text`, `muted`, `line`, `accent`, `soft`, `code`, `font`, and `mono`. The unprefixed prototype tokens below are historical reference, not the current customization API.

### Global layout

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
- search button - shows a small input with search&replace controls in the main workarea
- full-screen button

Toolbar items are buttons. They can either execute a command or show a dropdown with more buttons. 

The current H2 button toggles the selected textblock between Heading 2 and a regular paragraph; other heading levels become Heading 2. Its accessible name and tooltip are "Heading 2".

Toolbar items have a toggled-state. E.g. the `bold` item should appear toggled when the cursor is placed on a bold word. 

Toolbar items can be arranged in groups for better visualization. 

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

Markian remains an editor when editing is disabled. The separate W16 lightweight viewer is planned for display-only host widgets after Codiware integration; it must not be a disabled editor with hidden controls. For editors, disabled/read-only means document mutation is blocked, not that focus, selection, or the whole toolbar is disabled.

Keep search (without replace), text selection, copying text or the complete current Markdown, safe link/outline navigation, Help, fullscreen, and diagram pan/zoom available. Disable or omit typing, paste/drop, insertion/formatting, undo/redo, replace, task-checkbox changes, uploads, and regeneration. Source/code views, if accessible, must be noneditable too. Apply the same rules to keyboard shortcuts, extension commands, and asynchronous results, not just visible buttons.

Entering or leaving this state must retain the current document, drafts, selection/history, and pending-workspace policy without implicitly committing edits or marking the document dirty. Do not copy Help content or only a block draft when Copy Markdown is used; copy the editor's complete current value. The host can still supply an intentional new value through its normal value-setting API.

### Planned Lightweight Viewer

Share scoped document typography, safe rendered-content styling, theme tokens, and responsive media/table behavior with the editor from the beginning, without importing the editor frame, toolbars, dialogs, or engine styles. The viewer has no editing chrome; host display widgets supply their own surrounding UI. Retain accessible text selection, safe link navigation, nonmutating task presentation, and plain-code fallback when optional rendering is unavailable. W16 verifies standalone viewer CSS, light/dark desktop/mobile layouts, overflow, and coexistence with editors; this is planned behavior, not prototype conformance.

## Controls and Shared Patterns

| Pattern | Presentation and behavior |
| --- | --- |
| Command button | Use selected MDI icons, accessible names, and tooltips. The prototype uses 20px icons. Use text for explicit actions such as Back, not labels in place of familiar formatting icons. |
| Pinned toolbar | Group document commands predictably. Route every action to the active view and reflect its availability. |
| Selection toolbar | Stay near the selection without obscuring it; share command identities and state styling with the pinned toolbar. Preserve selection when interacting. |
| Option set | Use a menu for headings, lists, templates, or language choices; use recognizable selection state. |
| Mode choice | Clearly identify visual/raw or workspace mode. Switching mode must not resemble saving, discarding, or creating a new document. |
| Binary/numeric setting | Use a checkbox/toggle for binary settings and an appropriate input/stepper/slider for numeric values. |
| Dialog | Use shared field, label, error, action, and focus patterns for links, images, and similar tasks. Escape closes transient UI and focus returns to its origin. |
| Suggestion list | Use consistent loading, empty, error, and selected states with keyboard and pointer navigation. Never fabricate a successful result while work is pending. |
| Details/hover content | Provide the same information through keyboard focus and an explicit touch-accessible action, not hover alone. |

New patterns must be documented here and implemented through shared classes/components before being repeated elsewhere. Keep normal, hover, focus-visible, active, disabled, loading, and error states distinguishable. Individual disabled controls must not appear actionable, but the editor's disabled/read-only state must leave permitted nonmutating controls usable.

## Content and Specialized Views

- Document links remain recognizable and preserve ordinary Markdown destinations. Mentions may receive subtle highlighting, but their stored value remains text.
- Task checkboxes look and behave like checkboxes. Table controls are contextual and compact; editing a cell must not unexpectedly open a different surface.
- Hidden comments and extension delimiters remain invisible in the normal document view. Do not render metadata as badges or private syntax without a specific approved interaction.
- Raw mode uses CodeMirror, source-local selection/history, and its own outline. Keep the toolbar and surrounding frame consistent with visual mode rather than introducing a separate application aesthetic.
- Mermaid uses a dedicated code/preview workspace. On desktop show both panes; on narrow layouts stack them without overlap. Keep Back as the default return/apply action; do not add redundant Apply/Cancel controls.
- Diagram previews must expose useful loading and syntax-error states without replacing editable source. Pan/zoom/reset controls affect only presentation.
- Images retain alternative text and show bounded pending/error presentation. Temporary upload state must not look like confirmed persisted content.

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