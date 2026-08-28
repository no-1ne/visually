import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CopyPlusIcon, LayoutListIcon, PanelTopIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';

export function PageStrip() {
  const pages = useEditorStore((state) => state.pages);
  const active = useEditorStore((state) => state.activePageIndex);
  const setActivePage = useEditorStore((state) => state.setActivePage);
  const addPage = useEditorStore((state) => state.addPage);
  const duplicatePage = useEditorStore((state) => state.duplicatePage);
  const deletePage = useEditorStore((state) => state.deletePage);
  const reorderPage = useEditorStore((state) => state.reorderPage);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const canvasViewMode = useToolStore((state) => state.canvasViewMode);
  const setCanvasViewMode = useToolStore((state) => state.setCanvasViewMode);
  return (
    <div className="page-strip">
      <div className="page-strip-scroll">
        {pages.map((page, index) => (
          <button key={`${page.name}-${index}`} draggable className={`page-chip ${index === active ? 'is-active' : ''}`} onClick={() => setActivePage(index)} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) reorderPage(dragIndex, index); setDragIndex(null); }} onDragEnd={() => setDragIndex(null)}>
            <span className="page-chip-preview" style={{ background: page.background }}><span style={{ background: page.elements.find((element) => element.type === 'shape')?.fill ?? '#ddd' }} /></span>
            <span>Page {index + 1}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 border-l pl-2">
        <Button variant={canvasViewMode === 'continuous' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setCanvasViewMode(canvasViewMode === 'single' ? 'continuous' : 'single')} aria-label={canvasViewMode === 'single' ? 'Show all pages' : 'Show one page'}>{canvasViewMode === 'single' ? <LayoutListIcon /> : <PanelTopIcon />}</Button>
        <Button variant="ghost" size="icon-sm" onClick={addPage} aria-label="Add page"><PlusIcon /></Button>
        <Button variant="ghost" size="icon-sm" onClick={duplicatePage} aria-label="Duplicate page"><CopyPlusIcon /></Button>
        <Button variant="ghost" size="icon-sm" disabled={active === 0} onClick={() => reorderPage(active, active - 1)} aria-label="Move page left"><ChevronLeftIcon /></Button>
        <Button variant="ghost" size="icon-sm" disabled={active === pages.length - 1} onClick={() => reorderPage(active, active + 1)} aria-label="Move page right"><ChevronRightIcon /></Button>
        <Button variant="ghost" size="icon-sm" disabled={pages.length === 1} onClick={() => deletePage(active)} aria-label="Delete page"><Trash2Icon /></Button>
      </div>
    </div>
  );
}
