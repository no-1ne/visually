import { describe, expect, it } from 'vitest';
import {
  customGuideCandidates,
  nearestSnapCandidate,
  rectSnapCandidates,
  snapObjectPosition,
} from './object-snapping';

describe('object snapping', () => {
  it('selects the nearest candidate instead of the first candidate in input order', () => {
    const candidates = rectSnapCandidates({ id: 'target', x: 100, y: 20, width: 40, height: 40 })
      .filter((candidate) => candidate.axis === 'x')
      .reverse();
    const result = nearestSnapCandidate(91, [{ kind: 'start', offset: 0 }], candidates, 50);
    expect(result).toMatchObject({ position: 100, targetAnchor: 'start', distance: 9, delta: 9 });
  });

  it('matches object edges and centers using all moving anchors', () => {
    const target = { id: 'target', x: 100, y: 200, width: 80, height: 60 };
    expect(snapObjectPosition(
      { x: 62, y: 142, width: 40, height: 120 },
      { targets: [target], threshold: 3 },
    )).toMatchObject({
      x: 60,
      y: 140,
      guides: { x: 100, y: 200 },
      matches: {
        x: { movingAnchor: 'end', targetAnchor: 'start' },
        y: { movingAnchor: 'center', targetAnchor: 'start' },
      },
    });

    expect(snapObjectPosition(
      { x: 118, y: 218, width: 40, height: 20 },
      { targets: [target], threshold: 3 },
    )).toMatchObject({ x: 120, y: 220, guides: { x: 140, y: 230 } });
  });

  it('snaps axes independently when only one axis is near a candidate', () => {
    const result = snapObjectPosition(
      { x: 51, y: 400, width: 50, height: 20 },
      { targets: [{ x: 100, y: 20, width: 50, height: 50 }], threshold: 2 },
    );
    expect(result.x).toBe(50);
    expect(result.y).toBe(400);
    expect(result.guides).toEqual({ x: 100, y: undefined });
    expect(result.matches.x).toBeDefined();
    expect(result.matches.y).toBeUndefined();
  });

  it('leaves an object untouched outside the threshold', () => {
    expect(snapObjectPosition(
      { x: 20, y: 30, width: 10, height: 10 },
      { targets: [{ x: 100, y: 200, width: 20, height: 20 }], threshold: 5 },
    )).toMatchObject({ x: 20, y: 30, guides: { x: undefined, y: undefined } });
  });

  it('supports custom guides and gives them precedence for exact ties', () => {
    const guides = customGuideCandidates([{ id: 'brand-margin', axis: 'x', position: 100 }]);
    expect(guides[0]).toMatchObject({ source: 'custom', id: 'brand-margin', position: 100 });
    const result = snapObjectPosition(
      { x: 93, y: 20, width: 20, height: 10 },
      {
        page: { width: 200, height: 100 },
        targets: [{ id: 'other', x: 100, y: 60, width: 20, height: 10 }],
        guides: [{ id: 'brand-margin', axis: 'x', position: 100 }],
        threshold: 10,
      },
    );
    expect(result).toMatchObject({ x: 90, guides: { x: 100 }, matches: { x: { source: 'custom', id: 'brand-margin' } } });
  });

  it('preserves page edge and center snapping', () => {
    expect(snapObjectPosition(
      { x: 149, y: 2, width: 100, height: 50 },
      { page: { width: 400, height: 300 }, threshold: 3 },
    )).toMatchObject({ x: 150, y: 0, guides: { x: 200, y: 0 } });
  });
});
