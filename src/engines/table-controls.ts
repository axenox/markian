/**
 * Instance-owned table grips, cell actions and undoable reordering.
 * See Docs/Development/Components/Table_editor.md for interaction rules.
 */
import { CellSelection, Plugin, TableMap, closeHistory, selectedRect, type EditorView, type ProseNode } from './prose';
import { commandButton } from '../ui/controls';

type Axis = 'row' | 'column';
interface TableContext {
  table: ProseNode;
  position: number;
  row: number;
  column: number;
  dom: HTMLTableElement;
  multiple: boolean;
  axis?: Axis;
  range?: { top: number; bottom: number; left: number; right: number; backward: boolean };
}

function tableContext(view: EditorView): TableContext | undefined {
  const selection = view.state.selection;
  const cell = selection instanceof CellSelection ? selection.$headCell : selection.$head;
  let depth = cell.depth;
  while (depth > 0 && cell.node(depth).type.name !== 'table') depth--;
  if (!depth) return;
  const position = cell.before(depth);
  const dom = view.nodeDOM(position);
  const table = dom instanceof HTMLTableElement ? dom : dom instanceof HTMLElement ? dom.querySelector('table') : null;
  if (!table) return;
  const context: TableContext = {
    table: cell.node(depth), position, row: cell.index(depth), column: cell.index(depth + 1), dom: table, multiple: false,
  };
  if (selection instanceof CellSelection) {
    const { top, bottom, left, right, map } = selectedRect(view.state);
    const rows = left === 0 && right === map.width;
    const columns = top === 0 && bottom === map.height;
    context.multiple = (bottom - top) * (right - left) > 1;
    context.axis = rows !== columns ? rows ? 'row' : 'column' : undefined;
    context.range = { top, bottom, left, right, backward: selection.$anchorCell.pos > selection.$headCell.pos };
  } else if (!selection.empty) {
    context.multiple = selection.$anchor.depth < depth + 2
      || selection.$anchor.node(depth) !== cell.node(depth)
      || selection.$anchor.before(depth + 2) !== cell.before(depth + 2);
  }
  return context;
}

function axisRange(context: TableContext, axis: Axis): { from: number; to: number } {
  if (context.axis === axis && context.range) return axis === 'row'
    ? { from: context.range.top, to: context.range.bottom }
    : { from: context.range.left, to: context.range.right };
  return { from: context[axis], to: context[axis] + 1 };
}

function selectAxis(view: EditorView, context: TableContext, axis: Axis, index: number): void {
  const map = TableMap.get(context.table);
  const start = context.position + 1;
  const first = map.positionAt(axis === 'row' ? index : 0, axis === 'column' ? index : 0, context.table);
  const last = map.positionAt(axis === 'row' ? index : map.height - 1, axis === 'column' ? index : map.width - 1, context.table);
  view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, start + first, start + last)));
}

/** Rebuilds only the affected table, retaining GFM's single typed header row. */
function moveAxis(view: EditorView, context: TableContext, axis: Axis, target: number): void {
  const { from, to } = axisRange(context, axis);
  if (from === target) return;
  const order = Array.from({ length: axis === 'row' ? context.table.childCount : context.table.firstChild!.childCount }, (_, index) => index);
  order.splice(target, 0, ...order.splice(from, to - from));
  const { schema } = view.state;
  const rows = Array.from({ length: context.table.childCount }, (_, rowIndex) => {
    const row = context.table.child(axis === 'row' ? order[rowIndex] : rowIndex);
    const type = rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;
    const cells = Array.from({ length: row.childCount }, (_, column) => {
      const cell = row.child(axis === 'column' ? order[column] : column);
      return type.create(cell.attrs, cell.content, cell.marks);
    });
    return (rowIndex === 0 ? schema.nodes.table_header_row : schema.nodes.table_row).create(row.attrs, cells);
  });
  const table = context.table.type.create(context.table.attrs, rows);
  const transaction = closeHistory(view.state.tr.replaceWith(context.position, context.position + context.table.nodeSize, table));
  const map = TableMap.get(table);
  const row = axis === 'row' ? target : context.row;
  const column = axis === 'column' ? target : context.column;
  const start = context.position + 1;
  if (context.axis === axis) {
    const first = start + map.positionAt(axis === 'row' ? target : 0, axis === 'column' ? target : 0, table);
    const last = start + map.positionAt(axis === 'row' ? target + to - from - 1 : map.height - 1,
      axis === 'column' ? target + to - from - 1 : map.width - 1, table);
    transaction.setSelection(CellSelection.create(transaction.doc,
      context.range?.backward ? last : first, context.range?.backward ? first : last));
  } else {
    const cell = start + map.positionAt(row, column, table);
    transaction.setSelection(CellSelection.create(transaction.doc, cell));
  }
  view.dispatch(transaction);
  view.dispatch(closeHistory(view.state.tr));
}

