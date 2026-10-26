import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const browserErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.Markian))).toBe(true);
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

const getMarkdown = page => page.evaluate(() => window.Markian.get());
const command = (page, name) => page.getByRole('toolbar', { name: 'Document formatting', exact: true }).getByRole('button', { name, exact: true });

async function sourceText(page, text) {
  await page.locator('#source-editor .cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

test('edits Mermaid in a dedicated live view and saves one undoable Markdown change', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('# Diagram\n\n```mermaid\nflowchart LR\n  A[Draft] --> B[Review]\n```\n\nKeep this paragraph.\n'));
  const diagram = page.locator('.mermaid-block');
  await expect(diagram.locator('svg')).toBeVisible();
  await diagram.getByRole('button', { name: 'Edit Mermaid diagram', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Document formatting', exact: true })).toBeHidden();
  const diagramToolbar = page.getByRole('toolbar', { name: 'Mermaid editing', exact: true });
  await expect(diagramToolbar.getByRole('button')).toHaveCount(1);
  await expect(page.locator('#visual-mode')).toBeHidden();
  await page.locator('#mermaid-editor .cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('flowchart LR\n  A[Draft] --> B[Published]');
  await expect(page.locator('#mermaid-preview svg')).toBeVisible();
  await expect(page.locator('#mermaid-preview')).toContainText('Published');
  expect(await getMarkdown(page)).toContain('Published');
  await diagramToolbar.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(diagram).toContainText('Published');
  const saved = await getMarkdown(page);
  expect(saved).toContain('```mermaid');
  expect(saved).toContain('Keep this paragraph.');
  expect(saved).not.toContain('<svg');
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).toContain('B[Review]');
  expect(await getMarkdown(page)).not.toContain('Published');
});

test('Mermaid syntax errors preserve edits and recover without stale renders', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('```mermaid\nflowchart LR\n  A[First] --> B[Second]\n```'));
  await page.getByRole('button', { name: 'Edit Mermaid diagram', exact: true }).click();
  const source = page.locator('#mermaid-editor .cm-content');
  await source.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('flowchart LR\n  A[Unfinished');
  await expect(page.locator('#mermaid-preview [role="alert"]')).toBeVisible();
  expect(await getMarkdown(page)).toContain('A[Unfinished');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('flowchart LR\n  A[Newest] --> B[Recovered]');
  await expect(page.locator('#mermaid-preview svg')).toBeVisible();
  await expect(page.locator('#mermaid-preview')).toContainText('Recovered');
  await expect(page.locator('#mermaid-preview [role="alert"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await expect(page.locator('#mermaid-preview[aria-busy="false"] svg')).toBeVisible();
  await page.getByRole('toolbar', { name: 'Mermaid editing', exact: true }).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.mermaid-block')).toContainText('Recovered');
  expect(await page.evaluate(() => [...document.scripts].some(script => script.src.includes('/mermaid.min.js')))).toBe(true);
});

test('Mermaid edits target the selected block and unchanged visits add no undo step', async ({ page }) => {
  const original = '# Diagrams\n\n```mermaid\nflowchart LR\n  A[First] --> B[Keep]\n```\n\n```mermaid\nflowchart LR\n  C[Second] --> D[Change]\n```';
  await page.evaluate(value => window.Markian.set(value), original);
  const buttons = page.getByRole('button', { name: 'Edit Mermaid diagram', exact: true });
  await buttons.nth(1).click();
  await page.locator('#mermaid-editor .cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('flowchart LR\n  C[Second] --> D[Updated]');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.mermaid-block').nth(0)).toContainText('Keep');
  await expect(page.locator('.mermaid-block').nth(1)).toContainText('Updated');
  const saved = await getMarkdown(page);
  await buttons.nth(0).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await getMarkdown(page)).toBe(saved);
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).toContain('D[Change]');
  expect(await getMarkdown(page)).not.toContain('Updated');
});

