import { mdiFormatBold, mdiFormatItalic, mdiCodeTags, mdiUndo, mdiRedo, mdiLanguageMarkdownOutline, mdiEyeOutline, mdiHelpCircleOutline, mdiArrowLeft, mdiContentCopy, mdiFullscreen, mdiFullscreenExit, mdiCodeBraces, mdiFormatHeader1, mdiFormatHeader2, mdiFormatHeader3, mdiFormatHeader4, mdiFormatHeader5, mdiFormatHeader6, mdiFormatListBulleted, mdiFormatQuoteClose, mdiFormatStrikethrough, mdiFormatListNumbered, mdiFormatIndentIncrease, mdiFormatIndentDecrease, mdiCheckboxMarkedOutline, mdiMinus, mdiFormatClear, mdiLinkVariant, mdiLinkVariantOff, mdiImageOutline, mdiTable, mdiMagnify, mdiClose, mdiChevronUp, mdiChevronDown, mdiFindReplace, mdiTextBoxMultipleOutline, mdiDotsHorizontal, mdiFormatListText } from '@mdi/js';
import { mdiFormatColorFill } from '@mdi/js';
import { mdiTableRowPlusBefore, mdiTableRowPlusAfter, mdiTableColumnPlusBefore, mdiTableColumnPlusAfter, mdiTableRowRemove, mdiTableColumnRemove, mdiTableRemove, mdiTablePlus, mdiTableRow, mdiFormatAlignLeft, mdiFormatAlignCenter, mdiFormatAlignRight, mdiPageLayoutSidebarRight, mdiChevronRight } from '@mdi/js';

const icons: Record<string, string> = {
  bold: mdiFormatBold, italic: mdiFormatItalic, code: mdiCodeTags,
  undo: mdiUndo, redo: mdiRedo, raw: mdiLanguageMarkdownOutline, preview: mdiEyeOutline,
  help: mdiHelpCircleOutline, back: mdiArrowLeft, copy: mdiContentCopy,
  fullscreen: mdiFullscreen, fullscreenExit: mdiFullscreenExit, expand: mdiCodeBraces, heading: mdiFormatHeader2,
  bullet: mdiFormatListBulleted, quote: mdiFormatQuoteClose,
  heading1: mdiFormatHeader1, heading2: mdiFormatHeader2, heading3: mdiFormatHeader3, heading4: mdiFormatHeader4, heading5: mdiFormatHeader5, heading6: mdiFormatHeader6,
  strike: mdiFormatStrikethrough, ordered: mdiFormatListNumbered, indent: mdiFormatIndentIncrease, outdent: mdiFormatIndentDecrease,
  task: mdiCheckboxMarkedOutline, rule: mdiMinus, clear: mdiFormatClear, link: mdiLinkVariant, unlink: mdiLinkVariantOff,
  image: mdiImageOutline, table: mdiTable, search: mdiMagnify, close: mdiClose, up: mdiChevronUp, down: mdiChevronDown,
  replace: mdiFindReplace, replaceAll: mdiTextBoxMultipleOutline, more: mdiDotsHorizontal, outline: mdiPageLayoutSidebarRight,
  lists: mdiFormatListText, chevron: mdiChevronRight,
  'table:insert': mdiTablePlus, 'table:row-before': mdiTableRowPlusBefore, 'table:row-after': mdiTableRowPlusAfter,
  'table:column-before': mdiTableColumnPlusBefore, 'table:column-after': mdiTableColumnPlusAfter,
  'table:delete-row': mdiTableRowRemove, 'table:delete-column': mdiTableColumnRemove, 'table:delete': mdiTableRemove,
  'table:header': mdiTableRow, 'table:left': mdiFormatAlignLeft, 'table:center': mdiFormatAlignCenter, 'table:right': mdiFormatAlignRight,
  color: mdiFormatColorFill,
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