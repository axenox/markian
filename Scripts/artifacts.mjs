import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const sizes = {};
for (const path of ['markian.min.js', 'markian.css', 'markdown-github.css', 'markian-viewer.min.js', 'markian-viewer.css', 'extensions/viewer-mermaid.min.js', 'extensions/viewer-mermaid.css', 'extensions/mermaid.min.js', 'extensions/mermaid.css']) {
  const bytes = await readFile(`dist/${path}`);
  sizes[path] = { bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes).length };
}
const total = paths => Object.fromEntries(['bytes', 'gzip', 'brotli'].map(key => [key, paths.reduce((sum, path) => sum + sizes[path][key], 0)]));
const editor = total(['markian.min.js', 'markian.css', 'markdown-github.css']);
const viewer = total(['markian-viewer.min.js', 'markian-viewer.css']);
const combined = Object.fromEntries(['bytes', 'gzip', 'brotli'].map(key => [key, editor[key] + viewer[key]]));
const budget = { javascript: { bytes: 250000, gzip: 80000, brotli: 70000 }, css: { bytes: 6000, gzip: 1800, brotli: 1600 }, maximumEditorRatio: 0.35 };
for (const key of ['bytes', 'gzip', 'brotli']) {
  if (sizes['markian-viewer.min.js'][key] > budget.javascript[key] || sizes['markian-viewer.css'][key] > budget.css[key] || viewer[key] / editor[key] > budget.maximumEditorRatio) throw new Error(`Viewer size budget exceeded for ${key}. Inspect the rendering dependency boundary.`);
}
const mermaid = await readFile('node_modules/mermaid/dist/mermaid.min.js');
await writeFile('dist/sizes.json', JSON.stringify({
  compression: 'Independent resources; gzip level 9, Brotli default quality 11. Bytes, not KiB. No editor or viewer optional features enabled in baseline totals.',
  assets: sizes, totals: { editor, viewer, combined }, budget,
  optionalDependencies: [{ name: 'mermaid', version: pkg.devDependencies.mermaid, external: true, bytes: mermaid.length, gzip: gzipSync(mermaid, { level: 9 }).length, brotli: brotliCompressSync(mermaid).length }],
}, null, 2) + '\n');
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
  core: { script: 'markian.min.js', stylesheet: 'markian.css', contentStylesheet: 'markdown-github.css', types: 'types/index.d.ts' },
  viewer: { script: 'markian-viewer.min.js', stylesheet: 'markian-viewer.css', types: 'types/viewer.d.ts', global: 'MarkianViewer', dependencies: [], measurements: 'sizes.json' },
  extensions: {
    code: { script: 'extensions/code.min.js', global: 'MarkianCode.codeExtension', requires: pkg.version, dependencies: [] },
    mermaid: { script: 'extensions/mermaid.min.js', stylesheet: 'extensions/mermaid.css', types: 'types/extensions/mermaid.d.ts', global: 'MarkianMermaid.mermaidExtension', requires: pkg.version,
      dependencies: [{ name: 'mermaid', testedVersion: pkg.devDependencies.mermaid, requiredApi: ['initialize', 'render'], external: true, loading: 'host-configured source URL or supplied renderer adapter' }] },
    viewerMermaid: { script: 'extensions/viewer-mermaid.min.js', stylesheet: 'extensions/viewer-mermaid.css', types: 'types/viewer-mermaid.d.ts', global: 'MarkianViewerMermaid.createRenderer', requires: pkg.version,
      dependencies: [{ name: 'mermaid', testedVersion: pkg.devDependencies.mermaid, requiredApi: ['initialize', 'render'], external: true, loading: 'Explicit mermaid:true plus a matching fence and host-configured source URL or supplied renderer' }] },
  },
  assets,
}, null, 2) + '\n');
console.log(`Manifest generated for ${Object.keys(assets).length} artifacts; bundled licenses are in includes.json.`);
console.log(`Viewer/editor JS+CSS gzip: ${viewer.gzip}/${editor.gzip} bytes (${(100 * viewer.gzip / editor.gzip).toFixed(1)}%). Size budgets passed.`);