import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mdiSitemapOutline } from '@mdi/js';
import { equivalentMarkdown } from '../src/render/markdown';

const browserErrors = new WeakMap();
const corpus = JSON.parse(readFileSync(new URL('./Fixtures/compatibility.json', import.meta.url), 'utf8'));

async function revealCommand(root, id) {
  const command = root.locator(`[data-command="${id}"]`).first();
  const menus = await command.evaluate(element => {
    const labels = [];
    for (let menu = element.closest('details'); menu; menu = menu.parentElement?.closest('details')) labels.unshift(menu.querySelector(':scope > summary').getAttribute('aria-label'));
    return labels;
  });
  for (const label of menus) {
    const summary = root.locator(`summary[aria-label=${JSON.stringify(label)}]`);
    if (await summary.locator('..').getAttribute('open') === null) await summary.click();
  }
  return command;
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForURL('**/Examples/editor-workspace.html');
  await page.evaluate(async () => { await Promise.all([window.editor.ready, window.secondary.ready]); });
});

test('configured CSS URLs replace content styles and overlay the editor theme', async ({ page }) => {
  await page.route('**/host-content.css', route => route.fulfill({ contentType: 'text/css', body: '.css-configured .markian-document p { color: rgb(18, 52, 86); font-size: 19px; }' }));
  await page.route('**/host-theme.css', route => route.fulfill({ contentType: 'text/css', body: '.css-configured.markian { --markian-accent: rgb(170, 20, 40); }' }));
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.height = '400px';
    document.querySelector('main').prepend(host);
    window.cssEditor = Markian.create(host, { markdown: 'Custom content', markdownCssUrls: ['/host-content.css'], themeCssUrls: ['/host-theme.css'] });
    cssEditor.element.classList.add('css-configured');
    await cssEditor.ready;
  });
  const root = page.locator('.css-configured');
  await expect(root.locator('.markian-document p')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(root.locator('.markian-document p')).toHaveCSS('font-size', '19px');
  await expect(root).toHaveCSS('--markian-accent', 'rgb(170, 20, 40)');
  expect(await root.locator('link[data-markian-stylesheet]').evaluateAll(links => links.map(link => new URL(link.href).pathname))).toEqual(['/host-content.css', '/host-theme.css']);
  expect(await page.evaluate(() => editor.element.hasAttribute('data-markian-markdown-default'))).toBe(true);
  expect(await root.getAttribute('data-markian-markdown-default')).toBeNull();
  expect(await page.evaluate(async () => {
    const links = [...cssEditor.element.querySelectorAll('link[data-markian-stylesheet]')];
    cssEditor.destroy();
    const host = document.createElement('div');
    document.querySelector('main').prepend(host);
    const bare = Markian.create(host, { markdown: 'Unstyled content', markdownCssUrls: [] });
    await bare.ready;
    const noLinks = bare.element.querySelectorAll('link[data-markian-stylesheet]').length === 0;
    bare.destroy();
    host.remove();
    return noLinks && links.every(link => !link.isConnected);
  })).toBe(true);
});

test('focus colors the editor border without a document bar and respects host themes', async ({ page }) => {
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.height = '400px';
    document.querySelector('main').prepend(host);
    window.focusEditor = Markian.create(host, { markdown: 'Focus document' });
    focusEditor.element.classList.add('focus-configured');
    await focusEditor.ready;
  });
  const root = page.locator('.focus-configured');
  const document = root.locator('.ProseMirror');
  for (const width of [960, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => focusEditor.setTheme(theme), theme);
      await root.evaluate(element => element.style.removeProperty('--markian-focus-color'));
      const colors = await root.evaluate(element => {
        const probe = document.createElement('span');
        probe.style.cssText = 'color: var(--markian-accent); background-color: var(--markian-line)';
        element.append(probe);
        const style = getComputedStyle(probe);
        const colors = { accent: style.color, line: style.backgroundColor };
        probe.remove();
        return colors;
      });
      const bounds = await root.boundingBox();
      await document.focus();
      await expect(root).toHaveCSS('border-top-color', colors.accent);
      await expect(document).toHaveCSS('box-shadow', 'none');
      await root.evaluate(element => element.style.setProperty('--markian-focus-color', 'rgb(98, 0, 238)'));
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await expect(root).toHaveCSS(`border-${side}-color`, 'rgb(98, 0, 238)');
      }
      await page.evaluate(() => editor.element.querySelector('.ProseMirror').focus());
      await expect(root).toHaveCSS('border-top-color', colors.line);
      expect(await root.boundingBox()).toEqual(bounds);
      await page.evaluate(() => focusEditor.setMode('raw'));
      await root.locator('.cm-content').focus();
      await expect(root).toHaveCSS('border-top-color', 'rgb(98, 0, 238)');
      await page.evaluate(() => focusEditor.setMode('visual'));
    }
  }
  await page.evaluate(() => focusEditor.destroy());
});

test('base editor CSS normalizes list and table spacing with external content styles', async ({ page }) => {
  await page.route('**/spacing-content.css', route => route.fulfill({ contentType: 'text/css', body: '.markdown-body p { margin: 0 0 16px; } .markdown-body th, .markdown-body td { padding: 6px 13px; }' }));
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.height = '500px';
    document.querySelector('main').prepend(host);
    window.spacingEditor = Markian.create(host, {
      markdown: 'Outside table\n\n- First paragraph\n\n  Second paragraph\n\n| File | Responsibility |\n| --- | --- |\n| index.ts | Factory |',
      markdownCssUrls: ['/spacing-content.css'],
    });
    await spacingEditor.ready;
    spacingEditor.element.classList.add('spacing-configured');
    spacingEditor.element.querySelector('.markian-document').classList.add('markdown-body');
  });
  const root = page.locator('.spacing-configured');
  for (const tag of ['li', 'th', 'td']) {
    const paragraph = root.locator(`.markian-document ${tag} > p`).first();
    await expect(paragraph).toHaveCSS('margin-top', '0px');
    await expect(paragraph).toHaveCSS('margin-bottom', '0px');
  }
  await expect(root.locator('.markian-document li > p + p')).toHaveCSS('margin-top', '16px');
  await expect(root.locator('.markian-document > p').first()).toHaveCSS('margin-bottom', '16px');
  await expect(root.locator('.markian-document td').first()).toHaveCSS('padding', '6px 13px');
  await page.evaluate(() => spacingEditor.destroy());
});

test('CSS URL validation and load failure restore the host', async ({ page }) => {
  await page.route('**/missing-content.css', route => route.fulfill({ status: 404, contentType: 'text/css', body: '' }));
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    document.querySelector('main').prepend(host);
    let validation = '';
    try { Markian.create(host, { markdown: 'Keep source', markdownCssUrls: ['javascript:alert(1)'] }); }
    catch (error) { validation = error.message; }
    const instance = Markian.create(host, { markdown: 'Keep source', markdownCssUrls: ['/missing-content.css'] });
    let failure = '';
    try { await instance.ready; } catch (error) { failure = error.message; }
    return { validation, failure, restored: !host.hidden, removed: !instance.element.isConnected };
  });
  expect(result.validation).toContain('HTTP(S)');
  expect(result.failure).toContain('Unable to load Markian stylesheet');
  expect(result.restored).toBe(true);
  expect(result.removed).toBe(true);
});

async function mermaidFixture(page, kind = 'supplied') {
  await page.addStyleTag({ url: '/dist/extensions/mermaid.css' });
  await page.addScriptTag({ url: '/dist/extensions/mermaid.min.js' });
  await page.evaluate(async kind => {
    Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
    const host = document.createElement('div');
    host.style.height = '560px';
    document.querySelector('main').prepend(host);
    window.diagramCalls = [];
    const renderer = { render: async ({ source, theme, signal }) => {
      diagramCalls.push({ source, theme, signal });
      if (kind === 'delayed') await new Promise(resolve => { (window.diagramResolves ??= []).push(resolve); });
      if (source.includes('invalid')) throw new Error('Invalid diagram syntax');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160"><defs><marker id="arrow"><path d="M0 0L5 5"/></marker></defs><g class="node"><rect id="node" width="180" height="80"/><text x="10" y="40">${theme}</text></g><path marker-end="url(#arrow)" d="M0 90L100 90"/><script>alert(1)</script><foreignObject><p>Unsafe</p></foreignObject><a href="javascript:alert(1)"><text>Link</text></a></svg>`;
    } };
    window.diagramEditor = Markian.create(host, {
      markdown: '# Diagrams\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n```mermaid\nflowchart TD\n  C --> D\n```\n',
      extensions: { mermaid: { enabled: true, config: kind === 'missing' ? {} : { renderer } } },
    });
    await diagramEditor.ready;
  }, kind);
  const root = page.locator('[data-markian]').filter({ has: page.locator('.markian-diagram') }).first();
  await root.locator('.markian-diagram').first().hover();
  return root;
}

test('Mermaid optional core and disabled instances request no renderer assets', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (/mermaid/i.test(request.url())) requests.push(request.url()); });
  await page.evaluate(async () => {
    editor.set('```mermaid\nflowchart LR\n A-->B\n```');
    const host = document.createElement('div');
    document.body.append(host);
    window.disabledDiagram = Markian.create(host, { markdown: editor.get(), extensions: { mermaid: { enabled: false, config: { source: '/must-not-load.js' } } } });
    await disabledDiagram.ready;
    await editor.execute('preview');
  });
  await expect(page.locator('.markian-view code.language-mermaid')).toHaveCount(1);
  expect(requests).toEqual([]);
});

test('Mermaid supplied renderer scopes IDs, sanitizes SVG and keeps instance themes independent', async ({ page }) => {
  const root = await mermaidFixture(page);
  const commands = await root.locator('.markian-toolbar [data-command]').evaluateAll(elements => elements.map(element => element.dataset.command));
  expect(commands.indexOf('mermaid:insert')).toBeGreaterThan(commands.indexOf('image'));
  expect(commands.indexOf('mermaid:insert')).toBeGreaterThan(commands.indexOf('table:insert'));
  expect(commands.indexOf('mermaid:insert')).toBeLessThan(commands.indexOf('rule'));
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(2);
  await expect(root.locator('.markian-diagram script, .markian-diagram foreignObject, .markian-diagram a')).toHaveCount(0);
  const ids = await root.locator('.markian-diagram [id]').evaluateAll(elements => elements.map(element => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  await page.evaluate(() => diagramEditor.setTheme('dark'));
  await expect(root.locator('.markian-diagram text').first()).toHaveText('dark');
  expect(await page.evaluate(() => editor.element.dataset.theme)).toBe('light');
  const value = await page.evaluate(() => diagramEditor.get());
  await page.evaluate(() => diagramEditor.execute('preview'));
  await expect(root.locator('.markian-view .markian-diagram[data-state="ready"]')).toHaveCount(2);
  expect(await page.evaluate(() => diagramEditor.get())).toBe(value);
});

test('Mermaid Backspace after a rendered diagram deletes the entire fence and supports undo', async ({ page }) => {
  const root = await mermaidFixture(page);
  await page.evaluate(() => diagramEditor.set('Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter'));
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
  const initial = await page.evaluate(() => diagramEditor.get());
  const paragraph = root.locator('.markian-document > p').last();
  await paragraph.click();
  await page.keyboard.press('Home');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Backspace');
  await expect(root.locator('.markian-diagram')).toHaveCount(0);
  expect(await page.evaluate(() => diagramEditor.get())).toBe('Before\n\nAfter');
  await page.keyboard.type('Still editable ');
  expect(await page.evaluate(() => diagramEditor.get())).toBe('Before\n\nStill editable After');
  await page.evaluate(() => diagramEditor.execute('undo'));
  await page.evaluate(() => diagramEditor.execute('undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
});

test('Mermaid Backspace from an empty following paragraph respects read-only state', async ({ page }) => {
  const root = await mermaidFixture(page);
  await page.evaluate(() => diagramEditor.set('Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter'));
  const paragraph = root.locator('.markian-document > p').last();
  await paragraph.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Backspace');
  await expect(paragraph).toBeEmpty();
  const initial = await page.evaluate(() => diagramEditor.get());
  await page.evaluate(() => diagramEditor.setReadOnly(true));
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await page.evaluate(() => diagramEditor.setReadOnly(false));
  await paragraph.click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => diagramEditor.get())).not.toContain('```');
  await page.evaluate(() => diagramEditor.execute('undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
});

test('Mermaid Delete before a rendered diagram removes the fence and respects read-only state', async ({ page }) => {
  const root = await mermaidFixture(page);
  await page.evaluate(() => diagramEditor.set('Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter'));
  const initial = await page.evaluate(() => diagramEditor.get());
  const paragraph = root.locator('.markian-document > p').first();
  await paragraph.click();
  await page.keyboard.press('End');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => diagramEditor.setReadOnly(true));
  await page.keyboard.press('Delete');
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await page.evaluate(() => diagramEditor.setReadOnly(false));
  await paragraph.click();
  await page.keyboard.press('End');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Delete');
  expect(await page.evaluate(() => diagramEditor.get())).toBe('Before\n\nAfter');
  await page.keyboard.type(' still editable');
  expect(await page.evaluate(() => diagramEditor.get())).toBe('Before still editable\n\nAfter');
  await page.evaluate(() => diagramEditor.execute('undo'));
  await page.evaluate(() => diagramEditor.execute('undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
});

test('Mermaid drafts save before Back, suspend for Help, and commit once with local history', async ({ page }) => {
  const root = await mermaidFixture(page);
  const initial = await page.evaluate(() => diagramEditor.get());
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  await expect(root).toHaveAttribute('data-view', 'mermaid');
  await page.evaluate(() => { window.diagramChanges = 0; diagramEditor.on('change', () => diagramChanges++); });
  const input = root.locator('.markian-mermaid .cm-content');
  await input.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n  B --> C');
  const draft = await page.evaluate(() => diagramEditor.get());
  expect(draft).toContain('B --> C');
  expect(draft).toContain('# Diagrams');
  await page.evaluate(() => diagramEditor.on('save-request', () => { window.savedDiagramDraft = diagramEditor.get(); }));
  await page.keyboard.press('Control+s');
  expect(await page.evaluate(() => savedDiagramDraft)).toBe(draft);
  await page.evaluate(() => diagramEditor.execute('help'));
  await expect(root.locator('.markian-view:not([hidden])')).toContainText('Mermaid diagrams');
  expect(await page.evaluate(() => diagramEditor.get())).toBe(draft);
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => diagramEditor.execute('mermaid:undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await page.evaluate(() => diagramEditor.execute('mermaid:redo'));
  const before = await page.evaluate(() => diagramChanges);
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => diagramChanges)).toBe(before);
  expect(await page.evaluate(() => diagramEditor.get())).toBe(draft);
  await page.evaluate(() => diagramEditor.execute('undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
});

test('Mermaid no-op Back, conflicts, deleted targets and permission transitions retain drafts', async ({ page }) => {
  const root = await mermaidFixture(page);
  const initial = await page.evaluate(() => diagramEditor.get());
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  await page.evaluate(() => { window.oldDiagramTarget = diagramEditor.getActiveSession().target; });
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => diagramEditor.get())).toBe(initial);
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  await page.evaluate(() => diagramEditor.getActiveSession().set('flowchart LR\n A --> Changed'));
  const draft = await page.evaluate(() => diagramEditor.get());
  expect(await page.evaluate(() => { try { diagramEditor.set('New document'); return false; } catch { return true; } })).toBe(true);
  await page.evaluate(() => diagramEditor.setReadOnly(true));
  expect(await page.evaluate(() => diagramEditor.execute('mermaid:undo'))).toBe(false);
  expect(await page.evaluate(() => { try { diagramEditor.back(); return false; } catch { return true; } })).toBe(true);
  await root.locator('.markian-mermaid .cm-content').click();
  await page.keyboard.type('must not change');
  expect(await page.evaluate(() => diagramEditor.get())).toBe(draft);
  await root.locator('.markian-mermaid .markian-diagram').hover();
  await root.locator('.markian-mermaid').getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.evaluate(() => { diagramEditor.setReadOnly(false); diagramEditor.back(); diagramEditor.set('Replacement', { pending: 'discard' }); });
  expect(await page.evaluate(() => { try { diagramEditor.openView('mermaid', oldDiagramTarget); return false; } catch { return true; } })).toBe(true);
});

test('Mermaid invalid syntax, directives and complexity limits preserve ordinary fences', async ({ page }) => {
  const root = await mermaidFixture(page);
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  for (const [source, message] of [['invalid diagram', 'Invalid diagram syntax'], ['%%{init: {}}%%\nflowchart LR', 'configuration directives'], ['x'.repeat(20001), 'complexity limit']]) {
    await page.evaluate(source => diagramEditor.getActiveSession().set(source), source);
    await expect(root.locator('.markian-mermaid .markian-diagram-status')).toContainText(message);
    expect(await page.evaluate(() => diagramEditor.get())).toContain(source);
  }
  await page.evaluate(() => diagramEditor.getActiveSession().set('invalid diagram'));
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => diagramEditor.get())).toContain('```mermaid\ninvalid diagram');
});

test('Mermaid late results are ignored after rapid drafts and teardown', async ({ page }) => {
  const root = await mermaidFixture(page, 'delayed');
  await expect.poll(() => page.evaluate(() => diagramCalls.length)).toBe(2);
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => diagramCalls.length)).toBe(3);
  await page.evaluate(() => diagramEditor.getActiveSession().set('flowchart LR\n New --> Draft'));
  await expect.poll(() => page.evaluate(() => diagramCalls.length)).toBe(4);
  expect(await page.evaluate(() => diagramCalls[2].signal.aborted)).toBe(true);
  await page.evaluate(() => { diagramResolves[3](); diagramResolves[2](); });
  await expect(root.locator('.markian-mermaid .markian-diagram')).toHaveAttribute('data-state', 'ready');
  await page.evaluate(() => { diagramEditor.destroy(); diagramResolves.forEach(resolve => resolve()); });
  await expect(root).toHaveCount(0);
  expect(await page.evaluate(() => diagramCalls.every(call => call.signal.aborted))).toBe(true);
});

