import { describe, expect, it } from 'vitest';
import { createArcTextPath, normalizeTextPathSettings, pointOnArcTextPath } from './curved-text';

describe('curved text path geometry', () => {
  it('normalizes defaults and clamps bend without mutating input', () => {
    const source = { enabled: true, type: 'arc' as const, bend: 150, reverse: true };
    expect(normalizeTextPathSettings(source)).toEqual({ enabled: true, type: 'arc', bend: 100, reverse: true });
    expect(source.bend).toBe(150);
    expect(normalizeTextPathSettings(undefined)).toEqual({ enabled: false, type: 'arc', bend: 35, reverse: false });
  });

  it('creates an upward circular arc for positive bend', () => {
    const path = createArcTextPath(200, 100, { bend: 50 });
    expect(path.data).toMatch(/^M 0 .* A .* 0 0 1 200 /);
    expect(path.apex.y).toBeLessThan(path.start.y);
    expect(path.radius).toBeGreaterThan(100);
    expect(pointOnArcTextPath(path, 0.5)).toMatchObject({ x: 100, y: path.apex.y });
  });

  it('creates a downward circular arc for negative bend', () => {
    const path = createArcTextPath(160, 120, { bend: -75 });
    expect(path.data).toMatch(/^M 0 .* A .* 0 0 0 160 /);
    expect(path.apex.y).toBeGreaterThan(path.start.y);
    expect(pointOnArcTextPath(path, 0.5).y).toBeCloseTo(path.apex.y);
  });

  it('reverses endpoints, sweep, and sampled direction', () => {
    const path = createArcTextPath(200, 100, { bend: 40, reverse: true });
    expect(path.start.x).toBe(200);
    expect(path.end.x).toBe(0);
    expect(path.sweep).toBe(0);
    expect(pointOnArcTextPath(path, 0)).toMatchObject({ x: 200 });
    expect(pointOnArcTextPath(path, 1)).toMatchObject({ x: 0 });
  });

  it('uses a stable straight path at zero bend and sanitizes dimensions', () => {
    const path = createArcTextPath(Number.NaN, -2, { bend: 0 });
    expect(path).toMatchObject({ width: 1, height: 1, straight: true, sagitta: 0 });
    expect(path.data).toBe('M 0 0.5 L 1 0.5');
    expect(pointOnArcTextPath(path, 0.25)).toEqual({ x: 0.25, y: 0.5, angle: 0 });
  });
});
