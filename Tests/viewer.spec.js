import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const corpus = JSON.parse(readFileSync(new URL('./Fixtures/compatibility.json', import.meta.url), 'utf8'));

test('viewer standalone startup has no editor assets or implicit Mermaid runtime', async ({ page }) => {
  const requests = [];
  const errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/Examples/index.html');
  await page.addStyleTag({ url: '/dist/markian-viewer.css' });
  await page.addScriptTag({ url: '/dist/markian-viewer.min.js' });
  await page.evaluate(() => {
    const host = document.createElement('article');
    document.querySelector('main').append(host);
    window.viewer = MarkianViewer.create(host, { markdown: '# Field notes\n\n- [ ] Review\n\n```mermaid\ngraph LR\n Draft --> Review\n```' });
  });
  await page.evaluate(() => viewer.ready);
  await expect(page.locator('[data-markian-viewer] h1')).toHaveText('Field notes');
  await expect(page.locator('code.language-mermaid')).toContainText('Draft --> Review');
  await expect(page.locator('[data-markian-viewer] input[type=checkbox]').first()).toBeDisabled();
  expect(await page.evaluate(() => typeof window.Markian)).toBe('undefined');
  expect(requests.some(path => /\/markian\.(?:min\.js|css)$|\/extensions\/|mermaid\.min\.js|codemirror|milkdown/i.test(path))).toBe(false);
  expect(errors).toEqual([]);
});

test('viewer comparison mirrors editor changes and shares equal responsive panes', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/Examples/viewer.html');
  await page.evaluate(() => comparisonReady);
  const panes = page.locator('.demo-pane');
  const editorPane = await panes.nth(0).boundingBox();
  const viewerPane = await panes.nth(1).boundingBox();
  expect(Math.abs(editorPane.width - viewerPane.width)).toBeLessThan(1);
  expect(editorPane.y).toBe(viewerPane.y);
  for (const theme of ['light', 'dark']) {
    await page.locator('#theme').setChecked(theme === 'dark');
    const presentation = await page.evaluate(() => {
      const measure = root => {
        const top = root.querySelector('h1').getBoundingClientRect().top;
        const left = root.querySelector('h1').getBoundingClientRect().left;
        const checkbox = root.querySelector('input[type="checkbox"]');
        return {
          positions: ['h1', 'h2', 'table', 'blockquote', 'pre'].map(selector => root.querySelector(selector).getBoundingClientRect().top - top),
          cellWidth: root.querySelector('th').getBoundingClientRect().width,
          cellAlignment: getComputedStyle(root.querySelector('th')).textAlign,
          taskLeft: checkbox.getBoundingClientRect().left - left,
          taskColor: getComputedStyle(checkbox).backgroundColor,
        };
      };
      return { editor: measure(document.querySelector('.ProseMirror')), viewer: measure(viewer.element), comments: editor.get().includes('<!-- BEGIN sample -->') };
    });
    expect(presentation.comments).toBe(true);
    await expect(page.locator('.ProseMirror .markian-comment-only')).toHaveCount(2);
    for (let index = 0; index < presentation.editor.positions.length; index++) {
      expect(Math.abs(presentation.editor.positions[index] - presentation.viewer.positions[index])).toBeLessThan(2);
    }
    expect(presentation.editor.cellWidth).toBe(presentation.viewer.cellWidth);
    expect(presentation.editor.cellAlignment).toBe(presentation.viewer.cellAlignment);
    expect(presentation.editor.taskLeft).toBe(presentation.viewer.taskLeft);
    expect(presentation.editor.taskColor).toBe(presentation.viewer.taskColor);
    await expect(page.locator('.ProseMirror input[type="checkbox"]').first()).toBeEnabled();
    await expect(page.locator('#viewer input[type="checkbox"]').first()).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`comparison-${theme}.png`), fullPage: true });
  }
  await page.evaluate(() => editor.set('## Shared value\n\nLive **content**.'));
  await expect(page.locator('#viewer h2')).toHaveText('Shared value');
  expect(await page.evaluate(() => viewer.get() === editor.get())).toBe(true);
  await page.evaluate(() => editor.setMode('raw'));
  const source = page.locator('[data-markian] .cm-content');
  await source.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n\nTyped in source.');
  await expect(page.locator('#viewer')).toContainText('Typed in source.');
  await page.locator('#theme').check();
  await expect(page.locator('[data-markian]')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#viewer [data-markian-viewer]')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('comparison-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 });
  const mobileEditor = await panes.nth(0).boundingBox();
  const mobileViewer = await panes.nth(1).boundingBox();
  expect(mobileViewer.y).toBeGreaterThanOrEqual(mobileEditor.y + mobileEditor.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('comparison-mobile.png'), fullPage: true });
  await page.locator('#replace').click();
  await expect(page.locator('#viewer h1')).toHaveText('Updated notes');
  await page.locator('#destroy').click();
  await expect(page.locator('[data-markian], [data-markian-viewer]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('viewer source, resources, replacement failure, lifecycle and instance state are independent', async ({ page }) => {
  await page.goto('/Examples/viewer.html');
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    const original = document.createElement('button');
    original.textContent = 'Original host';
    host.append(original);
    document.body.append(host);
    const opened = [];
    const source = '# Local\n\n[Guide](../guide.md?q=1#heading) ![Pixel](pixel.png) [unsafe](javascript:alert%281%29)\n\n- [ ] Task\n\n<!-- invisible -->';
    const second = MarkianViewer.create(host, {
      markdown: source,
      documentBase: 'https://example.test/docs/current.md',
      onResourceResolve: ({ destination, kind }) => kind === 'image' ? '/assets/pixel.png' : destination,
      onLinkOpen: context => opened.push(context.destination),
    });
    await second.ready;
    second.element.querySelector('a').click();
    const urls = [...second.element.querySelectorAll('a, img')].map(node => node.getAttribute(node.tagName === 'IMG' ? 'src' : 'href'));
    let invalid = false;
    try { await second.set('x'.repeat(1_000_001)); } catch { invalid = true; }
    const retained = second.get() === source;
    await second.setTheme('dark');
    const firstTheme = viewer.element.dataset.theme;
    const secondTheme = second.element.dataset.theme;
    const noMetadata = !second.element.textContent.includes('invisible');
    const disabled = second.element.querySelector('input').disabled;
    second.destroy();
    second.destroy();
    const restored = host.firstChild === original && host.childNodes.length === 1;
    const next = MarkianViewer.create(host, { markdown: '' });
    await next.ready;
    next.destroy();
    return { urls, opened, invalid, retained, firstTheme, secondTheme, noMetadata, disabled, restored };
  });
  expect(result).toEqual({
    urls: ['https://example.test/guide.md?q=1#heading', 'https://example.test/assets/pixel.png', null],
    opened: ['../guide.md?q=1#heading'], invalid: true, retained: true,
    firstTheme: 'light', secondTheme: 'dark', noMetadata: true, disabled: true, restored: true,
  });
});