test('Mermaid missing host URL shows an error instead of a diagram and retains editable source', async ({ page }) => {
  const root = await mermaidFixture(page, 'missing');
  expect(await page.evaluate(async () => {
    try { await MarkianMermaid.loadMermaid(document, ' '); return ''; }
    catch (error) { return error.message; }
  })).toContain('Mermaid URL is not configured');
  await expect(root.locator('.markian-diagram[data-state="error"]')).toHaveCount(2);
  await expect(root.locator('.markian-diagram-status').first()).toContainText('Mermaid URL is not configured');
  await expect(root.locator('.markian-diagram-canvas svg, .markian-diagram-canvas code')).toHaveCount(0);
  await expect(root.locator('.markian-diagram-viewport').first()).toBeHidden();
  expect(await page.evaluate(() => diagramEditor.get())).toContain('flowchart LR');
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  await page.evaluate(() => diagramEditor.getActiveSession().set('flowchart LR\n Saved --> Source'));
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => diagramEditor.get())).toContain('Saved --> Source');
});

test('Mermaid nested fences render without offering unsupported block-session editing', async ({ page }) => {
  const root = await mermaidFixture(page);
  await page.evaluate(() => diagramEditor.set('> ```mermaid\n> flowchart LR\n> A --> B\n> ```'));
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
  await expect(root.getByRole('button', { name: 'Edit diagram', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => diagramEditor.get())).toContain('> A --> B');
});

test('Mermaid insertion, indentation and pointer pan use the active session only', async ({ page }) => {
  const root = await mermaidFixture(page);
  await expect((await revealCommand(root, 'mermaid:insert')).locator('svg path')).toHaveAttribute('d', mdiSitemapOutline);
  await page.evaluate(async () => { diagramEditor.set(''); await diagramEditor.execute('mermaid:insert'); });
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
  expect(await page.evaluate(() => diagramEditor.get())).toContain('A[Start] --> B[Finish]');
  await root.locator('.markian-diagram').hover();
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).click();
  const input = root.locator('.markian-mermaid .cm-content');
  await input.click();
  await page.keyboard.press('Control+Home');
  const original = await page.evaluate(() => diagramEditor.get());
  await page.evaluate(() => diagramEditor.execute('mermaid:indent'));
  expect(await page.evaluate(() => diagramEditor.get())).not.toBe(original);
  await page.evaluate(() => diagramEditor.execute('mermaid:undo'));
  expect(await page.evaluate(() => diagramEditor.get())).toBe(original);
  const viewport = root.locator('.markian-mermaid .markian-diagram-viewport');
  const bounds = await viewport.boundingBox();
  await page.mouse.move(bounds.x + 30, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 60);
  await page.mouse.up();
  await expect(root.locator('.markian-mermaid .markian-diagram-canvas')).toHaveAttribute('style', /translate\(60px, 30px\)/);
  expect(await page.evaluate(() => diagramEditor.get())).toBe(original);
});

