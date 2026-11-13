/**
 * Instance-owned table grips, cell actions and undoable reordering.
 * See Docs/Development/Components/Table_editor.md for interaction rules.
 */
import { Plugin } from './prose';
export declare function tableControls(readOnly: () => boolean, execute: (command: string) => void): Plugin;
