import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalentMarkdown, markdownDifferences, headings, renderMarkdown, safeUrl, validateMarkdown } from '../src/render/markdown';
import { findMatches } from '../src/search';
import { defaultToolbar, ToolbarItems, validateToolbar } from '../src/ui/toolbar';
import type { ToolbarEntry } from '../src/types';
import { markdownClasses } from '../src/styles';
import { expandTemplate, validateTemplates } from '../src/templates';
import { matchTags, validateTags } from '../src/mentions';

test('mention matching prioritizes literal prefixes and excludes URLs and email', () => {
  const rules = [{ id: 'ticket', prefix: '#' }, { id: 'topic', prefix: '##' }, { id: 'user', prefix: '@' }];
  assert.deepEqual(matchTags('#123 ##topic @user https://example.test/#hidden www.example.test/@hidden user@example.test', rules).map(match => [match.rule.id, match.value]), [['ticket', '#123'], ['topic', '##topic'], ['user', '@user']]);
  assert.equal(matchTags('##topic', [{ id: 'first', prefix: '#', priority: 5 }, ...rules.slice(1)])[0].rule.id, 'first');
  assert.equal(matchTags('@abcdef', [{ id: 'user', prefix: '@', maxLength: 3 }]).length, 0);
  assert.equal(matchTags('word#123', rules).length, 0);
  for (const invalid of [{ id: 'bad', prefix: '' }, { id: 'bad', prefix: '@', color: 'url(x)' }, { id: 'bad', prefix: '@', onHover: 'code' }, { id: 'bad', prefix: '@', maxLength: 101 }]) assert.throws(() => validateTags([invalid] as unknown as import('../src/types').TagRule[]), TypeError);
});