for (const width of [1440, 390]) test(`Mermaid host-configured example renders, centers labels and floats controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const assets = [];
  page.on('request', request => { if (request.url().includes('/host-assets/mermaid.min.js')) assets.push(request.url()); });
  await page.goto('/Examples/mermaid-diagrams.html');
  await page.evaluate(() => diagramEditor.ready);
  const root = page.locator('[data-markian]');
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(2);
  expect(assets).toHaveLength(1);
  await expect(root.locator('.markian-diagram').first()).toContainText('Draft');
  await expect(root.locator('.markian-diagram').first()).toContainText('Publish');
  const firstDiagram = root.locator('.markian-diagram').first();
  await expect(firstDiagram.locator('.markian-diagram-controls')).toHaveCSS('position', 'absolute');
  await expect(firstDiagram.locator('.markian-diagram-controls')).toHaveCSS('opacity', '0');
  await firstDiagram.locator('.markian-diagram-viewport').focus();
  await expect(firstDiagram.locator('.markian-diagram-controls')).toHaveCSS('opacity', '1');
  await firstDiagram.locator('.markian-diagram-viewport').blur();
  const centers = await firstDiagram.locator('svg .node').evaluateAll(nodes => nodes.map(node => {
    const shape = node.querySelector('rect');
    const label = node.querySelector('text');
    const box = shape.getBoundingClientRect();
    const text = label.getBoundingClientRect();
    return Math.abs(box.x + box.width / 2 - text.x - text.width / 2);
  }));
  expect(centers.every(offset => offset < 2)).toBe(true);
  await firstDiagram.hover();
  await expect(firstDiagram.locator('.markian-diagram-controls')).toHaveCSS('opacity', '1');
  await root.getByRole('button', { name: 'Edit diagram', exact: true }).first().click();
  const split = root.locator('.markian-mermaid');
  await expect(split.locator('.markian-diagram')).toHaveAttribute('data-state', 'ready');
  const code = await split.locator('.markian-mermaid-source').boundingBox();
  const preview = await split.locator('.markian-diagram').boundingBox();
  expect(width === 390 ? preview.y >= code.y + code.height - 1 : preview.x >= code.x + code.width - 1).toBe(true);
  expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const canvas = split.locator('.markian-diagram-canvas');
  await split.locator('.markian-diagram').hover();
  await split.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(canvas).toHaveAttribute('style', /scale\(1.25\)/);
  const viewport = split.locator('.markian-diagram-viewport');
  await viewport.focus();
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('style', /translate\(30px/);
  await page.keyboard.press('Home');
  await expect(canvas).toHaveAttribute('style', /scale\(1\)/);
  await page.selectOption('#theme', 'dark');
  await expect(split.locator('.markian-diagram')).toHaveAttribute('data-state', 'ready');
  await page.screenshot({ path: `.test-results/mermaid-${width}-dark.png` });
});

test('Mermaid source loading retries failures and deduplicates instances by URL', async ({ page }) => {
  let failures = 0;
  await page.route('**/host-assets/mermaid.min.js', async route => {
    if (++failures !== 1) { await route.continue(); return; }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await route.abort();
  });
  await page.goto('/Examples/mermaid-diagrams.html');
  await page.evaluate(() => diagramEditor.ready);
  const root = page.locator('[data-markian]');
  await expect(root.locator('.markian-diagram[data-state="error"]')).toHaveCount(2);
  await root.getByRole('button', { name: 'Retry diagram', exact: true }).first().click();
  await expect(root.locator('.markian-diagram[data-state="ready"]')).toHaveCount(1);
  await page.evaluate(async () => {
    const host = document.createElement('div');
    document.body.append(host);
    window.otherDiagram = Markian.create(host, { markdown: '```mermaid\nflowchart LR\n Other-->Instance\n```', extensions: { mermaid: { enabled: true, config: { source: '/host-assets/mermaid.min.js' } } } });
    await otherDiagram.ready;
  });
  await expect(page.locator('[data-markian] .markian-diagram[data-state="ready"]')).toHaveCount(2);
  expect(failures).toBe(2);
  expect(await page.evaluate(async () => {
    return await MarkianMermaid.loadMermaid(document, '/host-assets/mermaid.min.js') === await MarkianMermaid.loadMermaid(document, new URL('/host-assets/mermaid.min.js', document.baseURI).href);
  })).toBe(true);
  await page.evaluate(() => diagramEditor.destroy());
  await expect(page.locator('[data-markian] .markian-diagram[data-state="ready"]')).toHaveCount(1);
});

test('Mermaid source API failures retain Markdown and allow a corrected runtime retry', async ({ page }) => {
  let valid = false;
  await page.route('**/host-mermaid-api.js', route => route.fulfill({ contentType: 'text/javascript', body: valid
    ? 'window.mermaid = {initialize(){}, async render(){return {svg:\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><text x="5" y="25">Ready</text></svg>\'};}};'
    : 'window.mermaid = {initialize(){}};' }));
  await page.addStyleTag({ url: '/dist/extensions/mermaid.css' });
  await page.addScriptTag({ url: '/dist/extensions/mermaid.min.js' });
  await page.evaluate(async () => {
    Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
    const host = document.createElement('div');
    host.style.height = '560px';
    document.querySelector('main').prepend(host);
    window.diagramEditor = Markian.create(host, { markdown: '```mermaid\nflowchart LR\n A-->B\n```', extensions: { mermaid: { enabled: true, config: { source: '/host-mermaid-api.js' } } } });
    await diagramEditor.ready;
  });
  const diagram = page.locator('.markian-diagram');
  await expect(diagram).toHaveAttribute('data-state', 'error');
  await expect(diagram.locator('.markian-diagram-status')).toContainText('initialize() and render()');
  await expect(page.locator('.markian-mermaid-runtime')).toHaveCount(0);
  expect(await page.evaluate(() => diagramEditor.get())).toContain('flowchart LR');
  valid = true;
  await diagram.hover();
  await diagram.getByRole('button', { name: 'Retry diagram', exact: true }).click();
  await expect(diagram).toHaveAttribute('data-state', 'ready');
  await expect(diagram.locator('.markian-diagram-canvas svg')).toContainText('Ready');
});

test('Mermaid editor and viewer reject obsolete asset configuration without fallback', async ({ page }) => {
  await page.addScriptTag({ url: '/dist/extensions/mermaid.min.js' });
  await page.addScriptTag({ url: '/dist/extensions/viewer-mermaid.min.js' });
  const errors = await page.evaluate(async () => {
    Markian.registerExtension('mermaid', MarkianMermaid.mermaidExtension);
    const errors = [];
    for (const config of [{ asset: { url: '/old.js' } }, { asset: { url: '/old.js' }, source: '/new.js' }]) {
      const host = document.createElement('div');
      document.body.append(host);
      try { await Markian.create(host, { markdown: '', extensions: { mermaid: { enabled: true, config } } }).ready; }
      catch (error) { errors.push(error.message); }
      finally { host.remove(); }
      try { MarkianViewerMermaid.createRenderer(document, config); }
      catch (error) { errors.push(error.message); }
    }
    return errors;
  });
  expect(errors).toHaveLength(4);
  for (const message of errors) expect(message).toContain('Use source: URL string');
});

for (const finalNewline of [false, true]) test(`CRLF visual serialization is stable ${finalNewline ? 'with' : 'without'} a final newline`, async ({ page }) => {
  const markdown = '# Notes\n\nFirst line\nsecond **line**.\n\n<!-- keep -->\n\n- [x] Reviewed\n\n| Item | Status |\n| --- | --- |\n| Guide | Ready |\n\n```text\none  \n  two\n```\n\nTail paragraph' + (finalNewline ? '\n' : '');
  const source = markdown.replace(/\n/g, '\r\n');
  await page.evaluate(async value => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: value });
    await editor.ready;
  }, source);
  const root = page.locator('[data-markian]').first();
  await expect(root).toHaveAttribute('data-view', 'visual');
  await expect(root.locator('[role="alert"]')).toBeHidden();
  await root.locator('.ProseMirror > p').last().click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  const serialized = await page.evaluate(() => editor.get());
  expect(serialized).not.toContain('\r');
  expect(serialized.endsWith('\n')).toBe(finalNewline);
  expect(equivalentMarkdown(serialized, markdown.replace('Tail paragraph', 'Tail paragraph!'))).toBe(true);
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.evaluate(() => { editor.setMode('raw'); editor.setMode('visual'); editor.set(editor.get()); });
    expect(await page.evaluate(() => editor.get())).toBe(serialized);
    await expect(root).toHaveAttribute('data-view', 'visual');
    await expect(root.locator('[role="alert"]')).toBeHidden();
  }
});

for (const ending of ['', '\n']) test(`visual editing and undo preserve ${ending ? 'a final newline' : 'no final newline'}`, async ({ page }) => {
  const original = '# Heading\n\nParagraph' + ending;
  await page.evaluate(value => editor.set(value), original);
  const paragraph = page.locator('[data-markian] .ProseMirror p').first();
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  expect(await page.evaluate(() => editor.get())).toBe('# Heading\n\nParagraph!' + ending);
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toBe(original);
  await page.evaluate(() => editor.execute('redo'));
  expect(await page.evaluate(() => editor.get())).toBe('# Heading\n\nParagraph!' + ending);
  const replacementEnding = ending ? '' : '\n';
  const replacement = '# Replacement\n\nNew paragraph' + replacementEnding;
  await page.evaluate(value => editor.set(value), replacement);
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  expect(await page.evaluate(() => editor.get())).toBe('# Replacement\n\nNew paragraph!' + replacementEnding);
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toBe(replacement);
  await page.evaluate(() => editor.setMode('raw'));
  await page.locator('[data-markian] .cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press(replacementEnding ? 'Backspace' : 'Enter');
  expect(await page.evaluate(() => editor.get())).toBe('# Replacement\n\nNew paragraph' + ending);
  await page.evaluate(() => editor.setMode('visual'));
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  expect(await page.evaluate(() => editor.get())).toBe('# Replacement\n\nNew paragraph!' + ending);
});

for (const ending of ['', '\n']) test(`visual editing and undo preserve ${ending ? 'a newline-only document' : 'an empty document'}`, async ({ page }) => {
  await page.evaluate(value => editor.set(value), ending);
  await page.locator('[data-markian] .ProseMirror').first().click();
  await page.keyboard.type('New document');
  expect(await page.evaluate(() => editor.get())).toBe('New document' + ending);
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toBe(ending);
});

test('visual list normalization uses hyphens without changing ordered lists or code', async ({ page }) => {
  await page.evaluate(() => editor.set('* First\n  * Nested\n* [ ] Task\n\n3. Ordered\n4. Next\n\n```text\n* literal\n```\n'));
  const root = page.locator('[data-markian]').first();
  await expect(root.locator('.ProseMirror')).toBeVisible();
  await root.locator('.ProseMirror p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' edited');
  const markdown = await page.evaluate(() => editor.get());
  expect(markdown).toMatch(/^- First edited$/m);
  expect(markdown).toMatch(/^ +- Nested$/m);
  expect(markdown).toMatch(/^- \[ \] Task$/m);
  expect(markdown).toMatch(/^3\. Ordered$/m);
  expect(markdown).toContain('```text\n* literal\n```');
  expect(equivalentMarkdown(markdown, '* First edited\n  * Nested\n* [ ] Task\n\n3. Ordered\n4. Next\n\n```text\n* literal\n```\n')).toBe(true);
});

for (const command of ['bullet', 'ordered', 'task']) test(`toolbar ${command} list continues on Enter and exits an empty item`, async ({ page }) => {
  await page.evaluate(() => editor.set('First item'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror p').click();
  await (await revealCommand(root, command)).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second item');
  await expect(root.locator('.ProseMirror li')).toHaveCount(2);
  await expect(root.locator('.ProseMirror li').last()).toContainText('Second item');
  if (command === 'task') await expect(root.locator('.ProseMirror li input[type="checkbox"]')).toHaveCount(2);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Outside');
  await expect(root.locator('.ProseMirror li')).toHaveCount(2);
  await expect(root.locator('.ProseMirror > p').last()).toHaveText('Outside');
});

for (const width of [1440, 390]) test(`popup labels, anchoring and outside dismissal work at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const root = page.locator('[data-markian]').first();
  if (await root.locator('.markian-overflow').count()) {
    await root.locator('.markian-overflow > summary').click();
    const overflow = root.locator('.markian-overflow > .markian-menu-items');
    for (const button of await overflow.locator(':scope > button').all()) {
      expect(await button.innerText()).toBe(await button.getAttribute('aria-label'));
    }
    const buttons = await overflow.locator(':scope > button').all();
    if (buttons.length > 1) {
      const bounds = await Promise.all(buttons.slice(0, 2).map(button => button.boundingBox()));
      expect(bounds[1].y).toBeGreaterThanOrEqual(bounds[0].y + bounds[0].height);
    }
    await page.getByRole('button', { name: 'Get Markdown', exact: true }).click();
    await expect(root.locator('.markian-overflow')).not.toHaveAttribute('open');
  }
  if (width === 1440) {
    const heading = root.locator('.markian-toolbar > .markian-menu').filter({ has: page.locator('summary[aria-label="Headings"]') });
    await heading.locator('summary').click();
    const anchor = await heading.locator('summary').boundingBox();
    const menu = await heading.locator('.markian-menu-items').boundingBox();
    expect(Math.abs(menu.x - anchor.x)).toBeLessThan(2);
    expect(Math.abs(menu.y - anchor.y - anchor.height)).toBeLessThan(2);
    await root.locator('.ProseMirror p').first().click();
    await expect(heading).not.toHaveAttribute('open');
  }
  await page.evaluate(() => editor.execute('link'));
  const dialog = root.getByRole('dialog', { name: 'Link', exact: true });
  const destination = await dialog.getByLabel('Link destination').boundingBox();
  const text = await dialog.getByLabel('Link text').boundingBox();
  expect(text.y).toBeGreaterThan(destination.y + destination.height);
  expect(Math.abs(text.x - destination.x)).toBeLessThan(2);
  await dialog.getByLabel('Link text').click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Get Markdown', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Get Markdown', exact: true })).toBeFocused();
  await page.evaluate(() => editor.execute('image'));
  const image = root.getByRole('dialog', { name: 'Image', exact: true });
  await expect(image.getByLabel('Upload new image')).toBeVisible();
  const fields = image.locator('input');
  expect(await fields.evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label')))).toEqual([
    'Image URL', 'Upload new image', 'Tooltip (alternative text)',
  ]);
  const layout = await fields.evaluateAll(inputs => inputs.map(input => ({
    height: input.getBoundingClientRect().height,
    top: input.parentElement.getBoundingClientRect().top,
    bottom: input.parentElement.getBoundingClientRect().bottom,
  })));
  expect(layout.map(field => field.height)).toEqual([34, 34, 34]);
  expect(layout[1].top - layout[0].bottom).toBeCloseTo(layout[2].top - layout[1].bottom, 1);
  await page.getByRole('heading', { name: 'Disabled instance', exact: true }).click();
  await expect(root.getByRole('dialog', { name: 'Image', exact: true })).toHaveCount(0);
  await page.evaluate(() => editor.execute('search'));
  await root.locator('.markian-search').getByLabel('Find', { exact: true }).fill('notes');
  await root.locator('.ProseMirror p').first().click();
  await expect(root.locator('.markian-search')).toHaveCount(0);
  await expect(root.locator('.ProseMirror')).toBeFocused();
});

test('menu Home and End keep keyboard focus inside the active disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const root = page.locator('[data-markian]').first();
  const overflow = root.locator('.markian-overflow');
  const summary = overflow.locator(':scope > summary');
  await summary.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await expect(overflow.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  await root.evaluate(element => { element.style.height = '480px'; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(overflow.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(overflow).not.toHaveAttribute('open');
  await expect(summary).toBeFocused();
  await summary.press('Enter');
  const table = overflow.locator('details').filter({ has: page.locator('summary[aria-label="Table"]') });
  await table.locator('summary').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');
  await expect(table.locator('button:not(:disabled)').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(table).not.toHaveAttribute('open');
  await expect(table.locator('summary')).toBeFocused();
  await expect(overflow).toHaveAttribute('open');
});

test('overflow commands close their disclosures before destination dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const root = page.locator('[data-markian]').first();
  for (const command of ['link', 'image']) {
    await root.locator('.markian-overflow > summary').click();
    await root.locator(`[data-command="${command}"]`).click();
    await expect(root.getByRole('dialog')).toBeVisible();
    await expect(root.locator('details[open]')).toHaveCount(0);
    await root.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await root.locator('.markian-overflow > summary').click();
  const headings = root.locator('summary[aria-label="Headings"]').locator('..');
  await headings.locator('summary').click();
  await headings.getByRole('button', { name: 'Heading 3', exact: true }).click();
  await expect(root.locator('details[open]')).toHaveCount(0);
  await expect(root.locator('.ProseMirror h3')).toBeVisible();
});

test('default toolbar groups formatting, lists and modes and keeps fixed controls outside More', async ({ page }) => {
  const root = page.locator('[data-markian]').first();
  const endCommands = () => root.locator('.markian-toolbar > [data-command]').evaluateAll(buttons => buttons.slice(-3).map(button => button.dataset.command));
  expect(await endCommands()).toEqual(['search', 'fullscreen', 'outline']);
  await expect(root.locator('.markian-toolbar > [data-command="bold"]')).toHaveCount(0);
  for (const name of ['Formatting', 'Lists', 'View mode']) await expect(root.locator(`summary[aria-label="${name}"]`)).toHaveCount(1);
  await (await revealCommand(root, 'source')).click();
  await expect(root).toHaveAttribute('data-view', 'raw');
  await expect(root.locator('summary[aria-label="View mode"]')).toHaveCount(0);
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(root).toHaveAttribute('data-view', 'visual');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(root.locator('.markian-overflow')).toBeVisible();
  for (const id of ['fullscreen', 'search', 'outline']) {
    await expect(root.locator(`.markian-toolbar > [data-command="${id}"]`)).toBeVisible();
    await expect(root.locator(`.markian-overflow [data-command="${id}"]`)).toHaveCount(0);
  }
  expect(await endCommands()).toEqual(['search', 'fullscreen', 'outline']);
});

test('configured toolbar groups derive separators and align arbitrary controls outside overflow', async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Grouped toolbar',
      toolbar: [
        { id: 'right', type: 'group', align: 'opposite', items: ['copy', 'help'] },
        { id: 'history', type: 'group', align: 'default', items: ['undo', 'redo'] },
        { id: 'empty', type: 'group', items: [] },
        { id: 'format', type: 'group', items: ['bold', 'italic', 'strike', 'code', 'indent', 'outdent', 'rule', 'image', 'link', 'clear'] },
        { id: 'menu', type: 'menu', align: 'opposite', label: 'Tools', icon: 'more', items: [
          { id: 'first', type: 'group', items: ['search'] },
          { id: 'second', type: 'group', items: ['fullscreen'] },
        ] },
      ],
    });
    await editor.ready;
  });
  const root = page.locator('[data-markian]').first();
  const toolbar = root.locator('.markian-toolbar');
  await expect(toolbar.locator(':scope > [role="separator"]:not([hidden])')).toHaveCount(3);
  await expect(toolbar.locator(':scope > :first-child')).toHaveAttribute('data-command', 'undo');
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => editor.setTheme(theme), theme);
    if (width === 390) await expect(toolbar.locator('.markian-overflow')).toBeVisible();
    const copy = toolbar.locator(':scope > [data-command="copy"]');
    const help = toolbar.locator(':scope > [data-command="help"]');
    const tools = toolbar.locator(':scope > [data-toolbar-item="menu"]');
    await expect(copy).toBeVisible();
    await expect(help).toBeVisible();
    await expect(tools).toBeVisible();
    await expect(toolbar.locator('.markian-overflow [data-command="copy"], .markian-overflow [data-command="help"]')).toHaveCount(0);
    const bounds = await toolbar.boundingBox();
    const last = await tools.boundingBox();
    expect(bounds.x + bounds.width - last.x - last.width).toBeLessThan(16);
    expect((await help.boundingBox()).x).toBeGreaterThan((await copy.boundingBox()).x);
    await tools.locator('summary').click();
    await expect(tools.locator('[role="separator"]')).toHaveCount(1);
    await tools.locator('[data-command="search"]').focus();
    await page.keyboard.press('End');
    await expect(tools.locator('[data-command="fullscreen"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(tools.locator('summary')).toBeFocused();
    await root.screenshot({ path: testInfo.outputPath(`toolbar-groups-${width}.png`) });
  }
});

test('default-aligned groups let utility commands overflow without an opposite group', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Default alignment',
      toolbar: [
        { id: 'format', type: 'group', items: ['bold', 'italic', 'strike', 'code', 'indent', 'outdent', 'rule', 'image', 'link'] },
        { id: 'utilities', type: 'group', items: ['search', 'fullscreen'] },
      ],
    });
    await editor.ready;
  });
  const toolbar = page.locator('[data-markian]').first().locator('.markian-toolbar');
  await expect(toolbar.locator(':scope > [data-command="search"], :scope > [data-command="fullscreen"]')).toHaveCount(0);
  await expect(toolbar.locator(':scope > .markian-overflow')).toBeVisible();
  await toolbar.locator('.markian-overflow > summary').click();
  for (const command of ['search', 'fullscreen']) await expect(toolbar.locator(`.markian-overflow [data-command="${command}"]`)).toBeVisible();
  await expect(toolbar.locator('.markian-overflow .markian-menu-items > :last-child')).toHaveAttribute('data-command', 'fullscreen');
});

