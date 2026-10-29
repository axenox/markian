# Writing Extensions

An extension packages ordinary public API calls into a reusable feature. It has no privileged engine access. For enabling bundled features rather than building one, see [extensibility](../Extensibility.md). Exact types are in [the API reference](../API.md#extension-contract) and [types.ts](../../src/types.ts).

## Factory and Initialization

Register a factory once, then enable its ID separately in each editor's `extensions` map. Every enabled instance receives a new extension object. Disabled/omitted entries do not initialize or load optional dependencies. Unknown enabled IDs are errors.

An extension implements `init(instance, config, signal)` and returns a disposer, synchronously or through a promise. Validate `config: unknown` before using it. The signal represents instance lifetime; view and operation cleanup may need shorter-lived controllers of their own.

Initialization happens before engine construction. Commands, toolbar items, views, renderers, Help entries, and structural mappings can be registered here. Do not await `instance.ready` from `init`: readiness itself waits for initialization. Do not run editing commands until engines are ready.

## Minimal Extension

This example adds a visual command and toolbar control using only public operations. Its cleanup removes only owned contributions, including after a partial initialization failure.

```typescript
import type { Disposer, ExtensionFactory } from '../../src/types';

export const exampleExtension: ExtensionFactory = () => ({
  init(instance) {
    const disposers: Disposer[] = [];
    const dispose = () => {
      for (const remove of disposers.splice(0).reverse()) remove();
    };
    try {
      disposers.push(instance.getCommands().insert({
        id: 'example:insert',
        label: 'Insert example block',
        icon: 'codeblock',
        views: ['visual'],
        mutates: true,
        run: editor => editor.insertCodeBlock('Example pending', 'text'),
      }));
      disposers.push(instance.getToolbar().insert(
        { id: 'example:insert' }, 'insert', 'rule'
      ));
      disposers.push(instance.getHelp().insert({
        id: 'example:help',
        markdown: '## Example blocks\n\nInsert a text block for a pending example.',
      }));
      return dispose;
    } catch (error) {
      dispose();
      throw error;
    }
  },
});
```

The relative type import illustrates an in-repository implementation; external packages should resolve Markian's published declarations through their own build setup, not require consumers to compile source. Ship prebuilt browser assets and applicable notices.

Hosts load/register the resulting factory before creation. Extension IDs are host registration keys; prefix contribution IDs to avoid collisions. Registration does not mean activation, and no runtime activation API is currently provided.

## Contributions and Ordering

Generic registries use `insert(item, beforeId?)`. Toolbar insertion uses `insert(item, group?, beforeId?)`: the second argument is a target container, not a global ordering ID. Omitted group selects the last top-level default-aligned inline group. Missing groups are not created; configured references retain precedence. See [toolbar rules](../Configuration.md#live-toolbar-insertion).

Return removal handles for every contribution. Never replace host callbacks or configuration arrays as a side effect of registration. Subscribe to notifications with `on` and keep its unsubscribe function. Duplicate IDs and invalid ordering targets should fail clearly rather than depend on accidental load order.

Mark mutating commands with `mutates: true`, declare supported views, and use public permission-aware operations. A command supporting one workspace must not edit a hidden visual/source session. No public unrestricted selection-insertion helper is currently supplied.

## Views and Source Editing

A view owns its mount element and main-work-area presentation, not a separate authoritative Markdown document. It receives `{ element, signal, session? }` and returns cleanup. Supply optional `focus`, `resize`, and `setReadOnly` hooks when needed.

For code workspaces, obtain a live target through `getCodeTarget()` and call `openView(id, target)`. Never invent offsets. Use the supplied block session's `get`/`set`, and create CodeMirror through `createSourceEditor`. Destroy the source handle during view cleanup.

The controller projects the complete document including pending drafts. Back commits a changed block once; Help can suspend it without losing draft/history. Hidden handles cannot mutate. Stale/deleted targets and conflicting revisions must retain drafts and report failure, not overwrite newer content. Current sessions support top-level fences only.

Use the [Code extension](../../src/extensions/code.ts) as the smallest existing example. Reuse its public mechanisms, not its private state. Follow [shared view and control patterns](../Styleguide.md).

## Rendering and Schema

Fence renderer definitions match a language and return disposal for owned presentation. Opt into visual presentation explicitly with `visual: true`; otherwise rendering is Preview-only. Top-level visual renderer context may expose `open(view)` for target-aware navigation; nested fences do not gain editable sessions automatically.

Renderer implementation is trusted code. Use `textContent` for text or an established sanitizer for untrusted HTML/SVG. The editor renderer registry does not sanitize arbitrary DOM on an extension's behalf. Do not preserve rendered HTML as the Markdown value. Viewer callbacks have a separate, automatically bounded/sanitized output contract.

Register structural mappings during `init`, before engines are built. Late schema registration is rejected rather than rebuilding the editor silently. The current bridge supports atomic nodes using existing mdast types with a ProseMirror `NodeSpec`, `fromMarkdown`, and `toMarkdown`. New grammars, nested structural serialization, and general HTML handling are not complete contracts. Existing code fences prove render/view integration, not new-schema support.

## Optional Dependencies

Extension code must be loaded explicitly; there are no `getScripts` or `getStyles` hooks. Document required scripts, CSS, versions, local defaults, and any host-controlled dependency URL. Loading disabled extensions must not fetch optional runtimes just because matching fences are present.

Deduplicate compatible dependencies without sharing instance documents, drafts, callbacks, or controls. Failures must retain ordinary Markdown and allow unrelated editing. Do not guess CDN URLs or compile sibling framework paths into the library. Host-owned adapters remain in the owning host package.

Mermaid is the larger example: [mermaid.ts](../../src/extensions/mermaid.ts) uses public registries/source handles while shared runtime code owns bounds, version validation, and explicit isolated loading. The viewer adapter reuses rendering policy but not editor UI. Their user contracts are in [extensibility](../Extensibility.md#mermaid).

## Failure, Disposal, and Checks

Clean partial initialization before rethrowing. Markian can clean previously completed extensions but cannot know about resources an unfinished `init` never returned. If initialization finishes after destruction, the returned disposer is invoked. Make cleanup idempotent and avoid restoring stale copies over newer host changes.

Abort operations and recheck revision, view, permissions, and lifetime before installing async results. Correctness must not depend on host cancellation succeeding. Release listeners, observers, source handles, timers, rendered DOM, and registration handles. Shared retained dependency caches are not instance resources to unload on every destroy.

Use existing focused tests for initialization, cleanup, permissions, instance isolation, draft projection, stale targets/results, and any new structural preservation. Follow [validation](index.md#validation); do not run the full workflow by default. Keep local extension options in [configuration](../Configuration.md) and usage in [extensibility](../Extensibility.md) synchronized. Add a separate extension design page only when these guides and in-code explanations are insufficient.