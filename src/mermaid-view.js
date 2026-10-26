import { $view } from '@milkdown/kit/utils';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import mermaidUrl from '../../../exface/core/Facades/AbstractAjaxFacade/js/mermaid/mermaid.min.js?url';

let library;
let diagramId = 0;
const revisions = new WeakMap();

function loadMermaid() {
  if (!library) library = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = mermaidUrl;
    script.onload = () => window.mermaid ? resolve(window.mermaid) : reject(new Error('Mermaid did not initialize.'));
    script.onerror = () => {
      script.remove();
      library = undefined;
      reject(new Error('Could not load Core\'s Mermaid library.'));
    };
    document.head.append(script);
  });
  return library;
}

async function renderDiagram(target, value) {
  const revision = (revisions.get(target) ?? 0) + 1;
  revisions.set(target, revision);
  target.setAttribute('aria-busy', 'true');
  try {
    const mermaid = await loadMermaid();
    if (revisions.get(target) !== revision || !target.isConnected) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: 50000,
      maxEdges: 500,
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
      flowchart: { htmlLabels: false },
    });
    const result = await mermaid.render(`markian-mermaid-${++diagramId}`, value);
    if (revisions.get(target) !== revision || !target.isConnected) return;
    target.innerHTML = result.svg;
  } catch (error) {
    if (revisions.get(target) !== revision || !target.isConnected) return;
    const message = document.createElement('p');
    message.className = 'mermaid-error';
    message.setAttribute('role', 'alert');
    message.textContent = error.message || 'This diagram could not be rendered.';
    target.replaceChildren(message);
  } finally {
    if (revisions.get(target) === revision) target.setAttribute('aria-busy', 'false');
  }
}

export function mermaidCodeView(onEdit) {
  return $view(codeBlockSchema.node, () => (initialNode, view, getPosition) => {
    let node = initialNode;
    const dom = document.createElement('div');
    const pre = document.createElement('pre');
    const contentDOM = document.createElement('code');
    pre.append(contentDOM);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mermaid-preview-button';
    button.setAttribute('aria-label', 'Edit Mermaid diagram');
    button.title = 'Edit Mermaid diagram';
    const preview = document.createElement('div');
    preview.className = 'mermaid-render';
    button.append(preview);
    dom.append(pre, button);
    button.addEventListener('click', () => onEdit(getPosition()));
    function refresh() {
      const diagram = node.attrs.language?.toLowerCase() === 'mermaid';
      dom.className = diagram ? 'mermaid-block' : 'code-block';
      dom.contentEditable = diagram ? 'false' : 'true';
      pre.hidden = diagram;
      button.hidden = !diagram;
      if (diagram) renderDiagram(preview, node.textContent);
    }
    const refreshTheme = () => { if (!button.hidden) renderDiagram(preview, node.textContent); };
    window.addEventListener('markian-theme', refreshTheme);
    refresh();
    return {
      dom,
      contentDOM,
      update(nextNode) {
        if (nextNode.type !== node.type) return false;
        const previous = node;
        node = nextNode;
        if (!previous.eq(node)) refresh();
        return true;
      },
      stopEvent: event => button.contains(event.target),
      ignoreMutation: mutation => mutation.type !== 'selection' && !contentDOM.contains(mutation.target),
      destroy() {
        revisions.set(preview, (revisions.get(preview) ?? 0) + 1);
        window.removeEventListener('markian-theme', refreshTheme);
      },
    };
  });
}

export function createMermaidEditor(parent, preview, onChange) {
  let timer;
  const render = () => renderDiagram(preview, view.state.doc.toString());
  const view = new EditorView({ parent });
  return {
    open(value) {
      clearTimeout(timer);
      view.setState(EditorState.create({
        doc: value,
        extensions: [lineNumbers(), highlightActiveLine(), history(), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]), EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Mermaid source', spellcheck: 'false' }),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return;
            revisions.set(preview, (revisions.get(preview) ?? 0) + 1);
            clearTimeout(timer);
            timer = setTimeout(render, 200);
            onChange();
          }),
        ],
      }));
      preview.replaceChildren();
      render();
      view.requestMeasure();
      view.focus();
    },
    get: () => view.state.doc.toString(),
    focus: () => view.focus(),
    refresh: render,
    close() {
      clearTimeout(timer);
      revisions.set(preview, (revisions.get(preview) ?? 0) + 1);
    },
  };
}