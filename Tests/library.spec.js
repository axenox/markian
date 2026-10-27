import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  await page.evaluate(async () => { await Promise.all([window.editor.ready, window.secondary.ready]); });
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
  await expect(root.getByRole('dialog', { name: 'Image', exact: true }).getByLabel('Image file')).toBeVisible();
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
  await expect(root.locator('.markian-toolbar > [data-command="bold"]')).toHaveCount(0);
  for (const name of ['Formatting', 'Lists', 'View mode']) await expect(root.locator(`summary[aria-label="${name}"]`)).toHaveCount(1);
  await (await revealCommand(root, 'source')).click();
  await expect(root).toHaveAttribute('data-view', 'raw');
  await expect(root.locator('summary[aria-label="View mode"]')).toHaveCount(0);
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(root).toHaveAttribute('data-view', 'visual');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(root.locator('.markian-overflow')).toBeVisible();
  for (const id of ['fullscreen', 'search']) {
    await expect(root.locator(`.markian-toolbar > [data-command="${id}"]`)).toBeVisible();
    await expect(root.locator(`.markian-overflow [data-command="${id}"]`)).toHaveCount(0);
  }
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
    expect(commands.slice(-2)).toEqual(['search', 'fullscreen']);
    if (view === 'code:expand') expect(commands.slice(0, 2)).toEqual(['code:undo', 'code:redo']);
    const search = await toolbar.locator('[data-command="search"]').boundingBox();
    const maximize = await toolbar.locator('[data-command="fullscreen"]').boundingBox();
    const bounds = await toolbar.boundingBox();
    expect(maximize.x).toBeGreaterThan(search.x);
    expect(bounds.x + bounds.width - maximize.x - maximize.width).toBeLessThan(16);
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
      toolbar: [{ id: 'tools', label: 'Tools', icon: 'more', menu: [
        'image', { id: 'nested', label: 'Nested', icon: 'table', menu: ['table:insert', 'link', 'help'] },
      ] }, { id: 'boundary', overflow: true }, 'fullscreen', 'search'],
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
      toolbar: ['image', 'link', { id: 'boundary', overflow: true }, 'fullscreen', 'search'],
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
  await expect(page.locator('header .workspace-label')).toHaveText('Library workspace');
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
  const root = page.locator('[data-markian]').first();
  await root.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(root).toHaveAttribute('data-view', 'raw');
  await expect(root.locator('[data-command="raw"]')).toHaveCount(0);
  await expect(root.locator('[role="alert"]')).toContainText('retained');
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
  await page.goto('/Examples/index.html');
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

test('raw outline uses parsed Setext/ATX headings and its own scroller', async ({ page }) => {
  await page.evaluate(() => { editor.set('# Title\n\n' + Array(100).fill('paragraph\n').join('\n') + '\nSection\n-------\n\n## Last'); editor.setMode('raw'); });
  const root = page.locator('[data-markian]').first();
  await page.evaluate(() => editor.execute('outline'));
  const outline = root.getByRole('navigation', { name: 'Document outline' });
  await expect(outline.getByRole('button')).toHaveCount(2);
  await outline.getByRole('button', { name: 'Last', exact: true }).click();
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