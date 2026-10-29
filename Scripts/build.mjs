import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

for (const [entry, name, fileName, emptyOutDir] of [
  ['src/browser.ts', 'Markian', 'markian.min.js', true],
  ['src/viewer.ts', 'MarkianViewer', 'markian-viewer.min.js', false],
  ['src/viewer-mermaid.ts', 'MarkianViewerMermaid', 'extensions/viewer-mermaid.min.js', false],
  ['src/extensions/code.ts', 'MarkianCode', 'extensions/code.min.js', false],
  ['src/extensions/mermaid.ts', 'MarkianMermaid', 'extensions/mermaid.min.js', false],
]) {
  await build({
    configFile: false,
    plugins: [{ name: 'viewer-boundary', generateBundle(_options, bundle) {
      if (!name.startsWith('MarkianViewer')) return;
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          if (/node_modules\/(?:@milkdown|@codemirror|prosemirror)|src\/(?:engines|ui|extensions)\/|src\/(?:editor|editing|types)\.ts/.test(id.replaceAll('\\', '/'))) throw new Error(`Viewer dependency boundary: ${id}`);
        }
      }
    } }],
    build: {
      emptyOutDir,
      sourcemap: false,
      target: 'es2022',
      lib: { entry, name, formats: ['iife'], fileName: () => fileName, cssFileName: name === 'MarkianMermaid' ? 'extensions/mermaid' : name === 'MarkianViewerMermaid' ? 'extensions/viewer-mermaid' : name === 'MarkianViewer' ? 'markian-viewer' : 'markian' },
    },
  });
}
await writeFile('dist/markdown-github.css', (await readFile('src/render/content.css', 'utf8')).replace(/\r\n/g, '\n'));
