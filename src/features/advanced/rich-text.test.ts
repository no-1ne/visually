import { describe, expect, it } from 'vitest';
import { replaceTextKeepingRuns, styleTextRange } from './rich-text';

describe('rich text ranges', () => {
  it('splits a plain run around a styled character range', () => {
    expect(styleTextRange('Visually', undefined, 2, 6, { fontWeight: 700 })).toEqual([
      { text: 'Vi' },
      { text: 'sual', fontWeight: 700 },
      { text: 'ly' },
    ]);
  });

  it('supports reversed and clamped selections while preserving existing styles', () => {
    const runs = [{ text: 'Hello', fill: '#ff0000' }, { text: ' world', fontStyle: 'italic' as const }];
    const result = styleTextRange('Hello world', runs, 999, 6, { underline: true });
    expect(result).toEqual([
      { text: 'Hello', fill: '#ff0000' },
      { text: ' ', fontStyle: 'italic' },
      { text: 'world', fontStyle: 'italic', underline: true },
    ]);
  });

  it('compacts adjacent ranges with equivalent style', () => {
    const result = styleTextRange('abc', [{ text: 'a', fontWeight: 700 }, { text: 'bc', fontWeight: 700 }], 0, 3, { fill: '#111111' });
    expect(result).toEqual([{ text: 'abc', fontWeight: 700, fill: '#111111' }]);
  });

  it('keeps prefix and suffix formatting through insertions and deletions', () => {
    const runs = [{ text: 'Hello', fontWeight: 700 }, { text: ' world', fontStyle: 'italic' as const }];
    expect(replaceTextKeepingRuns('Hello world', runs, 'Hello brave world')).toEqual([
      { text: 'Hello', fontWeight: 700 },
      { text: ' brave world', fontStyle: 'italic' },
    ]);
    expect(replaceTextKeepingRuns('Hello world', runs, 'Hi world')).toEqual([
      { text: 'Hi', fontWeight: 700 },
      { text: ' world', fontStyle: 'italic' },
    ]);
  });

  it('handles empty text and no-op edits', () => {
    expect(styleTextRange('', [], 0, 1, { underline: true })).toEqual([]);
    expect(replaceTextKeepingRuns('ab', [{ text: 'ab', strikeThrough: true }], 'ab')).toEqual([{ text: 'ab', strikeThrough: true }]);
  });
});