test('Mermaid code and preview fit desktop and mobile viewports', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('```mermaid\nflowchart LR\n  A[Prepare] --> B[Review]\n  B --> C[Publish]\n```'));
  await page.getByRole('button', { name: 'Edit Mermaid diagram', exact: true }).click();
  await expect(page.locator('#mermaid-preview svg')).toBeVisible();
  const code = page.locator('.mermaid-code-pane');
  const preview = page.locator('.mermaid-preview-pane');
  const desktopCode = await code.boundingBox();
  const desktopPreview = await preview.boundingBox();
  expect(desktopCode.x + desktopCode.width).toBeLessThanOrEqual(desktopPreview.x + 1);
  await page.screenshot({ path: '.prototype-tests/mermaid-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCode = await code.boundingBox();
  const mobilePreview = await preview.boundingBox();
  expect(mobileCode.y + mobileCode.height).toBeLessThanOrEqual(mobilePreview.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.prototype-tests/mermaid-mobile.png', fullPage: true });
});

test('loads an editable document with invisible, preserved comments', async ({ page }) => {
  await expect(page.locator('.ProseMirror h1')).toHaveText('A new place to do good work');
  await expect(page.getByRole('checkbox')).toHaveCount(4);
  const markdown = await getMarkdown(page);
  expect(markdown).toContain('<!-- markian:placeholder');
  expect(markdown).toContain('<!-- /markian:placeholder -->');
  expect(await page.locator('.ProseMirror').innerText()).not.toContain('markian:placeholder');
  await expect(page.locator('.ProseMirror > [data-markian-comment]')).toHaveCount(2);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.type(' Updated');
  expect(await getMarkdown(page)).toContain('Updated');
  expect(await getMarkdown(page)).toContain('<!-- markian:placeholder');
});

test('formats a word at the caret and supports undo and redo', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('A simple paragraph.'));
  await page.locator('.ProseMirror p').click();
  await page.locator('.ProseMirror p').evaluate(paragraph => {
    const selection = window.getSelection();
    selection.collapse(paragraph.firstChild, 3);
  });
  await page.keyboard.press('ArrowRight');
  await command(page, 'Bold').click();
  await expect(page.locator('.ProseMirror strong')).toHaveText('simple');
  await command(page, 'Undo').click();
  await expect(page.locator('.ProseMirror strong')).toHaveCount(0);
  await command(page, 'Redo').click();
  await expect(page.locator('.ProseMirror strong')).toHaveText('simple');
});

test('typed backticks create inline code and allow typing after it', async ({ page }) => {
  await page.evaluate(() => window.Markian.set(''));
  await page.locator('.ProseMirror p').click();
  await page.keyboard.type('`asdf`');
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
  await page.keyboard.type(' normal');
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
  expect(await getMarkdown(page)).toContain('`asdf` normal');
});

test('typing inside paired backticks creates inline code', async ({ page }) => {
  await page.evaluate(() => window.Markian.set(''));
  await page.locator('.ProseMirror p').click();
  await page.keyboard.type('``');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('asdf');
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
  expect((await getMarkdown(page)).trim()).toBe('`asdf`');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' normal');
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
  expect((await getMarkdown(page)).trim()).toBe('`asdf` normal');
});

for (const fence of ['```', '````', '```javascript', '````c++']) {
  test(`typed fence ${fence} starts a code block on Enter`, async ({ page }) => {
    await page.evaluate(() => window.Markian.set(''));
    await page.locator('.ProseMirror p').click();
    await page.keyboard.type(fence);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ProseMirror pre code')).toHaveCount(1);
    await page.keyboard.type('const value = 1;');
    await expect(page.locator('.ProseMirror pre code')).toHaveText('const value = 1;');
    const language = fence.replace(/^`{3,}/, '');
    expect(await getMarkdown(page)).toContain(`\`\`\`${language}\nconst value = 1;`);
  });
}

test('paired inline code can be closed with a backtick and undone', async ({ page }) => {
  await page.evaluate(() => window.Markian.set(''));
  await page.locator('.ProseMirror p').click();
  await page.keyboard.type('``');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('asdf` normal');
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
  const typedDocument = await getMarkdown(page);
  expect(typedDocument.trim()).toBe('`asdf` normal');
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).not.toBe(typedDocument);
  await command(page, 'Redo').click();
  expect(await getMarkdown(page)).toBe(typedDocument);
  await expect(page.locator('.ProseMirror p code')).toHaveText('asdf');
});

test('backtick typing does not reformat the contents of code blocks', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('```text\nplain\n```'));
  await page.locator('.ProseMirror pre code').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' `literal`');
  await expect(page.locator('.ProseMirror pre code')).toHaveText('plain `literal`');
  await expect(page.locator('.ProseMirror pre code code')).toHaveCount(0);
});

test('checks tasks with mouse and keyboard', async ({ page }) => {
  const checkbox = page.getByRole('checkbox', { name: 'Put welcome packs on the front desk' });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  expect(await getMarkdown(page)).toContain('[x] Put welcome packs');
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).not.toBeChecked();
  expect(await getMarkdown(page)).toContain('[ ] Put welcome packs');
});

