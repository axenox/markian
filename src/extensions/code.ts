import './code.css';
import { commandButton } from '../ui/controls';
import type { ExtensionFactory, Disposer, SourceHandle, SourceToken } from '../types';

export interface CodeHighlighter {
  readonly apiVersion: 1;
  readonly version: string;
  readonly language: string;
  highlight(source: string): readonly SourceToken[] | Promise<readonly SourceToken[]>;
}
export interface CodeLanguage {
  id: string;
  label: string;
  aliases?: readonly string[];
  source?: string;
  highlighter?: CodeHighlighter;
}
export interface CodeConfig {
  tabWidth?: number;
  languageBase?: string;
  languages?: readonly CodeLanguage[];
  maxCharacters?: number;
  maxLines?: number;
}
export const supportedLanguages = [
  { id: 'javascript', label: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts'] },
  { id: 'json', label: 'JSON' }, { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML', aliases: ['xml'] }, { id: 'php', label: 'PHP' },
  { id: 'sql', label: 'SQL' }, { id: 'python', label: 'Python', aliases: ['py'] },
  { id: 'yaml', label: 'YAML', aliases: ['yml'] },
] satisfies readonly CodeLanguage[];
const scriptUrl = typeof document === 'undefined' ? undefined : (document.currentScript as HTMLScriptElement | null)?.src;
const loads = new WeakMap<Document, Map<string, Promise<CodeHighlighter>>>();

function checkHighlighter(value: unknown, language: string): CodeHighlighter {
  const candidate = value as CodeHighlighter | undefined;
  if (!candidate || candidate.apiVersion !== 1 || candidate.language !== language || typeof candidate.version !== 'string' || typeof candidate.highlight !== 'function') throw new TypeError(`Incompatible Code language asset: ${language}. Expected token API 1.`);
  return candidate;
}

/** Compatible URLs are retained across instances; rejected loads can be retried. */
export function loadCodeLanguage(document: Document, language: CodeLanguage): Promise<CodeHighlighter> {
  if (language.highlighter) return Promise.resolve(checkHighlighter(language.highlighter, language.id));
  if (!language.source) return Promise.reject(new Error(`No highlighting asset configured for ${language.id}.`));
  const url = new URL(language.source, document.baseURI);
  if (!/^https?:$/.test(url.protocol)) return Promise.reject(new TypeError('Code language assets require an HTTP(S) URL.'));
  let cache = loads.get(document);
  if (!cache) { cache = new Map(); loads.set(document, cache); }
  let pending = cache.get(url.href);
  if (!pending) {
    pending = new Promise<CodeHighlighter>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url.href;
      script.onload = () => {
        script.remove();
        try {
          const globals = document.defaultView as unknown as Record<string, { highlighter?: unknown }>;
          const result = checkHighlighter(globals[`MarkianCodeLanguage_${language.id}`]?.highlighter, language.id);
          if (result.version !== '11.12.0') throw new TypeError(`Incompatible bundled highlighter version for ${language.id}.`);
          resolve(result);
        } catch (error) { reject(error); }
      };
      script.onerror = () => { script.remove(); reject(new Error(`Could not load Code language asset: ${url.href}`)); };
      document.head.append(script);
    }).catch(error => { cache!.delete(url.href); throw error; });
    cache.set(url.href, pending);
  }
  return pending.then(value => checkHighlighter(value, language.id));
}

function validTokens(value: readonly SourceToken[], length: number): readonly SourceToken[] {
  if (!Array.isArray(value) || value.length > 100000) throw new TypeError('Code highlighter must return a bounded token array.');
  let end = 0;
  for (const token of value) {
    if (!token || !Number.isInteger(token.from) || !Number.isInteger(token.to) || token.from < end || token.to <= token.from || token.to > length || !/^tok-[a-z-]+(?: tok-[a-z-]+)*$/.test(token.className)) throw new TypeError('Invalid Code highlighting token.');
    end = token.to;
  }
  return value;
}

