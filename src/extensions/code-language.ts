import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import type { CodeHighlighter } from './code';
import type { SourceToken } from '../types';

/** Packs expose syntax tokens, never an editing engine or executable document HTML. */
export function createHighlighter(language: string, grammar: LanguageFn): CodeHighlighter {
  const engine = hljs.newInstance();
  engine.registerLanguage(language, grammar);
  return {
    apiVersion: 1,
    version: '11.12.0',
    language,
    highlight(source) {
      const parsed = new DOMParser().parseFromString('<div>' + engine.highlight(source, { language, ignoreIllegals: true }).value + '</div>', 'text/html');
      const tokens: SourceToken[] = [];
      let offset = 0;
      const visit = (node: Node, inherited = '') => {
        if (node.nodeType === Node.TEXT_NODE) {
          const end = offset + (node.textContent ?? '').length;
          if (inherited && end > offset) tokens.push({ from: offset, to: end, className: inherited });
          offset = end;
        } else {
          const classes = node instanceof Element ? [...node.classList].filter(name => /^hljs-[a-z-]+$/.test(name)).map(name => name.replace('hljs-', 'tok-')).join(' ') : '';
          node.childNodes.forEach(child => visit(child, classes || inherited));
        }
      };
      visit(parsed.body.firstElementChild!);
      return tokens;
    },
  };
}