test('edits table cells and adds a row and column', async ({ page }) => {
  await page.getByRole('cell', { name: 'Morgan', exact: true }).click();
  await page.keyboard.type(' Updated');
  await command(page, 'Add table row').click();
  await expect(page.locator('.ProseMirror tr')).toHaveCount(6);
  await command(page, 'Add table column').click();
  await expect(page.locator('.ProseMirror tr').first().locator('th, td')).toHaveCount(4);
  expect(await getMarkdown(page)).toContain('Updated');
});

test('source replaces the document in place and switches back without losing edits', async ({ page }) => {
  const before = await getMarkdown(page);
  await command(page, 'Markdown source').click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#source-editor')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(command(page, 'Bold')).toBeVisible();
  await sourceText(page, `${before}\n\nA new closing note.`);
  expect(await getMarkdown(page)).toContain('A new closing note.');
  await command(page, 'Visual editor').click();
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#source-editor')).toBeHidden();
  await expect(page.locator('.ProseMirror')).toContainText('A new closing note.');
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).toBe(before);
});

test('toolbar formats raw Markdown and undo stays in source mode', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  await sourceText(page, 'hello');
  await page.keyboard.press('ControlOrMeta+a');
  await command(page, 'Bold').click();
  expect(await getMarkdown(page)).toBe('**hello**');
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).toBe('hello');
  await command(page, 'Redo').click();
  expect(await getMarkdown(page)).toBe('**hello**');
});

test('source toolbar formats headings and multiline lists without touching comments', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  await sourceText(page, 'One\nTwo');
  await page.keyboard.press('ControlOrMeta+a');
  await command(page, 'Bulleted list').click();
  expect(await getMarkdown(page)).toBe('- One\n- Two');
  await command(page, 'Numbered list').click();
  expect(await getMarkdown(page)).toBe('1. One\n2. Two');
  await command(page, 'Insert task list').click();
  expect(await getMarkdown(page)).toBe('- [ ] One\n- [ ] Two');
  await sourceText(page, 'A heading\n\n<!-- metadata:keep -->');
  await page.locator('#source-editor .cm-content').press('ControlOrMeta+Home');
  await page.getByRole('combobox', { name: 'Text style' }).selectOption('2');
  expect(await getMarkdown(page)).toBe('## A heading\n\n<!-- metadata:keep -->');
  await command(page, 'Visual editor').click();
  await expect(page.locator('.ProseMirror h2')).toHaveText('A heading');
  expect(await getMarkdown(page)).toContain('<!-- metadata:keep -->');
});

for (const [button, expected] of [['Italic', '*hello*'], ['Strikethrough', '~~hello~~'], ['Inline code', '`hello`'], ['Blockquote', '> hello']]) {
  test(`source toolbar applies ${button}`, async ({ page }) => {
    await page.evaluate(() => window.Markian.set('plain'));
    await command(page, 'Markdown source').click();
    await sourceText(page, 'hello');
    await page.keyboard.press('ControlOrMeta+a');
    await command(page, button).click();
    expect(await getMarkdown(page)).toBe(expected);
  });
}

test('source toolbar clears formatting and creates code fences', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  await sourceText(page, '**hello**');
  await page.keyboard.press('ControlOrMeta+a');
  await command(page, 'Clear formatting').click();
  expect(await getMarkdown(page)).toBe('hello');
  await command(page, 'Code block').click();
  expect(await getMarkdown(page)).toBe('```\nhello\n```');
  await command(page, 'Visual editor').click();
  await expect(page.locator('.ProseMirror pre code')).toHaveText('hello');
});

test('source toolbar inserts and expands a Markdown table', async ({ page }) => {
  await page.evaluate(() => window.Markian.set(''));
  await command(page, 'Markdown source').click();
  await command(page, 'Insert table').click();
  await page.locator('#source-editor .cm-content').press('ControlOrMeta+End');
  await command(page, 'Add table row').click();
  await command(page, 'Add table column').click();
  await command(page, 'Visual editor').click();
  await expect(page.locator('.ProseMirror tr')).toHaveCount(3);
  await expect(page.locator('.ProseMirror tr').first().locator('th, td')).toHaveCount(3);
});

