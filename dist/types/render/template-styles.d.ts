/** Trusted template CSS is parsed once per mount and scoped to its document surfaces. */
export interface TemplateStyle {
    css?: string;
}
export declare function templateStyles(templates?: readonly TemplateStyle[]): string;
export declare function installTemplateStyles(element: HTMLElement, css: string): () => void;
