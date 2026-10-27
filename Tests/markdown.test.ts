import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalentMarkdown, headings, renderMarkdown, safeUrl, validateMarkdown } from '../src/render/markdown';
import { findMatches } from '../src/search';

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

test('literal search handles Unicode words, punctuation and case without regex execution', () => {
  assert.deepEqual(findMatches('Alpha alpha alphabet', { query: 'alpha', wholeWord: true }), [{ from: 0, to: 5 }, { from: 6, to: 11 }]);
  assert.deepEqual(findMatches('Alpha alpha', { query: 'alpha', caseSensitive: true }), [{ from: 6, to: 11 }]);
  assert.equal(findMatches('éclair éclairé', { query: 'éclair', wholeWord: true }).length, 1);
  assert.deepEqual(findMatches('a.*b', { query: '.*' }, 10), [{ from: 11, to: 13 }]);
  assert.deepEqual(findMatches('text', { query: '' }), []);
});

test('color preset renders only bounded hex styles and keeps nested Markdown readable', () => {
  const markdown = '<span style="color:#a82736">A **bold** word</span>';
  assert.match(renderMarkdown(markdown, false, true), /style="color: #a82736"/);
  assert.match(renderMarkdown(markdown, false, true), /<strong>bold<\/strong>/);
  assert.doesNotMatch(renderMarkdown(markdown), /style=/);
  const unsafe = '<span style="color:red;background:url(javascript:alert(1))" onclick="alert(1)">text</span>';
  assert.doesNotMatch(renderMarkdown(unsafe, false, true), /style=|onclick|javascript:/);
  assert.ok(equivalentMarkdown(markdown, markdown.replace('#a82736', '#A82736')));
});

test('nested headings share the same anchors as rendered output', () => {
  const markdown = '# Title\n\n> ## Nested\n\n- ### Item heading\n\n## Nested';
  assert.deepEqual(headings(markdown).map(heading => heading.id), ['title', 'nested', 'item-heading', 'nested-1']);
  const html = renderMarkdown(markdown);
  assert.match(html, /<h2 id="nested">/);
  assert.match(html, /<h3 id="item-heading">/);
  assert.match(html, /<h2 id="nested-1">/);
});