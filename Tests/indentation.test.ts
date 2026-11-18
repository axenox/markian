import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandTabs, indentationChanges } from '../src/engines/indentation';

test('incoming tabs expand at tab stops and restart after each newline', () => {
  assert.equal(expandTabs('\tA\tB\n\tC', 4, 2), '  A   B\n    C');
});

test('Tab inserts spaces at the caret or replaces a single-line selection', () => {
  assert.deepEqual(indentationChanges('abc', 1, 1, 4), [{ from: 1, to: 1, insert: '   ' }]);
  assert.deepEqual(indentationChanges('abc', 1, 3, 2), [{ from: 1, to: 3, insert: ' ' }]);
});

test('line indentation aligns to tab stops and excludes a terminal line-start selection', () => {
  assert.deepEqual(indentationChanges(' a\n  b\nc', 1, 7, 4), [
    { from: 0, to: 1, insert: '    ' },
    { from: 3, to: 5, insert: '    ' },
  ]);
});

test('Shift+Tab handles partial indentation, blank lines and edited tab prefixes', () => {
  assert.deepEqual(indentationChanges('      a\n \n\tb\tkeep', 0, 17, 4, true), [
    { from: 0, to: 6, insert: '    ' },
    { from: 8, to: 9, insert: '' },
    { from: 10, to: 11, insert: '' },
  ]);
  assert.deepEqual(indentationChanges('plain', 2, 2, 4, true), []);
});