test('viewer rejects unsafe resolved resources and invalid configuration without losing the host', async ({ page }) => {
  await page.goto('/Examples/viewer.html');
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.textContent = 'Retain';
    document.body.append(host);
    const failures = [];
    for (const options of [{ mermaid: 'yes' }, { theme: 'automatic' }, { renderers: { mermaid: true } }, { documentBase: 'file:///secret' }]) {
      try { MarkianViewer.create(host, options); } catch (error) { failures.push(error.message); }
    }
    let fail = false;
    const instance = MarkianViewer.create(host, {
      markdown: '[Unsafe](safe.md) ![Unsafe](safe.png)',
      onResourceResolve: () => { if (fail) throw new Error('Resolver failed'); return 'javascript:alert(1)'; },
    });
    await instance.ready;
    const safe = !instance.element.querySelector('a').hasAttribute('href') && !instance.element.querySelector('img').hasAttribute('src');
    fail = true;
    try { await instance.set('[Next](next.md)'); } catch { /* Expected transactional rejection. */ }
    const retained = instance.get() === '[Unsafe](safe.md) ![Unsafe](safe.png)';
    instance.destroy();
    return { failures: failures.length, safe, retained, host: host.textContent };
  });
  expect(result).toEqual({ failures: 4, safe: true, retained: true, host: 'Retain' });
});