test('toolbar insertion targets named groups with local ordering and removable ownership', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Live toolbar placement',
      toolbar: [
        { id: 'first', type: 'group', items: ['bold', 'italic'] },
        { id: 'last', type: 'group', items: ['strike'] },
        { id: 'right', type: 'group', align: 'opposite', items: ['fullscreen'] },
      ],
    });
    await editor.ready;
    window.toolbarCleanup = [
      editor.getToolbar().insert({ id: 'custom:copy', command: 'copy', label: 'Group copy' }, 'first', 'italic'),
      editor.getToolbar().insert({ id: 'custom:help', command: 'help', label: 'Group help' }, 'first'),
      editor.getToolbar().insert({ id: 'custom:search', command: 'search', label: 'Default search' }),
      editor.getToolbar().insert({ id: 'custom:clear', command: 'clear', label: 'Default before' }, undefined, 'strike'),
    ];
  });
  const root = page.locator('[data-markian]').first();
  const labels = () => root.locator('.markian-toolbar > button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  expect(await labels()).toEqual(['Bold', 'Group copy', 'Italic', 'Group help', 'Default before', 'Strikethrough', 'Default search', 'Maximize']);
  await root.getByRole('button', { name: 'Group help', exact: true }).click();
  await expect(root).toHaveAttribute('data-view', 'help');
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => { window.toolbarCleanup.reverse().forEach(dispose => dispose()); });
  expect(await labels()).toEqual(['Bold', 'Italic', 'Strikethrough', 'Maximize']);
});

test('secondary toolbars share main control order and keep Back separate', async ({ page }) => {
  const root = page.locator('[data-markian]').first();
  const toolbar = root.locator('.markian-toolbar');
  for (const view of ['source', 'help', 'preview', 'code:expand']) {
    if (view === 'code:expand') {
      await root.locator('.ProseMirror pre code').first().click();
      await expect.poll(() => page.evaluate(() => editor.getCodeTarget() !== null)).toBe(true);
    }
    await page.evaluate(view => editor.execute(view), view);
    await expect(toolbar.locator(':scope > :first-child')).toHaveAttribute('aria-label', 'Back');
    await expect(toolbar.locator(':scope > :nth-child(2)')).toHaveAttribute('role', 'separator');
    await expect(root.locator('summary[aria-label="View mode"]')).toHaveCount(0);
    const commands = await toolbar.locator(':scope > [data-command]').evaluateAll(buttons => buttons.map(button => button.dataset.command));
    const ending = view === 'source' ? ['search', 'fullscreen', 'outline'] : ['search', 'fullscreen'];
    expect(commands.slice(-ending.length)).toEqual(ending);
    if (view === 'code:expand') expect(commands.slice(0, 2)).toEqual(['code:undo', 'code:redo']);
    const search = await toolbar.locator('[data-command="search"]').boundingBox();
    const maximize = await toolbar.locator('[data-command="fullscreen"]').boundingBox();
    const outline = view === 'source' ? await toolbar.locator('[data-command="outline"]').boundingBox() : null;
    const bounds = await toolbar.boundingBox();
    expect(maximize.x).toBeGreaterThan(search.x);
    if (view === 'source') expect(outline.x).toBeGreaterThan(maximize.x);
    else await expect(toolbar.locator('[data-command="outline"]')).toHaveCount(0);
    const rightmost = outline ?? maximize;
    expect(bounds.x + bounds.width - rightmost.x - rightmost.width).toBeLessThan(16);
    await root.getByRole('button', { name: 'Back', exact: true }).click();
  }
});

test('selected list items change type together and task controls have readable spacing', async ({ page }, testInfo) => {
  await page.evaluate(() => editor.set('- Review the draft\n- Confirm the next steps\n- Publish the result'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror li p').first().click();
  await expect(root.locator('.ProseMirror li p').first()).toHaveCSS('margin-bottom', '0px');
  await expect(root.locator('.ProseMirror li').first()).toHaveCSS('margin-bottom', '2px');
  await page.keyboard.press('Control+a');
  await (await revealCommand(root, 'task')).click();
  await expect(root.locator('.ProseMirror input[type="checkbox"]')).toHaveCount(3);
  await (await revealCommand(root, 'ordered')).click();
  await expect(root.locator('.ProseMirror ol > li')).toHaveCount(3);
  await expect(root.locator('.ProseMirror input[type="checkbox"]')).toHaveCount(0);
  await (await revealCommand(root, 'bullet')).click();
  await expect(root.locator('.ProseMirror ul > li')).toHaveCount(3);
  await (await revealCommand(root, 'task')).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(width => editor.setTheme(width === 390 ? 'dark' : 'light'), width);
    const item = root.locator('.ProseMirror li[data-item-type="task"]').first();
    const checkbox = await item.locator('input').boundingBox();
    const text = await item.locator('p').boundingBox();
    expect(text.x - checkbox.x - checkbox.width).toBeGreaterThanOrEqual(8);
    expect(Math.abs(checkbox.y + checkbox.height / 2 - text.y - text.height / 2)).toBeLessThan(5);
    await root.screenshot({ path: testInfo.outputPath(`task-list-${width}.png`) });
  }
});

test('recursive configured menus use independent bounded flyouts without expanding the parent scroll area', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Configurable',
      toolbar: [{ id: 'tools', type: 'menu', label: 'Tools', icon: 'more', items: [
        'image', { id: 'nested', type: 'menu', label: 'Nested', icon: 'table', items: ['table:insert', 'link', 'help'] },
      ] }, { id: 'utilities', type: 'group', align: 'opposite', items: ['fullscreen', 'search'] }],
    });
    await editor.ready;
  });
  const root = page.locator('[data-markian]').first();
  await root.locator('summary[aria-label="Tools"]').click();
  const parent = root.locator('[data-toolbar-item="tools"] > .markian-menu-items');
  const before = await parent.evaluate(element => element.scrollHeight);
  const nested = root.locator('[data-toolbar-item="nested"]');
  await nested.locator('summary').focus();
  await page.keyboard.press('ArrowRight');
  const flyout = nested.locator('.markian-menu-items');
  await expect(flyout).toBeVisible();
  expect(await flyout.evaluate(element => element.matches(':popover-open'))).toBe(true);
  expect(await parent.evaluate(element => element.scrollHeight)).toBe(before);
  const outer = await parent.boundingBox();
  const inner = await flyout.boundingBox();
  expect(inner.x >= outer.x + outer.width || inner.x + inner.width <= outer.x).toBe(true);
  expect(inner.x).toBeGreaterThanOrEqual(0);
  expect(inner.x + inner.width).toBeLessThanOrEqual(640);
  await page.keyboard.press('ArrowLeft');
  await expect(nested).not.toHaveAttribute('open');
  await expect(nested.locator('summary')).toBeFocused();
});

for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) test(`text floating toolbar clears selected formatting (${theme}, ${width})`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(theme => editor.setTheme(theme), theme);
  await page.evaluate(() => editor.set('**Formatted** text'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.markian-document strong').evaluate(element => {
    element.closest('[contenteditable]').focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const clear = root.locator('.markian-floating').getByRole('button', { name: 'Clear formatting', exact: true });
  await expect(clear).toBeVisible();
  const bounds = await clear.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  await root.screenshot({ path: `.test-results/floating-clear-${theme}-${width}.png` });
  await clear.click();
  expect(await page.evaluate(() => editor.get())).toBe('Formatted text');
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toBe('**Formatted** text');
});

for (const { name, markdown, destination } of [
  { name: 'selected link', markdown: '[Link text](guide.md#target)', destination: 'guide.md#target' },
  { name: 'formatted link', markdown: '[Linked **text**](guide.md#target)', destination: 'guide.md#target' },
  { name: 'mixed text', markdown: '[Link text](guide.md) after', destination: '' },
  { name: 'different links', markdown: '[First](first.md) [Second](second.md)', destination: '' },
]) test(`floating link properties resolve ${name}`, async ({ page }) => {
  await page.evaluate(markdown => editor.set(markdown), markdown);
  const before = await page.evaluate(() => editor.get());
  const root = page.locator('[data-markian]').first();
  const paragraph = root.locator('.ProseMirror p').first();
  const label = await paragraph.textContent();
  await paragraph.evaluate(element => {
    element.closest('[contenteditable]').focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const link = root.locator('.markian-floating').getByRole('button', { name: 'Edit link', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  const panel = root.getByRole('dialog', { name: 'Link', exact: true });
  await expect(panel.getByRole('textbox', { name: 'Link destination' })).toHaveValue(destination);
  await expect(panel.getByRole('textbox', { name: 'Link text' })).toHaveValue(label);
  if (destination) await panel.getByRole('button', { name: 'Apply link', exact: true }).click();
  else await page.keyboard.press('Escape');
  expect(await page.evaluate(() => editor.get())).toBe(before);
});

test('table actions have distinct icons and code expansion is caret-contextual only', async ({ page }) => {
  const root = page.locator('[data-markian]').first();
  await page.evaluate(async () => { editor.set('Start'); await editor.execute('table:insert'); });
  await root.locator('.ProseMirror td').first().click();
  const paths = await root.locator('.markian-floating svg path').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  expect(paths).toHaveLength(4);
  expect(new Set(paths).size).toBe(4);
  await expect(root.locator('.markian-toolbar [data-command="code:expand"]')).toHaveCount(0);
  await page.evaluate(() => editor.set('```text\nhello\n```\n\nAfter'));
  await root.locator('.ProseMirror pre').click();
  const expand = root.locator('.markian-floating [data-command="code:expand"]');
  await expect(expand).toBeVisible();
  await expand.click();
  await expect(root).toHaveAttribute('data-view', 'code');
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await root.locator('.ProseMirror > p').last().click();
  await expect(expand).toHaveCount(0);
});

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) test(`panels follow their configured buttons and bubble tips (${theme}, ${width})`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async theme => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Panel anchors', theme,
      toolbar: [{ id: 'insert', type: 'group', items: ['image', 'link'] }, { id: 'utilities', type: 'group', align: 'opposite', items: ['fullscreen', 'search'] }],
    });
    await editor.ready;
  }, theme);
  const root = page.locator('[data-markian]').first();
  for (const command of ['image', 'link', 'search']) {
    const button = root.locator(`.markian-toolbar > [data-command="${command}"]`);
    await button.click();
    const popup = root.locator('.markian-popup');
    await expect(popup).toBeVisible();
    const anchor = await button.boundingBox();
    const panel = await popup.boundingBox();
    const tip = await popup.evaluate(element => ({
      left: parseFloat(element.style.getPropertyValue('--markian-tip-left')),
      content: getComputedStyle(element, '::before').content,
      side: element.dataset.side,
    }));
    expect(tip.content).not.toBe('none');
    expect(Math.abs(panel.x + tip.left - anchor.x - anchor.width / 2)).toBeLessThan(2);
    expect(tip.side).toBe(width === 390 ? 'above' : 'below');
    expect(Math.abs(tip.side === 'above' ? anchor.y - panel.y - panel.height - 10 : panel.y - anchor.y - anchor.height - 10)).toBeLessThan(2);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(900);
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
  }
});

test('overflow destination panels point to More after the command menu closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const root = page.locator('[data-markian]').first();
  await (await revealCommand(root, 'image')).click();
  const popup = root.locator('.markian-popup');
  await expect(root.locator('details[open]')).toHaveCount(0);
  const anchor = await root.locator('.markian-overflow > summary').boundingBox();
  const panel = await popup.boundingBox();
  const tip = await popup.evaluate(element => parseFloat(element.style.getPropertyValue('--markian-tip-left')));
  expect(Math.abs(panel.x + tip - anchor.x - anchor.width / 2)).toBeLessThan(2);
});

test('classic-script startup is visual, independent, and free of optional dependencies', async ({ page }) => {
  await expect(page.locator('header .brand-symbol')).toHaveText('m.');
  await expect(page.locator('header .workspace-label')).toHaveText('Editor workspace');
  expect(await page.evaluate(async () => (await document.fonts.load('600 25px "Space Grotesk"')).length)).toBe(1);
  await expect(page.locator('[data-markian]').first()).toHaveAttribute('data-view', 'visual');
  await expect(page.locator('.ProseMirror').first()).toContainText('Field notes');
  await expect(page.getByRole('heading', { name: 'Disabled instance', exact: true })).toBeVisible();
  await expect(page.locator('.demo-secondary [data-command="bold"]')).toBeDisabled();
  await expect(page.locator('.demo-secondary [data-command="help"]')).toBeEnabled();
  const result = await page.evaluate(() => {
    const initial = secondary.get();
    editor.set('# Changed');
    editor.setTheme('dark');
    return { initial, after: secondary.get(), theme: secondary.element.dataset.theme, requests: performance.getEntriesByType('resource').map(entry => entry.name) };
  });
  expect(result.after).toBe(result.initial);
  expect(result.theme).toBe('dark');
  expect(result.requests.some(url => /mermaid|language-pack|googleapis|exface/.test(url))).toBe(false);
});

test('public heading inspection populates link destination headings', async ({ page }) => {
  const markdown = '# Guide\n\n## Shared\n\n## Shared\n\n```markdown\n# Not a heading\n```';
  expect(await page.evaluate(markdown => Markian.headings(markdown), markdown)).toEqual([
    { id: 'guide', label: 'Guide', depth: 1, line: 1 },
    { id: 'shared', label: 'Shared', depth: 2, line: 3 },
    { id: 'shared-1', label: 'Shared', depth: 2, line: 5 },
  ]);
  await page.evaluate(async markdown => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Link text',
      onLinkInspect: () => ({ status: 'exists', headings: Markian.headings(markdown) }),
    });
    await editor.ready;
    await editor.execute('link');
  }, markdown);
  const panel = page.getByRole('dialog', { name: 'Link', exact: true });
  await panel.getByRole('textbox', { name: 'Link destination' }).fill('guide.md');
  await expect(panel.locator('output')).toHaveText('exists');
  await expect(panel.locator('select option')).toHaveText(['None', 'Guide', 'Shared', 'Shared']);
  await panel.getByRole('combobox', { name: 'Target heading' }).selectOption('shared-1');
  await expect(panel.getByRole('combobox', { name: 'Target heading' })).toHaveValue('shared-1');
});

test('link destination status uses document search labels', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Link text',
      onLinkSuggest: () => new Promise(resolve => { window.finishDocumentSearch = resolve; }),
      onLinkInspect: () => ({ status: 'missing' }),
    });
    await editor.ready;
    await editor.execute('link');
  });
  const panel = page.getByRole('dialog', { name: 'Link', exact: true });
  await panel.getByRole('textbox', { name: 'Link destination' }).fill('guide.md');
  await expect(panel.locator('output')).toHaveText('Searching documents...');
  await page.evaluate(() => window.finishDocumentSearch([]));
  await expect(panel.locator('output')).toHaveText('No exact match');
});

