import { readdir, readFile } from 'node:fs/promises';

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await check(path); continue; }
    if (!path.endsWith('.ts')) continue;
    const source = await readFile(path, 'utf8');
    const imports = Array.from(source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g), match => match[1]);
    for (const dependency of imports) {
      if (dependency.startsWith('@milkdown/') && path !== 'src/engines/visual.ts') throw new Error(`Milkdown boundary: ${path}`);
      if (path.startsWith('src/render/') && !['unified', 'remark-', 'rehype-', 'mdast', 'hast'].some(prefix => dependency.startsWith(prefix))) throw new Error(`Rendering boundary: ${path} -> ${dependency}`);
    }
    if (/\bfetch\s*\(|XMLHttpRequest|\beval\s*\(/.test(source)) throw new Error(`Forbidden transport or evaluation: ${path}`);
  }
}
await check('src');
console.log('Engine, rendering and transport boundaries passed.');