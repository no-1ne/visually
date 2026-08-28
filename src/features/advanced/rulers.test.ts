import { describe, expect, it } from 'vitest';
import {
  clampGuidePosition, convertUnit, expandRect, formatUnit, generateRulerTicks, guideKeyboardAction,
  guidePositionFromClient, insetRect, layoutGuides, orientPageDimensions, pageOrientation,
  pointerInsideGuideDropZone, unitToPixels,
} from './rulers';

describe('rulers, units, and print guides', () => {
  it('converts physical units using configurable DPI', () => {
    expect(convertUnit(96, 'px', 'in')).toBe(1);
    expect(convertUnit(1, 'in', 'mm')).toBe(25.4);
    expect(unitToPixels(1, 'in', 300)).toBe(300);
    expect(formatUnit(2.3456, 'cm', 2)).toBe('2.35 cm');
  });

  it('insets and expands page rectangles safely', () => {
    const page = { x: 10, y: 20, width: 100, height: 50 };
    expect(insetRect(page, 5)).toEqual({ x: 15, y: 25, width: 90, height: 40 });
    expect(insetRect(page, 100).width).toBe(0);
    expect(expandRect(page, 3)).toEqual({ x: 7, y: 17, width: 106, height: 56 });
  });

  it('generates bleed, safe-area, and center guides', () => {
    const guides = layoutGuides({ x: 0, y: 0, width: 100, height: 80 }, 3, 5);
    expect(guides).toHaveLength(10);
    expect(guides).toContainEqual({ axis: 'x', position: -3, kind: 'bleed' });
    expect(guides).toContainEqual({ axis: 'y', position: 40, kind: 'center' });
  });

  it('produces bounded adaptive ruler ticks with major labels', () => {
    const ticks = generateRulerTicks(0, 500, 1, 'px');
    expect(ticks.length).toBeGreaterThan(10);
    expect(ticks.some((tick) => tick.major && tick.label === '0')).toBe(true);
    expect(ticks.every((tick) => tick.position >= 0 && tick.position <= 500)).toBe(true);
  });

  it('converts pointer positions into zoom-independent clamped guide coordinates', () => {
    const bounds = { x: 100, y: 50, width: 400, height: 200 };
    expect(guidePositionFromClient('x', { clientX: 300, clientY: 70 }, bounds, 2)).toBe(100);
    expect(guidePositionFromClient('y', { clientX: 300, clientY: 150 }, bounds, 2)).toBe(50);
    expect(guidePositionFromClient('x', { clientX: 999, clientY: 70 }, bounds, 2)).toBe(200);
    expect(clampGuidePosition(Number.NaN, 100)).toBe(0);
  });

  it('recognizes the perpendicular page drop zone for guide removal', () => {
    const bounds = { x: 100, y: 50, width: 400, height: 200 };
    expect(pointerInsideGuideDropZone('x', { clientX: 300, clientY: 100 }, bounds)).toBe(true);
    expect(pointerInsideGuideDropZone('x', { clientX: 300, clientY: 20 }, bounds)).toBe(false);
    expect(pointerInsideGuideDropZone('y', { clientX: 80, clientY: 100 }, bounds)).toBe(false);
  });

  it('maps accessible keyboard controls to precise and accelerated movement', () => {
    expect(guideKeyboardAction(40, 'x', 'ArrowRight', 100)).toEqual({ kind: 'move', position: 41 });
    expect(guideKeyboardAction(40, 'x', 'ArrowLeft', 100, true)).toEqual({ kind: 'move', position: 30 });
    expect(guideKeyboardAction(40, 'y', 'ArrowRight', 100)).toEqual({ kind: 'none' });
    expect(guideKeyboardAction(40, 'y', 'End', 100)).toEqual({ kind: 'move', position: 100 });
    expect(guideKeyboardAction(40, 'y', 'Delete', 100)).toEqual({ kind: 'remove' });
  });

  it('reports and changes page orientation without changing its dimensions', () => {
    expect(pageOrientation(1200, 800)).toBe('landscape');
    expect(pageOrientation(800, 1200)).toBe('portrait');
    expect(orientPageDimensions(800, 1200, 'landscape')).toEqual({ width: 1200, height: 800 });
    expect(orientPageDimensions(800, 1200, 'portrait')).toEqual({ width: 800, height: 1200 });
  });
});
