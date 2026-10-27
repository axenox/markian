export { Plugin, EditorState, TextSelection } from 'prosemirror-state';
export type { Command, Transaction } from 'prosemirror-state';
export type { Node as ProseNode, NodeSpec, Attrs } from 'prosemirror-model';
export type { EditorView } from 'prosemirror-view';
export { toggleMark, setBlockType, wrapIn, baseKeymap } from 'prosemirror-commands';
export { history, undo, redo, closeHistory } from 'prosemirror-history';
export { keymap } from 'prosemirror-keymap';
export { wrapInList } from 'prosemirror-schema-list';
