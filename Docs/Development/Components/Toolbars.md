# Toolbars

This guide covers toolbar implementation details. For shared appearance and interaction principles, see the [style guide](../../Styleguide.md#toolbar-and-menus). For host configuration, see [toolbar configuration](../../Configuration.md#toolbar).

## Floating Control Positioning

Floating controls leave an 8px gap outside the complete selection. Prefer placement above it, flip below when necessary, and hide contextual controls if neither position fits in the visible work area without covering selected text.

Selection-toolbar positioning is implemented in [editor.ts](../../../src/editor.ts).