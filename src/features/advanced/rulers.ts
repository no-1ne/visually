export type CanvasUnit = 'px' | 'in' | 'cm' | 'mm' | 'pt';

export interface RectLike { x: number; y: number; width: number; height: number }
export interface GuideLine { axis: 'x' | 'y'; position: number; kind: 'bleed' | 'safe' | 'center' }
export interface RulerTick { position: number; value: number; major: boolean; label?: string }
export interface PointLike { clientX: number; clientY: number }
export type PageOrientation = 'portrait' | 'landscape';
export type GuideAxis = 'x' | 'y';

export interface GuideKeyboardAction {
  kind: 'move' | 'remove' | 'none';
  position?: number;
}

const UNITS_PER_INCH: Record<CanvasUnit, number> = { px: 96, in: 1, cm: 2.54, mm: 25.4, pt: 72 };

export function convertUnit(value: number, from: CanvasUnit, to: CanvasUnit, dpi = 96): number {
  const perInch = { ...UNITS_PER_INCH, px: Math.max(1, dpi) };
  return value / perInch[from] * perInch[to];
}

export function pixelsToUnit(value: number, unit: CanvasUnit, dpi = 96): number {
  return convertUnit(value, 'px', unit, dpi);
}

export function unitToPixels(value: number, unit: CanvasUnit, dpi = 96): number {
  return convertUnit(value, unit, 'px', dpi);
}

export function formatUnit(value: number, unit: CanvasUnit, precision = 2): string {
  const rounded = Number(value.toFixed(Math.max(0, precision)));
  return `${rounded} ${unit}`;
}

export function insetRect(rect: RectLike, inset: number): RectLike {
  const amount = Math.max(0, inset);
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width: Math.max(0, rect.width - amount * 2),
    height: Math.max(0, rect.height - amount * 2),
  };
}

export function expandRect(rect: RectLike, outset: number): RectLike {
  const amount = Math.max(0, outset);
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
}

export function layoutGuides(page: RectLike, bleed = 0, safeInset = 0, centers = true): GuideLine[] {
  const bleedRect = expandRect(page, bleed);
  const safeRect = insetRect(page, safeInset);
  const guides: GuideLine[] = [
    { axis: 'x', position: bleedRect.x, kind: 'bleed' },
    { axis: 'x', position: bleedRect.x + bleedRect.width, kind: 'bleed' },
    { axis: 'y', position: bleedRect.y, kind: 'bleed' },
    { axis: 'y', position: bleedRect.y + bleedRect.height, kind: 'bleed' },
    { axis: 'x', position: safeRect.x, kind: 'safe' },
    { axis: 'x', position: safeRect.x + safeRect.width, kind: 'safe' },
    { axis: 'y', position: safeRect.y, kind: 'safe' },
    { axis: 'y', position: safeRect.y + safeRect.height, kind: 'safe' },
  ];
  if (centers) {
    guides.push(
      { axis: 'x', position: page.x + page.width / 2, kind: 'center' },
      { axis: 'y', position: page.y + page.height / 2, kind: 'center' },
    );
  }
  return guides;
}

function niceStep(target: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(Number.EPSILON, target)));
  const scaled = target / power;
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return factor * power;
}

export function generateRulerTicks(
  startPixels: number,
  endPixels: number,
  zoom: number,
  unit: CanvasUnit = 'px',
  dpi = 96,
  minimumMajorPixels = 72,
): RulerTick[] {
  const safeZoom = Math.max(0.001, zoom);
  const unitPerPixel = pixelsToUnit(1, unit, dpi);
  const majorStep = niceStep(minimumMajorPixels / safeZoom * unitPerPixel);
  const minorStep = majorStep / 10;
  const startUnit = pixelsToUnit(Math.min(startPixels, endPixels), unit, dpi);
  const endUnit = pixelsToUnit(Math.max(startPixels, endPixels), unit, dpi);
  const first = Math.ceil(startUnit / minorStep) * minorStep;
  const ticks: RulerTick[] = [];
  for (let value = first, index = 0; value <= endUnit + minorStep / 100 && index < 10_000; value += minorStep, index += 1) {
    const major = Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-7;
    ticks.push({ position: unitToPixels(value, unit, dpi), value, major, label: major ? String(Number(value.toFixed(4))) : undefined });
  }
  return ticks;
}

export function clampGuidePosition(position: number, extent: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.min(Math.max(0, extent), Math.max(0, position));
}

/** Converts a viewport pointer into unscaled page coordinates. */
export function guidePositionFromClient(axis: GuideAxis, point: PointLike, pageBounds: RectLike, zoom: number): number {
  const safeZoom = Math.max(0.001, Number.isFinite(zoom) ? zoom : 1);
  const raw = axis === 'x' ? (point.clientX - pageBounds.x) / safeZoom : (point.clientY - pageBounds.y) / safeZoom;
  const extent = axis === 'x' ? pageBounds.width / safeZoom : pageBounds.height / safeZoom;
  return clampGuidePosition(raw, extent);
}

/** A vertical guide must be released beside the page; a horizontal guide above/below it. */
export function pointerInsideGuideDropZone(axis: GuideAxis, point: PointLike, pageBounds: RectLike, tolerance = 8): boolean {
  return axis === 'x'
    ? point.clientY >= pageBounds.y - tolerance && point.clientY <= pageBounds.y + pageBounds.height + tolerance
    : point.clientX >= pageBounds.x - tolerance && point.clientX <= pageBounds.x + pageBounds.width + tolerance;
}

export function guideKeyboardAction(
  position: number,
  axis: GuideAxis,
  key: string,
  extent: number,
  accelerated = false,
): GuideKeyboardAction {
  if (key === 'Delete' || key === 'Backspace') return { kind: 'remove' };
  if (key === 'Home') return { kind: 'move', position: 0 };
  if (key === 'End') return { kind: 'move', position: Math.max(0, extent) };
  const direction = axis === 'x'
    ? key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0
    : key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  if (!direction) return { kind: 'none' };
  return { kind: 'move', position: clampGuidePosition(position + direction * (accelerated ? 10 : 1), extent) };
}

export function pageOrientation(width: number, height: number): PageOrientation {
  return width > height ? 'landscape' : 'portrait';
}

/** Keeps the same two dimensions and swaps only when the requested orientation differs. */
export function orientPageDimensions(width: number, height: number, orientation: PageOrientation): { width: number; height: number } {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  if (orientation === 'landscape') return { width: Math.max(safeWidth, safeHeight), height: Math.min(safeWidth, safeHeight) };
  return { width: Math.min(safeWidth, safeHeight), height: Math.max(safeWidth, safeHeight) };
}
