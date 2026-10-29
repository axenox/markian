import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const viewerOnly = process.argv.includes('--viewer');
const [pack] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' }));
const paths = new Set(pack.files.map(file => file.path));
for (const path of ['dist/markian.min.js', 'dist/markian.css', 'dist/markian-viewer.min.js', 'dist/markian-viewer.css', 'dist/types/viewer.d.ts', 'dist/extensions/viewer-mermaid.min.js', 'dist/types/viewer-mermaid.d.ts', 'dist/sizes.json', 'dist/extensions/code.min.js', 'dist/extensions/mermaid.min.js', 'dist/extensions/mermaid.css', 'dist/types/extensions/mermaid.d.ts', 'dist/types/index.d.ts', 'dist/manifest.json', 'dist/THIRD_PARTY_NOTICES.txt', 'Examples/index.html', 'Examples/minimal-editor.html', 'Examples/mermaid-diagrams.html', 'Examples/viewer.html']) assert.ok(paths.has(path), `Missing package file: ${path}`);
assert.ok(![...paths].some(path => path.startsWith('dist/dependencies/')), 'Mermaid must be supplied by the host, not shipped in the archive.');
assert.ok(![...paths].some(path => /^(Prototype|node_modules|src|Tests)\//.test(path)));
console.log(`npm archive validated: ${pack.files.length} files, ${pack.size} bytes.`);
const temporary = await mkdtemp(join(tmpdir(), 'markian-package-'));
let server;
let browser;
try {
	const [archive] = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], { encoding: 'utf8', shell: process.platform === 'win32' }));
	const fixture = join(temporary, 'fixture');
	await mkdir(fixture);
	execFileSync(npm, ['install', '--prefix', fixture, join(temporary, archive.filename), '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], { stdio: 'inherit', shell: process.platform === 'win32' });
	const root = join(fixture, 'node_modules', 'markian');
	const manifest = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'));
	for (const [path, metadata] of Object.entries(manifest.assets)) {
		const bytes = await readFile(join(root, 'dist', path));
		assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256, path);
	}
	for (const name of ['@milkdown/kit', '@codemirror/view', 'mermaid']) {
		await assert.rejects(readFile(join(fixture, 'node_modules', name, 'package.json')));
	}
	const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
	server = createServer(async (request, response) => {
		try {
			const requested = new URL(request.url, 'http://localhost').pathname.replace(/^\/installed\/markian\//, '/');
			if (requested === '/Examples/mermaid.config.js') {
				response.setHeader('Content-Type', 'application/javascript');
				response.end(`window.markianMermaidConfig = ${JSON.stringify({ asset: { url: '/host-assets/mermaid.min.js', version: '12.2.0' } })};`);
				return;
			}
			if (requested === '/host-assets/mermaid.min.js') {
				response.setHeader('Content-Type', 'application/javascript');
				response.end(await readFile('node_modules/mermaid/dist/mermaid.min.js'));
				return;
			}
			const path = resolve(root, '.' + decodeURIComponent(requested));
			if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw new Error('Invalid path');
			response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
			response.end(await readFile(path));
		} catch { response.writeHead(404); response.end(); }
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	browser = await chromium.launch();
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	const requests = [];
	page.on('request', request => requests.push(new URL(request.url()).pathname));
	await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
	await page.goto(`http://127.0.0.1:${server.address().port}/installed/markian/Examples/index.html`);
	await page.addStyleTag({ url: '/installed/markian/dist/markian-viewer.css' });
	await page.addScriptTag({ url: '/installed/markian/dist/markian-viewer.min.js' });
	await page.evaluate(() => {
		const host = document.createElement('article');
		document.querySelector('main').append(host);
		window.viewer = MarkianViewer.create(host, { markdown: '# Field notes' });
	});
	assert.match(await page.evaluate(async () => { await viewer.ready; return viewer.get(); }), /Field notes/);
	assert.equal(await page.evaluate(() => typeof window.Markian), 'undefined');
	assert.ok(!requests.some(path => /\/markian\.(?:min\.js|css)$|mermaid\.min\.js|\/extensions\//.test(path)), 'Viewer archive startup must not request editor assets or Mermaid.');
	await page.evaluate(async () => { await viewer.set('# Replacement'); await viewer.setTheme('dark'); });
	assert.equal(await page.locator('[data-markian-viewer] h1').textContent(), 'Replacement');
	await page.evaluate(() => { viewer.destroy(); viewer.destroy(); });
	assert.equal(await page.locator('[data-markian-viewer]').count(), 0);
	if (!viewerOnly) {
	await page.goto(`http://127.0.0.1:${server.address().port}/Examples/minimal-editor.html`);
	assert.match(await page.evaluate(async () => { await window.example.ready; return window.example.get(); }), /A note/);
	await page.goto(`http://127.0.0.1:${server.address().port}/Examples/mermaid-diagrams.html`);
	await page.evaluate(() => window.diagramEditor.ready);
	await page.waitForFunction(() => document.querySelectorAll('.markian-diagram[data-state="ready"]').length === 2, null, { timeout: 15000 });
	assert.match(await page.locator('.markian-diagram').first().textContent(), /Draft/);
	}
	assert.deepEqual(errors, []);
	console.log('Installed npm archive passed hash, dependency-isolation and browser startup checks with scripts disabled.');
} finally {
	await browser?.close();
	if (server) await new Promise(resolve => server.close(resolve));
	await rm(temporary, { recursive: true, force: true });
}