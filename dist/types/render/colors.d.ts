import type { Parent, PhrasingContent, Root } from 'mdast';
export interface TextColor extends Parent {
    type: 'textColor';
    color: string;
    children: PhrasingContent[];
}
declare module 'mdast' {
    interface PhrasingContentMap {
        textColor: TextColor;
    }
    interface RootContentMap {
        textColor: TextColor;
    }
}
export declare const defaultColors: string[];
export declare function colorSyntax(): (tree: Root) => void;