test('visual typing, undo, and identical host echoes preserve content', async ({ page }) => {
  await page.evaluate(() => editor.set('Start'));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' finish');
  const value = await page.evaluate(() => editor.get());
  expect(value).toContain('Start finish');
  await page.evaluate(() => editor.set(editor.get()));
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).not.toContain('finish');
});

test('legacy H2 toolbar configuration toggles paragraph headings and supports undo', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Heading text', toolbar: ['heading'] });
    await editor.ready;
  });
  const root = page.locator('[data-markian]').first();
  const heading = root.locator('[data-command="heading"]');
  await root.locator('.ProseMirror p').click();
  await heading.click();
  await expect(root.locator('.ProseMirror h2')).toHaveText('Heading text');
  expect(await page.evaluate(() => editor.get())).toMatch(/^## Heading text/m);
  await heading.click();
  await expect(root.locator('.ProseMirror p')).toHaveText('Heading text');
  await expect(root.locator('.ProseMirror h2')).toHaveCount(0);
  await page.evaluate(() => editor.execute('undo'));
  await expect(root.locator('.ProseMirror h2')).toHaveText('Heading text');
  await page.evaluate(() => editor.execute('redo'));
  await expect(root.locator('.ProseMirror p')).toHaveText('Heading text');
});

test('raw draft is synchronous, returns as one visual edit, retains source history', async ({ page }) => {
  await page.evaluate(() => { editor.set('Before'); editor.setMode('raw'); });
  const source = page.locator('.markian-source .cm-content').first();
  await source.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' after');
  expect(await page.evaluate(() => editor.get())).toContain('Before after');
  await page.evaluate(() => { editor.setMode('visual'); editor.setMode('raw'); });
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toBe('Before');
});

for (const width of [1440, 390]) test(`source navigation uses Back instead of the Markdown toggle at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => editor.set('Before'));
  const root = page.locator('[data-markian]').first();
  const toggle = root.locator('[data-command="raw"]');
  const back = root.getByRole('button', { name: 'Back', exact: true });
  await expect(root.locator('.markian-status')).toHaveText(/^Visual · /);
  await expect(back).toHaveCount(0);
  await (await revealCommand(root, 'source')).click();
  await expect(root).toHaveAttribute('data-view', 'raw');
  await expect(root.locator('.markian-status')).toHaveText(/^Source · /);
  await expect(toggle).toHaveCount(0);
  await expect(back).toBeVisible();
  await root.locator('.markian-source .cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' after');
  const draft = await page.evaluate(() => editor.get());
  await page.evaluate(() => { window.navigationChanges = 0; editor.on('change', () => { window.navigationChanges++; }); });
  await back.click();
  await expect(root).toHaveAttribute('data-view', 'visual');
  await expect(back).toHaveCount(0);
  await expect(await revealCommand(root, 'source')).toBeVisible();
  expect(await page.evaluate(() => editor.get())).toBe(draft);
  expect(await page.evaluate(() => window.navigationChanges)).toBe(0);
  await page.evaluate(() => editor.execute('undo'));
  expect((await page.evaluate(() => editor.get())).trim()).toBe('Before');
});

test('unsupported input retains exact source and failed visual import retains draft', async ({ page }) => {
  const result = await page.evaluate(async () => {
    editor.destroy();
    const markdown = '---\nkey: value\n---\n\n# Notes\n\n<script>unsafe()</script>';
    window.editor = Markian.create(document.querySelector('#editor'), { markdown });
    await editor.ready;
    let error = '';
    try { editor.setMode('visual'); } catch (failure) { error = failure.message; }
    return { markdown, value: editor.get(), mode: editor.activeView, error };
  });
  expect(result.value).toBe(result.markdown);
  expect(result.mode).toBe('raw');
  expect(result.error).toContain('retained');
  expect(result.error).toContain('First round-trip differences:');
  expect(result.error).toMatch(/Lines 1-3: document\.children\[0\]\.type changed from "yaml"/);
  const root = page.locator('[data-markian]').first();
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(root).toHaveAttribute('data-view', 'raw');
  await expect(root.locator('[data-command="raw"]')).toHaveCount(0);
  await expect(root.locator('[role="alert"]')).toContainText('retained');
  await expect(root.locator('[role="alert"]')).toContainText('Lines 1-3:');
  expect(await page.evaluate(() => editor.get())).toBe(result.markdown);
});

test('comment payloads stay invisible and survive actual visual edits', async ({ page }) => {
  const initial = await page.evaluate(() => editor.get());
  expect(await page.locator('.ProseMirror').first().innerText()).not.toContain('BEGIN sample');
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Added');
  const value = await page.evaluate(() => editor.get());
  expect(value).toContain('<!-- BEGIN sample -->');
  expect(value).toContain('<!-- END sample -->');
  expect(initial).toContain('Generated content stays readable.');
  expect(value).toContain('Generated content stays readable.');
});

test('read-only blocks user mutation but permits source, Help, and copying values', async ({ page }) => {
  const before = await page.evaluate(() => editor.get());
  await page.evaluate(() => editor.setReadOnly(true));
  await expect(page.locator('.ProseMirror').first()).toHaveAttribute('contenteditable', 'false');
  expect(await page.evaluate(() => editor.execute('bold'))).toBe(false);
  await page.evaluate(() => editor.setMode('raw'));
  await page.locator('.markian-source .cm-content').first().click();
  await page.keyboard.type('Blocked');
  await page.evaluate(() => editor.execute('help'));
  expect(await page.evaluate(() => editor.get())).toBe(before);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => editor.setReadOnly(false));
  expect(await page.evaluate(() => editor.activeView)).toBe('raw');
});

test('Code draft survives Help, applies once, and undo restores the parent', async ({ page }) => {
  await page.locator('.ProseMirror pre code').first().click();
  await page.evaluate(() => editor.execute('code:expand'));
  await expect(page.locator('[data-markian]').first()).toHaveAttribute('data-view', 'code');
  await expect(page.locator('[data-markian]').first().locator('.markian-status')).toHaveText(/^Code · /);
  await page.locator('.markian-code .cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' revised');
  const draft = await page.evaluate(() => editor.get());
  expect(draft).toContain('hello, world revised');
  expect(draft).toContain('# Field notes');
  await page.evaluate(() => editor.execute('preview'));
  await expect(page.locator('[data-markian]').first().locator('.markian-status')).toHaveText(/^Preview · /);
  expect(await page.evaluate(() => editor.get())).toBe(draft);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => editor.execute('help'));
  await expect(page.locator('[data-markian]').first().locator('.markian-status')).toHaveText(/^Help · /);
  expect(await page.evaluate(() => editor.get())).toBe(draft);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => editor.execute('code:undo'));
  expect(await page.evaluate(() => editor.get())).not.toContain('revised');
  await page.evaluate(() => editor.execute('code:redo'));
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => editor.get())).toBe(draft);
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).not.toContain('revised');
});

test('pending block replacements are explicit and permissions preserve drafts', async ({ page }) => {
  await page.locator('.ProseMirror pre code').first().click();
  await page.evaluate(() => editor.execute('code:expand'));
  const result = await page.evaluate(() => {
    const before = editor.get();
    editor.setDisabled(true);
    let error = '';
    try { editor.set('Replacement'); } catch (failure) { error = failure.message; }
    const retained = editor.get() === before;
    editor.set('Replacement', { pending: 'discard' });
    return { error, retained, value: editor.get() };
  });
  expect(result.error).toContain('pending');
  expect(result.retained).toBe(true);
  expect(result.value).toBe('Replacement');
});

test('block drafts preserve trailing newlines and reject forged targets', async ({ page }) => {
  await page.locator('.ProseMirror pre code').first().click();
  expect(await page.evaluate(() => {
    const target = editor.getCodeTarget();
    try { editor.openView('code', { ...target, from: 0 }); return false; } catch { return true; }
  })).toBe(true);
  await page.evaluate(() => editor.execute('code:expand'));
  await page.locator('.markian-code .cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  const value = await page.evaluate(() => editor.get());
  expect(value).toContain('hello, world\n\n```');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => editor.get())).toBe(value);
});

test('textarea submission, reset and idempotent destruction restore the host', async ({ page }) => {
  await page.goto('/Examples/minimal-editor.html');
  await page.evaluate(() => window.example.ready);
  const initial = await page.evaluate(() => example.get());
  await page.evaluate(() => { example.set('Updated'); example.setMode('raw'); });
  expect(await page.evaluate(() => new FormData(document.querySelector('form')).get('notes'))).toBe('Updated');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await page.evaluate(() => example.get())).toBe(initial);
  await page.evaluate(() => { example.destroy(); example.destroy(); });
  await expect(page.locator('#example')).toBeVisible();
  await expect(page.locator('[data-markian]')).toHaveCount(0);
});

test('extension initialization failure rolls back and permits remount', async ({ page }) => {
  const result = await page.evaluate(async () => {
    Markian.registerExtension('broken', () => ({ init(instance) {
      instance.getToolbar().insert({ id: 'temporary', command: 'help' });
      throw new Error('Expected failure');
    } }));
    editor.destroy();
    const host = document.querySelector('#editor');
    const failed = Markian.create(host, { markdown: '', extensions: { broken: { enabled: true } } });
    let error = '';
    try { await failed.ready; } catch (failure) { error = failure.message; }
    const visible = !host.hidden;
    const remount = Markian.create(host, { markdown: 'Recovered' });
    await remount.ready;
    return { error, visible, value: remount.get() };
  });
  expect(result).toEqual({ error: 'Expected failure', visible: true, value: 'Recovered' });
});