/** Optional syntax presentation uses the same public sessions and source engine as hosts. */
export const codeExtension: ExtensionFactory = () => ({
  init(instance, supplied, lifetime) {
    const config = (supplied ?? {}) as CodeConfig;
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('Code config must be an object.');
    const tabWidth = config.tabWidth ?? 2;
    const characters = config.maxCharacters ?? 100000;
    const lines = config.maxLines ?? 5000;
    if (!Number.isInteger(tabWidth) || tabWidth < 1 || tabWidth > 8 || !Number.isInteger(characters) || characters < 1 || characters > 100000 || !Number.isInteger(lines) || lines < 1 || lines > 5000) throw new TypeError('Code limits: tabWidth 1-8, maxCharacters 1-100000, maxLines 1-5000.');
    if (config.languageBase !== undefined && (typeof config.languageBase !== 'string' || !config.languageBase.trim())) throw new TypeError('Code languageBase must be a nonempty URL.');
    if (config.languages !== undefined && !Array.isArray(config.languages)) throw new TypeError('Code languages must be an array.');
    const document = instance.element.ownerDocument;
    const base = config.languageBase ? new URL(config.languageBase, document.baseURI) : scriptUrl ? new URL('languages/', scriptUrl) : undefined;
    if (base && scriptUrl && !config.languageBase) base.search = new URL(scriptUrl).search;
    const languages: CodeLanguage[] = (config.languages ?? supportedLanguages).map(item => {
      const url = base ? new URL(`${item.id}.min.js`, base) : undefined;
      if (url && base) url.search = base.search;
      return { ...item, aliases: [...(item.aliases ?? [])], source: item.source ?? url?.href };
    });
    const names = new Set<string>();
    for (const language of languages) {
      if (!language || typeof language.label !== 'string' || !language.label.trim() || (language.source !== undefined && typeof language.source !== 'string')) throw new TypeError('Code languages require labels and URL strings.');
      for (const name of [language.id, ...(language.aliases ?? [])]) {
        if (typeof name !== 'string' || !/^[a-z0-9_+#.-]{1,80}$/.test(name) || names.has(name) || ['text', 'plain', 'plaintext', 'mermaid'].includes(name)) throw new TypeError(`Invalid or duplicate Code language: ${name}.`);
        names.add(name);
      }
      if (language.highlighter) checkHighlighter(language.highlighter, language.id);
    }
    const find = (id: string) => languages.find(language => language.id === id.toLowerCase() || language.aliases?.includes(id.toLowerCase()));
    const disposers: Disposer[] = [];
    let source: SourceHandle | undefined;
    const highlight = (value: () => string, language: () => string, apply: (tokens: readonly SourceToken[]) => void, status: HTMLElement): { refresh(): void; dispose(): void } => {
      let revision = 0;
      let disposed = false;
      let timer: ReturnType<typeof setTimeout>;
      const refresh = () => {
        const current = ++revision;
        clearTimeout(timer);
        apply([]);
        const text = value();
        const selected = find(language());
        if (!selected) { status.textContent = language() && !['text', 'plain', 'plaintext'].includes(language()) ? 'Highlighting unavailable for this language.' : ''; return; }
        if (text.length > characters || text.split('\n').length > lines) { status.textContent = 'Highlighting limit exceeded; source remains editable.'; return; }
        status.textContent = 'Loading highlighting...';
        timer = setTimeout(async () => {
          try {
            const highlighter = await loadCodeLanguage(document, selected);
            if (disposed || lifetime.aborted || current !== revision) return;
            const tokens = validTokens(await highlighter.highlight(text), text.length);
            if (disposed || lifetime.aborted || current !== revision) return;
            apply(tokens);
            status.textContent = '';
          } catch (error) {
            if (!disposed && !lifetime.aborted && current === revision) status.textContent = error instanceof Error ? error.message : String(error);
          }
        }, 100);
      };
      return { refresh, dispose: () => { disposed = true; revision++; clearTimeout(timer); } };
    };
    try {
      disposers.push(instance.getViews().insert({
        id: 'code',
        mount({ element, session }) {
          if (!session) throw new Error('The Code view requires a code-block target.');
          element.classList.add('markian-code');
          const editor = document.createElement('div');
          editor.className = 'markian-code-source';
          const status = document.createElement('div');
          status.className = 'markian-code-status';
          status.setAttribute('role', 'status');
          const retry = commandButton(document, 'Retry highlighting', 'retry', () => rendering.refresh());
          const message = document.createElement('span');
          status.append(message, retry);
          element.append(editor, status);
          source = instance.createSourceEditor(editor, session.get(), value => { session.set(value); rendering.refresh(); }, {
            tabWidth, label: 'Code source. Press Escape then Tab to move focus out.', language: session.getLanguage(),
            onLanguageChange: value => { session.setLanguage(value); rendering.refresh(); },
          });
          const activeSource = source;
          const rendering = highlight(() => activeSource.get(), () => activeSource.getLanguage(), tokens => activeSource.setHighlights(tokens), message);
          rendering.refresh();
          return () => { rendering.dispose(); activeSource.destroy(); if (source === activeSource) source = undefined; };
        },
        focus: () => source?.focus(), resize: () => source?.resize(), setReadOnly: value => source?.setReadOnly(value),
      }));
      disposers.push(instance.getCommands().insert({
        id: 'code:expand', label: 'Expand code block', icon: 'expand', views: ['visual'],
        enabled: () => instance.getCodeTarget() !== null,
        run: () => { const target = instance.getCodeTarget(); if (!target) throw new Error('Place the caret inside a fenced code block.'); instance.openView('code', target); },
      }));
      for (const id of ['undo', 'redo', 'indent', 'outdent'] as const) {
        disposers.push(instance.getCommands().insert({ id: `code:${id}`, label: { undo: 'Undo', redo: 'Redo', indent: 'Indent', outdent: 'Outdent' }[id], icon: id, mutates: true, views: ['code'], run: () => { if (id === 'indent' || id === 'outdent') source?.indent(id === 'outdent'); else source?.[id](); } }));
        disposers.push(instance.getToolbar().insert({ id: `code:${id}`, command: `code:${id}` }, id === 'undo' || id === 'redo' ? 'history' : 'format', id));
      }
      const choices = [{ id: '', label: 'Plain text' }, ...languages];
      for (const language of choices) disposers.push(instance.getCommands().insert({
        id: `code:language:${language.id || 'plain'}`, label: language.label, icon: 'code', views: ['code'], mutates: true,
        active: () => language.id === '' ? !source?.getLanguage() : find(source?.getLanguage() ?? '')?.id === language.id,
        run: () => source?.setLanguage(language.id),
      }));
      disposers.push(instance.getToolbar().insert({ id: 'code:language', label: 'Code language', icon: 'code', type: 'menu', items: choices.map(language => `code:language:${language.id || 'plain'}`) }, 'format'));
      for (const language of [...languages.flatMap(item => [item.id, ...(item.aliases ?? [])]), 'text', 'plain', 'plaintext']) disposers.push(instance.getRenderers().insert({
        id: `code:${language}`, language, visual: !['text', 'plain', 'plaintext'].includes(language),
        render(value, element, context) {
          const code = document.createElement('code');
          code.className = `language-${language}`;
          const status = document.createElement('span');
          status.className = 'markian-code-status';
          status.setAttribute('role', 'status');
          const controls = document.createElement('div');
          controls.className = 'markian-floating markian-code-controls';
          if (context) controls.append(commandButton(document, 'Expand code block', 'expand', () => context.open('code')));
          controls.append(commandButton(document, 'Retry highlighting', 'retry', () => rendering.refresh()));
          element.classList.add('markian-code-preview');
          element.replaceChildren(code, status, controls);
          const rendering = highlight(() => value, () => language, tokens => {
            code.replaceChildren();
            let offset = 0;
            for (const token of tokens) {
              code.append(document.createTextNode(value.slice(offset, token.from)));
              const span = document.createElement('span');
              span.className = token.className;
              span.textContent = value.slice(token.from, token.to);
              code.append(span);
              offset = token.to;
            }
            code.append(document.createTextNode(value.slice(offset)));
          }, status);
          rendering.refresh();
          return () => { rendering.dispose(); element.classList.remove('markian-code-preview'); };
        },
      }));
      disposers.push(instance.getHelp().insert({ id: 'code', markdown: '\n## Code blocks\n\nExpand a fenced block to edit its complete literal source. Back applies text and language changes as one document undo step. Undo/Redo and indentation affect the local draft; saved Markdown includes the draft before Back. The Code language menu chooses highlighting without translating source. Tab indents using the configured width; Shift+Tab outdents. Press Escape then Tab to leave Tab handling. Unknown, failed, or oversized highlighting retains plain editable source. Retry highlighting retries failed assets.\n' }));
    } catch (error) { disposers.reverse().forEach(dispose => dispose()); throw error; }
    return () => disposers.reverse().forEach(dispose => dispose());
  },
});