import type { Root } from 'mdast';
export declare const documentLimit = 1000000;
export declare function quoteMarker(text: string): {
    kind: string;
    length: number;
} | null;
export declare function validateMarkdown(markdown: string): void;
export declare function parseMarkdown(markdown: string): Root;
export declare function equivalentMarkdown(first: string, second: string): boolean;
export declare function markdownDifferences(first: string, second: string): string[];
export declare function safeUrl(destination: string, image?: boolean): boolean;
export interface Heading {
    id: string;
    label: string;
    depth: number;
    line: number;
}
export declare function headings(markdown: string): Heading[];
export declare function renderMarkdown(markdown: string, softbreaks?: boolean, allowTextColors?: boolean): string;
