import { describe, expect, it, vi } from 'vitest';
import { assetUrl, createObjectKey, isSafeObjectKey, parsePositiveInteger, safeFilename, validateUpload } from '../src/policy';

describe('upload policy', () => {
  it('accepts supported media within the configured limit', () => {
    expect(validateUpload({ filename: 'photo.png', contentType: 'image/png', size: 42 }, 100)).toEqual({ filename: 'photo.png', contentType: 'image/png', size: 42 });
  });

  it.each([
    [null, 'Expected a JSON'],
    [{ filename: '', contentType: 'image/png', size: 2 }, 'Filename'],
    [{ filename: 'x.exe', contentType: 'application/octet-stream', size: 2 }, 'not allowed'],
    [{ filename: 'x.png', contentType: 'image/png', size: 0 }, 'positive integer'],
    [{ filename: 'x.png', contentType: 'image/png', size: 101 }, 'exceeds'],
  ])('rejects invalid input %#', (input, message) => {
    expect(() => validateUpload(input, 100)).toThrow(message as string);
  });

  it('normalizes hostile filenames and produces tenant-safe keys', () => {
    expect(safeFilename('../../ cat 🐈.png')).toBe('cat-.png');
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-id' });
    expect(createObjectKey('my art.png', new Date('2026-08-26T00:00:00Z'))).toBe('uploads/2026/08/fixed-id-my-art.png');
    vi.unstubAllGlobals();
  });

  it('validates downloadable keys and encodes public URLs', () => {
    expect(isSafeObjectKey('uploads/2026/08/file name.png')).toBe(true);
    expect(isSafeObjectKey('uploads/../secret')).toBe(false);
    expect(isSafeObjectKey('other/file.png')).toBe(false);
    expect(assetUrl('https://assets.example.com/', 'uploads/file name.png')).toBe('https://assets.example.com/uploads/file%20name.png');
    expect(assetUrl(undefined, 'uploads/a')).toBeNull();
  });

  it('bounds numeric configuration', () => {
    expect(parsePositiveInteger('20', 5, 10)).toBe(10);
    expect(parsePositiveInteger('bad', 5)).toBe(5);
    expect(parsePositiveInteger('-2', 5)).toBe(5);
  });
});
