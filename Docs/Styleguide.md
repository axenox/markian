# Markian Style Guide

## Purpose and Status

Markian should feel like a focused writing tool: a readable document, compact recognizable controls, and enough structure to navigate without turning the page into a dashboard. The approved prototype is the visual baseline, not a license to copy its demonstration shell into every integration.

This is the living reference for look-and-feel, shared UI patterns, and interaction presentation. Update it in the same change whenever a reusable visual or interaction pattern changes. Internal ownership belongs in the [architecture](Architectur.md); feature scope and implementation status belong in the [plan](Requirements/Plan.md).

The current implementation is in [style.css](../src/style.css) and the [prototype](../README.md). Rules for the extracted library below are design requirements, not claims that scoped themes, configurable toolbars, or every accessibility state already exist.

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

- Separate document hierarchy from tool hierarchy. Toolbar labels, outline headings, dialogs, and status text stay compact; demo branding does not set tool heading sizes.
- Use consistent document spacing for headings, paragraphs, lists, quotes, code, and tables in editor and viewer output.
- Keep code monospaced, preserve meaningful whitespace, and provide scrolling for long lines where appropriate.
- Do not use viewport-scaled type or negative letter spacing. Allow labels to wrap or constrain their layout without overlapping neighbors.

## Frame and Responsive Layout

The desktop prototype uses a document area with a 212px outline, reduced to 180px at 1200px. At 760px and below, the outline is hidden, the editor becomes a single column, toolbar targets grow, and Mermaid code/preview panes stack. These are current baselines; embedded sizing must ultimately respond to available container space, not assume the full browser width.

- Keep the pinned toolbar discoverable and the active writing surface bounded by its own scroll area.
- Outline navigation scrolls the active editor, not the outer host page. Raw mode uses CodeMirror positions and its own scrolling behavior.
- Give toolbars, icons, pane tracks, and status areas stable dimensions so hover, selection, and loading do not shift the layout.
- Overflow tools through a deliberate horizontal strip or menu. Do not let controls overlap content or become unreachable on narrow screens.
- Fullscreen remains the same editing experience with more space. Restore the prior host layout, focus, and scrolling on exit.

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

New patterns must be documented here and implemented through shared classes/components before being repeated elsewhere. Keep normal, hover, focus-visible, active, disabled, loading, and error states distinguishable. Disabled controls must not appear actionable; read-only presentation is a separate state.

## Content and Specialized Views

- Document links remain recognizable and preserve ordinary Markdown destinations. Mentions may receive subtle highlighting, but their stored value remains text.
- Task checkboxes look and behave like checkboxes. Table controls are contextual and compact; editing a cell must not unexpectedly open a different surface.
- Hidden comments and extension delimiters remain invisible in the normal document view. Do not render metadata as badges or private syntax without a specific approved interaction.
- Raw mode uses CodeMirror, source-local selection/history, and its own outline. Keep the toolbar and surrounding frame consistent with visual mode rather than introducing a separate application aesthetic.
- Mermaid uses a dedicated code/preview workspace. On desktop show both panes; on narrow layouts stack them without overlap. Keep Back as the default return/apply action; do not add redundant Apply/Cancel controls.
- Diagram previews must expose useful loading and syntax-error states without replacing editable source. Pan/zoom/reset controls affect only presentation.
- Images retain alternative text and show bounded pending/error presentation. Temporary upload state must not look like confirmed persisted content.

## Accessibility and Motion

Support keyboard traversal, visible focus, meaningful accessible names, and sensible focus restoration across menus, dialogs, mode changes, and workspaces. Ensure toolbar and touch targets remain usable; the prototype increases toolbar buttons from 32px to 40px on mobile, which does not by itself establish accessibility conformance.

Check contrast in both themes, including muted labels and disabled states. Respect reduced-motion preferences. The prototype's brief frame entrance is optional decoration; motion must never be needed to understand state or delay editing.

## Visual Verification

For changes to shared presentation, inspect the affected states in light/dark themes at desktop and narrow mobile sizes. Include embedded/hidden-then-shown containers when lifecycle or sizing is touched. Use Playwright checks/screenshots where appropriate and verify actual interaction, focus, overflow, and text fitting, not only a static image.

Update this guide when a pattern changes, and update the architecture only if the change also alters ownership or structural principles. Do not treat a one-off screenshot as a replacement for reusable styling rules.