for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
  test(`fullscreen restore icon stays synchronized (${theme}, ${width})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#theme').setChecked(theme === 'dark');
    const root = page.locator('[data-markian]').first();
    const button = root.locator('[data-command="fullscreen"]');
    await expect(button).toHaveAccessibleName('Maximize');
    const originalIcon = await button.locator('path').getAttribute('d');
    await button.click();
    await expect(root).toHaveClass(/markian-fullscreen/);
    await expect(button).toHaveAccessibleName('Restore original size');
    await expect(button).toHaveAttribute('title', 'Restore original size');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const restoreIcon = await button.locator('path').getAttribute('d');
    expect(restoreIcon).not.toBe(originalIcon);
    await page.screenshot({ path: testInfo.outputPath('expanded.png') });
    await (await revealCommand(root, 'help')).click();
    await expect(button.locator('path')).toHaveAttribute('d', restoreIcon);
    await expect(button).toHaveAccessibleName('Restore original size');
    await button.click();
    await expect(root).not.toHaveClass(/markian-fullscreen/);
    await expect(button).toHaveAccessibleName('Maximize');
    await expect(button.locator('path')).toHaveAttribute('d', originalIcon);
    await button.click();
    await button.focus();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAccessibleName('Maximize');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button.locator('path')).toHaveAttribute('d', originalIcon);
    await expect(page.locator('.demo-secondary [data-command="fullscreen"]')).toHaveAccessibleName('Maximize');
  });
}

test('compact light/dark layout has bounded scroll areas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#theme').check();
  await expect(page.locator('header .brand-symbol')).toBeVisible();
  await expect(page.locator('header .workspace-label')).toBeVisible();
  await expect(page.locator('#snapshot')).toBeInViewport();
  expect(await page.locator('.demo-secondary h2').evaluate(element => getComputedStyle(element).color)).toBe('rgb(229, 236, 232)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.test-results/mobile-dark.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#theme').uncheck();
  await page.screenshot({ path: '.test-results/desktop-light.png', fullPage: true });
});

test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

test('visual search crosses inline formatting and replace-all is one undo step', async ({ page }) => {
  const result = await page.evaluate(async () => {
    editor.set('one **two** three\n\none two three\n\n<!-- one two -->');
    let changes = 0;
    const unsubscribe = editor.on('change', () => changes++);
    const matches = editor.search({ query: 'one two', wholeWord: true });
    editor.selectSearch(0);
    editor.replaceSearch('replaced', true);
    const value = editor.get();
    const events = changes;
    await editor.execute('undo');
    unsubscribe();
    return { matches: matches.length, value, events, restored: editor.get() };
  });
  expect(result.matches).toBe(2);
  expect(result.value).toContain('<!-- one two -->');
  expect(result.value.match(/replaced/g)).toHaveLength(2);
  expect(result.events).toBe(1);
  expect(result.restored).toContain('**two**');
});

test('search stays in code draft, never replaces suspended sessions, and respects permissions', async ({ page }) => {
  await page.locator('.ProseMirror pre code').first().click();
  const result = await page.evaluate(async () => {
    await editor.execute('code:expand');
    editor.search({ query: 'hello' });
    editor.selectSearch(0);
    editor.replaceSearch('goodbye');
    const draft = editor.get();
    await editor.execute('help');
    editor.search({ query: 'goodbye' });
    editor.replaceSearch('wrong', true);
    const suspended = editor.get();
    editor.back();
    editor.setReadOnly(true);
    editor.search({ query: 'goodbye' });
    editor.replaceSearch('blocked', true);
    return { draft, suspended, readonly: editor.get() };
  });
  expect(result.draft).toContain('goodbye, world');
  expect(result.suspended).toBe(result.draft);
  expect(result.readonly).toBe(result.draft);
});

test('focus-bound search panel navigates and hides replace when locked', async ({ page }, testInfo) => {
  await page.evaluate(() => editor.set('Alpha alpha alphabet'));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.press('Control+f');
  const panel = page.locator('.markian-search');
  await expect(panel.getByLabel('Find', { exact: true })).toBeFocused();
  for (const name of ['Replace match', 'Replace all']) {
    await expect(panel.getByRole('button', { name, exact: true }).locator('svg')).toHaveAttribute('viewBox', '0 0 16 16');
  }
  const paths = await panel.locator('button[aria-label^="Replace"] svg path').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  expect(new Set(paths).size).toBe(2);
  await panel.screenshot({ path: testInfo.outputPath('replace-codicons.png') });
  await panel.getByLabel('Find', { exact: true }).fill('alpha');
  await panel.getByLabel('Whole word').check();
  await expect(panel.locator('output')).toHaveText('1 / 2');
  await panel.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(panel.locator('output')).toHaveText('2 / 2');
  await page.evaluate(() => editor.setReadOnly(true));
  await expect(panel.getByLabel('Replace', { exact: true })).toBeHidden();
  await panel.getByLabel('Find', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('table row and column commands preserve GFM and undo', async ({ page }) => {
  await page.evaluate(async () => { editor.set('Start'); await editor.execute('table:insert', { rows: 3, columns: 2 }); });
  const table = page.locator('.ProseMirror table').first();
  await expect(table.locator('tr')).toHaveCount(3);
  await expect(table.locator('td').first()).toHaveCSS('padding-top', '4px');
  await expect(table.locator('td').first()).toHaveCSS('padding-left', '8px');
  await expect(table.locator('td p').first()).toHaveCSS('margin-bottom', '0px');
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:row-after'));
  await expect(table.locator('tr')).toHaveCount(4);
  await page.evaluate(() => editor.execute('table:column-after'));
  await expect(table.locator('tr').first().locator('th')).toHaveCount(3);
  const markdown = await page.evaluate(() => { editor.setMode('raw'); return editor.get(); });
  await page.evaluate(() => editor.setMode('visual'));
  expect(equivalentMarkdown(markdown, await page.evaluate(() => editor.get()))).toBe(true);
  await page.evaluate(() => editor.execute('undo'));
  await expect(table.locator('tr').first().locator('th')).toHaveCount(2);
});

test('spreadsheet text fills and grows a table from the selected cell with undo', async ({ page }) => {
  await page.evaluate(() => editor.set('| A | B |\n| --- | --- |\n| old | keep |'));
  const table = page.locator('.ProseMirror table').first();
  const initial = await page.evaluate(() => editor.get());
  await table.locator('td p').first().evaluate(element => {
    element.closest('[contenteditable]').focus();
    window.getSelection().collapse(element, 0);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await table.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/plain', '001\t"two\tparts"\t"say ""hi"""\r\nnext\t\tend\r\n');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(table.locator('tr')).toHaveCount(3);
  await expect(table.locator('tr').first().locator('th')).toHaveCount(3);
  expect(await table.locator('tr').nth(1).locator('td').allTextContents()).toEqual(['001', 'two\tparts', 'say "hi"']);
  expect(await table.locator('tr').nth(2).locator('td').allTextContents()).toEqual(['next', '', 'end']);
  const markdown = await page.evaluate(() => editor.get());
  await page.evaluate(() => editor.setMode('raw'));
  await page.evaluate(() => editor.setMode('visual'));
  expect(equivalentMarkdown(markdown, await page.evaluate(() => editor.get()))).toBe(true);
  await page.evaluate(() => editor.execute('undo'));
  expect(equivalentMarkdown(initial, await page.evaluate(() => editor.get()))).toBe(true);
});

for (const direction of ['forward', 'backward', 'diagonal']) test(`spreadsheet paste replaces a selected body range ${direction} without changing neighboring cells`, async ({ page }) => {
  await page.evaluate(() => {
    const rows = ['| Keep | A | B | C | D |', '| --- | --- | --- | --- | --- |'];
    for (let row = 1; row <= 5; row++) rows.push(`| Keep ${row} | old A${row} | old B${row} | old C${row} | old D${row} |`);
    editor.set('Before\n\n' + rows.join('\n') + '\n\nAfter');
  });
  const table = page.locator('.ProseMirror table').first();
  const initial = await page.evaluate(() => editor.get());
  const first = table.locator('tr').nth(direction === 'backward' ? 4 : 1).locator('td').nth(direction === 'forward' ? 1 : 4);
  const last = table.locator('tr').nth(direction === 'backward' ? 1 : 4).locator('td').nth(direction === 'forward' ? 4 : 1);
  await first.click({ position: { x: 8, y: 8 } });
  await last.click({ modifiers: ['Shift'], position: { x: 8, y: 8 } });
  await expect(table.locator('.selectedCell')).toHaveCount(16);
  for (const prefix of ['New', 'Again']) {
    await table.evaluate(async (element, { prefix, direction }) => {
      const rows = Array.from({ length: 4 }, (_, row) => ['A', 'B', 'C', 'D'].map(column => `${prefix} ${column}${row + 1}`));
      const data = new DataTransfer();
      if (direction !== 'backward') data.setData('text/plain', rows.map(row => row.join('\t')).join('\r\n'));
      if (direction !== 'forward') data.setData('text/html', `<table>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`);
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      await editor.whenIdle();
    }, { prefix, direction });
    await expect(table.locator('tr')).toHaveCount(6);
    await expect(table.locator('.selectedCell')).toHaveCount(16);
    expect(await table.locator('th').allTextContents()).toEqual(['Keep', 'A', 'B', 'C', 'D']);
    for (let row = 1; row <= 4; row++) {
      expect(await table.locator('tr').nth(row).locator('td').allTextContents()).toEqual([`Keep ${row}`, `${prefix} A${row}`, `${prefix} B${row}`, `${prefix} C${row}`, `${prefix} D${row}`]);
    }
    expect(await table.locator('tr').last().locator('td').allTextContents()).toEqual(['Keep 5', 'old A5', 'old B5', 'old C5', 'old D5']);
  }
  await page.evaluate(() => editor.execute('undo'));
  await expect(table.locator('tr').nth(1).locator('td').nth(1)).toHaveText('New A1');
  await page.evaluate(() => editor.execute('undo'));
  expect(equivalentMarkdown(initial, await page.evaluate(() => editor.get()))).toBe(true);
});

test('spreadsheet HTML fills the top-left cell and table copying retains spreadsheet HTML', async ({ page }) => {
  await page.evaluate(() => editor.set('| A | B |\n| --- | --- |\n| C | D |'));
  const table = page.locator('.ProseMirror table').first();
  await table.locator('th').first().click();
  await table.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/plain', 'Name\tCount\r\nApples\t12\r\nPears\t7');
    data.setData('text/html', '<html><body><!--StartFragment--><table><tr><td>Name</td><td>Count</td></tr><tr><td>Apples</td><td>12</td></tr><tr><td>Pears</td><td>7</td></tr></table><!--EndFragment--></body></html>');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(table.locator('tr')).toHaveCount(3);
  expect(await table.locator('tr').first().locator('th').allTextContents()).toEqual(['Name', 'Count']);
  expect(await table.locator('tr').nth(2).locator('td').allTextContents()).toEqual(['Pears', '7']);
  const copied = await table.evaluate(element => {
    const range = document.createRange();
    range.selectNode(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      const data = new DataTransfer();
      element.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
      resolve({ html: data.getData('text/html'), text: data.getData('text/plain') });
    })));
  });
  expect(copied.html).toContain('<table');
  expect(copied.html).toContain('Pears');
  expect(copied.text).toBe('Name\tCount\r\nApples\t12\r\nPears\t7');
  await page.evaluate(() => editor.set('| X | Y |\n| --- | --- |\n| | |'));
  await table.locator('th').first().click();
  await table.evaluate((element, copied) => {
    const data = new DataTransfer();
    data.setData('text/html', copied.html);
    data.setData('text/plain', copied.text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, copied);
  await expect(table.locator('tr')).toHaveCount(3);
  expect(await table.locator('tr').nth(1).locator('td').allTextContents()).toEqual(['Apples', '12']);
});

for (const format of ['text', 'html', 'both']) test(`spreadsheet ${format} values take precedence over the accompanying clipboard image`, async ({ page }) => {
  await page.evaluate(() => editor.set('| A | B | C | D |\n| --- | --- | --- | --- |\n| old | old | old | old |\n| old | old | old | old |\n| old | old | old | old |'));
  const table = page.locator('.ProseMirror table').first();
  await table.locator('th p').first().evaluate(element => {
    element.closest('[contenteditable]').focus();
    window.getSelection().collapse(element, 0);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await table.evaluate(async (element, format) => {
    const rows = Array.from({ length: 4 }, (_, row) => ['A', 'B', 'C', 'D'].map(column => `${column}${row + 1}`));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'Excel.png', { type: 'image/png' }));
    if (format !== 'html') data.setData('text/plain', rows.map(row => row.join('\t')).join('\r\n'));
    if (format !== 'text') data.setData('text/html', `<table>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    await editor.whenIdle();
  }, format);
  await expect(page.locator('.ProseMirror').first().locator('img')).toHaveCount(0);
  await expect(table.locator('tr')).toHaveCount(4);
  expect(await table.locator('th').allTextContents()).toEqual(['A1', 'B1', 'C1', 'D1']);
  expect(await table.locator('td').allTextContents()).toEqual(['A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3', 'A4', 'B4', 'C4', 'D4']);
});

test('image-only clipboard pastes still insert an image', async ({ page }) => {
  await page.evaluate(() => editor.set('Before'));
  const prose = page.locator('.ProseMirror').first();
  await prose.click();
  await prose.evaluate(async element => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'Screenshot.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    await editor.whenIdle();
  });
  const image = prose.locator('img[src^="data:image/png"]');
  await expect(image).toHaveCount(1);
  expect(await image.evaluate(async image => { await image.decode(); return image.naturalWidth; })).toBe(1);
  expect((await page.evaluate(() => editor.get())).match(/!\[/g)).toHaveLength(1);
});

