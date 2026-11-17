/** Renders source-offset tokens as literal text and static syntax spans. */
import type { SourceToken } from '../types';

export function renderTokens(element: HTMLElement, value: string, tokens: readonly SourceToken[]): void {
  const document = element.ownerDocument;
  const content = document.createDocumentFragment();
  let offset = 0;
  for (const token of tokens) {
    content.append(document.createTextNode(value.slice(offset, token.from)));
    const span = document.createElement('span');
    span.className = token.className;
    span.textContent = value.slice(token.from, token.to);
    content.append(span);
    offset = token.to;
  }
  content.append(document.createTextNode(value.slice(offset)));
  element.replaceChildren(content);
}
