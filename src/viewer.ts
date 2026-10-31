import DOMPurify from 'dompurify';
import { headings, renderMarkdown, safeUrl, validateMarkdown } from './render/markdown';
import { loadStylesheets, markdownClasses, stylesheetUrls } from './styles';
import { validateInlineHtml, type InlineHtmlTag } from './render/inline-html';
import { installTemplateStyles, templateStyles, type TemplateStyle } from './render/template-styles';
export type { TemplateStyle } from './render/template-styles';
import './viewer.css';

export { headings };
export type { Heading } from './render/markdown';

export interface ViewerContext {
  markdown: string;
  revision: number;
  signal: AbortSignal;
  theme: 'light' | 'dark';
  documentBase: string;
}

export interface ViewerResourceContext extends ViewerContext {
  destination: string;
  kind: 'link' | 'image';
}

export interface ViewerRendererContext extends ViewerContext {
  language: string;
  source: string;
}

export interface ViewerOptions {
  markdown?: string;
  theme?: 'light' | 'dark';
  markdownCssUrls?: readonly string[];
  markdownCssClasses?: readonly string[];
  softbreaks?: boolean;
  allowTextColors?: boolean;
  allowedHtml?: readonly InlineHtmlTag[];
  templates?: readonly TemplateStyle[];
  mermaid?: boolean;
  documentBase?: string;
  onResourceResolve?: (context: ViewerResourceContext) => string | null;
  onLinkOpen?: (context: ViewerResourceContext & { event: MouseEvent }) => void;
  onError?: (error: Error) => void;
  renderers?: Readonly<Record<string, (context: ViewerRendererContext) => string | Promise<string>>>;
}

export interface Viewer {
  readonly element: HTMLElement;
  readonly ready: Promise<void>;
  get(): string;
  set(markdown: string): Promise<void>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
  destroy(): void;
}

const mounted = new WeakSet<HTMLElement>();
let sequence = 0;

function themeValue(value: unknown): 'light' | 'dark' {
  if (value !== 'light' && value !== 'dark') throw new TypeError('Viewer theme must be light or dark.');
  return value;
}

