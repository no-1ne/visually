export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step-start' | 'step-end';
export type AnimatableValue = number | string | number[] | { [key: string]: AnimatableValue };

export interface Keyframe<T extends AnimatableValue = AnimatableValue> {
  time: number;
  value: T;
  easing?: EasingName | readonly [number, number, number, number];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function easingValue(easing: Keyframe['easing'], progress: number): number {
  const amount = clamp01(progress);
  switch (easing) {
    case 'ease-in': return amount * amount;
    case 'ease-out': return 1 - (1 - amount) ** 2;
    case 'ease-in-out': return amount < 0.5 ? 2 * amount * amount : 1 - ((-2 * amount + 2) ** 2) / 2;
    case 'step-start': return amount === 0 ? 0 : 1;
    case 'step-end': return amount < 1 ? 0 : 1;
    case 'linear':
    case undefined: return amount;
    default: return cubicBezierY(easing, amount);
  }
}

function cubicBezierY(curve: readonly [number, number, number, number], progress: number): number {
  const [x1, y1, x2, y2] = curve;
  let guess = progress;
  for (let index = 0; index < 6; index += 1) {
    const x = bezier(guess, x1, x2);
    const derivative = bezierDerivative(guess, x1, x2);
    if (Math.abs(derivative) < 1e-6) break;
    guess = clamp01(guess - (x - progress) / derivative);
  }
  return clamp01(bezier(guess, y1, y2));
}

const bezier = (time: number, first: number, second: number) =>
  3 * (1 - time) ** 2 * time * first + 3 * (1 - time) * time ** 2 * second + time ** 3;
const bezierDerivative = (time: number, first: number, second: number) =>
  3 * (1 - time) ** 2 * first + 6 * (1 - time) * time * (second - first) + 3 * time ** 2 * (1 - second);

function parseHexColor(value: string): [number, number, number, number] | null {
  const match = /^#([\da-f]{3,8})$/i.exec(value);
  if (!match) return null;
  const text = match[1];
  const expanded = text.length === 3 || text.length === 4 ? [...text].map((character) => character.repeat(2)).join('') : text;
  if (expanded.length !== 6 && expanded.length !== 8) return null;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255,
  ];
}

const byteHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

export function interpolateValue<T extends AnimatableValue>(start: T, end: T, progress: number): T {
  const amount = clamp01(progress);
  if (typeof start === 'number' && typeof end === 'number') return (start + (end - start) * amount) as T;
  if (typeof start === 'string' && typeof end === 'string') {
    const firstColor = parseHexColor(start);
    const secondColor = parseHexColor(end);
    if (firstColor && secondColor) {
      const values = firstColor.map((value, index) => value + (secondColor[index] - value) * amount);
      const alpha = firstColor[3] < 255 || secondColor[3] < 255 ? byteHex(values[3]) : '';
      return (`#${byteHex(values[0])}${byteHex(values[1])}${byteHex(values[2])}${alpha}`) as T;
    }
    return (amount < 1 ? start : end) as T;
  }
  if (Array.isArray(start) && Array.isArray(end) && start.length === end.length) {
    return start.map((value, index) => value + (end[index] - value) * amount) as T;
  }
  if (isValueRecord(start) && isValueRecord(end)) {
    const result: Record<string, AnimatableValue> = { ...start };
    for (const key of Object.keys(end)) {
      if (key in start) result[key] = interpolateValue(start[key], end[key], amount);
      else if (amount === 1) result[key] = end[key];
    }
    return result as T;
  }
  return (amount < 1 ? start : end) as T;
}

function isValueRecord(value: AnimatableValue): value is { [key: string]: AnimatableValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function evaluateKeyframes<T extends AnimatableValue>(keyframes: readonly Keyframe<T>[], time: number): T | undefined {
  if (keyframes.length === 0) return undefined;
  const ordered = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= ordered[0].time) return ordered[0].value;
  if (time >= ordered.at(-1)!.time) return ordered.at(-1)!.value;
  const endIndex = ordered.findIndex((keyframe) => keyframe.time >= time);
  const start = ordered[endIndex - 1];
  const end = ordered[endIndex];
  const duration = Math.max(Number.EPSILON, end.time - start.time);
  const progress = easingValue(start.easing, (time - start.time) / duration);
  return interpolateValue(start.value, end.value, progress);
}

export function upsertKeyframe<T extends AnimatableValue>(
  keyframes: readonly Keyframe<T>[],
  keyframe: Keyframe<T>,
  epsilon = 1e-6,
): Keyframe<T>[] {
  const next = keyframes.filter((item) => Math.abs(item.time - keyframe.time) > epsilon);
  next.push({ ...keyframe, time: Math.max(0, keyframe.time) });
  return next.sort((a, b) => a.time - b.time);
}

export function moveKeyframe<T extends AnimatableValue>(keyframes: readonly Keyframe<T>[], index: number, time: number): Keyframe<T>[] {
  if (!keyframes[index]) return [...keyframes];
  return keyframes.map((item, itemIndex) => itemIndex === index ? { ...item, time: Math.max(0, time) } : item)
    .sort((a, b) => a.time - b.time);
}
