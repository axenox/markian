# Matching the Host Application

Markian can use the surrounding application's visual language without adding a
dependency on its UI framework. This guide is for integrators building that
styling layer. See the [style guide](Styleguide.md) for Markian's shared patterns
and [configuration](Configuration.md) for stylesheet and theme options.

## Approach

1. **Compare real controls.** Place an ordinary host text field, multiline field,
   toolbar button, checkbox, select and text label beside Markian. Inspect their
   computed styles in the browser, including hover and keyboard focus. A theme's
   token names alone do not tell you how a control actually paints.
2. **Map host tokens to Markian variables.** Reuse the host's fonts, colours,
   borders, shadows and density values instead of copying one theme's pixel
   values. Inspect complete background styling: a field's bottom line may be a
   background image or gradient, not a border.
3. **Keep overrides in a host stylesheet.** Do not edit packaged library CSS.
   Scope rules to an integration class on the actual editor and viewer roots.
   Use Markian variables first and targeted selectors where a variable does not
   cover the required detail.
4. **Separate content from editable controls.** Share document typography, links
   and code styling across Visual, Preview and the standalone viewer. Keep field
   borders, validation decoration and input padding on editable surfaces only.
5. **Test the real states and layouts.** Compare rendered measurements, then use
   genuine pointer and keyboard interaction. Check light/dark themes, supported
   densities, narrow containers and fullscreen before calling a match complete.

Styling is presentation, not a document transformation. Theme changes must not
rewrite Markdown, recreate the editor or lose drafts, selection or history.

## Scoping and Stylesheet Order

The editor uses `.markian`; the independent viewer uses `.markian-viewer`.
Both contain `.markian-document`. The viewer defines its own theme variables, so
styling only the editor does not theme a standalone viewer.

Add your integration class to the library-owned root, not just its host wrapper.
Fullscreen can move the editor outside that wrapper. Ensure host tokens, density
classes and fonts remain available after reparenting, and restore temporary
layout changes on exit. Avoid global rules for `input`, `button`, `code` or
`.markdown-body`, which can change unrelated controls and other instances.

Content stylesheets can override document font size, padding, code backgrounds
and colours independently of the toolbar. Check the winning rule, specificity
and load order rather than increasing specificity everywhere. Keep base assets
loaded; consult [stylesheet configuration](Configuration.md) before replacing
content styles or adding editor theme overrides. Load corresponding host
overrides for the independent viewer too.

The following is an illustrative starting point, not a complete control theme.
`--host-*` names represent tokens supplied by your application, not Markian
options. Attach `host-theme` to the actual editor and viewer roots.

```css
.markian.host-theme,
.markian-viewer.host-theme {
    --markian-font: var(--host-font-family);
    --markian-mono: var(--host-monospace-font-family);
    --markian-text: var(--host-text-color);
    --markian-muted: var(--host-label-color);
    --markian-line: var(--host-divider-color);
    --markian-accent: var(--host-accent-color);
    --markian-soft: var(--host-hover-background);
    --markian-code: var(--host-code-background);
}

.markian.host-theme {
    --markian-surface: var(--host-field-background);
}

.markian-viewer.host-theme {
    --markian-surface: transparent;
}

:is(.markian.host-theme, .markian-viewer.host-theme) .markian-document {
    font-family: var(--markian-font);
    font-size: var(--host-font-size);
    line-height: var(--host-content-line-height);
    color: var(--markian-text);
    background: var(--markian-surface);
}

.markian-viewer.host-theme .markian-document {
    padding: 0;
}

:is(.markian.host-theme, .markian-viewer.host-theme) .markian-document :is(pre, code) {
    font-family: var(--markian-mono);
    background-color: var(--markian-code);
}
```

Choose a code background distinguishable from the document in each theme.
A list or panel background token may resolve to the same colour as the field.

## Styling Checklist

### Document and Viewer

- [ ] Compare body font family, size, weight, line height and text colour with
  ordinary host text, not just the editor's outer container.
- [ ] Check paragraph spacing, heading hierarchy, list indentation, table cells,
  links, quotes, keyboard keys and task checkboxes.
- [ ] Match Visual, Source, Preview and standalone viewer typography where
  appropriate; source and code text must use the host's monospace font.
- [ ] Give inline code, active backtick markers and fenced code a consistent,
  visible background. Check block padding, corners and syntax token contrast.
  Avoid applying inline padding again to code inside an already padded block.
- [ ] Inspect highlighted fences and optional rendered content, not only plain
  `pre` elements. Follow the owning [extension guides](Extensions/index.md).
- [ ] Keep viewers unframed and unpadded when the surrounding layout already
  supplies spacing. A transparent surface can preserve the host card background.
- [ ] Verify long code, wide tables and images remain contained and scroll locally.

### Editor Frame and Host Layout

- [ ] Compare field corners, real borders, inset shadows, underlines, focus
  outlines and their offsets. Include normal, hover, focused, read-only, disabled
  and invalid states; do not hard-code an underline colour.
- [ ] Check that opaque Visual/Source children do not cover a parent's inset
  border or focus indicator. If an overlay is needed, paint decoration above the
  content without an opaque fill or intercepted pointer events.
