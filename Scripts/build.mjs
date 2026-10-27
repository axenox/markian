import { build } from 'vite';

for (const [entry, name, fileName, emptyOutDir] of [
  ['src/browser.ts', 'Markian', 'markian.min.js', true],
  ['src/extensions/code.ts', 'MarkianCode', 'extensions/code.min.js', false],
  ['src/extensions/mermaid.ts', 'MarkianMermaid', 'extensions/mermaid.min.js', false],
]) {
  await build({
    configFile: false,
    build: {
      emptyOutDir,
      sourcemap: false,
      target: 'es2022',
      lib: { entry, name, formats: ['iife'], fileName: () => fileName, cssFileName: name === 'MarkianMermaid' ? 'extensions/mermaid' : 'markian' },
    },
  });
}
