/** Instance-local UI dictionaries and static JSON assets; see ../Docs/Configuration.md#translations. */
import english from '../Translations/en.json';
import type { Disposer, TranslationDictionary, TranslationParameters, TranslationSource } from './types';

const keyPattern = /^[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)+$/;
const maximumCharacters = 1_000_000;

function dictionary(value: unknown): TranslationDictionary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Translations must be a flat JSON object.');
  const entries = Object.entries(value);
  if (entries.length > 10000) throw new TypeError('Translations must contain at most 10000 entries.');
  let size = 0;
  for (const [key, text] of entries) {
    if (!keyPattern.test(key) || typeof text !== 'string') throw new TypeError(`Invalid translation entry: ${key}. Use uppercase dotted keys and string values.`);
    size += key.length + text.length;
  }
  if (size > maximumCharacters) throw new TypeError('Translations exceed the 1000000 character limit.');
  return Object.fromEntries(entries);
}

export class Translations {
  private base = new Map(Object.entries(dictionary(english)));
  private overrides = new Map<string, string>();
  private extensions = new Map<string, string>();
  readonly sources: readonly TranslationSource[];

  constructor(sources: readonly TranslationSource[] = []) {
    if (!Array.isArray(sources) || sources.length > 32) throw new TypeError('translations must be an array of at most 32 URLs or dictionaries.');
    this.sources = sources.map(source => {
      if (typeof source !== 'string') return dictionary(source);
      if (!source.trim()) throw new TypeError('Translation URLs must not be empty.');
      return source;
    });
  }

  /** Fetch only configured static assets, with no credentials or application transport settings. */
  async load(baseURI: string, signal: AbortSignal, fetchAsset: typeof fetch = fetch): Promise<void> {
    const request = new AbortController();
    const cancel = () => request.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const timeout = setTimeout(() => request.abort(new Error('Translation asset loading timed out.')), 15000);
    try {
      const loaded = await Promise.all(this.sources.map(async source => {
        if (typeof source !== 'string') return source;
        const url = new URL(source, baseURI);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new TypeError('Translation assets require an HTTP(S) URL without credentials.');
        const response = await fetchAsset(url.href, { signal: request.signal, credentials: 'omit' }).catch(error => {
          request.signal.throwIfAborted();
          throw new Error(`Could not load translation asset: ${url.href}`, { cause: error });
        });
        if (!response.ok) throw new Error(`Could not load translation asset: ${url.href} (HTTP ${response.status}).`);
        const text = await response.text();
        if (text.length > maximumCharacters) throw new TypeError(`Translation asset exceeds the character limit: ${url.href}`);
        try { return dictionary(JSON.parse(text)); }
        catch (error) { throw new Error(`Invalid translation asset: ${url.href}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
      }));
      request.signal.throwIfAborted();
      for (const entries of loaded) for (const [key, text] of Object.entries(entries)) this.overrides.set(key, text);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      request.abort();
    }
  }

  /** Extension English defaults fill gaps below host overrides; collisions are errors. */
  register(defaults: TranslationDictionary): Disposer {
    const entries = Object.entries(dictionary(defaults));
    for (const [key] of entries) if (this.base.has(key) || this.extensions.has(key)) throw new Error(`Duplicate translation default: ${key}`);
    for (const [key, text] of entries) this.extensions.set(key, text);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      for (const [key] of entries) this.extensions.delete(key);
    };
  }

  translate(key: string, parameters: TranslationParameters = {}): string {
    if (!keyPattern.test(key)) throw new TypeError(`Invalid translation key: ${key}`);
    const text = this.overrides.get(key) ?? this.extensions.get(key) ?? this.base.get(key) ?? key;
    return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, name: string) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : token);
  }

  label(value: string): string { return keyPattern.test(value) ? this.translate(value) : value; }
}