test('viewer renderer results are sanitized, cancelled and cannot replace a newer document', async ({ page }) => {
  const externalRequests = [];
  await page.route('https://example.test/**', route => { externalRequests.push(route.request().url()); return route.abort(); });
  await page.goto('/Examples/viewer.html');
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const completions = [];
    const signals = [];
    const errors = [];
    const instance = MarkianViewer.create(host, {
      markdown: '```sample\nold\n```',
      onError: error => errors.push(error.message),
      renderers: { sample: context => { signals.push(context.signal); return new Promise(resolve => completions.push(resolve)); } },
    });
    await new Promise(resolve => requestAnimationFrame(resolve));
    const next = instance.set('```sample\nnew\n```');
    await new Promise(resolve => requestAnimationFrame(resolve));
    completions[1]('<svg viewBox="0 0 100 30"><defs><marker id="arrow"/></defs><path marker-end="url(#arrow)"/><text x="5" y="20">New</text><script>window.compromised=true</script><foreignObject>bad</foreignObject><image href="https://example.test/track"/></svg><img src="https://example.test/image.png" srcset="https://example.test/wide.png 2x"><video poster="https://example.test/poster.png"><source src="https://example.test/movie.mp4"></video>');
    await next;
    completions[0]('<p>Old</p>');
    await instance.ready;
    const text = instance.element.textContent;
    const safe = !instance.element.querySelector('script, foreignObject, image, img, video, source, [srcset], [poster]');
    const marker = instance.element.querySelector('marker').id;
    const reference = instance.element.querySelector('path').getAttribute('marker-end');
    const pending = instance.set('```sample\nhanging\n```');
    await new Promise(resolve => requestAnimationFrame(resolve));
    instance.destroy();
    await pending;
    completions[2]('<p>Late</p>');
    return { text, safe, reference, marker, aborted: signals.every(signal => signal.aborted), removed: !instance.element.isConnected, errors };
  });
  expect(result.text).toBe('New');
  expect(result.safe).toBe(true);
  expect(result.reference).toBe(`url(#${result.marker})`);
  expect(result.aborted).toBe(true);
  expect(result.removed).toBe(true);
  expect(result.errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('viewer Mermaid loading is explicit, lazy and independently disabled per instance', async ({ page }, testInfo) => {
  const runtimeRequests = [];
  page.on('request', request => { if (request.url().includes('/host-assets/mermaid.min.js')) runtimeRequests.push(request.url()); });
  await page.goto('/Examples/viewer.html');
  await page.addStyleTag({ url: '/dist/extensions/viewer-mermaid.css' });
  await page.addScriptTag({ url: '/dist/extensions/viewer-mermaid.min.js' });
  await page.evaluate(async () => {
    const renderer = MarkianViewerMermaid.createRenderer(document, { source: '/host-assets/mermaid.min.js' });
    window.viewerErrors = [];
    const make = async options => {
      const host = document.createElement('div');
      document.body.append(host);
      const instance = MarkianViewer.create(host, { renderers: { mermaid: renderer }, onError: error => viewerErrors.push(error.message), ...options });
      await instance.ready;
      return instance;
    };
    window.disabledViewer = await make({ markdown: '```mermaid\ngraph LR\n A-->B\n```' });
    window.emptyViewer = await make({ markdown: 'No diagrams', mermaid: true });
  });
  expect(runtimeRequests).toHaveLength(0);
  await page.evaluate(async () => {
    await emptyViewer.set('```mermaid\ngraph LR\n Draft-->Review\n```');
  });
  expect(runtimeRequests).toHaveLength(1);
  await expect(page.locator('[data-markian-viewer] svg')).toHaveCount(1);
  await expect(page.locator('[data-markian-viewer] svg')).toContainText('Draft');
  expect(await page.evaluate(() => disabledViewer.element.querySelector('pre').textContent)).toContain('A-->B');
  expect(await page.evaluate(() => viewerErrors)).toEqual([]);
  expect(await page.evaluate(() => typeof window.MarkianMermaid)).toBe('undefined');
  await expect(page.locator('[data-markian-viewer] svg .node rect').first()).toHaveCSS('fill', 'rgb(236, 236, 255)');
  await expect(page.locator('[data-markian-viewer] svg .node text').first()).toHaveCSS('text-anchor', 'middle');
  await page.screenshot({ path: testInfo.outputPath('viewer-mermaid.png'), fullPage: true });
});

test('viewer optional renderer failure retains readable source and reports the error', async ({ page }) => {
  await page.goto('/Examples/viewer.html');
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const errors = [];
    const instance = MarkianViewer.create(host, {
      markdown: '```mermaid\ngraph LR\n A-->B\n```', mermaid: true,
      onError: error => errors.push(error.message),
      renderers: { mermaid: () => Promise.reject(new Error('Unavailable renderer')) },
    });
    await instance.ready;
    return { source: instance.get(), text: instance.element.textContent, errors };
  });
  expect(result.text).toContain('A-->B');
  expect(result.source).toContain('```mermaid');
  expect(result.errors).toEqual(['Unavailable renderer']);
});

