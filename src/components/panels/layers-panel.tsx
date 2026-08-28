import {
  ArrowDownIcon, ArrowUpIcon, CircleIcon, EyeIcon, EyeOffIcon,
  LockIcon, MinusIcon, RectangleHorizontalIcon, StarIcon, TypeIcon, UnlockIcon,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { PanelHeading } from './panel-heading';

export function LayersPanel() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const toggleHidden = useEditorStore((state) => state.toggleHidden);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  return (
    <>
      <PanelHeading title="Layers" note={`${page.elements.length} objects on this page`} />
      <div className="space-y-1.5">
        {[...page.elements].reverse().map((element) => (
          <div key={element.id} className={`layer-row ${selectedIds.includes(element.id) ? 'is-selected' : ''}`} onClick={() => setSelectedIds([element.id])}>
            <span className="layer-thumb">
              {element.type === 'text' ? <TypeIcon /> : element.type === 'image' ? 'IMG' : element.type === 'line' || element.type === 'drawing' ? <MinusIcon /> : element.type === 'shape' && element.shape === 'circle' ? <CircleIcon /> : element.type === 'shape' && element.shape === 'star' ? <StarIcon /> : element.type === 'shape' ? <RectangleHorizontalIcon /> : element.type.slice(0, 3).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{element.name}</span>
            <button onClick={(event) => { event.stopPropagation(); toggleHidden(element.id); }} aria-label="Toggle visibility">{element.hidden ? <EyeOffIcon /> : <EyeIcon />}</button>
            <button onClick={(event) => { event.stopPropagation(); toggleLock(element.id); }} aria-label="Toggle lock">{element.locked ? <LockIcon /> : <UnlockIcon />}</button>
            <button onClick={(event) => { event.stopPropagation(); moveLayer(element.id, event.shiftKey ? 'top' : 'up'); }} aria-label="Move up"><ArrowUpIcon /></button>
            <button onClick={(event) => { event.stopPropagation(); moveLayer(element.id, event.shiftKey ? 'bottom' : 'down'); }} aria-label="Move down"><ArrowDownIcon /></button>
          </div>
        ))}
      </div>
    </>
  );
}
