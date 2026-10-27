import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = ['Markian third-party notices', 'Dependency versions are pinned in package-lock.json.'];
for (const [path, metadata] of Object.entries(lock.packages).sort(([first], [second]) => first.localeCompare(second, 'en'))) {
  if (!path || metadata.optional) continue;
  const licenses = (await readdir(path)).filter(name => /^(license|licence|copying)(\.|$)/i.test(name)).sort();
  notices.push(`\n${path.replace(/^node_modules\//, '')} ${metadata.version} (${metadata.license ?? 'see upstream license'})`);
  for (const license of licenses) {
    try { notices.push((await readFile(`${path}/${license}`, 'utf8')).replace(/\r\n/g, '\n')); }
    catch (error) { if (error.code !== 'EISDIR') throw error; }
  }
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n') + '\n');
const assets = {};
async function collect(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((first, second) => first.name.localeCompare(second.name, 'en'))) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(path);
    else if (entry.name !== 'manifest.json') {
      const bytes = await readFile(path);
      assets[path.slice(5)] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    }
  }
}
await collect('dist');
await writeFile('dist/manifest.json', JSON.stringify({
  name: pkg.name, version: pkg.version, format: 'classic-script', sourceMaps: false,
  core: { script: 'markian.min.js', stylesheet: 'markian.css', types: 'types/index.d.ts' },
  extensions: { code: { script: 'extensions/code.min.js', global: 'MarkianCode.codeExtension', requires: pkg.version, dependencies: [] } },
  assets,
}, null, 2) + '\n');
console.log(`Manifest and notices generated for ${Object.keys(assets).length} artifacts.`);