test('source toolbar inserts safe links and images at the source selection', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  await sourceText(page, 'hello');
  await page.keyboard.press('ControlOrMeta+a');
  await command(page, 'Insert or edit link').click();
  await expect(page.locator('#link-text')).toHaveValue('hello');
  await page.locator('#link-url').fill('./guide.md');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  expect(await getMarkdown(page)).toBe('[hello](<./guide.md>)');
  await command(page, 'Insert image').click();
  await page.locator('#link-text').fill('Workspace plan');
  await page.locator('#link-url').fill('./plan.png');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  expect(await getMarkdown(page)).toBe('![Workspace plan](<./plan.png>)');
  await command(page, 'Visual editor').click();
  await expect(page.getByRole('img', { name: 'Workspace plan', exact: true })).toHaveAttribute('src', './plan.png');
});

test('source history and exact raw downloads survive mode and theme switches', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  const raw = '# Unnormalized\n\n-   original spacing\n\n<!-- retain:this -->\n';
  await sourceText(page, raw);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await command(page, 'Maximize editor').click();
  expect(await getMarkdown(page)).toBe(raw);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => document.getElementById('download').click());
  const download = await downloadPromise;
  expect(await readFile(await download.path(), 'utf8')).toBe(raw);
  await command(page, 'Visual editor').click();
  await command(page, 'Markdown source').click();
  expect(await getMarkdown(page)).toBe(raw);
  await command(page, 'Undo').click();
  expect(await getMarkdown(page)).toBe('plain\n');
});

test('unchanged source mode switches do not add visual undo steps', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('plain'));
  await command(page, 'Markdown source').click();
  await sourceText(page, '#  A heading\n');
  await command(page, 'Visual editor').click();
  await command(page, 'Markdown source').click();
  await command(page, 'Visual editor').click();
  await command(page, 'Undo').click();
  expect((await getMarkdown(page)).trim()).toBe('plain');
});

