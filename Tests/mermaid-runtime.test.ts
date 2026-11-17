import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMermaid, mermaidApi } from '../src/mermaid-runtime';
import { diagramFor, diagrams } from '../src/extensions/mermaid-snippets';
import { render } from 'pele';
import hljs from 'highlight.js/lib/core';
import { mermaidGrammar } from '../src/extensions/mermaid-language';

test('Mermaid grammar highlights templates and fragments without interpreting source', () => {
  const highlighter = hljs.newInstance();
  highlighter.registerLanguage('mermaid', mermaidGrammar);
  for (const diagram of diagrams) {
    const result = highlighter.highlight(diagram.template, { language: 'mermaid' });
    assert.equal(result.errorRaised, undefined, diagram.label);
    assert.match(result.value, /class="hljs-keyword"/, diagram.label);
    for (const snippet of diagram.groups.flatMap(group => group.snippets)) {
      assert.equal(highlighter.highlight(snippet.code, { language: 'mermaid' }).errorRaised, undefined, `${diagram.label}: ${snippet.label}`);
    }
  }
  const highlighted = highlighter.highlight('flowchart LR\n  %% note\n  A["<script> & text"] --> B\n  style A fill:#dbeafe', { language: 'mermaid' }).value;
  assert.match(highlighted, /hljs-keyword">flowchart/);
  assert.match(highlighted, /hljs-comment">%% note/);
  assert.match(highlighted, /hljs-built_in">--&gt;/);
  assert.match(highlighted, /hljs-number">#dbeafe/);
  assert.ok(highlighted.includes('&lt;script&gt;'));
  assert.ok(!highlighted.includes('<script>'));
});

test('diagram templates and custom color fragments render with Pele', () => {
  for (const diagram of diagrams) {
    const result = render(diagram.template);
    assert.match(result.svg, /<svg\b/, diagram.label);
    for (const group of diagram.groups.filter(group => group.label === 'Custom colors')) {
      for (const snippet of group.snippets) {
        const colored = render(`${diagram.template}\n${snippet.code}`);
        assert.match(colored.svg, /#dbeafe|#2563eb|219,\s*234,\s*254/, `${diagram.label}: ${snippet.label}`);
      }
    }
  }
});

test('snippet detection follows declarations and keeps unsupported source generic', () => {
  for (const diagram of diagrams) {
    assert.equal(diagramFor(`\r\n%% User comment\r\n${diagram.template.replace(/\n/g, '\r\n')}`)?.id, diagram.id);
  }
  assert.equal(diagramFor('graph TD\n A --> B')?.id, 'flowchart');
  assert.equal(diagramFor('stateDiagram\n A --> B')?.id, 'state');
  assert.equal(diagramFor('flowchart LR\n A["sequenceDiagram"]')?.id, 'flowchart');
  assert.equal(diagramFor('flowchart LR\n %% User note about use cases')?.id, 'flowchart');
  for (const source of ['', '%% flowchart LR', 'unfinished', 'pie\n "A": 1']) assert.equal(diagramFor(source), undefined);
});

test('Pele accepts the required API without a version declaration', () => {
  const api = { render() { return { svg: '<svg/>' }; } };
  assert.equal(mermaidApi(api), api);
  assert.equal(mermaidApi({ ...api, version: 'unknown-host-release' }).render, api.render);
});

test('Pele rejects absent and noncallable render methods', () => {
  for (const value of [undefined, null, {}, { initialize() {} }, { render: 'render' }]) {
    assert.throws(() => mermaidApi(value), /Pele render\(\)/);
  }
});

test('Mermaid requires a source string and never accepts the old asset object', async () => {
  await assert.rejects(loadMermaid({} as Document, ''), /config.source/);
  await assert.rejects(loadMermaid({} as Document, { url: '/mermaid.js', version: '12.2.0' } as unknown as string), /config.source/);
});