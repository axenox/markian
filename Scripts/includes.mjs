/** Generates the Power UI bundle registry from the actual browser bundle inputs. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function writeIncludes(modules, destination = 'includes.json') {
  const packages = new Map();
  for (const moduleId of modules) {
    const normalized = moduleId.replaceAll('\\', '/');
    if (!normalized.includes('/node_modules/')) continue;
    const directory = normalized.slice(0, normalized.lastIndexOf('/node_modules/') + 14);
    const segments = normalized.slice(directory.length).split('/');
    const root = directory + segments.slice(0, segments[0].startsWith('@') ? 2 : 1).join('/');
    if (!packages.has(root)) packages.set(root, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')));
  }
  const entries = new Map();
  for (const [root, metadata] of packages) {
    const texts = [];
    for (const file of (await readdir(root, { withFileTypes: true })).sort((first, second) => first.name.localeCompare(second.name, 'en'))) {
      if (file.isFile() && /^(licen[cs]e|copying|notice)([.\-_]|$)/i.test(file.name)) {
        texts.push((await readFile(join(root, file.name), 'utf8')).replace(/\r\n/g, '\n').trim());
      }
    }
    const declarations = metadata.license ? [metadata.license] : metadata.licenses ?? [];
    const licenses = declarations.map(license => typeof license === 'string' ? license : license.type);
    const links = Object.fromEntries(declarations.filter(license => typeof license === 'object' && license.url).map(license => [license.type, license.url]));
    if (licenses.length === 0 || licenses.some(license => !license || (texts.length === 0 && !links[license]))) throw new Error(`Missing license declaration or text/link for ${metadata.name}@${metadata.version} (${relative('.', root)}). Review upstream licensing before distribution.`);
    entries.set(`${metadata.name}@${metadata.version}`, {
      name: `npm-asset/${metadata.name.replace(/^@/, '').replace('/', '--')}`,
      version: metadata.version,
      license: licenses,
      ...(texts.length ? { license_text: Object.fromEntries(licenses.map(license => [license, texts.join('\n\n')])) } : { license_link: links }),
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.homepage ? { homepage: metadata.homepage } : {}),
    });
  }
  const sorted = [...entries.values()].sort((first, second) => first.name.localeCompare(second.name, 'en') || first.version.localeCompare(second.version, 'en'));
  await writeFile(destination, JSON.stringify(sorted, null, 4) + '\n');
  console.log(`${destination} generated for ${sorted.length} bundled third-party packages.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { buildBundles } = await import('./build.mjs');
  await writeIncludes(await buildBundles(false));
}