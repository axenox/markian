import { mdiFormatBold, mdiFormatItalic, mdiCodeTags, mdiUndo, mdiRedo, mdiLanguageMarkdownOutline, mdiEyeOutline, mdiHelpCircleOutline, mdiArrowLeft, mdiContentCopy, mdiFullscreen, mdiFullscreenExit, mdiCodeBraces, mdiFormatHeader2, mdiFormatListBulleted, mdiFormatQuoteClose } from '@mdi/js';

const icons: Record<string, string> = {
  bold: mdiFormatBold, italic: mdiFormatItalic, code: mdiCodeTags,
  undo: mdiUndo, redo: mdiRedo, raw: mdiLanguageMarkdownOutline, preview: mdiEyeOutline,
  help: mdiHelpCircleOutline, back: mdiArrowLeft, copy: mdiContentCopy,
  fullscreen: mdiFullscreen, fullscreenExit: mdiFullscreenExit, expand: mdiCodeBraces, heading: mdiFormatHeader2,
  bullet: mdiFormatListBulleted, quote: mdiFormatQuoteClose,
};

export function commandButton(document: Document, label: string, icon: string | undefined, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'markian-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  const path = icons[icon ?? ''];
  if (path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    button.append(svg);
  } else button.textContent = label;
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', action);
  return button;
}