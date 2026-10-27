import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { equivalentMarkdown } from '../src/render/markdown';

const browserErrors = new WeakMap();
const corpus = JSON.parse(readFileSync(new URL('./Fixtures/compatibility.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async () => { await Promise.all([window.editor.ready, window.secondary.ready]); });
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

test('H2 toolbar toggles paragraph headings and supports undo', async ({ page }) => {
  await page.evaluate(() => editor.set('Heading text'));
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
  await toggle.click();
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
  await expect(toggle).toBeVisible();
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
    await root.locator('[data-command="help"]').click();
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