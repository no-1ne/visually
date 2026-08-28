import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  generateRulerTicks, guideKeyboardAction, guidePositionFromClient, pointerInsideGuideDropZone,
  type GuideAxis, type RectLike,
} from '@/features/advanced/rulers';
import { useEditorStore } from '@/store/editor-store';
import type { PageMetadata } from '@/types';

type Guide = NonNullable<PageMetadata['guides']>[number];
interface GuideDrag { guide: Guide; initialPosition: number; created: boolean }

const pageBounds = (element: HTMLElement): RectLike => {
  const bounds = element.getBoundingClientRect();
  return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
};

export function WorkspaceRulers() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const zoom = useEditorStore((state) => state.zoom);
  const updatePage = useEditorStore((state) => state.updatePage);
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<GuideDrag | null>(null);
  const guides = page.metadata?.guides ?? [];
  const horizontalTicks = useMemo(() => generateRulerTicks(0, page.width, zoom), [page.width, zoom]);
  const verticalTicks = useMemo(() => generateRulerTicks(0, page.height, zoom), [page.height, zoom]);

  const replaceGuides = (next: Guide[]) => updatePage({ metadata: { ...page.metadata, guides: next } });
  const addCentered = (axis: GuideAxis) => replaceGuides([...guides, {
    id: crypto.randomUUID(), axis, position: axis === 'x' ? page.width / 2 : page.height / 2,
  }]);
  const begin = (guide: Guide, created: boolean, event: ReactPointerEvent<HTMLElement>) => {
    if (guide.locked || !frameRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const position = guidePositionFromClient(guide.axis, event, pageBounds(frameRef.current), zoom);
    setDrag({ guide: { ...guide, position }, initialPosition: guide.position, created });
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !frameRef.current) return;
    const position = guidePositionFromClient(drag.guide.axis, event, pageBounds(frameRef.current), zoom);
    setDrag({ ...drag, guide: { ...drag.guide, position } });
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !frameRef.current) return;
    const inside = pointerInsideGuideDropZone(drag.guide.axis, event, pageBounds(frameRef.current));
    if (inside) replaceGuides(drag.created ? [...guides, drag.guide] : guides.map((guide) => guide.id === drag.guide.id ? drag.guide : guide));
    else if (!drag.created) replaceGuides(guides.filter((guide) => guide.id !== drag.guide.id));
    setDrag(null);
  };
  const cancel = () => setDrag(null);
  const keyGuide = (guide: Guide, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key.toLowerCase() === 'l') {
      event.preventDefault();
      replaceGuides(guides.map((item) => item.id === guide.id ? { ...item, locked: !item.locked } : item));
      return;
    }
    const action = guideKeyboardAction(guide.position, guide.axis, event.key, guide.axis === 'x' ? page.width : page.height, event.shiftKey);
    if (action.kind === 'none') return;
    event.preventDefault();
    if (guide.locked) return;
    if (action.kind === 'remove') replaceGuides(guides.filter((item) => item.id !== guide.id));
    else replaceGuides(guides.map((item) => item.id === guide.id ? { ...item, position: action.position! } : item));
  };
  const visibleGuides = drag?.created ? [...guides, drag.guide] : guides.map((guide) => drag?.guide.id === guide.id ? drag.guide : guide);

  return (
    <div
      ref={frameRef}
      className="workspace-rulers"
      data-testid="workspace-rulers"
      style={{ width: page.width * zoom, height: page.height * zoom }}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={cancel}
    >
      <button
        type="button"
        className="workspace-ruler workspace-ruler-horizontal"
        aria-label="Add vertical guide"
        title="Drag to add a vertical guide"
        onPointerDown={(event) => begin({ id: crypto.randomUUID(), axis: 'x', position: 0 }, true, event)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addCentered('x'); } }}
      >
        {horizontalTicks.map((tick) => <i key={tick.position} className={tick.major ? 'is-major' : ''} style={{ left: tick.position * zoom }}>{tick.label && <span>{tick.label}</span>}</i>)}
      </button>
      <button
        type="button"
        className="workspace-ruler workspace-ruler-vertical"
        aria-label="Add horizontal guide"
        title="Drag to add a horizontal guide"
        onPointerDown={(event) => begin({ id: crypto.randomUUID(), axis: 'y', position: 0 }, true, event)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addCentered('y'); } }}
      >
        {verticalTicks.map((tick) => <i key={tick.position} className={tick.major ? 'is-major' : ''} style={{ top: tick.position * zoom }}>{tick.label && <span>{tick.label}</span>}</i>)}
      </button>
      <span className="workspace-ruler-corner" aria-hidden="true" />
      {visibleGuides.map((guide) => (
        <button
          type="button"
          role="slider"
          key={guide.id}
          className={`workspace-guide workspace-guide-${guide.axis} ${guide.locked ? 'is-locked' : ''}`}
          style={guide.axis === 'x' ? { left: guide.position * zoom } : { top: guide.position * zoom }}
          aria-label={`${guide.locked ? 'Locked ' : ''}${guide.axis === 'x' ? 'vertical' : 'horizontal'} guide`}
          aria-orientation={guide.axis === 'x' ? 'vertical' : 'horizontal'}
          aria-valuemin={0}
          aria-valuemax={guide.axis === 'x' ? page.width : page.height}
          aria-valuenow={Math.round(guide.position * 100) / 100}
          aria-valuetext={`${Math.round(guide.position * 100) / 100} pixels${guide.locked ? ', locked' : ''}`}
          title="Arrow keys move · Shift moves 10px · L locks · Delete removes"
          onPointerDown={(event) => begin(guide, false, event)}
          onKeyDown={(event) => keyGuide(guide, event)}
        />
      ))}
    </div>
  );
}
