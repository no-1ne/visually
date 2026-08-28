import type { TextPathSettings } from '@/types';

export interface ArcTextPathGeometry {
  data: string;
  width: number;
  height: number;
  bend: number;
  sagitta: number;
  radius: number;
  center: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
  apex: { x: number; y: number };
  sweep: 0 | 1;
  reversed: boolean;
  straight: boolean;
}

export interface ArcPathPoint {
  x: number;
  y: number;
  angle: number;
}

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const number = (value: number) => String(Math.round(value * 1000) / 1000);

export function normalizeTextPathSettings(settings: TextPathSettings | undefined): TextPathSettings {
  return {
    enabled: settings?.enabled ?? false,
    type: 'arc',
    bend: clamp(finite(settings?.bend ?? 35, 35), -100, 100),
    reverse: settings?.reverse ?? false,
  };
}

/**
 * Builds a circular SVG arc constrained to the element box. Positive bend arches
 * upward and negative bend bows downward. A zero bend produces a straight path.
 */
export function createArcTextPath(
  width: number,
  height: number,
  settings: Pick<TextPathSettings, 'bend' | 'reverse'>,
): ArcTextPathGeometry {
  const safeWidth = Math.max(1, finite(width, 1));
  const safeHeight = Math.max(1, finite(height, 1));
  const bend = clamp(finite(settings.bend), -100, 100);
  const reversed = settings.reverse ?? false;
  const direction = bend < 0 ? -1 : 1;
  const maximumSagitta = Math.max(0.001, Math.min(safeHeight * 0.45, safeWidth * 0.45));
  const sagitta = Math.abs(bend) / 100 * maximumSagitta;
  const middleY = safeHeight / 2;

  if (sagitta < 0.001) {
    const start = { x: reversed ? safeWidth : 0, y: middleY };
    const end = { x: reversed ? 0 : safeWidth, y: middleY };
    return {
      data: `M ${number(start.x)} ${number(start.y)} L ${number(end.x)} ${number(end.y)}`,
      width: safeWidth,
      height: safeHeight,
      bend,
      sagitta: 0,
      radius: Number.POSITIVE_INFINITY,
      center: { x: safeWidth / 2, y: middleY },
      start,
      end,
      apex: { x: safeWidth / 2, y: middleY },
      sweep: reversed ? 0 : 1,
      reversed,
      straight: true,
    };
  }

  const radius = safeWidth ** 2 / (8 * sagitta) + sagitta / 2;
  const endpointY = middleY + direction * sagitta / 2;
  const apexY = endpointY - direction * sagitta;
  const centerY = endpointY + direction * (radius - sagitta);
  const forwardSweep: 0 | 1 = direction > 0 ? 1 : 0;
  const sweep: 0 | 1 = reversed ? (forwardSweep === 1 ? 0 : 1) : forwardSweep;
  const start = { x: reversed ? safeWidth : 0, y: endpointY };
  const end = { x: reversed ? 0 : safeWidth, y: endpointY };
  return {
    data: `M ${number(start.x)} ${number(start.y)} A ${number(radius)} ${number(radius)} 0 0 ${sweep} ${number(end.x)} ${number(end.y)}`,
    width: safeWidth,
    height: safeHeight,
    bend,
    sagitta,
    radius,
    center: { x: safeWidth / 2, y: centerY },
    start,
    end,
    apex: { x: safeWidth / 2, y: apexY },
    sweep,
    reversed,
    straight: false,
  };
}

/** Samples the arc and its tangent, useful for selection handles and future glyph layouts. */
export function pointOnArcTextPath(geometry: ArcTextPathGeometry, progress: number): ArcPathPoint {
  const amount = clamp(finite(progress), 0, 1);
  const pathAmount = geometry.reversed ? 1 - amount : amount;
  const x = geometry.width * pathAmount;
  if (geometry.straight) return { x, y: geometry.start.y, angle: geometry.reversed ? 180 : 0 };
  const horizontal = x - geometry.center.x;
  const vertical = Math.sqrt(Math.max(0, geometry.radius ** 2 - horizontal ** 2));
  const upward = geometry.bend > 0;
  const y = geometry.center.y + (upward ? -vertical : vertical);
  const slope = upward ? horizontal / Math.max(Number.EPSILON, vertical) : -horizontal / Math.max(Number.EPSILON, vertical);
  const direction = geometry.reversed ? -1 : 1;
  const angle = Math.atan2(slope * direction, direction) * 180 / Math.PI;
  return { x, y, angle };
}