export function create(host: HTMLElement, options: ViewerOptions = {}): Viewer {
  if (!host || host.nodeType !== 1 || !['DIV', 'SECTION', 'ARTICLE'].includes(host.tagName)) throw new TypeError('Viewer requires a div, section or article host.');
  if (mounted.has(host) || host.querySelector(':scope > [data-markian-viewer]')) throw new Error('Viewer host is already mounted.');
  const initial = options.markdown ?? '';
  validateMarkdown(initial);
  validateInlineHtml(options.allowedHtml);
  const templateCss = templateStyles(options.templates);
  const allowedHtml = [...(options.allowedHtml ?? [])];
  let theme = themeValue(options.theme ?? 'light');
  for (const name of ['softbreaks', 'allowTextColors', 'mermaid'] as const) {
    if (options[name] !== undefined && typeof options[name] !== 'boolean') throw new TypeError(`${name} must be a boolean.`);
  }
  for (const name of ['onResourceResolve', 'onLinkOpen', 'onError'] as const) {
    if (options[name] !== undefined && typeof options[name] !== 'function') throw new TypeError(`${name} must be a function.`);
  }
  if (options.renderers !== undefined && (!options.renderers || typeof options.renderers !== 'object' || Array.isArray(options.renderers))) throw new TypeError('Viewer renderers must be a language-to-function map.');
  const renderers = new Map(Object.entries(options.renderers ?? {}));
  for (const [language, renderer] of renderers) {
    if (!/^[\w+-]+$/.test(language) || typeof renderer !== 'function') throw new TypeError('Viewer renderers require language IDs and functions.');
  }
  const document = host.ownerDocument;
  const classes = markdownClasses(options.markdownCssClasses);
  const cssUrls = stylesheetUrls(options, document);
  const stylesLifetime = new AbortController();
  const styleCleanups: (() => void)[] = [];
  const window = document.defaultView;
  if (!window) throw new Error('Viewer requires a live document.');
  const base = new URL(options.documentBase ?? document.baseURI, document.baseURI);
  if (!['http:', 'https:'].includes(base.protocol)) throw new TypeError('Viewer documentBase requires HTTP(S).');
  const purify = DOMPurify(window);
  const element = document.createElement('div');
  element.className = 'markian-viewer';
  element.dataset.markianViewer = '';
  element.toggleAttribute('data-markian-markdown-default', options.markdownCssUrls === undefined);
  element.dataset.theme = theme;
  const original = document.createDocumentFragment();
  let markdown = initial;
  let revision = 0;
  let destroyed = false;
  let active: AbortController | undefined;
  let pendingRender = Promise.resolve();
  const instanceId = ++sequence;
  const assertLive = () => { if (destroyed) throw new Error('Viewer is destroyed.'); };
  const report = (error: unknown) => {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (options.onError) options.onError(failure);
    else window.console.error(failure);
  };
  const resolveResource = (destination: string, kind: 'link' | 'image', context: ViewerContext): string | null => {
    if (!destination || !safeUrl(destination, kind === 'image')) return null;
    const resolved = options.onResourceResolve ? options.onResourceResolve({ ...context, destination, kind }) : destination;
    if (resolved === null) return null;
    if (typeof resolved !== 'string') throw new TypeError('onResourceResolve must return a URL string or null.');
    if (!resolved || !safeUrl(resolved, kind === 'image')) return null;
    if (resolved.startsWith('#') && kind === 'link') return resolved;
    return new URL(resolved, base).href;
  };
  const render = (next: string): Promise<void> => {
    assertLive();
    validateMarkdown(next);
    const controller = new AbortController();
    const context: ViewerContext = { markdown: next, revision: revision + 1, signal: controller.signal, theme, documentBase: base.href };
    const content = document.createElement('div');
    content.className = 'markian-document';
    content.classList.add(...classes);
    content.innerHTML = renderMarkdown(next, options.softbreaks, options.allowTextColors, allowedHtml);
    for (const node of content.querySelectorAll<HTMLAnchorElement | HTMLImageElement>('a, img')) {
      const kind = node.tagName === 'IMG' ? 'image' : 'link';
      const attribute = kind === 'image' ? 'src' : 'href';
      const destination = node.getAttribute(attribute) ?? '';
      const url = resolveResource(destination, kind, context);
      if (url === null) node.removeAttribute(attribute); else node.setAttribute(attribute, url);
      if (kind === 'link') node.dataset.markianDestination = destination;
    }
    active?.abort();
    active = controller;
    revision = context.revision;
    markdown = next;
    element.dataset.theme = theme;
    element.replaceChildren(content);
    const pending = [...content.querySelectorAll<HTMLElement>('pre > code')].map(async (code, index) => {
      const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9) ?? '';
      if (language === 'mermaid' && !options.mermaid) return;
      const renderer = renderers.get(language);
      if (!renderer) return;
      const pre = code.parentElement;
      if (!pre) return;
      try {
        let cancel = () => {};
        const aborted = new Promise<undefined>(resolve => { cancel = () => resolve(undefined); controller.signal.addEventListener('abort', cancel, { once: true }); });
        let html: string | undefined;
        try { html = await Promise.race([Promise.resolve().then(() => renderer({ ...context, language, source: code.textContent ?? '' })), aborted]); }
        finally { controller.signal.removeEventListener('abort', cancel); }
        if (controller.signal.aborted || destroyed || html === undefined) return;
        if (typeof html !== 'string') throw new TypeError(`Viewer renderer ${language} must return HTML or SVG text.`);
        if (html.length > 2_000_000) throw new RangeError('Viewer renderer output exceeds 2000000 characters.');
        const replacement = document.createElement('div');
        replacement.className = 'markian-rendered-fence';
        replacement.dataset.language = language;
        const mermaid = language === 'mermaid';
        replacement.innerHTML = purify.sanitize(html, { USE_PROFILES: { html: true, svg: true }, FORBID_TAGS: [...(mermaid ? [] : ['style']), 'foreignObject', 'form', 'input', 'button', 'textarea', 'select', 'animate', 'set', 'image', 'use', 'img', 'audio', 'video', 'source', 'picture', 'track'], FORBID_ATTR: [...(mermaid ? [] : ['style']), 'src', 'srcset', 'poster', 'background', 'ping', 'action', 'formaction', 'data'], ALLOW_DATA_ATTR: mermaid });
        const ids = new Map<string, string>();
        for (const node of replacement.querySelectorAll<HTMLElement>('[id]')) {
          const previous = node.id;
          if (!mermaid) node.id = `markian-viewer-${instanceId}-${revision}-${index}-${ids.size}`;
          ids.set(previous, node.id);
        }
        for (const node of replacement.querySelectorAll('*')) {
          for (const attribute of [...node.attributes]) {
            if (/^(href|xlink:href|src)$/i.test(attribute.name)) {
              if (attribute.value.startsWith('#') && ids.has(attribute.value.slice(1))) node.setAttribute(attribute.name, `#${ids.get(attribute.value.slice(1))}`);
              else node.removeAttribute(attribute.name);
            } else if (!(mermaid && attribute.name === 'style') && /url\s*\(/i.test(attribute.value)) {
              const reference = attribute.value.match(/^url\(#([^\s)]+)\)$/);
              if (reference && ids.has(reference[1])) node.setAttribute(attribute.name, `url(#${ids.get(reference[1])})`);
              else node.removeAttribute(attribute.name);
            }
          }
        }
        pre.replaceWith(replacement);
      } catch (error) {
        if (!controller.signal.aborted && !destroyed) report(error);
      }
    });
    pendingRender = Promise.all(pending).then(() => undefined);
    return pendingRender;
  };
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const link = target?.closest<HTMLAnchorElement>('a[data-markian-destination]');
    if (!link || !element.contains(link)) return;
    const destination = link.dataset.markianDestination ?? '';
    if (!link.hasAttribute('href')) { event.preventDefault(); return; }
    if (options.onLinkOpen) {
      event.preventDefault();
      try {
        options.onLinkOpen({ markdown, revision, theme, documentBase: base.href, signal: active!.signal, destination, kind: 'link', event });
      } catch (error) { report(error); }
    } else if (link.getAttribute('href')?.startsWith('#')) {
      event.preventDefault();
      let id: string;
      try { id = decodeURIComponent(link.getAttribute('href')!.slice(1)); }
      catch { return; }
      [...element.querySelectorAll<HTMLElement>('[id]')].find(node => node.id === id)?.scrollIntoView({ block: 'nearest' });
    }
  };
  while (host.firstChild) original.append(host.firstChild);
  host.append(element);
  mounted.add(host);
  element.addEventListener('click', click);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    active?.abort();
    stylesLifetime.abort();
    styleCleanups.reverse().forEach(dispose => dispose());
    element.removeEventListener('click', click);
    element.remove();
    host.append(original);
    mounted.delete(host);
  };
  let ready: Promise<void>;
  try {
    styleCleanups.push(installTemplateStyles(element, templateCss));
    ready = Promise.all([render(initial), loadStylesheets(host, cssUrls, stylesLifetime.signal, dispose => styleCleanups.push(dispose))]).then(() => undefined);
    ready = ready.catch(error => { destroy(); throw error; });
  }
  catch (error) { destroy(); throw error; }
  return {
    element, ready,
    get: () => { assertLive(); return markdown; },
    set: next => { if (next === markdown) { assertLive(); return pendingRender; } return render(next); },
    setTheme: next => { assertLive(); const previous = theme; theme = themeValue(next); try { return render(markdown); } catch (error) { theme = previous; throw error; } },
    destroy,
  };
}