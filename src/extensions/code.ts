import type { ExtensionFactory, Disposer, SourceHandle } from '../types';

export const codeExtension: ExtensionFactory = () => ({
  init(instance) {
    let source: SourceHandle | undefined;
    const disposers: Disposer[] = [];
    disposers.push(instance.getViews().insert({
      id: 'code',
      mount({ element, session }) {
        if (!session) throw new Error('The Code view requires a code-block target.');
        element.classList.add('markian-code');
        source = instance.createSourceEditor(element, session.get(), value => session.set(value));
        return () => { source?.destroy(); source = undefined; };
      },
      focus: () => source?.focus(),
      resize: () => source?.resize(),
      setReadOnly: value => source?.setReadOnly(value),
    }));
    disposers.push(instance.getCommands().insert({
      id: 'code:expand', label: 'Expand code block', icon: 'expand', views: ['visual'],
      enabled: () => instance.getCodeTarget() !== null,
      run: () => {
        const target = instance.getCodeTarget();
        if (!target) throw new Error('Place the caret inside a fenced code block.');
        instance.openView('code', target);
      },
    }));
    for (const id of ['undo', 'redo'] as const) {
      disposers.push(instance.getCommands().insert({ id: `code:${id}`, label: id === 'undo' ? 'Undo' : 'Redo', icon: id, mutates: true, views: ['code'], run: () => { source?.[id](); } }));
      disposers.push(instance.getToolbar().insert({ id: `code:${id}`, command: `code:${id}` }, 'history', id));
    }
    disposers.push(instance.getRenderers().insert({
      id: 'code:plain', language: 'text',
      render(code, element) {
        element.textContent = code;
        element.classList.add('markian-code-preview');
        return () => element.classList.remove('markian-code-preview');
      },
    }));
    return () => { for (const dispose of disposers.reverse()) dispose(); };
  },
});