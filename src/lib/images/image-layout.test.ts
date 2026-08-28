import { describe, expect, it } from 'vitest';
import { fitImageToPage } from './image-layout';

describe('orientation-aware image placement', () => {
  it.each([
    ['landscape', { width: 6000, height: 3000 }, { width: 907.2, height: 453.6 }],
    ['portrait', { width: 3000, height: 6000 }, { width: 453.6, height: 907.2 }],
    ['square', { width: 4096, height: 4096 }, { width: 907.2, height: 907.2 }],
  ] as const)('preserves a %s image ratio inside a square page', (orientation, source, expected) => {
    const placement = fitImageToPage(source, { width: 1080, height: 1080 });
    expect(placement).toMatchObject({ orientation, ...expected });
    expect(placement.x).toBeGreaterThanOrEqual(0);
    expect(placement.y).toBeGreaterThanOrEqual(0);
    expect(placement.x + placement.width).toBeLessThanOrEqual(1080);
    expect(placement.y + placement.height).toBeLessThanOrEqual(1080);
  });

  it('fits landscape media inside a portrait page', () => {
    const placement = fitImageToPage({ width: 3840, height: 2160 }, { width: 1080, height: 1920 });
    expect(placement.orientation).toBe('landscape');
    expect(placement.width / placement.height).toBeCloseTo(16 / 9);
    expect(placement.width).toBeLessThanOrEqual(1080);
    expect(placement.height).toBeLessThanOrEqual(1920);
  });

  it('fits portrait media inside a landscape page', () => {
    const placement = fitImageToPage({ width: 1080, height: 1920 }, { width: 1920, height: 1080 });
    expect(placement.orientation).toBe('portrait');
    expect(placement.width / placement.height).toBeCloseTo(9 / 16);
  });

  it('keeps extreme panoramas selectable and on-page', () => {
    const wide = fitImageToPage({ width: 100_000, height: 1 }, { width: 1080, height: 1080 });
    const tall = fitImageToPage({ width: 1, height: 100_000 }, { width: 1080, height: 1080 });
    expect(wide).toMatchObject({ width: 907.2, height: 24, orientation: 'landscape' });
    expect(tall).toMatchObject({ width: 24, height: 907.2, orientation: 'portrait' });
  });

  it('uses safe defaults for corrupt metadata and staggers batches within bounds', () => {
    const first = fitImageToPage({ width: 0, height: Number.NaN }, { width: 800, height: 600 });
    const later = fitImageToPage({ width: 0, height: Number.NaN }, { width: 800, height: 600 }, { cascadeIndex: 4 });
    expect(first.orientation).toBe('square');
    expect(later.x).toBeGreaterThan(first.x);
    expect(later.x + later.width).toBeLessThanOrEqual(800);
  });
});
