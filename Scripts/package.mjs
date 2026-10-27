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
for (const path of ['dist/markian.min.js', 'dist/markian.css', 'dist/extensions/code.min.js', 'dist/types/index.d.ts', 'dist/manifest.json', 'dist/THIRD_PARTY_NOTICES.txt', 'Examples/index.html']) assert.ok(paths.has(path), `Missing package file: ${path}`);
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
	for (const name of ['@milkdown/kit', '@codemirror/view']) {
		await assert.rejects(readFile(join(fixture, 'node_modules', name, 'package.json')));
	}
	const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
	server = createServer(async (request, response) => {
		try {
			const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
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
	assert.deepEqual(errors, []);
	console.log('Installed npm archive passed hash, dependency-isolation and browser startup checks with scripts disabled.');
} finally {
	await browser?.close();
	if (server) await new Promise(resolve => server.close(resolve));
	await rm(temporary, { recursive: true, force: true });
}