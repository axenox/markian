import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Translations } from '../src/translations';

test('translation assets merge in configured order, with English and naked-key fallback', async () => {
  const input = { 'TOOLBAR.ITALIC': 'Custom italic' };
  const translations = new Translations(['/first.json', '/second.json', input]);
  input['TOOLBAR.ITALIC'] = 'Changed after construction';
  const requests: string[] = [];
  const fetchAsset: typeof fetch = async (url, options) => {
    requests.push(String(url));
    assert.equal(options?.credentials, 'omit');
    if (String(url).endsWith('first.json')) {
      await new Promise(resolve => setTimeout(resolve, 20));
      return Response.json({ 'TOOLBAR.BOLD': 'First', 'EXAMPLE.EMPTY': '' });
    }
    return Response.json({ 'TOOLBAR.BOLD': 'Last', 'EXAMPLE.COUNT': '{count} for {name}' });
  };
  await translations.load('https://example.test/assets/', new AbortController().signal, fetchAsset);
  assert.deepEqual(requests, ['https://example.test/first.json', 'https://example.test/second.json']);
  assert.equal(translations.translate('TOOLBAR.BOLD'), 'Last');
  assert.equal(translations.translate('TOOLBAR.ITALIC'), 'Custom italic');
  assert.equal(translations.translate('TOOLBAR.COPY'), 'Copy Markdown');
  assert.equal(translations.translate('EXAMPLE.MISSING'), 'EXAMPLE.MISSING');
  assert.equal(translations.translate('EXAMPLE.EMPTY'), '');
  assert.equal(translations.translate('EXAMPLE.COUNT', { count: 2, name: '$& <b>' }), '2 for $& <b>');
  assert.equal(translations.translate('EXAMPLE.COUNT', { count: 0 }), '0 for {name}');
});

test('extension English defaults stay below host overrides and are independently disposable', async () => {
  const first = new Translations([{ 'EXAMPLE.ACTION': 'Aktion' }]);
  const second = new Translations();
  await first.load('https://example.test/', new AbortController().signal);
  const defaults = { 'EXAMPLE.ACTION': 'Action', 'EXAMPLE.OTHER': 'Other' };
  const remove = first.register(defaults);
  second.register(defaults);
  assert.equal(first.translate('EXAMPLE.ACTION'), 'Aktion');
  assert.equal(first.translate('EXAMPLE.OTHER'), 'Other');
  assert.equal(second.translate('EXAMPLE.ACTION'), 'Action');
  assert.throws(() => first.register({ 'EXAMPLE.OTHER': 'Collision' }), /Duplicate/);
  assert.throws(() => first.register({ 'TOOLBAR.BOLD': 'Collision' }), /Duplicate/);
  remove();
  remove();
  assert.equal(first.translate('EXAMPLE.ACTION'), 'Aktion');
  assert.equal(first.translate('EXAMPLE.OTHER'), 'EXAMPLE.OTHER');
  assert.equal(second.translate('EXAMPLE.OTHER'), 'Other');
});

test('malformed translation data and failed assets reject instead of returning success', async () => {
  for (const value of [[], null, { 'toolbar.bold': 'Bold' }, { 'TOOLBAR.BOLD': {} }, { BOLD: 'Bold' }]) {
    assert.throws(() => new Translations([value as never]), /Translations|translation/);
  }
  const translations = new Translations([{ 'TOOLBAR.BOLD': 'Partial' }, 'bad.json']);
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response('not json'),
    Response.json({ 'TOOLBAR.BOLD': { nested: true } }),
  ]) {
    await assert.rejects(translations.load('https://example.test/', new AbortController().signal, async () => response), /translation asset/);
    assert.equal(translations.translate('TOOLBAR.BOLD'), 'Bold');
  }
  await assert.rejects(new Translations(['javascript:alert(1)']).load('https://example.test/', new AbortController().signal), /HTTP/);
  await assert.rejects(translations.load('https://example.test/', new AbortController().signal, async () => {
    throw new Error('Network unavailable');
  }), /Could not load translation asset: https:\/\/example.test\/bad.json/);
});

test('cancelled translation loads cannot install late results', async () => {
  const translations = new Translations(['late.json']);
  const controller = new AbortController();
  const pending = translations.load('https://example.test/', controller.signal, async () => {
    controller.abort();
    return Response.json({ 'TOOLBAR.BOLD': 'Late' });
  });
  await assert.rejects(pending, /abort/i);
  assert.equal(translations.translate('TOOLBAR.BOLD'), 'Bold');
});