test('viewer shares semantic and security fixtures with editor Preview and coexists without global or theme collisions', async ({ page }) => {
  await page.goto('/Examples/viewer.html');
  await page.addStyleTag({ url: '/dist/markian.css' });
  await page.addScriptTag({ url: '/dist/markian.min.js' });
  const results = await page.evaluate(async corpus => {
    const host = document.createElement('div');
    host.style.height = '400px';
    document.body.append(host);
    let editor;
    const summarize = node => ({
      text: node.innerText.replace(/\s+/g, ' ').trim(),
      headings: [...node.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => [heading.tagName, heading.id]),
      tasks: [...node.querySelectorAll('input[type=checkbox]')].map(input => [input.checked, input.disabled]),
      unsafe: node.querySelectorAll('script,iframe,[onclick]').length,
      cells: [...node.querySelectorAll('th,td')].map(cell => cell.textContent),
    });
    const results = [];
    for (const fixture of corpus) {
      editor?.destroy();
      editor = Markian.create(host, { markdown: fixture.markdown, theme: 'dark', initialMode: 'raw' });
      await editor.ready;
      await viewer.set(fixture.markdown);
      await editor.execute('preview');
      const preview = editor.element.querySelector('.markian-view.markian-document');
      results.push({ name: fixture.name, viewer: summarize(viewer.element.querySelector('.markian-document')), preview: summarize(preview) });
    }
    const globals = typeof Markian.create === 'function' && typeof MarkianViewer.create === 'function';
    await viewer.setTheme('light');
    const theme = editor.element.dataset.theme;
    editor.destroy();
    return { results, globals, theme };
  }, corpus);
  for (const result of results.results) expect(result.viewer, result.name).toEqual(result.preview);
  expect(results.globals).toBe(true);
  expect(results.theme).toBe('dark');
});

for (const theme of ['light', 'dark']) {
  for (const width of [1100, 360]) {
    test(`viewer ${theme} at ${width}px keeps media, tables and code within its surface`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/Examples/viewer.html');
      await page.evaluate(async theme => {
        document.querySelector('#theme').checked = theme === 'dark';
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 100;
        const context = canvas.getContext('2d');
        context.fillStyle = '#e8f3ee';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#227761';
        context.font = '22px sans-serif';
        context.fillText('Review notes', 20, 58);
        await viewer.setTheme(theme);
        await viewer.set('# Notes\n\n[Checklist](#tasks)\n\n## Tasks\n\n- [x] Reviewed\n\n![Sample](' + canvas.toDataURL('image/png') + ')\n\n| Wide table heading | Other heading | Third heading |\n| --- | --- | --- |\n| Value | Value | Value |\n\n```text\n' + 'Long code '.repeat(60) + '\n```\n\n> [!WARNING]\n> Read carefully.');
      }, theme);
      await expect(page.locator('[data-markian-viewer] img')).toBeVisible();
      expect(await page.locator('[data-markian-viewer] img').evaluate(async image => { await image.decode(); return image.naturalWidth; })).toBe(300);
      await expect(page.locator('[data-markian-viewer] input')).toBeDisabled();
      expect(await page.locator('[data-markian-viewer] blockquote').evaluate(quote => getComputedStyle(quote, '::before').color)).toBe(theme === 'dark' ? 'rgb(232, 193, 90)' : 'rgb(153, 108, 0)');
      expect(await page.locator('[data-markian-viewer]').evaluate(root => root.scrollWidth <= root.clientWidth + 1)).toBe(true);
      await page.locator('[data-markian-viewer] a').focus();
      await expect(page.locator('[data-markian-viewer] a')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#tasks')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`viewer-${theme}-${width}.png`), fullPage: true });
    });
  }
}