test('source outline belongs to raw mode and scrolls the code editor', async ({ page }) => {
  const markdown = '# Document\n\n## Start\n\n'
    + Array.from({ length: 100 }, (_, index) => `Paragraph ${index}.\n`).join('\n')
    + '\n## Destination\n\nFinal note.\n';
  await page.evaluate(value => window.Markian.set(value), markdown);
  await command(page, 'Markdown source').click();
  const sourceOutline = page.locator('#source-mode nav');
  await expect(page.locator('#visual-mode')).toBeHidden();
  await expect(sourceOutline.getByRole('button', { name: 'Destination', exact: true })).toBeVisible();
  const before = await page.evaluate(() => ({
    page: scrollY,
    visual: document.querySelector('#editor').scrollTop,
  }));
  await sourceOutline.getByRole('button', { name: 'Destination', exact: true }).click();
  await expect.poll(() => page.locator('#source-editor .cm-scroller').evaluate(scroller => scroller.scrollTop)).toBeGreaterThan(100);
  const target = page.locator('#source-editor .cm-line').filter({ hasText: /^## Destination$/ });
  await expect(target).toBeVisible();
  const targetBounds = await target.boundingBox();
  const editorBounds = await page.locator('#source-editor .cm-scroller').boundingBox();
  expect(targetBounds.y).toBeGreaterThanOrEqual(editorBounds.y);
  expect(targetBounds.y + targetBounds.height).toBeLessThanOrEqual(editorBounds.y + editorBounds.height);
  expect(await page.evaluate(() => scrollY)).toBe(before.page);
  expect(await page.locator('#editor').evaluate(editor => editor.scrollTop)).toBe(before.visual);
  await expect(sourceOutline.getByRole('button', { name: 'Destination', exact: true })).toHaveAttribute('aria-current', 'location');
  await sourceOutline.getByRole('button', { name: 'Start', exact: true }).click();
  await command(page, 'Maximize editor').click();
  await sourceOutline.getByRole('button', { name: 'Destination', exact: true }).click();
  await expect.poll(async () => {
    const targetRect = await target.boundingBox();
    const editorRect = await page.locator('#source-editor .cm-scroller').boundingBox();
    return targetRect && targetRect.y >= editorRect.y && targetRect.y + targetRect.height <= editorRect.y + editorRect.height;
  }).toBe(true);
  await command(page, 'Restore editor').click();
  await command(page, 'Visual editor').click();
  await expect(page.locator('#source-mode')).toBeHidden();
  await expect(page.locator('#visual-mode nav').getByRole('button', { name: 'Destination', exact: true })).toBeVisible();
});

test('source outline follows edits and parsed headings, not fenced examples', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('# Document\n\n## Old heading\n'));
  await command(page, 'Markdown source').click();
  const outline = page.locator('#source-mode nav');
  await expect(outline.getByRole('button', { name: 'Old heading', exact: true })).toBeVisible();
  await sourceText(page, '# Document\n\n## New heading\n\n```markdown\n## Fenced example\n```\n\nSetext heading\n--------------\n\nText.\n');
  await expect(outline.getByRole('button')).toHaveCount(2);
  await expect(outline.getByRole('button', { name: 'New heading', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Setext heading', exact: true })).toHaveAttribute('title', 'Line 9');
  await outline.getByRole('button', { name: 'Setext heading', exact: true }).click();
  await expect(outline.getByRole('button', { name: 'Setext heading', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('preserves unknown block and inline comments and keeps HTML inert', async ({ page }) => {
  await page.evaluate(() => window.Markian.set('# Notes\n\n<!-- unknown:provider {"id":7} -->\n\nReadable <!-- inline:meta --> text.\n\n<!-- /unknown:provider -->\n\n<script>window.prototypeInjection = true</script>'));
  const markdown = await getMarkdown(page);
  expect(markdown).toContain('<!-- unknown:provider {"id":7} -->');
  expect(markdown).toContain('<!-- inline:meta -->');
  expect(markdown).toContain('<!-- /unknown:provider -->');
  await expect(page.locator('.ProseMirror script')).toHaveCount(0);
  expect(await page.evaluate(() => window.prototypeInjection)).toBeUndefined();
});

test('link dialog inserts links and rejects executable URLs', async ({ page }) => {
  await command(page, 'Insert or edit link').click();
  await page.locator('#link-text').fill('Project guide');
  await page.locator('#link-url').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  await expect(page.locator('#link-error')).toBeVisible();
  await page.locator('#link-url').fill('./guide.md#arrival');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  await expect(page.locator('.ProseMirror a[href="./guide.md#arrival"]')).toHaveText('Project guide');
});

test('rejects unsafe source without replacing the document', async ({ page }) => {
  const before = await getMarkdown(page);
  await command(page, 'Markdown source').click();
  await sourceText(page, '[unsafe](javascript:alert%281%29)');
  await command(page, 'Visual editor').click();
  await expect(page.locator('#source-error')).toBeVisible();
  await expect(page.locator('#source-editor')).toBeVisible();
  expect(await getMarkdown(page)).toContain('javascript:');
  await sourceText(page, before);
  await command(page, 'Visual editor').click();
  expect(await getMarkdown(page)).toBe(before);
});

test('inserts an image with alt text through the dialog', async ({ page }) => {
  await command(page, 'Insert image').click();
  await page.locator('#link-text').fill('Workspace plan');
  await page.locator('#link-url').fill('./workspace-plan.png');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  await expect(page.locator('.ProseMirror img[alt="Workspace plan"]')).toHaveAttribute('src', './workspace-plan.png');
  expect(await getMarkdown(page)).toContain('![Workspace plan](./workspace-plan.png)');
});

test('theme, maximize and download do not alter Markdown', async ({ page }) => {
  const before = await getMarkdown(page);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await command(page, 'Maximize editor').click();
  await expect(page.locator('.editor-frame')).toHaveClass(/is-maximized/);
  await command(page, 'Restore editor').click();
  expect(await getMarkdown(page)).toBe(before);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md' }).click();
  expect((await download).suggestedFilename()).toBe('workspace-launch.md');
});

test('desktop and mobile layouts fit and have usable source controls', async ({ page }) => {
  await page.screenshot({ path: '.prototype-tests/desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.screenshot({ path: '.prototype-tests/dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const label of ['Markdown source', 'Maximize editor']) {
    const bounds = await command(page, label).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.screenshot({ path: '.prototype-tests/mobile.png', fullPage: true });
  await command(page, 'Markdown source').click();
  await expect(page.locator('#source-editor')).toBeVisible();
  await expect(command(page, 'Visual editor')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const firstLine = await page.locator('#source-editor .cm-line').first().boundingBox();
  const firstNumber = await page.locator('#source-editor .cm-lineNumbers .cm-gutterElement').filter({ hasText: /^1$/ }).boundingBox();
  expect(Math.abs(firstLine.y - firstNumber.y)).toBeLessThan(2);
  await page.screenshot({ path: '.prototype-tests/source-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.prototype-tests/source-desktop.png' });
});