- [ ] Match document padding to a host multiline field in each supported density.
  Do not confuse content padding with toolbar, wrapper or form padding.
- [ ] Measure unexpected whitespace at every level: editor, mount, form group,
  card and page. Remove only redundant spacing at its owning level; preserve
  following fields, non-final groups and the editor's usable height.
- [ ] Check explicit height, minimum height, flex shrinking, overflow and local
  scrolling. Avoid negative margins or arbitrary height reductions to hide gaps.

### Toolbars, Buttons and Icons

- [ ] Compare toolbar height, internal padding, button height/width, hit areas,
  spacing, separators, corners and icon size with equivalent host controls.
- [ ] Check pinned and floating toolbars, dropdown triggers and popup actions.
  Narrow-container rules must not unexpectedly replace the host's density.
- [ ] Match normal, hover, pressed, selected, open, focused and disabled states.
  A host's transparent button may use a hover border in one theme but not another.
- [ ] Reserve border space so hover or selection does not shift the layout.
  Use icon geometry or a loaded font that retains accessible control names.

### Popup Fields, Checkboxes and Dropdowns

- [ ] Inspect `.markian-panel` text inputs, search/replace fields and destination
  forms. Match height, padding, font, label and placeholder colours, corners,
  border, background image, shadow and focus outline.
- [ ] Check field hover, focus, read-only and disabled styling separately.
  A background-colour override alone will not reproduce a native underline.
- [ ] Match checkbox box and checkmark sizes, border, corners, colours, label
  spacing and order in each density. Include checked, unchecked, indeterminate,
  focused, hovered and disabled states where supported.
- [ ] Preserve label-click and Space toggling. If removing native checkbox
  appearance, supply visible focus and checked/disabled feedback, including in
  forced-colours mode. Scope popup checkbox rules separately from document tasks.
- [ ] Match select height, arrow size/position and reserved text space. Decorative
  arrows must not intercept clicks. Keep native keyboard selection; an
  operating-system option popup may not be fully styleable with ordinary CSS.
- [ ] Inspect `.markian-menu-items` rows and nested menu summaries: font, icon
  alignment, height, padding, corners, hover and selection. Preserve special colour
  grids rather than forcing every menu item into an ordinary text-row layout.
- [ ] Match popup surface, border, shadow, corners and pointer. Check top-layer
  placement, viewport clamping, scrolling, narrow layouts and bottom toolbars.
  Inspect focused and inactive popup appearance, not only a hovered screenshot.

## Verification Checklist

### Markdown Checklists

Task checkboxes belong to document content, not popup forms. Include them in the
host skin for both editable Visual content and nonediting Preview/viewer output.
Editor tasks use `li[data-item-type="task"]`; rendered task items use
`.task-list-item`. Their checkbox can be a direct child or inside a paragraph,
so do not assume identical editor and viewer markup.

- [ ] Reuse the host's checkbox box/checkmark dimensions, corners, borders and
  checked colours in each density. Define these tokens on viewer roots too,
  rather than relying on inheritance from an editor.
- [ ] Centre the box vertically on the **first line** of task text, not the
  entire height of a wrapped item. Base the offset on the text's font/line height
  and the checkbox height, not a fixed top offset.
- [ ] If positioning boxes absolutely, make each task item the positioning
  context. Replacement content styles may omit that rule. Inherit the text font
  for offsets expressed in `em`; the browser's default input font can differ.
- [ ] Reserve a clear gap between box and text. Check short, wrapped, nested and
  loose lists with multiple paragraphs, including rendered paragraph wrappers.
  Preserve list indentation and spacing between subsequent paragraphs.
- [ ] Check checked/unchecked appearance in Visual, Preview and the standalone
  viewer, including overridden Markdown styles and dark themes.
- [ ] Keep viewer tasks disabled without washing out their checked state.
  Visual tasks must still toggle and update Markdown; CSS must not change
  permissions or turn read-only tasks into editable controls.
- [ ] Verify pointer and keyboard activation, focus visibility, and that a
  checkbox does not overlap text, clip at the document edge or shift on hover.

### Integration Checks

- [ ] Compare actual computed styles and bounding rectangles with host controls
  in each supported theme and density, including dark backgrounds.
- [ ] Hover with a real pointer and traverse controls with Tab, Space, Enter,
  arrow keys and Escape. Check selection, dismissal and focus restoration.
- [ ] Type slowly while host hints, tooltips or validation update. Such metadata
  must not trigger teardown/remount on every keystroke. Keep validation messages
  distinct from ordinary hints.
- [ ] Switch themes, densities and views, enter/leave fullscreen, and resize the
  container. Confirm the same instance retains its complete draft and focus.
- [ ] Verify popup input values survive theme changes and that styling does not
  change editor bindings, emit synthetic document changes or alter saved source.
- [ ] Test two instances and ordinary host controls together for style leakage.
- [ ] Check forced colours, keyboard-only use, zoom, reduced motion and touch
  targets as applicable. Do not claim accessibility or device coverage from
  computed-style comparisons alone.

Use small focused regression tests for the differences the integration fixes.
Screenshots show appearance; interaction tests establish that styling has not
broken editing, selection or native field behaviour.
