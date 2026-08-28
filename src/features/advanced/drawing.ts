export type DrawingTool = 'pen' | 'brush' | 'highlighter' | 'eraser';

export interface DrawingPoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export interface DrawingStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
}

export interface DrawingStroke {
  id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  style: DrawingStyle;
  composite: 'source-over' | 'destination-out';
}

export interface DrawingSession extends DrawingStroke {
  active: boolean;
}

export interface PointInput {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

const DEFAULT_STYLE: DrawingStyle = {
  color: '#111827',
  width: 4,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeDrawingPoint(point: PointInput, fallbackTime = 0): DrawingPoint {
  return {
    x: finite(point.x),
    y: finite(point.y),
    pressure: clamp(finite(point.pressure ?? 0.5, 0.5), 0, 1),
    time: Math.max(0, finite(point.time ?? fallbackTime, fallbackTime)),
  };
}

export function beginDrawingStroke(
  id: string,
  tool: DrawingTool,
  point: PointInput,
  style: Partial<DrawingStyle> = {},
): DrawingSession {
  const merged = { ...DEFAULT_STYLE, ...style };
  return {
    id,
    tool,
    active: true,
    points: [normalizeDrawingPoint(point)],
    style: {
      ...merged,
      width: Math.max(0.1, finite(merged.width, DEFAULT_STYLE.width)),
      opacity: clamp(finite(merged.opacity, DEFAULT_STYLE.opacity), 0, 1),
    },
    composite: tool === 'eraser' ? 'destination-out' : 'source-over',
  };
}

export function appendDrawingPoint(
  session: DrawingSession,
  point: PointInput,
  minimumDistance = 0.5,
): DrawingSession {
  if (!session.active) return session;
  const previous = session.points.at(-1);
  const next = normalizeDrawingPoint(point, previous?.time ?? 0);
  if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < Math.max(0, minimumDistance)) {
    return session;
  }
  return { ...session, points: [...session.points, next] };
}

function distanceToSegment(point: DrawingPoint, start: DrawingPoint, end: DrawingPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

/** Ramer-Douglas-Peucker simplification which preserves point pressure and timestamps. */
export function simplifyPath(points: readonly DrawingPoint[], tolerance = 1): DrawingPoint[] {
  if (points.length <= 2 || tolerance <= 0) return [...points];
  let furthestIndex = 0;
  let furthestDistance = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], first, last);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestDistance <= tolerance) return [first, last];
  const left = simplifyPath(points.slice(0, furthestIndex + 1), tolerance);
  const right = simplifyPath(points.slice(furthestIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** One or more Chaikin passes, useful for a brush preview after input sampling. */
export function smoothPath(points: readonly DrawingPoint[], passes = 1): DrawingPoint[] {
  let result = [...points];
  const iterations = Math.max(0, Math.floor(passes));
  for (let pass = 0; pass < iterations && result.length > 2; pass += 1) {
    const smoothed: DrawingPoint[] = [result[0]];
    for (let index = 0; index < result.length - 1; index += 1) {
      const start = result[index];
      const end = result[index + 1];
      smoothed.push(mixPoint(start, end, 0.25), mixPoint(start, end, 0.75));
    }
    smoothed.push(result[result.length - 1]);
    result = smoothed;
  }
  return result;
}

function mixPoint(start: DrawingPoint, end: DrawingPoint, amount: number): DrawingPoint {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    pressure: start.pressure + (end.pressure - start.pressure) * amount,
    time: start.time + (end.time - start.time) * amount,
  };
}

export function finishDrawingStroke(session: DrawingSession, tolerance = 0.75): DrawingStroke {
  const points = simplifyPath(session.points, tolerance);
  return {
    id: session.id,
    tool: session.tool,
    points,
    style: { ...session.style },
    composite: session.composite,
  };
}

export function pressureWidth(styleWidth: number, pressure: number, minimumRatio = 0.2): number {
  const ratio = clamp(minimumRatio + (1 - minimumRatio) * clamp(pressure, 0, 1), 0, 1);
  return Math.max(0, styleWidth) * ratio;
}

export function drawingBounds(points: readonly Pick<DrawingPoint, 'x' | 'y'>[], padding = 0) {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const inset = Math.max(0, padding);
  const minX = Math.min(...xs) - inset;
  const minY = Math.min(...ys) - inset;
  const maxX = Math.max(...xs) + inset;
  const maxY = Math.max(...ys) + inset;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
