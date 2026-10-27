import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalentMarkdown, headings, renderMarkdown, safeUrl, validateMarkdown } from '../src/render/markdown';

test('ordinary GFM and unknown comments survive semantic comparison', () => {
  const source = '# Notes\n\n<!-- BEGIN sample -->\n\n3. Three\n4. Four\n\n<!-- END sample -->\n\n```mermaid\ngraph LR\n A-->B\n```\n';
  assert.ok(equivalentMarkdown(source, source));
  assert.ok(!equivalentMarkdown(source, source.replace('3. Three', '1. Three')));
  assert.ok(!equivalentMarkdown('line  \nbreak', 'line\nbreak'));
  assert.ok(!equivalentMarkdown(source, source.replace('<!-- BEGIN sample -->', '')));
});

test('rendering is safe, autolinks GFM and hides front matter and metadata', () => {
  const html = renderMarkdown('---\nsecret: value\n---\n\n<!-- secret -->\n\nwww.example.org and user@example.org\n\n[bad](javascript:alert%281%29)\n\n<script>alert(1)</script>');
  assert.ok(html.includes('http://www.example.org'));
  assert.ok(html.includes('mailto:user@example.org'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('secret'));
});

test('Unicode headings have deterministic unique anchors', () => {
  assert.deepEqual(headings('# Über\n\n## Über\n\n## Über-1\n\n## Über'), [
    { id: 'über', label: 'Über', depth: 1, line: 1 },
    { id: 'über-1', label: 'Über', depth: 2, line: 3 },
    { id: 'über-1-1', label: 'Über-1', depth: 2, line: 5 },
    { id: 'über-2', label: 'Über', depth: 2, line: 7 },
  ]);
});

test('softbreak presentation never changes fenced code', () => {
  assert.match(renderMarkdown('first\nsecond\n\n```text\none\ntwo\n```', true), /first<br>second/);
  assert.match(renderMarkdown('```text\none\ntwo\n```', true), /one\ntwo/);
});

test('URL and document bounds reject unsafe input', () => {
  for (const url of ['java\nscript:alert(1)', '//example.org', 'file:///secret', 'data:image/svg+xml;base64,abc', 'a\\b']) assert.equal(safeUrl(url), false);
  assert.equal(safeUrl('../notes.md?q=1#heading'), true);
  assert.equal(safeUrl('data:image/png;base64,AA==', true), true);
  assert.throws(() => validateMarkdown('x'.repeat(1_000_001)), RangeError);
});