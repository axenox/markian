import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Shares bundle inputs with license generation without writing assets during npm hooks. */
export async function buildBundles(write = true) {
  const modules = new Set();
  const languages = ['javascript', 'typescript', 'json', 'css', 'html', 'php', 'sql', 'python', 'yaml'];
  for (const [entry, name, fileName, emptyOutDir] of [
    ['src/browser.ts', 'Markian', 'markian.min.js', true],
    ['src/viewer.ts', 'MarkianViewer', 'markian-viewer.min.js', false],
    ['src/viewer-mermaid.ts', 'MarkianViewerMermaid', 'extensions/viewer-mermaid.min.js', false],
    ['src/extensions/code.ts', 'MarkianCode', 'extensions/code.min.js', false],
    ['src/extensions/mermaid.ts', 'MarkianMermaid', 'extensions/mermaid.min.js', false],
    ...languages.map(language => [`code-language:${language}`, `MarkianCodeLanguage_${language}`, `extensions/languages/${language}.min.js`, false]),
  ]) {
    await build({
      configFile: false,
      plugins: [{ name: 'language-entry', resolveId(id) { if (id.includes('code-language:')) return '\0' + id.slice(id.indexOf('code-language:')); }, load(id) {
        if (!id.startsWith('\0code-language:')) return;
        const language = id.slice('\0code-language:'.length);
        const grammar = language === 'html' ? 'xml' : language;
        return `import grammar from 'highlight.js/lib/languages/${grammar}'; import { createHighlighter } from ${JSON.stringify(resolve('src/extensions/code-language.ts'))}; export const highlighter = createHighlighter(${JSON.stringify(language)}, grammar);`;
      } }, { name: 'bundle-inputs', generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          for (const id of Object.keys(output.modules)) {
            modules.add(id);
            if (name.startsWith('MarkianCodeLanguage_') && /node_modules\/(?:@codemirror|@milkdown|prosemirror)/.test(id.replaceAll('\\', '/'))) throw new Error(`Code language engine boundary: ${id}`);
            if (!name.startsWith('MarkianViewer')) continue;
            if (/node_modules\/(?:@milkdown|@codemirror|prosemirror)|src\/(?:engines|ui|extensions)\/|src\/(?:editor|editing|types)\.ts/.test(id.replaceAll('\\', '/'))) throw new Error(`Viewer dependency boundary: ${id}`);
          }
        }
      } }],
      build: {
        write,
        emptyOutDir,
        sourcemap: false,
        target: 'es2022',
        lib: { entry, name, formats: ['iife'], fileName: () => fileName, cssFileName: name === 'MarkianCode' ? 'extensions/code' : name === 'MarkianMermaid' ? 'extensions/mermaid' : name === 'MarkianViewerMermaid' ? 'extensions/viewer-mermaid' : name === 'MarkianViewer' ? 'markian-viewer' : 'markian' },
      },
    });
  }
  return modules;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const modules = await buildBundles();
  await writeFile('dist/markdown-github.css', (await readFile('src/render/content.css', 'utf8')).replace(/\r\n/g, '\n'));
  const { writeIncludes } = await import('./includes.mjs');
  await writeIncludes(modules);
}
