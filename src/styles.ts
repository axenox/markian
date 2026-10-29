import type { Disposer, EditorOptions } from './types';

export function markdownClasses(classes: readonly string[] = []): string[] {
  if (!Array.isArray(classes) || classes.some(value => typeof value !== 'string' || !value || /\s/.test(value))) throw new TypeError('markdownCssClasses must be an array of nonempty class names without whitespace.');
  return [...new Set(classes)];
}

export function stylesheetUrls(options: Pick<EditorOptions, 'markdownCssUrls' | 'themeCssUrls'>, document: Document): string[] {
  return ['markdownCssUrls', 'themeCssUrls'].flatMap(name => {
    const values = options[name as 'markdownCssUrls' | 'themeCssUrls'] ?? [];
    if (!Array.isArray(values)) throw new TypeError(`${name} must be an array of CSS URLs.`);
    return values.map(value => {
      if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must contain nonempty CSS URLs.`);
      const url = new URL(value, document.baseURI);
      if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError(`${name} requires HTTP(S) CSS URLs.`);
      return url.href;
    });
  });
}

export function loadStylesheets(element: HTMLElement, urls: readonly string[], signal: AbortSignal, own: (dispose: Disposer) => void): Promise<void> {
  return Promise.all([...new Set(urls)].map(url => new Promise<void>((resolve, reject) => {
    const link = element.ownerDocument.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.markianStylesheet = '';
    const finish = (error?: Error) => {
      link.onload = null;
      link.onerror = null;
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => { link.remove(); finish(new Error('Editor destroyed while loading stylesheets.')); };
    link.onload = () => finish();
    link.onerror = () => finish(new Error(`Unable to load Markian stylesheet: ${url}`));
    own(() => link.remove());
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    element.append(link);
  }))).then(() => undefined);
}