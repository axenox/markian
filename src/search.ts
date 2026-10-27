import type { SearchMatch, SearchOptions } from './types';

export function findMatches(text: string, options: SearchOptions, offset = 0): SearchMatch[] {
  if (!options.query) return [];
  const expression = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(expression, options.caseSensitive ? 'gu' : 'giu');
  const word = /[\p{L}\p{N}_]/u;
  return Array.from(text.matchAll(pattern)).filter(match => !options.wholeWord
    || (!word.test(text[match.index! - 1] ?? '') && !word.test(text[match.index! + match[0].length] ?? '')))
    .map(match => ({ from: offset + match.index!, to: offset + match.index! + match[0].length }));
}