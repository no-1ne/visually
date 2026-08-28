export type SnapAxis = 'x' | 'y';
export type SnapAnchorKind = 'start' | 'center' | 'end';
export type SnapCandidateSource = 'page' | 'object' | 'custom';

export interface SnapPoint {
  x: number;
  y: number;
}

export interface SnapRect extends SnapPoint {
  width: number;
  height: number;
}

export interface SnapTargetRect extends SnapRect {
  id?: string;
}

export interface SnapGuide {
  axis: SnapAxis;
  position: number;
  source?: SnapCandidateSource;
  id?: string;
}

export interface SnapCandidate extends SnapGuide {
  source: SnapCandidateSource;
  targetAnchor: SnapAnchorKind;
}

export interface SnapMatch extends SnapCandidate {
  movingAnchor: SnapAnchorKind;
  distance: number;
  delta: number;
}

export interface ObjectSnapOptions {
  threshold?: number;
  page?: { width: number; height: number };
  targets?: readonly SnapTargetRect[];
  guides?: readonly SnapGuide[];
}

export interface ObjectSnapResult extends SnapPoint {
  guides: { x?: number; y?: number };
  matches: { x?: SnapMatch; y?: SnapMatch };
}

interface MovingAnchor {
  kind: SnapAnchorKind;
  offset: number;
}

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

function axisAnchors(size: number): MovingAnchor[] {
  const safeSize = Math.max(0, finite(size));
  return [
    { kind: 'start', offset: 0 },
    { kind: 'center', offset: safeSize / 2 },
    { kind: 'end', offset: safeSize },
  ];
}

export function rectSnapCandidates(
  rect: SnapTargetRect,
  source: Extract<SnapCandidateSource, 'object'> = 'object',
): SnapCandidate[] {
  const id = rect.id;
  return [
    { axis: 'x', position: rect.x, source, id, targetAnchor: 'start' },
    { axis: 'x', position: rect.x + rect.width / 2, source, id, targetAnchor: 'center' },
    { axis: 'x', position: rect.x + rect.width, source, id, targetAnchor: 'end' },
    { axis: 'y', position: rect.y, source, id, targetAnchor: 'start' },
    { axis: 'y', position: rect.y + rect.height / 2, source, id, targetAnchor: 'center' },
    { axis: 'y', position: rect.y + rect.height, source, id, targetAnchor: 'end' },
  ];
}

export function pageSnapCandidates(page: { width: number; height: number }): SnapCandidate[] {
  return rectSnapCandidates({ x: 0, y: 0, width: page.width, height: page.height }, 'object')
    .map((candidate) => ({ ...candidate, source: 'page' as const }));
}

export function customGuideCandidates(guides: readonly SnapGuide[]): SnapCandidate[] {
  return guides.map((guide) => ({
    ...guide,
    source: 'custom' as const,
    targetAnchor: 'center' as const,
  }));
}

/**
 * Finds the closest candidate for one axis. Ties prefer custom guides, then page
 * lines, then objects, which keeps deliberate layout guides stable near objects.
 */
export function nearestSnapCandidate(
  origin: number,
  movingAnchors: readonly MovingAnchor[],
  candidates: readonly SnapCandidate[],
  threshold: number,
): SnapMatch | undefined {
  const maximumDistance = Math.max(0, finite(threshold));
  const priority: Record<SnapCandidateSource, number> = { custom: 0, page: 1, object: 2 };
  let nearest: SnapMatch | undefined;

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.position)) continue;
    for (const anchor of movingAnchors) {
      const delta = candidate.position - (origin + anchor.offset);
      const distance = Math.abs(delta);
      if (distance > maximumDistance) continue;
      const betterDistance = !nearest || distance < nearest.distance - Number.EPSILON;
      const equalDistance = nearest !== undefined && Math.abs(distance - nearest.distance) <= Number.EPSILON;
      const betterPriority = nearest !== undefined && equalDistance && priority[candidate.source] < priority[nearest.source];
      if (betterDistance || betterPriority) {
        nearest = { ...candidate, movingAnchor: anchor.kind, distance, delta };
      }
    }
  }
  return nearest;
}

/** Snaps horizontal and vertical movement independently so diagonal drags stay natural. */
export function snapObjectPosition(moving: SnapRect, options: ObjectSnapOptions = {}): ObjectSnapResult {
  const candidates = [
    ...(options.page ? pageSnapCandidates(options.page) : []),
    ...(options.targets ?? []).flatMap((target) => rectSnapCandidates(target)),
    ...customGuideCandidates(options.guides ?? []),
  ];
  const xMatch = nearestSnapCandidate(
    moving.x,
    axisAnchors(moving.width),
    candidates.filter((candidate) => candidate.axis === 'x'),
    options.threshold ?? 9,
  );
  const yMatch = nearestSnapCandidate(
    moving.y,
    axisAnchors(moving.height),
    candidates.filter((candidate) => candidate.axis === 'y'),
    options.threshold ?? 9,
  );
  return {
    x: moving.x + (xMatch?.delta ?? 0),
    y: moving.y + (yMatch?.delta ?? 0),
    guides: { x: xMatch?.position, y: yMatch?.position },
    matches: { x: xMatch, y: yMatch },
  };
}