test('configured inline HTML renders escaped content without permitting attributes or scripts', () => {
  const markdown = 'Press <kbd>&lt;Enter&gt; &amp; **now**</kbd> then <sup>2</sup>.';
  assert.match(renderMarkdown(markdown, false, false, ['kbd', 'sup']), /<kbd>&#x3C;Enter> &#x26; <strong>now<\/strong><\/kbd>/);
  assert.doesNotMatch(renderMarkdown('<kbd onclick="bad()">x</kbd><script>bad()</script>', false, false, ['kbd']), /onclick|<script|<kbd/);
  assert.doesNotMatch(renderMarkdown(markdown), /<kbd|<sup/);
});

test('templates expand literal selections and reject executable or unsupported contexts', () => {
  assert.deepEqual(expandTemplate('<kbd>{{selection}}</kbd>', '', ['kbd']), { markdown: '<kbd></kbd>', caret: 5 });
  assert.equal(expandTemplate('**{{selection}}**', '{{selection}} <script> & *word*').markdown, '**\\{\\{selection\\}\\} &lt;script&gt; &amp; \\*word\\***');
  assert.equal(expandTemplate('Fixed body', 'ignored').markdown, 'Fixed body');
  assert.equal(expandTemplate('{{selection}}', '- item\n+ other\n1. ordered\n===').markdown, '\\- item\n\\+ other\n1\\. ordered\n\\=\\=\\=');
  for (const markdown of ['[label]({{selection}})', '<kbd title="{{selection}}">text</kbd>', '<script>bad</script>', '<img src="x">']) assert.throws(() => expandTemplate(markdown, 'text', ['kbd']), TypeError);
  assert.throws(() => validateTemplates([{ id: 'one', label: 'One', markdown: '<kbd>x</kbd>' }]), TypeError);
});

test('Markdown wrapper classes validate individual tokens and copy host configuration', () => {
  const classes = ['markdown-body', 'host-content', 'markdown-body'];
  assert.deepEqual(markdownClasses(classes), ['markdown-body', 'host-content']);
  assert.deepEqual(classes, ['markdown-body', 'host-content', 'markdown-body']);
  assert.deepEqual(markdownClasses(), []);
  for (const invalid of ['', 'two classes', 'line\nbreak', null, 2]) {
    assert.throws(() => markdownClasses([invalid] as string[]), TypeError);
  }
  assert.throws(() => markdownClasses('markdown-body' as unknown as string[]), TypeError);
});

test('softbreaks render text line breaks without adding breaks between blocks', () => {
  const markdown = '# Heading\n\nFirst\nsecond **bold\ntext**\n\n- One\n- Two\n\n```text\nfirst\nsecond\n```';
  const html = renderMarkdown(markdown, true);
  assert.match(html, /First<br>\nsecond <strong>bold<br>\ntext<\/strong>/);
  assert.doesNotMatch(html, /<\/(?:h1|p|li|ul)>\s*<br>|<(?:ul|li)>\s*<br>/);
  assert.match(html, /<code class="language-text">first\nsecond\n<\/code>/);
  assert.doesNotMatch(renderMarkdown(markdown, false), /<br>/);
});

test('toolbar containers validate types, alignment, nesting and legacy migration', () => {
  assert.doesNotThrow(() => validateToolbar(defaultToolbar));
  assert.doesNotThrow(() => validateToolbar([
    { id: 'tools', type: 'menu', align: 'opposite', items: [
      { id: 'section', type: 'group', items: ['copy', 'help'] },
    ] },
  ]));
  const invalid = [
    [{ id: 'tools', type: 'collapse', items: [] }],
    [{ id: 'tools', type: 'group', align: 'right', items: [] }],
    [{ id: 'tools', type: 'menu' }],
    [{ id: 'tools', items: [] }],
    [{ id: 'tools', type: 'group', command: 'copy', items: [] }],
    [{ id: 'copy', align: 'opposite' }],
    [{ id: 'tools', type: 'group', items: [{ id: 'nested', type: 'group', align: 'opposite', items: [] }] }],
    [{ id: 'same', type: 'group', items: [{ id: 'same', command: 'copy' }] }],
    [{ id: 'old', menu: ['copy'] }],
    [{ id: 'old', separator: true }],
    [{ id: 'old', overflow: true }],
    [{ id: 'old', fixed: true }],
  ];
  for (const entries of invalid) assert.throws(() => validateToolbar(entries as unknown as ToolbarEntry[]), TypeError);
});

test('toolbar insertion uses explicit groups, local before IDs and the last default inline group', () => {
  const original = JSON.stringify(defaultToolbar);
  const toolbar = new ToolbarItems(() => defaultToolbar);
  const childIds = (group: string) => {
    const container = toolbar.layout().find(entry => typeof entry !== 'string' && entry.id === group);
    return typeof container === 'object' ? container.items?.map(entry => typeof entry === 'string' ? entry : entry.id) : undefined;
  };
  const dispose = toolbar.insert({ id: 'diagram', command: 'help' }, 'insert', 'rule');
  toolbar.insert({ id: 'last-insert', command: 'copy' }, 'insert');
  toolbar.insert({ id: 'default-end', command: 'help' });
  toolbar.insert({ id: 'default-before', command: 'help' }, undefined, 'copy');
  assert.deepEqual(childIds('insert')?.slice(-3), ['diagram', 'rule', 'last-insert']);
  assert.deepEqual(childIds('document')?.slice(-4), ['default-before', 'copy', 'help', 'default-end']);
  assert.deepEqual(childIds('utilities'), ['search', 'fullscreen', 'outline']);
  assert.throws(() => toolbar.insert({ id: 'wrong', command: 'help' }, 'history', 'rule'), /Unknown toolbar ordering target/);
  assert.equal(toolbar.items().some(item => item.id === 'wrong'), false);
  assert.throws(() => toolbar.insert({ id: 'diagram', command: 'help' }, 'insert'), /Duplicate/);
  dispose();
  dispose();
  assert.equal(childIds('insert')?.includes('diagram'), false);
  assert.equal(toolbar.items().some(item => item.id === 'diagram'), false);
  assert.equal(JSON.stringify(defaultToolbar), original);
});

test('toolbar insertion resolves nested and registered containers without changing their definitions', () => {
  const menu = { id: 'menu', type: 'menu', items: [{ id: 'section', type: 'group', items: ['copy'] }] } as const;
  const base: ToolbarEntry[] = [
    { id: 'first', type: 'group', items: ['help'] },
    { id: 'last', type: 'group', align: 'default', items: ['copy'] },
    'menu',
    { id: 'right', type: 'group', align: 'opposite', items: ['fullscreen'] },
  ];
  const toolbar = new ToolbarItems(() => base);
  toolbar.register(menu);
  toolbar.insert({ id: 'nested', command: 'help' }, 'section');
  toolbar.insert({ id: 'menu-end', command: 'help' }, 'menu');
  toolbar.insert({ id: 'fallback', command: 'help' });
  const layout = toolbar.layout();
  const last = layout[1];
  assert.deepEqual(typeof last === 'object' ? last.items : undefined, ['copy', { id: 'fallback', command: 'help' }]);
  const projectedMenu = layout[2];
  assert.deepEqual(typeof projectedMenu === 'object' ? projectedMenu.items : undefined, [
    { id: 'section', type: 'group', items: ['copy', { id: 'nested', command: 'help' }] },
    { id: 'menu-end', command: 'help' },
  ]);
  assert.deepEqual(menu.items, [{ id: 'section', type: 'group', items: ['copy'] }]);
  assert.equal(base[2], 'menu');
});

test('explicit toolbar references retain their placement and absent groups stay opt-in', () => {
  const toolbar = new ToolbarItems(() => [
    { id: 'host', type: 'group', items: ['extension', 'help'] },
  ]);
  toolbar.insert({ id: 'extension', command: 'copy' }, 'insert', 'rule');
  toolbar.insert({ id: 'available', command: 'copy' }, 'missing');
  assert.equal(toolbar.items().length, 2);
  assert.deepEqual(toolbar.layout(), [{ id: 'host', type: 'group', items: ['extension', 'help'] }]);
  const floating = new ToolbarItems(() => []);
  floating.insert({ id: 'available', command: 'copy' });
  assert.deepEqual(floating.layout(), []);
});

test('toolbar removal preserves the default layout except for the requested item', () => {
  const original = JSON.stringify(defaultToolbar);
  const toolbar = new ToolbarItems(() => defaultToolbar);
  const restore = toolbar.remove('image');
  const expected = defaultToolbar.map(entry => typeof entry !== 'string' && entry.id === 'insert'
    ? { ...entry, items: entry.items?.filter(item => item !== 'image') } : entry);
  assert.deepEqual(toolbar.layout(), expected);
  assert.equal(JSON.stringify(defaultToolbar), original);
  assert.deepEqual(new ToolbarItems(() => defaultToolbar).layout(), defaultToolbar);
  restore();
  restore();
  assert.deepEqual(toolbar.layout(), defaultToolbar);
});

test('toolbar removal searches nested entries and retains registrations and other contributions', () => {
  const base: ToolbarEntry[] = [{ id: 'tools', type: 'menu', items: [
    { id: 'nested', type: 'group', items: ['image', 'copy'] },
    { id: 'image', command: 'image', label: 'Insert picture' },
  ] }];
  const toolbar = new ToolbarItems(() => base);
  toolbar.register({ id: 'image', command: 'image' });
  const restore = toolbar.remove('image');
  const restoreSecond = toolbar.remove('image');
  toolbar.insert({ id: 'custom', command: 'help' }, 'nested');
  const expected = [{ id: 'tools', type: 'menu', items: [
    { id: 'nested', type: 'group', items: ['copy', { id: 'custom', command: 'help' }] },
  ] }];
  assert.deepEqual(toolbar.layout(), expected);
  assert.equal(toolbar.items().some(item => item.id === 'image'), true);
  restore();
  assert.deepEqual(toolbar.layout(), expected);
  restoreSecond();
  assert.deepEqual(toolbar.layout(), [{ id: 'tools', type: 'menu', items: [
    { id: 'nested', type: 'group', items: ['image', 'copy', { id: 'custom', command: 'help' }] },
    { id: 'image', command: 'image', label: 'Insert picture' },
  ] }]);
  assert.throws(() => toolbar.remove(''), TypeError);
});

test('ordinary GFM and unknown comments survive semantic comparison', () => {
  const source = '# Notes\n\n<!-- BEGIN sample -->\n\n3. Three\n4. Four\n\n<!-- END sample -->\n\n```mermaid\ngraph LR\n A-->B\n```\n';
  assert.ok(equivalentMarkdown(source, source));
  assert.ok(!equivalentMarkdown(source, source.replace('3. Three', '1. Three')));
  assert.ok(!equivalentMarkdown('line  \nbreak', 'line\nbreak'));
  assert.ok(!equivalentMarkdown(source, source.replace('<!-- BEGIN sample -->', '')));
});

test('semantic comparison accepts line-ending normalization without hiding content changes', () => {
  const markdown = '---\ntitle: Notes\n---\n\n# Notes\n\nFirst line\nsecond **line**.\n\n<!-- first\nsecond -->\n\n| Item | Status |\n| --- | --- |\n| Guide | Ready |\n\n```text\none  \n  two\n```\n';
  for (const ending of ['\r\n', '\r']) {
    const source = markdown.replace(/\n/g, ending);
    assert.ok(equivalentMarkdown(source, markdown));
    assert.ok(equivalentMarkdown(markdown, source));
    assert.ok(!equivalentMarkdown(source, markdown.replace('one  ', 'one')));
    assert.ok(!equivalentMarkdown(source, markdown.replace('  two', 'two')));
    assert.ok(!equivalentMarkdown(source, markdown.replace('second **line**.', 'changed **line**.')));
    assert.ok(!equivalentMarkdown(source, markdown.replace('<!-- first\nsecond -->', '')));
  }
  assert.ok(equivalentMarkdown('first\r\nsecond\nthird\rfourth', 'first\nsecond\nthird\nfourth'));
});

test('round-trip differences report original source lines and bounded excerpts', () => {
  const source = '# Notes\r\n\r\nFirst line\r\nsecond line.\r\n\r\n- [x] Reviewed\r\n';
  const normalized = source.replace(/\r\n/g, '\n');
  assert.deepEqual(markdownDifferences(source, normalized), []);
  const differences = markdownDifferences(source, normalized.replace('second line.', 'Changed.').replace('[x]', '[ ]'));
  assert.equal(differences.length, 2);
  assert.match(differences[0], /^Lines 3-4: document\.children\[1\]\.children\[0\]\.value changed from/);
  assert.match(differences[0], /second line\./);
  assert.match(differences[0], /Changed\./);
  assert.match(differences[1], /^Line 6: .*checked changed from true to false\./);
  assert.match(markdownDifferences('# Notes\n\n<!-- keep -->', '# Notes')[0], /^Line 3: .* to missing\./);
  assert.match(markdownDifferences('# Notes', '# Notes\n\nAdded')[0], /^Line 1: .*changed from missing to/);
  assert.match(markdownDifferences('x'.repeat(500), 'y'.repeat(500))[0], /\.\.\./);
  const many = Array.from({ length: 10 }, (_, index) => `Paragraph ${index}`).join('\n\n');
  assert.equal(markdownDifferences(many, many.replaceAll('Paragraph', 'Changed')).length, 5);
});

test('rendering is safe, autolinks GFM and hides front matter and metadata', () => {
  const html = renderMarkdown('---\nsecret: value\n---\n\n<!-- secret -->\n\nwww.example.org and user@example.org\n\n[bad](javascript:alert%281%29)\n\n<script>alert(1)</script>');
  assert.ok(html.includes('http://www.example.org'));
  assert.ok(html.includes('mailto:user@example.org'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('secret'));
});

test('alert quotes render semantic types without exposing their Markdown markers', () => {
  for (const kind of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
    const markdown = `> [!${kind}]\n> Read **carefully**`;
    const html = renderMarkdown(markdown);
    assert.ok(html.includes(`data-alert-kind="${kind.toLowerCase()}"`));
    assert.ok(html.includes(`data-alert-title="${kind[0] + kind.slice(1).toLowerCase()}"`));
    assert.ok(html.includes('<strong>carefully</strong>'));
    assert.ok(!html.includes(`[!${kind}]`));
    assert.ok(equivalentMarkdown(markdown, markdown));
  }
  assert.ok(!renderMarkdown('> Ordinary quote').includes('data-alert-kind'));
  assert.ok(!renderMarkdown('> [!TIP] inline body').includes('data-alert-kind'));
  assert.match(renderMarkdown('> [!TIP]\\\n> Read **carefully**'), /data-alert-kind="tip"/);
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

test('rendered images retain bounded raster data URIs but reject unsafe direct and reference destinations', () => {
  const raster = 'data:image/png;base64,AA==';
  assert.match(renderMarkdown(`![Pixel](${raster})`), /src="data:image\/png;base64,AA=="/);
  assert.match(renderMarkdown(`![Pixel][image]\n\n[image]: ${raster}`), /src="data:image\/png;base64,AA=="/);
  for (const destination of ['data:image/svg+xml;base64,AA==', 'data:text/html;base64,AA==', 'javascript:alert%281%29', '//example.org/image.png', 'data:image/png;base64,' + 'A'.repeat(2_000_001)]) {
    if (destination.length > 1_000_000) { assert.equal(safeUrl(destination, true), false); continue; }
    for (const markdown of [`![Unsafe](${destination})`, `![Unsafe][image]\n\n[image]: ${destination}`]) assert.doesNotMatch(renderMarkdown(markdown), /src="(?:data:|javascript:|\/\/)/);
  }
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