test('spreadsheet single columns and HTML-only cells preserve untouched table values', async ({ page }) => {
  await page.evaluate(() => editor.set('| A | B |\n| --- | --- |\n| C | D |\n| E | F |'));
  const table = page.locator('.ProseMirror table').first();
  await table.locator('td p').first().evaluate(element => {
    element.closest('[contenteditable]').focus();
    window.getSelection().collapse(element, 0);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await table.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/plain', '001\r\n002\r\n');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  expect(await table.locator('td').allTextContents()).toEqual(['001', 'D', '002', 'F']);
  await table.locator('th').first().click();
  await table.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/html', '<table><tr><th>Title</th><th>Value</th></tr><tr><td>*literal* | [text]</td><td>12</td></tr></table>');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  expect(await table.locator('th').allTextContents()).toEqual(['Title', 'Value']);
  expect(await table.locator('td').allTextContents()).toEqual(['*literal* | [text]', '12', '002', 'F']);
  const markdown = await page.evaluate(() => editor.get());
  await page.evaluate(() => editor.setMode('raw'));
  await page.evaluate(() => editor.setMode('visual'));
  expect(equivalentMarkdown(markdown, await page.evaluate(() => editor.get()))).toBe(true);
});

test('spreadsheet quoted line breaks normalize to portable single-row Markdown tables', async ({ page }) => {
  await page.evaluate(() => editor.set(''));
  const prose = page.locator('.ProseMirror').first();
  await prose.click();
  await prose.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/plain', 'Name\t"first line\nsecond line"');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(prose.locator('table tr')).toHaveCount(2);
  await expect(prose.locator('th').nth(1)).toHaveText('first line second line');
  await expect(prose.locator('th br')).toHaveCount(0);
  const markdown = await page.evaluate(() => editor.get());
  await page.evaluate(markdown => { editor.set('Reset'); editor.set(markdown); }, markdown);
  await expect(page.locator('[data-markian]').first()).toHaveAttribute('data-view', 'visual');
  await expect(prose.locator('th').nth(1)).toHaveText('first line second line');
  expect(equivalentMarkdown(markdown, await page.evaluate(() => editor.get()))).toBe(true);
});

test('spreadsheet pasting creates a table outside cells but leaves code and read-only content unchanged', async ({ page }) => {
  const prose = page.locator('.ProseMirror').first();
  const paste = text => prose.evaluate((element, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  await page.evaluate(() => editor.set(''));
  await prose.click();
  await paste('Name\tCount\nApples\t12\n');
  await expect(prose.locator('table tr')).toHaveCount(2);
  await expect(prose.locator('th').first()).toHaveText('Name');
  const initial = await page.evaluate(() => editor.get());
  await page.evaluate(() => editor.setReadOnly(true));
  await paste('Changed\tValue');
  expect(await page.evaluate(() => editor.get())).toBe(initial);
  await page.evaluate(() => { editor.setReadOnly(false); editor.set('```text\ncode\n```'); });
  await prose.locator('pre').click();
  await paste('literal\ttabs');
  await expect(prose.locator('table')).toHaveCount(0);
  expect(await page.evaluate(() => editor.get())).toContain('literal\ttabs');
});

for (const [key, side] of [['Delete', 'before'], ['Backspace', 'after']]) test(`table ${key} from ${side} removes the whole table and is undoable`, async ({ page }) => {
  await page.evaluate(() => editor.set('Before\n\n| A | B |\n| --- | --- |\n| C | D |\n\nAfter'));
  const prose = page.locator('.ProseMirror').first();
  const initial = await page.evaluate(() => editor.get());
  const paragraph = side === 'before' ? prose.locator(':scope > p').first() : prose.locator(':scope > p').last();
  await paragraph.click();
  await page.keyboard.press(side === 'before' ? 'End' : 'Home');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => editor.setReadOnly(true));
  await page.keyboard.press(key);
  expect(await page.evaluate(() => editor.get())).toBe(initial);
  await page.evaluate(() => editor.setReadOnly(false));
  await paragraph.click();
  await page.keyboard.press(side === 'before' ? 'End' : 'Home');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press(key);
  await expect(prose.locator('table')).toHaveCount(0);
  expect(await page.evaluate(() => editor.get())).toBe('Before\n\nAfter');
  await page.evaluate(() => editor.execute('undo'));
  expect(equivalentMarkdown(initial, await page.evaluate(() => editor.get()))).toBe(true);
});

test('heading levels and word-at-caret formatting serialize ordinary Markdown', async ({ page }) => {
  await page.evaluate(() => editor.set('alpha beta'));
  await page.locator('.ProseMirror p').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => editor.execute('bold'));
  expect(await page.evaluate(() => editor.get())).toContain('**alpha** beta');
  await page.evaluate(() => editor.execute('heading:6'));
  await expect(page.locator('.ProseMirror h6').first()).toHaveText('alpha beta');
  await page.keyboard.type('X');
  expect(await page.evaluate(() => editor.get())).toContain('aXlpha');
});

test('grouped menu pointer commands preserve the word-at-caret selection', async ({ page }) => {
  await page.evaluate(() => editor.set('alpha beta'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror p').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await (await revealCommand(root, 'bold')).click();
  expect(await page.evaluate(() => editor.get())).toContain('**alpha** beta');
  await (await revealCommand(root, 'heading:6')).click();
  await expect(root.locator('.ProseMirror h6')).toHaveText('alpha beta');
  await page.keyboard.type('X');
  expect(await page.evaluate(() => editor.get())).toContain('aXlpha');
});

test('quote toggles and variants preserve toolbar text selections without nesting', async ({ page }) => {
  await page.evaluate(() => editor.set('alpha beta gamma'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror p').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Shift+ArrowRight');
  const selected = await page.evaluate(() => window.getSelection().toString());
  expect(selected.trim()).toBe('alpha');
  await revealCommand(root, 'quote');
  expect(await page.evaluate(() => window.getSelection().toString())).toBe(selected);
  await root.locator('[data-command="quote"]').click();
  await expect(root.locator('.ProseMirror blockquote')).toHaveCount(1);
  const quote = await revealCommand(root, 'quote');
  await expect(quote).toHaveAttribute('aria-pressed', 'true');
  await quote.click();
  await expect(root.locator('.ProseMirror blockquote')).toHaveCount(0);
  expect((await page.evaluate(() => editor.get())).trim()).toBe('alpha beta gamma');
  await (await revealCommand(root, 'quote:note')).click();
  await expect(root.locator('.ProseMirror blockquote')).toHaveCount(1);
  await (await revealCommand(root, 'quote:tip')).click();
  await expect(root.locator('.ProseMirror blockquote')).toHaveCount(1);
  expect(await page.evaluate(() => editor.get())).toContain('[!TIP]');
  expect(await page.evaluate(() => editor.get())).not.toContain('[!NOTE]');
  const icons = await root.locator('[data-command^="quote:"] svg path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  expect(new Set(icons).size).toBe(5);
  await expect(root.locator('[data-command="quote:remove"]')).toHaveCount(0);
  await revealCommand(root, 'visual');
  await expect(root.locator('[data-command="visual"] svg path')).toHaveAttribute('d', /^M10 20H6V4H13V9H18V12/);
});

test('loaded alert quotes render their type and select only the matching menu choice', async ({ page }, testInfo) => {
  const root = page.locator('[data-markian]').first();
  for (const kind of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
    await page.evaluate(kind => editor.set(`> [!${kind}]\n> Read **carefully**`), kind);
    const alert = root.locator('.ProseMirror blockquote');
    await expect(alert).toHaveAttribute('data-alert-kind', kind.toLowerCase());
    expect(await alert.innerText()).not.toContain(`[!${kind}]`);
    await alert.locator('strong').click();
    const active = await revealCommand(root, `quote:${kind.toLowerCase()}`);
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await expect(root.locator('[data-command="quote"]')).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => editor.execute('preview'));
    const preview = root.locator('blockquote:visible');
    await expect(preview).toHaveAttribute('data-alert-kind', kind.toLowerCase());
    await expect(preview).toContainText('Read carefully');
    expect(await preview.innerText()).not.toContain(`[!${kind}]`);
    await root.getByRole('button', { name: 'Back', exact: true }).click();
    await page.evaluate(() => editor.setMode('raw'));
    expect(await page.evaluate(() => editor.get())).toContain(`[!${kind}]`);
    await root.getByRole('button', { name: 'Back', exact: true }).click();
  }
  await root.screenshot({ path: testInfo.outputPath('alert-quote.png') });
});

test('toolbar alert quotes enforce a line break and survive a source round trip', async ({ page }) => {
  await page.evaluate(() => editor.set('Read **carefully**'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror p').click();
  await (await revealCommand(root, 'quote:note')).click();
  const alert = root.locator('.ProseMirror blockquote');
  await expect(alert).toHaveAttribute('data-alert-kind', 'note');
  const markdown = await page.evaluate(() => editor.get());
  expect(markdown).toMatch(/\[!NOTE\](?:\\| {2})?\n> Read \*\*carefully\*\*/);
  await page.evaluate(() => { editor.setMode('raw'); editor.setMode('visual'); });
  await expect(alert).toHaveAttribute('data-alert-kind', 'note');
  expect(await alert.innerText()).not.toContain('[!NOTE]');
  await alert.locator('strong').click();
  const note = await revealCommand(root, 'quote:note');
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('[data-command="quote"]')).toHaveAttribute('aria-pressed', 'false');
  await (await revealCommand(root, 'quote:tip')).click();
  await expect(alert).toHaveAttribute('data-alert-kind', 'tip');
  await (await revealCommand(root, 'quote:tip')).click();
  await expect(alert).toHaveCount(0);
  expect((await page.evaluate(() => editor.get())).trim()).toBe('Read **carefully**');
});

test('all quote choices toggle off and switch types in visual and source views', async ({ page }) => {
  await page.evaluate(() => editor.set('Readable **content**'));
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror p').click();
  const choices = ['quote', 'quote:note', 'quote:tip', 'quote:important', 'quote:warning', 'quote:caution'];
  for (const id of choices) {
    await (await revealCommand(root, id)).click();
    await expect(root.locator('.ProseMirror blockquote')).toHaveCount(1);
    const active = await revealCommand(root, id);
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await active.click();
    await expect(root.locator('.ProseMirror blockquote')).toHaveCount(0);
    expect((await page.evaluate(() => editor.get())).trim()).toBe('Readable **content**');
  }
  await page.evaluate(async () => { await editor.execute('quote:warning'); await editor.execute('quote'); });
  await expect(root.locator('.ProseMirror blockquote')).toHaveCount(1);
  expect(await page.evaluate(() => editor.get())).not.toContain('[!WARNING]');
  await page.evaluate(() => editor.execute('quote'));
  await page.evaluate(() => editor.setMode('raw'));
  await root.locator('.cm-content').click();
  await page.keyboard.press('Control+Home');
  for (const id of choices) {
    await page.evaluate(id => editor.execute(id), id);
    const active = await revealCommand(root, id);
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await active.click();
    expect((await page.evaluate(() => editor.get())).trim()).toBe('Readable **content**');
  }
  await page.evaluate(async () => { await editor.execute('quote:note'); await editor.execute('quote:tip'); });
  expect((await page.evaluate(() => editor.get())).trim()).toBe('> [!TIP]\n> Readable **content**');
  await page.evaluate(() => editor.execute('quote:tip'));
  expect((await page.evaluate(() => editor.get())).trim()).toBe('Readable **content**');
});

test('custom fullscreen is paired and late cancelled entry restores once', async ({ page }) => {
  const result = await page.evaluate(async () => {
    editor.destroy();
    let restores = 0;
    let finish;
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Full', onFullscreenEnter: () => new Promise(resolve => { finish = resolve; }) });
    await editor.ready;
    const pending = editor.execute('fullscreen');
    await editor.execute('fullscreen');
    finish(() => restores++);
    await pending;
    const cancelled = editor.element.dataset.fullscreen;
    const next = editor.execute('fullscreen');
    finish(() => restores++);
    await next;
    const entered = editor.element.dataset.fullscreen;
    const builtIn = editor.element.classList.contains('markian-fullscreen');
    editor.destroy();
    editor.destroy();
    return { restores, cancelled, entered, builtIn };
  });
  expect(result).toEqual({ restores: 2, cancelled: 'false', entered: 'true', builtIn: false });
});

test('local link providers insert relative destinations and separate target headings', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), {
      markdown: 'Read this', documentBase: 'https://example.test/docs/',
      onLinkSuggest: ({ query }) => [{ label: 'Guide', destination: 'guide.md' }].filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
      onLinkInspect: () => ({ status: 'exists', headings: [{ id: 'details', label: 'Details' }] }),
    });
    await editor.ready;
    await editor.execute('link');
  });
  const panel = page.getByRole('dialog', { name: 'Link', exact: true });
  await panel.getByLabel('Link destination').fill('gui');
  await panel.getByRole('button', { name: 'Guide', exact: true }).click();
  await expect(panel.getByLabel('Target heading')).toContainText('Details');
  await panel.getByLabel('Target heading').selectOption('details');
  await panel.getByLabel('Link text').fill('Guide');
  await panel.getByRole('button', { name: 'Apply link', exact: true }).click();
  expect(await page.evaluate(() => editor.get())).toContain('[Guide](guide.md#details)');
});

test('image callbacks block saving until completion and reject stale results', async ({ page }) => {
  const result = await page.evaluate(async () => {
    editor.destroy();
    let finish;
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Image', onImageInsert: () => new Promise(resolve => { finish = resolve; }) });
    await editor.ready;
    const operation = editor.insertImage(new Blob(['raster'], { type: 'image/png' }));
    let idle = false;
    const saving = editor.whenIdle().then(() => { idle = true; });
    const blocked = !idle;
    finish({ destination: 'images/photo.png', alt: 'Photo' });
    await operation;
    await saving;
    const saved = editor.get();
    const stale = editor.insertImage(new Blob(['raster'], { type: 'image/png' })).catch(error => error.message);
    editor.set('New document');
    finish({ destination: 'images/stale.png' });
    return { blocked, saved, error: await stale, current: editor.get() };
  });
  expect(result.blocked).toBe(true);
  expect(result.saved).toContain('![Photo](images/photo.png)');
  expect(result.saved).not.toContain('data:');
  expect(result.error).toContain('stale');
  expect(result.current).toBe('New document');
});

for (const width of [1440, 390]) test(`outline sidebar defaults visible and its toggle tracks visibility at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const root = page.locator('[data-markian]').first();
  const outline = root.getByRole('navigation', { name: 'Document outline' });
  const toggle = root.getByRole('button', { name: 'Document outline', exact: true });
  const before = await page.evaluate(() => editor.get());
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('heading', { name: 'Outline', exact: true })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const document = await root.locator('.markian-visual').boundingBox();
  const sidebar = await outline.boundingBox();
  expect(document.x + document.width).toBeLessThanOrEqual(sidebar.x + 1);
  await outline.getByRole('button').first().click();
  await expect(outline).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(outline).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(outline).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => editor.get())).toBe(before);
});

test('visual outline scrolls live headings after DOM replacement inside positioned content', async ({ page }) => {
  const markdown = '# Title\n\n## First\n\n' + Array(80).fill('Paragraph').join('\n\n') + '\n\n## Target\n\n' + Array(30).fill('Following paragraph').join('\n\n');
  await page.evaluate(value => editor.set(value), markdown);
  const root = page.locator('[data-markian]').first();
  await root.locator('.ProseMirror').evaluate(element => {
    element.style.position = 'relative';
    const heading = [...element.querySelectorAll('h2')].find(node => node.textContent === 'Target');
    heading.replaceWith(heading.cloneNode(true));
  });
  await root.getByRole('navigation', { name: 'Document outline' }).getByRole('button', { name: 'Target', exact: true }).click();
  await expect.poll(() => root.locator('.markian-visual').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const distance = await root.locator('.markian-visual').evaluate(element => {
    const heading = [...element.querySelectorAll('h2')].find(node => node.textContent === 'Target');
    return heading.getBoundingClientRect().top - element.getBoundingClientRect().top;
  });
  expect(Math.abs(distance)).toBeLessThan(2);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => editor.get())).toBe(markdown);
});

test('outline sidebar honors hidden startup and validates its configuration', async ({ page }) => {
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.height = '400px';
    document.querySelector('main').prepend(host);
    window.outlineEditor = Markian.create(host, { markdown: '# Title\n\n## Section', sidebarVisible: false });
    outlineEditor.element.classList.add('outline-configured');
    await outlineEditor.ready;
  });
  const root = page.locator('.outline-configured');
  const outline = root.getByRole('navigation', { name: 'Document outline' });
  const toggle = root.getByRole('button', { name: 'Document outline', exact: true });
  await expect(outline).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(outline).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => {
    const host = document.createElement('div');
    outlineEditor.destroy();
    try { Markian.create(host, { markdown: '', sidebarVisible: 'yes' }); }
    catch (error) { return error.message; }
  })).toContain('sidebarVisible must be a boolean');
});

test('raw outline uses parsed Setext/ATX headings and its own scroller', async ({ page }) => {
  await page.evaluate(() => { editor.set('# Title\n\n' + Array(100).fill('paragraph\n').join('\n') + '\nSection\n-------\n\n## Last'); editor.setMode('raw'); });
  const root = page.locator('[data-markian]').first();
  const outline = root.getByRole('navigation', { name: 'Document outline' });
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('button')).toHaveCount(2);
  await outline.getByRole('button', { name: 'Last', exact: true }).click();
  await expect(outline).toBeVisible();
  await expect(root.getByRole('button', { name: 'Document outline', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await root.locator('.markian-source .cm-scroller').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('Preview search highlights its presentation without replacing document content', async ({ page }) => {
  await page.evaluate(async () => { editor.set('hello **world** and hello world'); await editor.execute('preview'); });
  const result = await page.evaluate(() => {
    const before = editor.get();
    const count = editor.search({ query: 'hello world' }).length;
    editor.selectSearch(1);
    editor.replaceSearch('wrong', true);
    return { before, after: editor.get(), count };
  });
  expect(result.count).toBe(2);
  expect(result.after).toBe(result.before);
  await expect(page.locator('.markian-view mark')).toHaveCount(3);
  await page.evaluate(() => editor.back());
  expect(await page.evaluate(() => editor.get())).toBe(result.before);
});

test('dirty raw replacement requires a policy and rejection retains history', async ({ page }) => {
  await page.evaluate(() => { editor.set('Original'); editor.setMode('raw'); });
  await page.locator('.markian-source .cm-content').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' draft');
  const result = await page.evaluate(() => {
    const before = editor.get();
    let error = '';
    try { editor.set('Replacement'); } catch (failure) { error = failure.message; }
    const retained = editor.get();
    editor.set('Replacement', { pending: 'discard' });
    return { before, retained, error, after: editor.get() };
  });
  expect(result.error).toContain('pending');
  expect(result.retained).toBe(result.before);
  expect(result.after).toBe('Replacement');
});

test('table header operations and deleting final cells remain valid and undoable', async ({ page }) => {
  await page.evaluate(() => editor.set('| Head |\n| --- |\n| Body |'));
  const table = page.locator('.ProseMirror table').first();
  await table.locator('th').first().click();
  await page.evaluate(() => editor.execute('table:row-before'));
  await page.evaluate(() => { editor.setMode('raw'); editor.setMode('visual'); });
  await expect(table.locator('tr')).toHaveCount(3);
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:delete-row'));
  await expect(table.locator('tr')).toHaveCount(2);
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:delete-row'));
  await expect(table).toHaveCount(0);
  await page.evaluate(() => editor.execute('undo'));
  await expect(table.locator('tr')).toHaveCount(2);
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:delete-column'));
  await expect(table).toHaveCount(0);
  await page.evaluate(() => editor.execute('undo'));
  await expect(table.locator('th')).toHaveCount(1);
});

test('opt-in text colors preserve nested Markdown and portable instances have no swatches', async ({ page }) => {
  await expect(page.locator('.demo-secondary [aria-label="Text color"]')).toHaveCount(0);
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'A **bold** word', allowTextColors: true });
    await editor.ready;
  });
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Control+Shift+End');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => editor.execute('color:#a82736'));
  const markdown = await page.evaluate(() => editor.get());
  expect(markdown).toContain('color:#a82736');
  expect(markdown).toContain('**bold**');
  await page.evaluate(() => { editor.setMode('raw'); editor.setMode('visual'); });
  await expect(page.locator('.ProseMirror span[style]').first()).toHaveCSS('color', 'rgb(168, 39, 54)');
  await page.evaluate(() => editor.execute('preview'));
  await expect(page.locator('.markian-view span[style]').first()).toHaveCSS('color', 'rgb(168, 39, 54)');
  expect(equivalentMarkdown(markdown, await page.evaluate(() => editor.get()))).toBe(true);
});

test('typed backticks create inline code and leave following text unformatted', async ({ page }) => {
  await page.evaluate(() => editor.set(''));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.type('`code` normal');
  await expect(page.locator('.ProseMirror p code').first()).toHaveText('code');
  expect((await page.evaluate(() => editor.get())).trim()).toBe('`code` normal');
});

for (const exit of ['ArrowRight', 'backtick']) test(`paired backticks create inline code with ${exit} exit and undo`, async ({ page }) => {
  await page.evaluate(() => editor.set(''));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.type('``');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('code');
  await expect(page.locator('.ProseMirror p code').first()).toHaveText('code');
  if (exit === 'backtick') await page.keyboard.type('`');
  else await page.keyboard.press(exit);
  await page.keyboard.type(' normal');
  const value = await page.evaluate(() => editor.get());
  expect(value.trim()).toBe('`code` normal');
  expect(value).not.toMatch(/[\u200b\u2060\ufeff]/u);
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).not.toBe(value);
  await page.evaluate(() => editor.execute('redo'));
  expect(await page.evaluate(() => editor.get())).toBe(value);
});

