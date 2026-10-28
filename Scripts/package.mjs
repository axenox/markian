import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const [pack] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' }));
const paths = new Set(pack.files.map(file => file.path));
for (const path of ['dist/markian.min.js', 'dist/markian.css', 'dist/extensions/code.min.js', 'dist/extensions/mermaid.min.js', 'dist/extensions/mermaid.css', 'dist/types/extensions/mermaid.d.ts', 'dist/types/index.d.ts', 'dist/manifest.json', 'dist/THIRD_PARTY_NOTICES.txt', 'Examples/index.html', 'Examples/mermaid.html', 'Examples/mermaid.js', 'Examples/mermaid.config.js']) assert.ok(paths.has(path), `Missing package file: ${path}`);
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
			const requested = new URL(request.url, 'http://localhost').pathname;
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
	await page.goto(`http://127.0.0.1:${server.address().port}/Examples/index.html`);
	assert.match(await page.evaluate(async () => { await window.example.ready; return window.example.get(); }), /A note/);
	await page.goto(`http://127.0.0.1:${server.address().port}/Examples/mermaid.html`);
	await page.evaluate(() => window.diagramEditor.ready);
	await page.waitForFunction(() => document.querySelectorAll('.markian-diagram[data-state="ready"]').length === 2, null, { timeout: 15000 });
	assert.match(await page.locator('.markian-diagram').first().textContent(), /Draft/);
	assert.deepEqual(errors, []);
	console.log('Installed npm archive passed hash, dependency-isolation and browser startup checks with scripts disabled.');
} finally {
	await browser?.close();
	if (server) await new Promise(resolve => server.close(resolve));
	await rm(temporary, { recursive: true, force: true });
}