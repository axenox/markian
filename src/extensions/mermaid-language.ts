/** Lexical Mermaid highlighting for editable drafts and standalone snippet fragments.
 * See ../../Docs/Development/Extensions/Mermaid_extension.md.
 */
import type { LanguageFn } from 'highlight.js';
import { createHighlighter } from './code-language';

export const mermaidGrammar: LanguageFn = hljs => ({
  name: 'Mermaid',
  keywords: {
    $pattern: /[A-Za-z_][\w-]*/,
    keyword: 'flowchart graph classDiagram sequenceDiagram stateDiagram stateDiagram-v2 erDiagram gitGraph '
      + 'class classDef style linkStyle subgraph end direction state participant actor as '
      + 'note Note over left right of activate deactivate loop alt else opt par and critical break rect '
      + 'autonumber title accTitle accDescr click callback link '
      + 'commit branch checkout switch merge cherry-pick id tag type order '
      + 'fill stroke color LR RL TB TD BT',
    built_in: 'int string String bool boolean float double date datetime PK FK UK choice fork join',
  },
  contains: [
    hljs.COMMENT(/%%/, /$/),
    hljs.QUOTE_STRING_MODE,
    { scope: 'number', match: /#[\da-fA-F]{3,8}\b/ },
    hljs.NUMBER_MODE,
    { scope: 'built_in', match: /(?:[<|}o*]+)?[-.=]+[>|{o*x)]+|(?:[<|}o*]+)?[-.=]{2,}/ },
    { scope: 'string', begin: /\[/, end: /\]|\n/, contains: [hljs.QUOTE_STRING_MODE] },
    { scope: 'string', begin: /\|/, end: /\||\n/ },
    { scope: 'title', match: /\b[A-Za-z_]\w*(?=[ \t]*(?:[([{]|(?:<\|)?[-.]{2,}|->))/ },
  ],
});

export const mermaidHighlighter = createHighlighter('mermaid', mermaidGrammar);