export function tableControls(readOnly: () => boolean, execute: (command: string) => void): Plugin {
  return new Plugin({
    view(view) {
      const document = view.dom.ownerDocument;
      const pane = view.dom.closest<HTMLElement>('.markian-visual')!;
      const root = pane.closest<HTMLElement>('.markian')!;
      const overlay = document.createElement('div');
      overlay.className = 'markian-table-controls';
      const marker = document.createElement('div');
      marker.className = 'markian-table-drop';
      marker.hidden = true;
      overlay.append(marker);
      root.append(overlay);
      let destroyed = false;
      let suppressClick = false;
      let drag: { axis: Axis; context: TableContext; doc: ProseNode; pointer: number; x: number; y: number; slot: number; moved: boolean } | undefined;
      const buttons = new Map<Axis, HTMLButtonElement>();
      const panels = new Map<Axis, HTMLDivElement>();
      const additions = new Map<Axis, HTMLButtonElement>();
      const cancel = () => {
        if (drag) {
          const button = buttons.get(drag.axis)!;
          if (button.hasPointerCapture(drag.pointer)) button.releasePointerCapture(drag.pointer);
        }
        drag = undefined;
        marker.hidden = true;
        overlay.classList.remove('markian-table-dragging');
      };
      const focused = () => view.hasFocus() || overlay.contains(document.activeElement);
      const update = () => {
        if (destroyed) return;
        if (drag && (readOnly() || drag.doc !== view.state.doc || !focused())) cancel();
        const context = tableContext(view);
        overlay.hidden = readOnly() || !focused() || !context || context.multiple && !context.axis || !pane.getClientRects().length;
        if (!context || overlay.hidden) return;
        const bounds = root.getBoundingClientRect();
        const visible = pane.getBoundingClientRect();
        overlay.style.clipPath = `inset(${visible.top - bounds.top}px ${Math.max(0, bounds.right - visible.right)}px ${Math.max(0, bounds.bottom - visible.bottom)}px ${visible.left - bounds.left}px)`;
        const table = context.dom.getBoundingClientRect();
        const row = context.dom.rows[context.row]?.getBoundingClientRect();
        const column = context.dom.rows[0]?.cells[context.column]?.getBoundingClientRect();
        const cell = context.dom.rows[context.row]?.cells[context.column]?.getBoundingClientRect();
        const place = (element: HTMLElement, x: number, y: number, width: number, height: number) => {
          element.hidden = x < visible.left || y < visible.top || x + width > visible.right || y + height > visible.bottom;
          element.style.left = `${x - bounds.left - root.clientLeft}px`;
          element.style.top = `${y - bounds.top - root.clientTop}px`;
        };
        // Absolute chrome never changes table dimensions, margins, or document scroll.
        if (row) {
          const top = context.axis === 'row' && context.range ? context.dom.rows[context.range.top].getBoundingClientRect().top : row.top;
          const bottom = context.axis === 'row' && context.range ? context.dom.rows[context.range.bottom - 1].getBoundingClientRect().bottom : row.bottom;
          place(buttons.get('row')!, Math.max(visible.left + 2, table.left - 20),
            (Math.max(top, visible.top) + Math.min(bottom, visible.bottom) - 28) / 2, 20, 28);
        }
        if (column) {
          const left = context.axis === 'column' && context.range ? context.dom.rows[0].cells[context.range.left].getBoundingClientRect().left : column.left;
          const right = context.axis === 'column' && context.range ? context.dom.rows[0].cells[context.range.right - 1].getBoundingClientRect().right : column.right;
          place(buttons.get('column')!, (left + right - 28) / 2, Math.max(visible.top + 2, table.top - 20), 28, 20);
        }
        for (const axis of ['row', 'column'] as const) {
          const allowed = !context.axis || context.axis === axis;
          buttons.get(axis)!.hidden ||= !allowed;
          const panel = panels.get(axis)!;
          const grouped = context.axis === axis;
          additions.get(axis)!.hidden = grouped;
          panel.classList.toggle('markian-table-actions-delete', grouped);
          const inView = cell && cell.right > visible.left && cell.left < visible.right && cell.bottom > visible.top && cell.top < visible.bottom;
          panel.hidden = !allowed || !inView || !!drag;
          if (allowed && cell && inView && !drag) {
            const width = axis === 'row' && !grouped ? 40 : 20;
            const height = axis === 'column' && !grouped ? 40 : 20;
            // At a scroll edge, keep actions reachable without moving the document.
            place(panel,
              Math.max(visible.left, Math.min(axis === 'row' ? cell.left + (cell.width - width) / 2 : cell.right - 1, visible.right - width)),
              Math.max(visible.top, Math.min(axis === 'row' ? cell.bottom - 1 : cell.top + (cell.height - height) / 2, visible.bottom - height)),
              width, height);
          }
        }
      };
      const refreshFocus = () => { queueMicrotask(update); };
      const cancelOnEscape = (event: KeyboardEvent) => {
        if (!drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
        update();
      };
      const move = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointer) return;
        if (readOnly() || drag.doc !== view.state.doc) { cancel(); update(); return; }
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
        drag.moved = true;
        overlay.classList.add('markian-table-dragging');
        const { axis, context } = drag;
        const table = context.dom.getBoundingClientRect();
        const cells = axis === 'row' ? [...context.dom.rows] : [...context.dom.rows[0].cells];
        const coordinate = axis === 'row' ? event.clientY : event.clientX;
        const rectangles = cells.map(cell => cell.getBoundingClientRect());
        const slot = rectangles.findIndex(rect => coordinate < (axis === 'row' ? rect.top + rect.height / 2 : rect.left + rect.width / 2));
        drag.slot = slot < 0 ? rectangles.length : slot;
        const boundary = drag.slot === rectangles.length
          ? (axis === 'row' ? table.bottom : table.right)
          : (axis === 'row' ? rectangles[drag.slot].top : rectangles[drag.slot].left);
        const bounds = root.getBoundingClientRect();
        marker.hidden = false;
        marker.style.left = `${(axis === 'row' ? table.left : boundary) - bounds.left - root.clientLeft}px`;
        marker.style.top = `${(axis === 'row' ? boundary : table.top) - bounds.top - root.clientTop}px`;
        marker.style.width = `${axis === 'row' ? table.width : 2}px`;
        marker.style.height = `${axis === 'row' ? 2 : table.height}px`;
      };
      for (const axis of ['row', 'column'] as const) {
        const panel = document.createElement('div');
        panel.className = 'markian-table-actions';
        panel.dataset.tableActions = axis;
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', axis === 'row' ? 'Row actions' : 'Column actions');
        for (const [operation, label, icon] of [
          [`${axis}-after`, axis === 'row' ? 'Insert row below' : 'Insert column right', 'plus'],
          [`delete-${axis}`, `Delete ${axis}`, 'rule'],
        ]) {
          const command = `table:${operation}`;
          const action = commandButton(document, label, icon, () => {
            if (!readOnly() && tableContext(view)) execute(command);
          });
          action.dataset.command = command;
          if (operation === `${axis}-after`) additions.set(axis, action);
          panel.append(action);
        }
        panels.set(axis, panel);
        overlay.append(panel);
        const button = commandButton(document, `Drag to move ${axis}; Alt+${axis === 'row' ? 'Up/Down' : 'Left/Right'} to reorder`, axis === 'row' ? 'table:grip-row' : 'table:grip-column', () => {
          const context = tableContext(view);
          if (context && !readOnly()) {
            if (context.axis !== axis) selectAxis(view, context, axis, context[axis]);
            view.focus();
          }
        });
        button.classList.add('markian-table-grip');
        button.dataset.tableGrip = axis;
        buttons.set(axis, button);
        overlay.append(button);
        button.addEventListener('pointerdown', event => {
          if (event.button !== 0 || readOnly()) return;
          const context = tableContext(view);
          if (!context) return;
          suppressClick = false;
          drag = { axis, context, doc: view.state.doc, pointer: event.pointerId, x: event.clientX, y: event.clientY, slot: context[axis], moved: false };
          button.setPointerCapture(event.pointerId);
          update();
        });
        button.addEventListener('pointermove', move);
        button.addEventListener('pointerup', event => {
          if (!drag || event.pointerId !== drag.pointer) return;
          const current = drag;
          suppressClick = current.moved;
          cancel();
          if (current.moved && !readOnly() && current.doc === view.state.doc) {
            const { from, to } = axisRange(current.context, axis);
            const target = current.slot > from ? Math.max(from, current.slot - (to - from)) : current.slot;
            moveAxis(view, current.context, axis, target);
            view.focus();
          }
          update();
        });
        button.addEventListener('lostpointercapture', cancel);
        button.addEventListener('pointercancel', () => { cancel(); update(); });
        button.addEventListener('keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); view.focus(); update(); return; }
          const direction = axis === 'row' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
          if (!event.altKey || !direction.includes(event.key) || readOnly()) return;
          event.preventDefault();
          const context = tableContext(view);
          if (!context) return;
          const { from, to } = axisRange(context, axis);
          const target = from + (event.key === direction[0] ? -1 : 1);
          const count = axis === 'row' ? context.table.childCount : context.table.firstChild!.childCount;
          if (target >= 0 && target <= count - (to - from)) moveAxis(view, context, axis, target);
        });
        // Pointer reordering must not turn its trailing click into a range selection.
        button.addEventListener('click', event => {
          if (suppressClick && event.detail > 0) event.stopImmediatePropagation();
        }, { capture: true });
      }
      root.addEventListener('focusin', refreshFocus);
      root.addEventListener('focusout', refreshFocus);
      root.addEventListener('keydown', cancelOnEscape, true);
      document.addEventListener('scroll', update, true);
      document.defaultView?.addEventListener('resize', update);
      const observer = new ResizeObserver(update);
      observer.observe(pane);
      observer.observe(view.dom);
      update();
      return {
        update,
        destroy() {
          destroyed = true;
          cancel();
          observer.disconnect();
          root.removeEventListener('focusin', refreshFocus);
          root.removeEventListener('focusout', refreshFocus);
          root.removeEventListener('keydown', cancelOnEscape, true);
          document.removeEventListener('scroll', update, true);
          document.defaultView?.removeEventListener('resize', update);
          overlay.remove();
        },
      };
    },
  });
}
