import { $inputRule, $node, $prose, $remark, $view } from '@milkdown/kit/utils';
import { codeBlockSchema, inlineCodeSchema, listItemSchema } from '@milkdown/kit/preset/commonmark';
import { textblockTypeInputRule } from '@milkdown/kit/prose/inputrules';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';

export const codeFenceInputRule = $inputRule(ctx => textblockTypeInputRule(
  /^ {0,3}(`{3,})([^\s`]*)[\s\n]$/,
  codeBlockSchema.type(ctx),
  match => ({ language: match[2] }),
));

export const pairedCodeTyping = $prose(ctx => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (view.composing || from !== to || text.includes('\n')) return false;
      const { state } = view;
      const code = inlineCodeSchema.type(ctx);
      const position = state.doc.resolve(from);
      if (position.parent.type.spec.code) return false;
      const marks = state.storedMarks ?? position.marks();
      const atCodeEnd = marks.some(mark => mark.type === code)
        && !position.nodeAfter?.marks.some(mark => mark.type === code);
      if (text === '`' && atCodeEnd) {
        view.dispatch(state.tr.removeStoredMark(code));
        return true;
      }
      if (atCodeEnd && state.storedMarks?.some(mark => mark.type === code)) {
        view.dispatch(state.tr.insertText(text, from, to).setStoredMarks(marks));
        return true;
      }
      if (text.includes('`') || marks.some(mark => mark.type === code)) return false;
      const offset = position.parentOffset;
      const before = position.parent.textBetween(0, offset, '\n', '\ufffc');
      const after = position.parent.textBetween(offset, position.parent.content.size, '\n', '\ufffc');
      if (!before.endsWith('`') || before.endsWith('``') || !after.startsWith('`') || after.startsWith('``')) return false;
      const backslashes = before.slice(0, -1).match(/\\+$/)?.[0].length ?? 0;
      if (backslashes % 2) return false;
      const transaction = state.tr.replaceWith(from - 1, to + 1, state.schema.text(text, [code.create()]));
      transaction.setSelection(TextSelection.create(transaction.doc, from - 1 + text.length));
      transaction.setStoredMarks([code.create()]);
      view.dispatch(transaction.scrollIntoView());
      return true;
    },
    handleKeyDown(view, event) {
      if (view.composing || event.key !== 'ArrowRight' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
      const { state } = view;
      if (!state.selection.empty) return false;
      const position = state.selection.$from;
      const code = inlineCodeSchema.type(ctx);
      if (!(state.storedMarks ?? position.marks()).some(mark => mark.type === code)
        || position.nodeAfter?.marks.some(mark => mark.type === code)) return false;
      view.dispatch(state.tr.removeStoredMark(code));
      return true;
    },
  },
}));

export function isSafeUrl(value, image = false) {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return false;
  if (image && /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=]+$/i.test(value)) return true;
  try {
    const url = new URL(value, 'https://example.invalid/');
    return ['http:', 'https:', ...(image ? [] : ['mailto:', 'tel:'])].includes(url.protocol);
  } catch {
    return false;
  }
}

export const commentSyntax = $remark('markian-comments', () => () => tree => {
  function visit(parent) {
    for (const child of parent.children ?? []) {
      if (child.type === 'paragraph' && child.children?.length && child.children.every(part => part.type === 'html' && /^\s*<!--[\s\S]*-->\s*$/.test(part.value))) {
        child.type = 'markianCommentBlock';
        child.value = child.children.map(part => part.value).join('\n');
        delete child.children;
      }
      if (child.type === 'html' && /^\s*<!--[\s\S]*-->\s*$/.test(child.value)) {
        child.type = ['paragraph', 'heading', 'tableCell'].includes(parent.type)
          ? 'markianCommentInline' : 'markianCommentBlock';
      }
      visit(child);
    }
  }
  visit(tree);
});

function commentNode(inline) {
  const name = inline ? 'markian_comment_inline' : 'markian_comment_block';
  const markdownType = inline ? 'markianCommentInline' : 'markianCommentBlock';
  return $node(name, () => ({
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: false,
    attrs: { value: { default: '' } },
    toDOM: node => [inline ? 'span' : 'div', {
      'data-markian-comment': node.attrs.value,
      hidden: '',
      contenteditable: 'false',
      'aria-hidden': 'true',
    }],
    parseDOM: [{
      tag: `${inline ? 'span' : 'div'}[data-markian-comment]`,
      getAttrs: element => ({ value: element.getAttribute('data-markian-comment') }),
    }],
    parseMarkdown: {
      match: node => node.type === markdownType,
      runner: (state, node, type) => state.addNode(type, { value: node.value }),
    },
    toMarkdown: {
      match: node => node.type.name === name,
      runner: (state, node) => state.addNode('html', undefined, node.attrs.value),
    },
  }));
}

export const commentBlock = commentNode(false);
export const commentInline = commentNode(true);

export const taskItemView = $view(listItemSchema.node, () => (initialNode, view, getPosition) => {
  let node = initialNode;
  const dom = document.createElement('li');
  const contentDOM = document.createElement('div');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.contentEditable = 'false';
  checkbox.className = 'task-checkbox';
  dom.append(checkbox, contentDOM);
  function refresh() {
    const task = node.attrs.checked !== null;
    checkbox.hidden = !task;
    checkbox.checked = Boolean(node.attrs.checked);
    checkbox.setAttribute('aria-label', node.textContent);
    dom.dataset.itemType = task ? 'task' : 'list';
    dom.dataset.checked = String(Boolean(node.attrs.checked));
  }
  checkbox.addEventListener('change', () => {
    const position = getPosition();
    if (typeof position !== 'number') return;
    view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, checked: checkbox.checked }));
  });
  refresh();
  return {
    dom,
    contentDOM,
    update(nextNode) {
      if (nextNode.type !== node.type) return false;
      node = nextNode;
      refresh();
      return true;
    },
    stopEvent: event => event.target === checkbox,
    ignoreMutation: mutation => mutation.type !== 'selection' && !contentDOM.contains(mutation.target),
  };
});