/** Checks bundle-registry metadata without rebuilding the browser library. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeIncludes } from '../Scripts/includes.mjs';

test('bundle registry records actual packages, keyed terms and legacy license links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'markian-includes-'));
  try {
    const scoped = join(root, 'node_modules', '@example', 'library');
    const transitive = join(scoped, 'node_modules', 'legacy');
    const tools = join(root, 'node_modules', 'build-tool');
    for (const directory of [scoped, transitive, tools]) await mkdir(directory, { recursive: true });
    await writeFile(join(scoped, 'package.json'), JSON.stringify({ name: '@example/library', version: '1.2.3', license: 'MIT' }));
    await writeFile(join(scoped, 'LICENSE'), 'Copyright Example\r\nMIT terms\r\n');
    await writeFile(join(scoped, 'NOTICE.txt'), 'Required attribution\n');
    await writeFile(join(transitive, 'package.json'), JSON.stringify({ name: 'legacy', version: '2.0.0', licenses: [{ type: 'ISC', url: 'https://example.org/license' }] }));
    await writeFile(join(tools, 'package.json'), JSON.stringify({ name: 'build-tool', version: '9.0.0' }));
    const destination = join(root, 'includes.json');
    await writeIncludes(new Set([join(root, 'src', 'index.ts'), join(scoped, 'index.js'), join(scoped, 'other.js'), join(transitive, 'index.js')]), destination);
    const entries = JSON.parse(await readFile(destination, 'utf8'));
    assert.deepEqual(entries.map(entry => entry.name), ['npm-asset/example--library', 'npm-asset/legacy']);
    assert.equal(entries[0].version, '1.2.3');
    assert.deepEqual(entries[0].license, ['MIT']);
    assert.equal(entries[0].license_text.MIT, 'Copyright Example\nMIT terms\n\nRequired attribution');
    assert.deepEqual(entries[1].license_link, { ISC: 'https://example.org/license' });
    const first = await readFile(destination, 'utf8');
    await writeIncludes(new Set([join(transitive, 'index.js'), join(scoped, 'index.js')]), destination);
    assert.equal(await readFile(destination, 'utf8'), first);
    await assert.rejects(writeIncludes(new Set([join(tools, 'index.js')]), destination), /Missing license declaration or text\/link for build-tool@9\.0\.0/);
    assert.equal(await readFile(destination, 'utf8'), first);
    await writeFile(join(tools, 'package.json'), JSON.stringify({ name: 'build-tool', version: '9.0.0', license: 'MIT' }));
    await assert.rejects(writeIncludes(new Set([join(tools, 'index.js')]), destination), /Missing license declaration or text\/link/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('bundle registry replaces stale entries and deduplicates installed copies without merging versions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'markian-includes-copies-'));
  try {
    const copies = [
      { directory: join(root, 'node_modules', 'library'), version: '1.0.0' },
      { directory: join(root, 'node_modules', 'parent', 'node_modules', 'library'), version: '1.0.0' },
      { directory: join(root, 'node_modules', 'other', 'node_modules', 'library'), version: '2.0.0' },
    ];
    for (const { directory, version } of copies) {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'library', version, license: 'MIT' }));
      await writeFile(join(directory, 'LICENSE'), 'Library copyright and license terms');
    }
    const destination = join(root, 'includes.json');
    await writeFile(destination, JSON.stringify([{ name: 'npm-asset/stale', version: '9.0.0' }]));
    const modules = copies.map(({ directory }) => join(directory, 'index.js'));
    await writeIncludes(new Set(modules), destination);
    const entries = JSON.parse(await readFile(destination, 'utf8'));
    assert.deepEqual(entries.map(entry => `${entry.name}@${entry.version}`), ['npm-asset/library@1.0.0', 'npm-asset/library@2.0.0']);
    const first = await readFile(destination, 'utf8');
    await writeIncludes(new Set(modules.reverse()), destination);
    assert.equal(await readFile(destination, 'utf8'), first);
    await writeIncludes(new Set(), destination);
    assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('npm hooks refresh the registry on install and uninstall and skip prebuilt consumers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'markian-includes-npm-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;
    const dependency = join(root, 'fixture-package');
    for (const directory of ['Scripts', 'src', 'fixture-package']) await mkdir(join(root, directory));
    await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-package', version: '1.0.0', license: 'MIT' }));
    await writeFile(join(dependency, 'LICENSE'), 'Fixture copyright and license terms');
    await writeFile(join(root, 'src', 'browser.ts'), '');
    await copyFile(new URL('../Scripts/includes.mjs', import.meta.url), join(root, 'Scripts', 'includes.mjs'));
    await writeFile(join(root, 'Scripts', 'build.mjs'), `import { existsSync } from 'node:fs'; import { resolve } from 'node:path'; export async function buildBundles() { return new Set(existsSync('node_modules/fixture-package') ? [resolve('node_modules/fixture-package/index.js')] : []); }`);
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'registry-fixture', private: true, scripts: { dependencies: scripts.dependencies, postinstall: scripts.postinstall }, dependencies: { 'fixture-package': 'file:./fixture-package' } }));
    const runNpm = (args: string[]) => execFileSync(npm, [...args, '--offline', '--no-audit', '--no-fund'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
    runNpm(['install']);
    const registry = join(root, 'includes.json');
    assert.equal(JSON.parse(await readFile(registry, 'utf8'))[0].name, 'npm-asset/fixture-package');
    runNpm(['uninstall', 'fixture-package']);
    assert.deepEqual(JSON.parse(await readFile(registry, 'utf8')), []);
    await rm(join(root, 'Scripts'), { recursive: true });
    await rm(join(root, 'src'), { recursive: true });
    runNpm(['run', 'postinstall']);
    assert.deepEqual(JSON.parse(await readFile(registry, 'utf8')), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});