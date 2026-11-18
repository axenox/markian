# Code Blocks

The optional Code extension highlights fenced code and provides an expanded source workspace. See [Configuration](../Configuration.md#code) for all options and defaults, the [Code example](../../Examples/code-blocks.html) for script-tag setup, and the separate [developer guide](../Development/Extensions/Code_extension.md) for internals.

## Setup and Editing

Load `dist/extensions/code.min.js` and `dist/extensions/code.css` after core. Register `MarkianCode.codeExtension` as `code` and enable it for each editor. The extension adds Expand code block to the code-caret floating toolbar and highlighted-block controls.

Clicking highlighted code switches to core's direct fence editing, with visible boundaries and a language field beside the opening backticks. `config.showExpandButton: false` omits the expanded editor command and buttons without disabling direct editing. See the [fenced-block guide](../Development/Components/Visual_editor.md#fenced-blocks) for navigation and controls.

The workspace provides line numbers, Undo/Redo, Indent/Outdent and a Code language menu. Back commits text and language changes once; unchanged Back adds no history step. Help suspends the workspace without losing its draft, selection or history.

Tab inserts the configured indentation; Shift+Tab outdents. Incoming code tabs expand to space-based tab stops; existing imported code is unchanged. See [clipboard behavior](../Interoperability.md#clipboard-formats-and-smart-paste) for limits. Escape then Tab leaves source Tab handling. Read-only/disabled state retains inspection and search but blocks text, language and history edits. Complete `get()` values and textarea submission include pending language/source drafts before Back. Current block sessions target top-level fences; nested ordinary fences can still be edited directly.

## Languages and XML

The default catalogue includes JavaScript, TypeScript, JSON, CSS, HTML, XML, PHP, SQL, Python and YAML. Selected Highlight.js grammars ship as separate offline script assets without editing engines. Only matching enabled languages load; Code has no Mermaid dependency.

XML is a separate Code language choice and uses the `xml` fence and language asset. It highlights generic XML, including declarations, namespaced elements and attributes, comments and CDATA. HTML remains a separate choice. Both use Highlight.js's XML grammar; choosing a language changes the fence label, not the source body. XML fences previously used the HTML alias; they now use the explicit XML entry without changing saved content.

Custom `languages` arrays replace the default catalogue. If you need both HTML and XML, include both IDs; existing custom aliases remain supported under the usual uniqueness rules.

## Highlighting and Public Helper

Hosts may replace the catalogue or supply token highlighters through [Code configuration](../Configuration.md#code). Unknown, failed or oversized highlighting retains plain source. Highlighting is presentation-only and does not change Markdown or history. A highlight failure does not block saving; Retry highlighting retries a failed asset.

`MarkianCode.loadCodeLanguage(document: Document, language: CodeLanguage): Promise<CodeHighlighter>` returns a checked highlighter. Compatible successful loads are shared between editors, while rejected loads can be retried. The highlighter returns source-offset tokens, not executable document HTML. The configuration reference describes `CodeLanguage`, the token contract and bundled versions.