for (const fence of ['```', '````', '```javascript', '````c++', '~~~', '~~~~c++']) {
  for (const submit of ['Enter', 'Space']) test(`typed fence ${fence} converts on ${submit}`, async ({ page }) => {
    await page.evaluate(() => editor.set(''));
    await page.locator('.ProseMirror').first().click();
    await page.keyboard.type(fence);
    await expect(page.locator('.ProseMirror pre').first()).toHaveCount(0);
    await page.keyboard.press(submit);
    const code = page.locator('.ProseMirror pre code').first();
    await expect(code).toHaveCount(1);
    await page.keyboard.type('literal `code` *text*');
    await expect(code).toHaveText('literal `code` *text*');
    await expect(code).toHaveClass(`language-${fence.replace(/^[`~]+/, '')}`);
    await expect(code.locator('code')).toHaveCount(0);
    expect(await page.evaluate(() => editor.get())).toContain('literal `code` *text*');
  });
}

for (const marker of ['```', '~~~']) test(`typing ${marker} creates a code fence without source damage`, async ({ page }) => {
  await page.evaluate(() => editor.set(''));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.type(marker + 'text ');
  await page.keyboard.type('literal *code*');
  await expect(page.locator('.ProseMirror pre code').first()).toContainText('literal *code*');
  expect(await page.evaluate(() => editor.get())).toContain('literal *code*');
});

test('host-created block views retain draft history through Help and get shared controls', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let handle;
    editor.getViews().insert({ id: 'host-code', mount({ element, session }) {
      handle = editor.createSourceEditor(element, session.get(), value => session.set(value));
      return () => handle.destroy();
    } });
    const root = editor.element.querySelector('.ProseMirror pre code');
    root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return { registered: true };
  });
  expect(result.registered).toBe(true);
  await page.locator('.ProseMirror pre code').first().click();
  await page.evaluate(() => { editor.openView('host-code', editor.getCodeTarget()); editor.getActiveSession().set('new draft'); });
  await expect(page.locator('[data-markian]').first().locator('[data-command="search"]')).toBeEnabled();
  await page.evaluate(() => editor.execute('help'));
  expect(await page.evaluate(() => {
    try { editor.getActiveSession().set('wrong'); return false; } catch { return true; }
  })).toBe(true);
  expect(await page.evaluate(() => editor.get())).toContain('new draft');
  await page.evaluate(() => { editor.back(); editor.back(); });
  expect(await page.evaluate(() => editor.get())).toContain('new draft');
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toContain('hello, world');
});

test('cancelled image insertion settles even when the host ignores its signal', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Before', onImageInsert: () => new Promise(() => {}) });
    await editor.ready;
    window.imageOperation = editor.insertImage(new Blob(['raster'], { type: 'image/png' })).catch(error => error.message);
  });
  await page.getByRole('button', { name: 'Cancel image insertion', exact: true }).click();
  expect(await page.evaluate(() => window.imageOperation)).toContain('cancelled');
  await expect(page.getByRole('button', { name: 'Retry image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove pending image', exact: true }).click();
  await page.evaluate(() => editor.whenIdle());
  expect(await page.evaluate(() => editor.get())).toBe('Before');
});

test('right arrow leaves inline code without invisible content', async ({ page }) => {
  await page.evaluate(() => editor.set('`code`'));
  await page.locator('.ProseMirror code').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' outside');
  const value = await page.evaluate(() => editor.get());
  expect(value.trim()).toBe('`code` outside');
  expect(value).not.toMatch(/[\u200b\u2060\ufeff]/u);
});

test('double-tilde strikethrough typing remains available beside fence input', async ({ page }) => {
  await page.evaluate(() => editor.set(''));
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.type('~~removed~~');
  await expect(page.locator('.ProseMirror del').first()).toHaveText('removed');
});

test('task checkboxes toggle as one edit and permissions block pointer mutation', async ({ page }) => {
  await page.evaluate(() => editor.set('- [ ] Pending'));
  const task = page.locator('.ProseMirror input[type="checkbox"]').first();
  await expect(task).not.toBeChecked();
  await task.click();
  expect(await page.evaluate(() => editor.get())).toContain('[x] Pending');
  await page.evaluate(() => editor.execute('undo'));
  expect(await page.evaluate(() => editor.get())).toContain('[ ] Pending');
  await page.evaluate(() => editor.setReadOnly(true));
  await expect(task).toBeDisabled();
  await page.evaluate(() => editor.setReadOnly(false));
  await expect(task).toBeEnabled();
});

test('alignment from a body cell updates its GFM column and survives both modes', async ({ page }) => {
  await page.evaluate(() => editor.set('| A | B |\n| --- | --- |\n| C | D |'));
  const table = page.locator('.ProseMirror table').first();
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:right'));
  const markdown = await page.evaluate(() => editor.get());
  expect(markdown).toMatch(/-+:/);
  await page.evaluate(() => { editor.setMode('raw'); editor.setMode('visual'); });
  await expect(table.locator('th').first()).toHaveCSS('text-align', 'right');
  await expect(table.locator('td').first()).toHaveCSS('text-align', 'right');
  await table.locator('td').first().click();
  await page.evaluate(() => editor.execute('table:header'));
  await expect(table.locator('th').first()).toHaveText('C');
  await page.evaluate(() => editor.execute('undo'));
  await expect(table.locator('th').first()).toHaveText('A');
});

test('late link suggestions cannot replace a newer query or survive permission changes', async ({ page }) => {
  await page.evaluate(async () => {
    editor.destroy();
    window.resolveSuggestions = {};
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Links', onLinkSuggest: ({ query }) => new Promise(resolve => { window.resolveSuggestions[query] = resolve; }) });
    await editor.ready;
    await editor.execute('link');
  });
  const destination = page.getByLabel('Link destination', { exact: true });
  await destination.fill('old');
  await expect.poll(() => page.evaluate(() => Boolean(window.resolveSuggestions.old))).toBe(true);
  await destination.fill('new');
  await expect.poll(() => page.evaluate(() => Boolean(window.resolveSuggestions.new))).toBe(true);
  await page.evaluate(() => { window.resolveSuggestions.new([{ label: 'New result', destination: 'new.md' }]); window.resolveSuggestions.old([{ label: 'Obsolete result', destination: 'old.md' }]); });
  await expect(page.getByRole('button', { name: 'New result', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Obsolete result', exact: true })).toHaveCount(0);
  await page.evaluate(() => editor.setReadOnly(true));
  await expect(page.getByRole('dialog', { name: 'Link', exact: true })).toHaveCount(0);
});

test('pending image results are cancelled on permission changes and cannot mutate afterward', async ({ page }) => {
  const result = await page.evaluate(async () => {
    editor.destroy();
    let finish;
    let signal;
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: 'Before', onImageInsert: context => { signal = context.signal; return new Promise(resolve => { finish = resolve; }); } });
    await editor.ready;
    const operation = editor.insertImage(new Blob(['raster'], { type: 'image/png' })).catch(error => error.message);
    editor.setDisabled(true);
    finish({ destination: 'images/late.png' });
    return { error: await operation, aborted: signal.aborted, value: editor.get() };
  });
  expect(result.aborted).toBe(true);
  expect(result.error).toContain('stale');
  expect(result.value).toBe('Before');
});

test('native forms cannot submit a pending image and recover after explicit removal', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const form = document.createElement('form');
    const textarea = document.createElement('textarea');
    form.append(textarea);
    document.body.append(form);
    const instance = Markian.create(textarea, { markdown: 'Before', onImageInsert: () => new Promise(() => {}) });
    await instance.ready;
    const insertion = instance.insertImage(new Blob(['image'], { type: 'image/png' })).catch(() => undefined);
    const pending = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(pending);
    instance.element.querySelector('[aria-label="Cancel image insertion"]').click();
    await insertion;
    instance.element.querySelector('[aria-label="Remove pending image"]').click();
    const removed = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(removed);
    await instance.whenIdle();
    const value = textarea.value;
    instance.destroy();
    form.remove();
    return { pending: pending.defaultPrevented, removed: removed.defaultPrevented, value };
  });
  expect(result).toEqual({ pending: true, removed: false, value: 'Before' });
});

for (const theme of ['light', 'dark']) for (const width of [1440, 390]) test(`search and destination controls fit (${theme}, ${width})`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async theme => { editor.setTheme(theme); await editor.execute('search'); }, theme);
  const root = page.locator('[data-markian]').first();
  const panel = root.locator('.markian-search');
  await panel.getByLabel('Find', { exact: true }).fill('notes');
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('search.png') });
  await panel.getByRole('button', { name: 'Close search', exact: true }).click();
  await page.evaluate(() => editor.execute('link'));
  const link = root.getByRole('dialog', { name: 'Link', exact: true });
  await expect(link.getByLabel('Link destination')).toBeFocused();
  expect(await link.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('link.png') });
});

test('touch table controls insert rows without a context-menu gesture', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(async () => { await editor.ready; editor.set('| A | B |\n| --- | --- |\n| C | D |'); });
  const root = page.locator('[data-markian]').first();
  await root.locator('td').first().tap();
  await root.locator('.markian-floating').getByRole('button', { name: 'Insert row below', exact: true }).tap();
  await expect(root.locator('table tr')).toHaveCount(3);
  await context.close();
});

test('construction-time schema mappings round trip and reject late registration', async ({ page }) => {
  const result = await page.evaluate(async () => {
    Markian.registerExtension('schema-fixture', () => ({ init(instance) {
      return instance.getSchema().insert({
        id: 'fixture_rule',
        schema: { group: 'block', atom: true, toDOM: () => ['hr', { 'data-fixture': 'mapped' }] },
        fromMarkdown: node => node.type === 'thematicBreak' ? {} : null,
        toMarkdown: () => ({ type: 'thematicBreak' }),
      });
    } }));
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown: '***\n\nText', extensions: { 'schema-fixture': { enabled: true } } });
    await editor.ready;
    let error = '';
    try { editor.getSchema().insert({ id: 'late' }); } catch (failure) { error = failure.message; }
    return { mapped: !!editor.element.querySelector('[data-fixture="mapped"]'), value: editor.get(), error, mode: editor.activeView };
  });
  expect(result.mapped).toBe(true);
  expect(result.mode).toBe('visual');
  expect(result.value).toContain('***');
  expect(result.error).toContain('closed');
});

test('destruction during asynchronous initialization disposes late contributions', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let release;
    let cleaned = 0;
    Markian.registerExtension('delayed', () => ({ async init() {
      await new Promise(resolve => { release = resolve; });
      return () => { cleaned++; };
    } }));
    editor.destroy();
    const host = document.querySelector('#editor');
    const pending = Markian.create(host, { markdown: 'Retained', extensions: { delayed: { enabled: true } } });
    pending.destroy();
    release();
    let rejected = false;
    try { await pending.ready; } catch { rejected = true; }
    return { cleaned, rejected, restored: !host.hidden };
  });
  expect(result).toEqual({ cleaned: 1, rejected: true, restored: true });
});

for (const fixture of corpus) test(`preservation corpus: ${fixture.name}`, async ({ page }) => {
  const initial = await page.evaluate(async markdown => {
    editor.destroy();
    window.editor = Markian.create(document.querySelector('#editor'), { markdown });
    await editor.ready;
    return { value: editor.get(), mode: editor.activeView };
  }, fixture.markdown);
  expect(initial.value).toBe(fixture.markdown);
  if (initial.mode === 'visual') {
    await page.locator('.ProseMirror').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('x');
    await page.evaluate(() => editor.execute('undo'));
    expect(equivalentMarkdown(fixture.markdown, await page.evaluate(() => editor.get()))).toBe(true);
  } else {
    await page.evaluate(() => editor.execute('preview'));
    expect(await page.evaluate(() => editor.get())).toBe(fixture.markdown);
    expect(await page.evaluate(() => window.compromised)).toBeUndefined();
  }
});