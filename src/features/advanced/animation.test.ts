import { describe, expect, it } from 'vitest';
import { easingValue, evaluateKeyframes, interpolateValue, moveKeyframe, upsertKeyframe } from './animation';

describe('animation interpolation', () => {
  it('interpolates numbers, arrays, nested records, and hex colors', () => {
    expect(interpolateValue(0, 10, 0.25)).toBe(2.5);
    expect(interpolateValue([0, 10], [10, 20], 0.5)).toEqual([5, 15]);
    expect(interpolateValue({ x: 0, scale: [1, 1] }, { x: 10, scale: [2, 3] }, 0.5)).toEqual({ x: 5, scale: [1.5, 2] });
    expect(interpolateValue('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(interpolateValue('#0000', '#ffff', 0.5)).toBe('#80808080');
    expect(interpolateValue('hidden', 'visible', 0.5)).toBe('hidden');
  });

  it('evaluates easing curves and bounded keyframe tracks', () => {
    expect(easingValue('ease-in', 0.5)).toBe(0.25);
    expect(easingValue('ease-out', 0.5)).toBe(0.75);
    expect(easingValue([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 3);
    const frames = [{ time: 0, value: 0, easing: 'ease-in' as const }, { time: 2, value: 8 }];
    expect(evaluateKeyframes(frames, -1)).toBe(0);
    expect(evaluateKeyframes(frames, 1)).toBe(2);
    expect(evaluateKeyframes(frames, 3)).toBe(8);
    expect(evaluateKeyframes([], 1)).toBeUndefined();
  });

  it('upserts and moves keyframes without mutating the source', () => {
    const source = [{ time: 0, value: 1 }, { time: 2, value: 3 }];
    expect(upsertKeyframe(source, { time: 2, value: 9 })).toEqual([{ time: 0, value: 1 }, { time: 2, value: 9 }]);
    expect(moveKeyframe(source, 0, 4).map((item) => item.time)).toEqual([2, 4]);
    expect(source[0].time).toBe(0);
  });
});
