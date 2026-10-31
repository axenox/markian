/** Trusted template CSS is parsed once per mount and scoped to its document surfaces. */
export interface TemplateStyle {
  css?: string;
}

export function templateStyles(templates: readonly TemplateStyle[] = []): string {
  if (!Array.isArray(templates)) throw new TypeError('templates must be an array.');
  return templates.map(template => {
    if (!template || typeof template !== 'object') throw new TypeError('Template styles require objects.');
    if (template.css === undefined) return '';
    if (typeof template.css !== 'string' || template.css.length > 100000) throw new TypeError('Template CSS requires a string of at most 100000 characters.');
    if (/@import\b/i.test(template.css)) throw new TypeError('Template CSS does not support imports.');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(template.css);
    return [...sheet.cssRules].map(rule => {
      if (!(rule instanceof CSSStyleRule) || rule.cssRules.length) throw new TypeError('Template CSS supports flat style rules only.');
      return rule.cssText;
    }).join('\n');
  }).join('\n').trim();
}

export function installTemplateStyles(element: HTMLElement, css: string): () => void {
  if (!css) return () => {};
  const id = crypto.randomUUID();
  const style = element.ownerDocument.createElement('style');
  element.dataset.markianTemplateStyles = id;
  style.dataset.markianTemplateStyles = id;
  style.textContent = `@scope ([data-markian-template-styles="${id}"] .markian-document) to ([data-markian], [data-markian-viewer]) { ${css} }`;
  element.ownerDocument.head.append(style);
  return () => { style.remove(); delete element.dataset.markianTemplateStyles; };
}