# Markian Documentation

Start with the usage guides to embed and customize Markian. The development guides are for contributors who change the library itself. Requirements record approved scope and unfinished work; they are not an API reference.

## Using Markian

- [Getting started](../README.md): installation and first editor.
- [Architecture](Architecture.md): documents, views, extensions, and host responsibilities.
- [Configuration](Configuration.md): all options, defaults, and callback values.
- [API](API.md): public functions, properties, and lifecycle.
- [Extensibility](Extensibility.md): commands, callbacks, renderers, and bundled extensions.
- [Extension guides](Extensions/index.md): setup, usage and public helpers for optional extensions.
  - [Code blocks](Extensions/Code.md): expanded editing, language choices and XML highlighting.
  - [Mermaid diagrams](Extensions/Mermaid.md): editor workspace, snippets, templates and viewer setup.
- [Interoperability](Interoperability.md): smart paste, spreadsheet round trips, images, and compatibility with other software.
- [Style guide](Styleguide.md): shared controls, themes, and responsive layout.
- [Matching the host application](Host_application_styling.md): theme integration approach and styling checklist.
- [Examples](Examples.md): runnable pages and their host asset requirements.

## Contributing

- [Development](Development/index.md): setup, coding rules, and validation.
- [Code guide](Development/Code_guide.md): source layout and ownership.
- [Writing extensions](Development/Writing_extensions.md): extension initialization and cleanup.
- [Visual editor](Development/Components/Visual_editor.md): layout dimensions, document spacing, and responsive thresholds.
- [Toolbars](Development/Components/Toolbars.md): floating-control positioning.
- [Table editor](Development/Components/Table_editor.md): table controls, selections, and row/column operations.
- [Mermaid extension](Development/Extensions/Mermaid_extension.md): runtime loading, SVG styling, and safety boundaries.
- [Code extension](Development/Extensions/Code_extension.md): language assets, source tokens and highlighting lifecycle.

## Requirements and Decisions

- [Requirements](Requirements/Requirements.md).
- [Implementation plan](Requirements/Plan.md).
- [Approach](Requirements/Approach.md).
