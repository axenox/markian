import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMermaid, mermaidApi } from '../src/render/mermaid-runtime';

test('Mermaid accepts the required API without a version declaration', () => {
  const api = { initialize() {}, async render() { return { svg: '<svg/>' }; } };
  assert.equal(mermaidApi(api), api);
  assert.equal(mermaidApi({ ...api, version: 'unknown-host-release' }).render, api.render);
});

test('Mermaid rejects absent and noncallable required methods', () => {
  for (const value of [undefined, null, {}, { initialize() {} }, { render() {} }, { initialize: true, render() {} }, { initialize() {}, render: 'render' }]) {
    assert.throws(() => mermaidApi(value), /initialize\(\) and render\(\)/);
  }
});

test('Mermaid requires a source string and never accepts the old asset object', async () => {
  await assert.rejects(loadMermaid({} as Document, ''), /config.source/);
  await assert.rejects(loadMermaid({} as Document, { url: '/mermaid.js', version: '12.2.0' } as unknown as string), /config.source/);
});