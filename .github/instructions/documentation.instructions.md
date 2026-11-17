---
description: "Understand documentation structure, document changes properly"
name: "Writing documentation"
---
# Documentation Instructions

Carefully inspect and update instructions every time you change something! Make sure the documentation in well structured and easy to read. Ensure that the information is understandable and helpful for the target audience of each type of documentation.

## Global rules

- Write all documentation in english
- Use Github compatible markdown (including mermaid for diagrams)
- Use simple words - the docs must be easy to understand!
- When adding information, choose the appropriate file carefully. Avoid adding similar information to multiple docs files. Find the document with the best-fit scope for your new information.
- If there is no suitable existing document, create a new one - e.g. a new Component document in `Development` folder.


## README file

The `README.md` file in the project root is the main entry point for understanding the project. It should provide an overview of the project, its purpose, how to get started, and any other essential information for new users or contributors. Important chapters:

- Getting started
- Configuration - one good example for advanced configuration with custom options + link to detailed configuration docs.
- Extensibility - one good example for an editor with each available extensibility principle: custom command, extensions, etc. + link to detailed extensibility docs. The explanation about how to build extensions belongs in the details!
- API - short not on API principles (how it is accessible, simple example) + link to detailed API documentation.
- Documentation - list of links to most important documentation files: Architecture, styleguide, Development-index.

## Docs folder

Place all documentation in markdown files in the `Docs` folder. Separate documentation for library users and developers as show below.

- `Docs`
  - `index.md` - very short intro explaining docs structure, in particular separation between user and developer documentation. Mainly serves as a table of contents with links to every docs file.
  - `Configuration.md` - Lists all configuration options with descriptions, default values and important examples in a table. Also includes a complete default config JSON. Separate chapters for every built-in extension with configuration table and default JSON for each of them.
  - `Extensibility.md` - Explains shared extensibility principles, such as custom commands, extension registration, callbacks and renderers. Link to extension usage guides instead of describing individual extensions here.
  - `Extensions`
    - `index.md` - Index of extension usage guides, with links to their separate developer guides.
    - `<Name>.md` - One user-facing guide per extension, covering setup, usage, extension-specific public helpers, appearance and limitations. For example, `Mermaid.md`.
  - `Styleguide.md` - User interface guidelines and design principles for the project. Explains layout, toolbar, switching views, status bar, etc. Includes short definition for every UI component like button, button group, menu. Keep this focused on reusable appearance and interaction rules, not exact sizes, spacing values, or breakpoints. Link to the visual editor component guide for dimensions and to interoperability guidance for detailed application compatibility workflows.
  - `Interoperability.md` - User and integrator guidance on compatibility with other software: smart paste, clipboard format precedence, spreadsheet round trips, image exchange, Markdown portability, and import/export limits. Explain observable behavior and practical workflows, not internal implementation details.
  - `Architecture.md` - High-level overview of core architectural principles for library users: documents, views, extension boundaries and host responsibilities. Include important core dependencies, not extension internals or extension-specific dependencies.
  - `API.md` - Core public API available to surrounding code, with arguments, return types and short usage examples. Extension-specific factories and helpers belong in their usage guides; link to those guides here.
  - `Development` - these docs are for contributors only! Not intended for library users. 
    - `index.md` - Intro to development/contribution. Language used, coding principles.
    - `Code_guide.md` - Describes the inner structure of the project, including the organization of files and directories, and how different components interact with each other, what their purpose is, responsibility boundaries.
    - `Writing_extensions.md` - guide to write an extension.
    - `Components` - place separate documents for important (complex) core components here. Link these docs from the relevant code files!
    - `Extensions` - One `<Name>_extension.md` developer guide per extension, separate from its usage guide. Explain internal structure, responsibilities, ownership, lifecycle, dependencies, exact styling dimensions and responsive thresholds. Link to the usage guide and from relevant extension code files.

### Usage documentation

The top-level documents in the `Docs` folder are intended for library users and integrators. These are expected to understand JavaScript, but they will not need to dive into the code itself. These docs help to understand, how to use the library: configure the editor, call its API, etc.

This documentation should also show, hot wo customize and extend the editor, which is almost development documentation, but for integrators, not for contributors.

### Extension documentation ownership

- Keep each extension's documentation in two files: `Docs/Extensions/<Name>.md` for users/integrators and `Docs/Development/Extensions/<Name>_extension.md` for contributors.
- Keep extension descriptions centralized. The global API, Architecture, Styleguide and Visual editor guides must not describe extension internals, specific controls, layouts or runtime dependencies. Use links to the owning extension guide instead.
- Keep all extension configuration options and effective defaults in the global `Docs/Configuration.md` overview. Extension guides link to that reference rather than duplicate option tables or complete defaults.
- Keep shared contracts in their core references even when first needed by an extension. For example, a core source-handle method belongs in `Docs/API.md`; an extension's use of that method belongs in its developer guide.
- Update global guides only when shared core behavior actually changes, not for extension-only changes. Update the extension's usage or developer guide according to the affected audience.
- Link each usage guide from `Docs/Extensions/index.md` and `Docs/index.md`, and cross-link its separate developer guide.

### Interoperability maintenance

- Update `Docs/Interoperability.md` in the same change whenever clipboard behavior, smart paste, content exchange, or compatibility with other software changes.
- Keep detailed compatibility workflows and format limitations there. Other guides should link to it instead of repeating them; configuration options and public API contracts remain in their own references.
- Distinguish implemented behavior from planned support and verified compatibility. Browser tests with simulated clipboard data do not establish that a desktop application or every version of it has been tested.
- State normalization and data-loss limits explicitly, including formatting or content that cannot survive a round trip. Do not promise support for an application or native file format merely because it can provide HTML or plain text.
- Link new user-facing guides from `Docs/index.md`.

### Development documentation

All documentation in the `Development` folder is intended for contributors - humans and agents. Only add files here if the in-code documentation is not sufficient! Prefer in-code documentation for behaviors and implementation details over separate development documents.

`Docs/Development/Components/Visual_editor.md` owns exact core editor dimensions, shared control sizes, document spacing, line heights, and responsive thresholds. Extension-specific dimensions and thresholds belong in that extension's developer guide. Update the owning guide alongside changes to those values. Keep shared qualitative design principles in the style guide and link to the owning developer guide instead of duplicating numeric definitions there. Component-specific details, such as floating-toolbar positioning, can remain in their owning component guides.

## In-code documentation

Comments must help human developers and agents to understand the purpose of the code. 

- Describe the purpose of each file in a doc block at the top (or before the `export()`)
- Make sure, each function has a clear but short description of what it does unless it is short and obvious.
- If you add logic for a specific purpose (or because this and that does not work), add a comment about it unless the passage is an integral part of surrounding code and is self-explanatory.
- Never add obvious comments that do not add value