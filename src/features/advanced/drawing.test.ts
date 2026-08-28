import { describe, expect, it } from 'vitest';
import {
  appendDrawingPoint,
  beginDrawingStroke,
  drawingBounds,
  finishDrawingStroke,
  pressureWidth,
  simplifyPath,
  smoothPath,
} from './drawing';

const point = (x: number, y: number, pressure = 0.5) => ({ x, y, pressure, time: x });

describe('advanced drawing helpers', () => {
  it('creates immutable pressure-aware strokes and skips duplicate samples', () => {
    const started = beginDrawingStroke('stroke-1', 'brush', { x: 1, y: 2, pressure: 2 }, { width: 8, opacity: 2 });
    expect(started).toMatchObject({ id: 'stroke-1', active: true, composite: 'source-over' });
    expect(started.points[0].pressure).toBe(1);
    expect(started.style.opacity).toBe(1);
    expect(appendDrawingPoint(started, { x: 1.1, y: 2.1 }, 1)).toBe(started);
    const extended = appendDrawingPoint(started, { x: 4, y: 2, pressure: 0 });
    expect(extended.points).toHaveLength(2);
    expect(started.points).toHaveLength(1);
  });

  it('uses destination-out for eraser strokes', () => {
    expect(beginDrawingStroke('e', 'eraser', { x: 0, y: 0 }).composite).toBe('destination-out');
  });

  it('simplifies nearly straight paths while retaining corners and endpoints', () => {
    const source = [point(0, 0), point(1, 0.1), point(2, 0), point(2, 3), point(4, 3)];
    const simplified = simplifyPath(source, 0.2);
    expect(simplified[0]).toEqual(source[0]);
    expect(simplified.at(-1)).toEqual(source.at(-1));
    expect(simplified).toContainEqual(point(2, 0));
    expect(simplified.length).toBeLessThan(source.length);
    expect(simplifyPath(source, 0)).toEqual(source);
  });

  it('smooths geometry without moving endpoints and finalizes sessions', () => {
    const source = [point(0, 0), point(10, 10), point(20, 0)];
    const smoothed = smoothPath(source);
    expect(smoothed).toHaveLength(6);
    expect(smoothed[0]).toEqual(source[0]);
    expect(smoothed.at(-1)).toEqual(source.at(-1));
    const result = finishDrawingStroke({ ...beginDrawingStroke('p', 'pen', source[0]), points: source }, 0.1);
    expect(result).not.toHaveProperty('active');
    expect(result.points.length).toBeGreaterThan(2);
  });

  it('calculates pressure width and padded bounds', () => {
    expect(pressureWidth(10, 0)).toBe(2);
    expect(pressureWidth(10, 1)).toBe(10);
    expect(drawingBounds([point(2, 5), point(10, 12)], 2)).toEqual({ x: 0, y: 3, width: 12, height: 11 });
    expect(drawingBounds([])).toBeNull();
  });
});
