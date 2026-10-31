# Markian

Markian is a framework-independent Markdown editor and lightweight viewer. It stores ordinary Markdown and provides visual/source editing, tables, an outline, search, templates, mentions, and optional code and Mermaid workspaces.

The library is under development. Current APIs are documented below; unfinished features and acceptance checks are tracked in the [implementation plan](Docs/Requirements/Plan.md). Browser coverage does not yet establish cross-browser, real-device, screen-reader, or restrictive-CSP conformance.

## Getting Started

Use the prebuilt files in `dist` with a static HTTP server. Consumers do not need Node.js, a bundler, or a build step.

```html
<link rel="stylesheet" href="dist/markian.css">
<div id="notes" style="height: 480px"></div>
<script src="dist/markian.min.js"></script>
<script>
  const editor = Markian.create(document.querySelector('#notes'), {
    markdown: '# Notes\n\nReady for review.',
  });
  editor.ready.then(() => editor.focus());
</script>
```

Serve `dist/markdown-github.css` beside the script: Markian loads it by default. Await `ready` before commands or document replacement. A textarea is also a supported host; its value follows edits and native form reset.

To install the development package with Composer:

```powershell
composer config repositories.markian vcs https://github.com/axenox/markian.git
composer require axenox/markian:@dev
```

Expose the installed package's `dist` files through your static asset routing. Tagged publication and Asset Packagist availability are not yet verified. See the [examples guide](Docs/Examples.md) for runnable pages and the [development guide](Docs/Development/index.md) to work from source.

## Configuration

Options belong to each instance. This example uses a compact toolbar, a custom content stylesheet, and local link suggestions:

```javascript
const editor = Markian.create(document.querySelector('#notes'), {
  markdown: '# Notes',
  theme: 'dark',
  sidebarVisible: false,
  markdownCssUrls: ['/assets/markdown.css'],
  toolbar: [
    { id: 'format', type: 'group', items: ['bold', 'italic', 'link'] },
    { id: 'utilities', type: 'group', align: 'opposite', items: ['search', 'fullscreen'] },
  ],
  onLinkSuggest: ({ query }) => [
    { label: 'Guide', destination: 'guide.md' },
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
});
```

All options, effective defaults, callbacks, and bundled extension settings are in the [configuration reference](Docs/Configuration.md).

## Extensibility

Hosts and extensions use the same public API. The following example loads both bundled editor extensions and adds a custom command. The host must serve a trusted Mermaid 11+ runtime at the configured URL.

### Optional Mermaid Extension

This example enables Mermaid alongside Code. Full renderer, safety, and workspace guidance is in the [Mermaid guide](Docs/Extensibility.md#mermaid).

```html
<link rel="stylesheet" href="dist/markian.css">
<link rel="stylesheet" href="dist/extensions/mermaid.css">
<div id="extended-notes" style="height: 480px"></div>
<script src="dist/markian.min.js"></script>
<script src="dist/extensions/code.min.js"></script>
<script src="dist/extensions/mermaid.min.js"></script>
<script>
  Markian.registerExtension('code', MarkianCode.codeExtension);
  Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
  const extendedEditor = Markian.create(document.querySelector('#extended-notes'), {
    markdown: '# Review',
    extensions: {
      code: { enabled: true },
      mermaid: { enabled: true, config: {
        source: '/assets/mermaid.min.js',
      } },
    },
  });
  extendedEditor.ready.then(() => {
    extendedEditor.getCommands().insert({
      id: 'review:example',
      label: 'Insert review example',
      icon: 'codeblock',
      views: ['visual'],
      mutates: true,
      run: instance => instance.insertCodeBlock('Review pending', 'text'),
    });
    extendedEditor.getToolbar().insert({ id: 'review:example' }, 'insert', 'rule');
  });
</script>
```

Callbacks connect host services; renderers and views add presentation; schema mappings extend supported structure. See [customization examples](Docs/Extensibility.md) and the contributor guide to [writing extensions](Docs/Development/Writing_extensions.md). Core [templates](Examples/templates.html) and [mentions](Examples/mentions.html) need no optional script or backend. Inline HTML is limited to explicitly enabled attribute-free tags; generated-region providers remain unfinished.

## API

The classic script exposes `window.Markian`, a factory rather than a singleton editor. Instances own their document, theme, history, callbacks, and lifecycle.

```javascript
await editor.ready;
const unsubscribe = editor.on('change', event => {
  console.log(event.origin, editor.get());
});
await editor.whenIdle();
const markdown = editor.get();
unsubscribe();
```

`get()` includes pending source and block drafts, even while Help is visible. Hosts own persistence and must handle edits during any asynchronous save. See the [complete API reference](Docs/API.md).

## Lightweight Viewer

The viewer displays Markdown without constructing an editor. Load only its assets for display-only pages:

```html
<link rel="stylesheet" href="dist/markian-viewer.css">
<article id="document"></article>
<script src="dist/markian-viewer.min.js"></script>
<script>
  const viewer = MarkianViewer.create(document.querySelector('#document'), {
    markdown: '# Notes\n\nReady for review.',
  });
</script>
```

Its source value is exact, tasks are noninteractive, and optional fence rendering is opt-in. Mermaid requires a separate render-only adapter. See [viewer customization](Docs/Extensibility.md#viewer-renderers) and [viewer options](Docs/Configuration.md#viewer-options).

## Documentation

- [Documentation index](Docs/index.md).
- [Architecture](Docs/Architecture.md).
- [Configuration](Docs/Configuration.md).
- [API](Docs/API.md).
- [Extensibility](Docs/Extensibility.md).
- [Style guide](Docs/Styleguide.md).
- [Development](Docs/Development/index.md).

## Current Limits

Visual editing can normalize Markdown syntax and line endings, but must retain meaningful content. Unsupported visual imports fall back to source rather than silently deleting content. Raw HTML is not trusted rendered content. The [architecture](Docs/Architecture.md#markdown-and-safety) describes preservation and safety policies.

Code workspaces currently target top-level fences; the Code extension does not include language packs. Mermaid is supplied by the host, never bundled into core. Host transport, authentication, storage, and framework widgets remain outside Markian. Full migration and production acceptance are still tracked in the unchanged requirements documents.
