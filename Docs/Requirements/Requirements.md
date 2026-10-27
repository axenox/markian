Power UI includes widgets to show and edit markdown: `Markdown` (also called Display Markdown, but ideally there should be no difference) and `InputMarkdown`. The latter is supposed to be a very user-friendly editor, which would allow people, that never heard of Markdown to write and format their texts very easily. 

We use a lot of markdown: for formatting wranings and error messages, in comments, in our internal ticketing system, etc. Over the years we have developed a number of wishes/requirements, that are currently not covered by the Toast UI Editor. Saskia (cc) tried to implement some of them as plugins/extensions, but it proved to be not that easy. 

Until now we have used the open source UI library Toast UI Editor ([https://ui.toast.com/tui-editor](https://ui.toast.com/tui-editor)) for a WYSIWYG Markdown editor. However, that was never really ideal and now it seems to become unmaintained. So now the time has come to build our own tailored whsiwyg editor. 

## Basic requirements 

- single-file vanilla js include (plus a CSS file of course) - compatible with script html tags. 
	- easy to integrate with frameworks and other libs: jeasyui, Openui5,  codiware, jQuery comments. 
- turns an HTML element (text or div) into an interactive editor
- editor looks like an editor (not regular content becoming editable on hover or so)
- get/set value and persisted content use Markdown, not editor-specific JSON or HTML as the document format. Markdown syntax and whitespace may be normalized, but supported content and formatting semantics must be preserved, including meaningful whitespace such as hard line breaks and code indentation. The stored Markdown must remain renderable by regular Markdown software, including GitHub and GitLab, without Markian-specific processing.
- easy to use for typical word users
- fast to use for markdown pros
- compatible with github and gitlab
- custom add-ons must gracefully degrade in other Markdown software: ordinary content remains readable, while extension metadata and placeholder delimiters remain invisible HTML comments. Preserve those comments and their meaning through import, editing, and export. Generated content between placeholder delimiters must remain independently renderable without executing the add-on. Do not emit proprietary visible delimiters, obscure characters, or editor-specific wrappers like the custom Markdown elements used by Toast UI. Loss of interactive behavior is acceptable outside Markian; visible syntax debris or silent content loss is not.

## Library name

Working title: Markian. 

Alzernatives:

- PyriteEditor

## Experience with other editors

### Toast UI editor

Looks good, but lots of problems when using it. 

What we like:

- toolbar
- checkbox in lists can be checked by click (sadly, not in all modes)

What we dislike

- cannot type markdown in WYSIWYG mode - it is escaped automatically. Makes it harder to use for pros. 
- in WYSIWYG mode cannot leave inline code at the end of a line. E.g. pressing right arrow key still leaves the carret inside the code element
- hard to extend - lots of quirks for different modes. 
- different modes produce different markdown output for mentions and custom tags. Very hard to synchronize. 
- toolbar to big and cannot be scaled properly
### Obsidian

The editor in Obsidian is very comfortable to use on desktop and mobile. Writing is extremely quick. But on desktop there is no toolbar. There is a plugin that adds a nice floating toolbar, but a pinned one at the bottom would have better visibility. 

- when I press on a word and click Inline code icon - to word becomes code. No need to highlight it first. Similarly, when just typing a can click Inline code at the end. Same goes for headings and many other toolbar buttons. Very comfortable! 

## Look&Feel

The editing experience should be much like Obsidian. Especially the mobile version with its toolbar is great!

It should still have an easily explorable UI with icons for all the features. 

We will use SVG material design icons from https://pictogrammers.com/library/mdi/. 

The editor must support a dark and light mode. The modes should. Be switchable programmatically as they need to sync to the other libraries used. 

The styling of the resulting markdown shall be similar to Github. 

## Requirements details
### Toolbar

Look&feel of a typical WYSIWYG-Editor with a Toolbar - either at the top (like word) and floating when text is selected. 

* Toolbar buttons, that are important for us:
    * Bold/italic
    * Headings H1-H6 (at least 4 leels)
    * Insert inline code with backticks (e.g. \`a=1\`)
    * Insert a code block
    * Create/modify lists: ![](data:image/png;base64,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) . It would be cool to have checkbox-lists too (regular Markdown supports them).
* Button to switch to raw markdown view (switch between WYSIWYG mode and writing markdown directly)
* Buttons to insert and modify a table
* Toolbar button to change the color of the text. Ideally not a color picker, but a selection of 5-10 predefined colors.
* toggle codeblock
* toggle Inline code
* toggle quote
* toggle link (with a dialog to add link)
* add image

The toolbar should have different modes:

1. Regular toolbar at the top of the editor (maybe at the bottom on mobile?)
2. Floating toolbar when text is selected with less icons

The toolbar should be easily customizable via config. Easy to add/remove icons to both modes separately. 

Maybe small editors without a pinned toolbar, just with the floating one? 
### Mobile support 

- overflow toolbar
- Button to maximize the editor. Initially our editors are pretty small: e.g. 300px x 400px. The button should maximize the editor so it takes up the entire screen without changing the state of the rest of the UI (it should simply be displayed over the rest). We should be able to restore the initial size too, of course. The button can be placed in the toolbar too
### Undo/redo history

Undo/redo functionality. Ideally with buttons in the toolbar

### Events

* OnChange event – we need to do things every time the text changes.

### Tables

* visual editing for a table inspired by Obsidian. It is very comfortable there
* toolbar icon to add and edit (submenu) a table
* right-click or floating toolbar for table cells allowing to add rows and columns, delete them, etc. 
* Ability to copy and paste tables from Excel (simple tables work in TUI Editor). Just the table structure is important, not the formatting.

### Images

* Ability to paste an image. The expectation here is that the image is transformed into a data-URI and saved inside the markdown. We are planning to handle these pasted images internally. We do not require the editor to extract them somehow.
* button to add an image by URL
* when used in codiware, I would like an Autosuggest for image URLs from the same repo via AJAX. 

### Links

Small dialog opened from toolbar to add a link

- absolute links
- relative links (base should be configurable)
- when used in codiware, I would like an Autosuggest for `.md` files from the same repo via AJAX. 
- for links to markdown files, the dialog should show a separate field for the target heading. Headings shall automatically become anchors when rendering.
- ctrl+click should open the link. 

When entering a url in the add-link dialog, there should be a customizable check-callback to validate if the URL exists and to get the heading structure. Tha latter would allow a dropdown for headings. 

### Mermaid diagrams 

- Render mermaid diagrams
- pan/zoom large diagrams (ideally with floating buttons like on github)
- view/edit mermaid code easily

The rendered diagram should show an edit button. Editing mermaid should swith to an editor view with code and preview side-by-side. There should be a button to apply changes. Not quite sure, if the mermaid editor should be a popup or a replacement for the regular markdown editor. It surely needs a different toolbar. Maybe a real mermaid editor with a shapes sidebar? 

In any case, the mermaid include path must be configurable. When used inside codiware or Power UI the editor should reuse existing mermaid. 
### Templates

A button in the toolbar, that will create a custom HTML element around the selected text: e.g. “Edit” -> “\<kbd>Edit\</kbd>”. This particular example would help our test and documentation team a lot as they need a nice “button” symbol in their documents. It is important, that the resulting Markdown contains just the HTML element, no extra syntax. This is important, because we use the editor for our documentation and that should be readable on GitHub and GitLab directly.

Toolbar button that opens a menu with templates to insert in the editor: e.g. templates for a typical test case. The templates should be part of the configuration of the widget

### Mentions

Ability to use mentions: e.g. “@Name” to mention someone or “#TC1234” to reference test case 1234 or similar. 

* First of all, these mentions need to be highlighted (either colored text or colored background).
* Different mention types should have different styles and colors: e.g. #TC1234 should look different than #1234 (references to a test case vs. a ticket).
* In the resulting markdown the mentions should remain pure text – ideally no extra formatting. Mentions being transformed into links are OK too, but the option to have no transformation, but just formatting would be nice too.
* It would be great to have a dropdown menu suggesting existing mentions. So if I start typing “@A” I will see all users starting with “A”. If I type “#TC” is will have an autosuggest for test case number while typing simply “#” will trigger an autosuggest for ticket numbers.
* It would be great to be able to have a OnTagClickedEvent. 
* it should be easy to add a new mention syntax
* hovering over a mention should allow to pull additional information via Ajax - e.g. the status of a ticket or an HTML card for a mentioned person (like in outlook). In PowerUI there will be hidden action, that provide the endpoints, but the editor should work without power UI too. 

### Code blocks

Code blocks should be easy to write and look like code. 

- tab support
- configurable tab width
- display line numbers

Maybe codeblocks should have a separate editor similar to the mermaid editor idea. So clicking on a button on the code block would replace the entire editor with a code editor with line numbers, separate toolbar (e.g. with language selection). This should be easy to. Implement if we use some code editor as base like CodeMirror is used for milkdown. 

## Extensibility

Features, that we only need in some use-cases. They can either be added via event callbacks or using some extension mechanism. In any case, configuration via JSON is required. 

### Placeholders

Docs of PowerUI apps are markdown and support placeholders rendered by the `DocsFacade`. These placeholders have begins and end tags as HTML comments and generate the content in between. These block of generated content should be visible. The editor should render a border around the generated content with a. Edit button, that would allow to edit the placeholder comment tags. 

We also need a toolbar icon with a menu allowing to quickly insert pre-configured placeholders. 

### Custom toolbar buttons

Need a simple way to add toolbar buttons. Single ones or dropdown menus to keep the toolbar compact. 

Examples:

- custom link types, that generate most of the URL requiring only a part of it as input. E.g. in the PowerUI docs we need to generate a URL to a widget docs page by entering the widget type only. Or for a MetaObject markdown printout by entering the object alias. 
- icon to add an HTML tag - e.g. `<kbd>`
- turn the quote-button into a dropdown with regular quote, tip, warning, error. 

### Table of contents

A built-in floating toc should show up when the document has heading except for the one in line 1. Maybe not floating, but as a sidebar? 

## Security 

The editor should carefully parse input and disallow malicious HTML and JS in Glgeneral. However, JS inside codeblocks is needed. 

## Integrations with PowerUI

### In codiware

We will replace tui editor in codiware in general. The codiware middleware will provide endpoints for the Ajax feature, that are not powerui specific (e.g. Autosuggest for file names)

### In IDE app

A custom configuration will be required in codiware inside the axenox.IDE app. For example, that would support app docs placeholders. 

### As Widget

The `InputMarkdown` Widget already has mentions and stencils - they all must be supported.
## Discussion topics

### Split vs WYSIWYG 

What is better: a split-mode editor (like vs code with preview) or WYSIWYG (like word or like the Obsidian Markdown editor)? 

Our designers did not use the split mode really. They used WYSIWYG and complained about things, that did not work there (required the other modes). So the split mode can be omitted. 

The strict WYSIWYG mode escaping all markdown chars might still be useful, but should not be default. Maybe we should have a mode switch icon:

- Obsidian like (WYSIWYG with auto-render)
- word-like (WYSIWYG strict)
- Markdown 

