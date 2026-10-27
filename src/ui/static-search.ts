import { findMatches } from '../search';
import type { SearchMatch, SearchOptions } from '../types';

export class StaticSearch {
  private marks: HTMLElement[] = [];
  private matches: SearchMatch[] = [];
  private nodes: { node: Text; from: number; to: number }[] = [];

  constructor(private element: HTMLElement) {}

  search(options: SearchOptions): SearchMatch[] {
    for (const mark of this.marks) mark.replaceWith(...mark.childNodes);
    this.marks = [];
    this.element.normalize();
    this.nodes = [];
    let text = '';
    const walker = this.element.ownerDocument.createTreeWalker(this.element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('[hidden], script, style, svg')) continue;
      const from = text.length;
      text += node.textContent;
      this.nodes.push({ node: node as Text, from, to: text.length });
    }
    this.matches = findMatches(text, options);
    for (const entry of [...this.nodes].reverse()) {
      for (const match of [...this.matches].reverse()) {
        const from = Math.max(entry.from, match.from) - entry.from;
        const to = Math.min(entry.to, match.to) - entry.from;
        if (from >= to) continue;
        const range = this.element.ownerDocument.createRange();
        range.setStart(entry.node, from);
        range.setEnd(entry.node, to);
        const mark = this.element.ownerDocument.createElement('mark');
        mark.className = 'markian-match';
        mark.dataset.match = String(match.from);
        range.surroundContents(mark);
        this.marks.push(mark);
      }
    }
    return this.matches;
  }

  select(from: number): void {
    const mark = this.marks.find(item => item.dataset.match === String(from));
    if (mark) this.element.scrollTo({ top: mark.offsetTop - this.element.offsetTop, behavior: 'instant' });
  }

  replaceSearch(): void {}
}