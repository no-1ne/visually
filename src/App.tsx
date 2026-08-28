import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MinusIcon, PlusIcon, ScanIcon } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { ContextToolbar } from '@/components/context-toolbar';
import { EditorTopbar } from '@/components/editor-topbar';
import { MobileToolDock } from '@/components/mobile-tool-dock';
import { TimelineBar } from '@/components/timeline-bar';
import { WorkspaceRulers } from '@/components/workspace-rulers';
import { PageStrip } from '@/components/page-strip';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditorCanvas, type CanvasHandle } from '@/EditorCanvas';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';
import { fileToDataUrl, fitImageToPage, loadImageDimensions } from '@/lib/images/image-layout';
import { installVisuallyWebMcp } from '@/lib/webmcp';

function VirtualCanvasPage({ width, height, active, onActivate, children }: { width: number; height: number; active: boolean; onActivate: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(active);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setNearViewport(true); return; }
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), { rootMargin: '700px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`virtual-canvas-page ${active ? 'is-active' : ''}`} style={{ width, height }} onPointerDown={onActivate}>
    {(active || nearViewport) ? children : <div className="virtual-canvas-placeholder">Page preview loads nearby</div>}
  </div>;
}

function EditorWorkspace() {
  const canvasRef = useRef<CanvasHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const hasFit = useRef(false);
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const pages = useEditorStore((state) => state.pages);
  const activePageIndex = useEditorStore((state) => state.activePageIndex);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setActivePage = useEditorStore((state) => state.setActivePage);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const updateElement = useEditorStore((state) => state.updateElement);
  const addElement = useEditorStore((state) => state.addElement);
  const tool = useToolStore((state) => state.tool);
  const brushColor = useToolStore((state) => state.brushColor);
  const brushWidth = useToolStore((state) => state.brushWidth);
  const brushOpacity = useToolStore((state) => state.brushOpacity);
  const currentTime = useToolStore((state) => state.currentTime);
  const playing = useToolStore((state) => state.playing);
  const canvasViewMode = useToolStore((state) => state.canvasViewMode);
  const setCurrentTime = useToolStore((state) => state.setCurrentTime);
  const setPlaying = useToolStore((state) => state.setPlaying);
  const playbackTimeRef = useRef(currentTime);

  useEffect(() => { playbackTimeRef.current = currentTime; }, [currentTime]);

  const insertImageFile = useCallback(async (file: File, cascadeIndex = 0) => {
    const src = await fileToDataUrl(file);
    const dimensions = await loadImageDimensions(src).catch(() => ({ width: 1024, height: 1024 }));
    const placement = fitImageToPage(dimensions, page, { cascadeIndex });
    addElement({
      id: crypto.randomUUID(), type: 'image', name: file.name, src, mimeType: file.type, alt: file.name,
      intrinsicWidth: dimensions.width, intrinsicHeight: dimensions.height,
      x: placement.x, y: placement.y, width: placement.width, height: placement.height,
      rotation: 0, opacity: 1, cornerRadius: 0, objectFit: 'contain', aspectLocked: true,
    });
  }, [addElement, page]);

  useEffect(() => {
    if (!playing) return;
    const duration = Math.max(.1, page.metadata?.duration ?? 5);
    let frame = 0;
    const anchorClock = performance.now();
    const anchorTime = playbackTimeRef.current >= duration ? 0 : playbackTimeRef.current;
    const tick = (now: number) => {
      const next = anchorTime + (now - anchorClock) / 1000;
      if (next >= duration) {
        setCurrentTime(duration);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [page.metadata?.duration, playing, setCurrentTime, setPlaying]);

  const fitCanvas = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const availableWidth = workspace.clientWidth - (window.innerWidth < 768 ? 32 : 112);
    const availableHeight = workspace.clientHeight - (window.innerWidth < 768 ? 44 : 104);
    setZoom(Math.min(.82, availableWidth / page.width, availableHeight / page.height));
  }, [page.height, page.width, setZoom]);

  useEffect(() => {
    if (!hasFit.current) {
      requestAnimationFrame(fitCanvas);
      hasFit.current = true;
    }
    const observer = new ResizeObserver(() => {
      if (window.innerWidth < 768) fitCanvas();
    });
    if (workspaceRef.current) observer.observe(workspaceRef.current);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const store = useEditorStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault(); store.redo();
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault(); store.duplicateSelected();
      } else if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault(); store.copySelected();
      } else if (mod && event.key.toLowerCase() === 'x') {
        event.preventDefault(); store.copySelected(); store.deleteSelected();
      } else if (mod && event.key.toLowerCase() === 'v' && store.clipboard.length) {
        event.preventDefault(); store.pasteClipboard();
      } else if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault(); store.setSelectedIds(store.pages[store.activePageIndex].elements.filter((element) => !element.hidden).map((element) => element.id));
      } else if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) store.ungroupSelected();
        else store.groupSelected();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); store.deleteSelected();
      } else if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault(); store.setZoom(store.zoom + .1);
      } else if (mod && event.key === '-') {
        event.preventDefault(); store.setZoom(store.zoom - .1);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && store.selectedIds[0]) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        store.nudgeSelected(
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        );
      } else if (event.altKey && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        store.alignSelected(event.key === '1' ? 'left' : event.key === '2' ? 'middle' : 'right');
      } else if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault(); store.copyStyle();
      } else if (event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault(); store.pasteStyle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
      if (imageFile) {
        event.preventDefault();
        void insertImageFile(imageFile);
        return;
      }
      const text = event.clipboardData?.getData('text/plain').trim();
      if (text && !useEditorStore.getState().clipboard.length) {
        event.preventDefault();
        addElement({ id: crypto.randomUUID(), type: 'text', name: 'Pasted text', text, x: 220, y: 260, width: 640, height: 180, rotation: 0, opacity: 1, fontSize: 42, fontFamily: 'Manrope', fontStyle: 'normal', fill: '#171923', align: 'left', letterSpacing: 0, lineHeight: 1.2 });
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [addElement, insertImageFile]);

  const exportPng = () => {
    const data = canvasRef.current?.exportImage();
    if (!data) return;
    const anchor = document.createElement('a');
    anchor.href = data;
    anchor.download = `${page.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'visually-design'}.png`;
    anchor.click();
  };

  return (
    <div className="editor-root">
      <EditorTopbar onExportPng={exportPng} />
      <ContextToolbar />
      <main ref={workspaceRef} className="workspace-scroll" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={(event) => { const files = Array.from(event.dataTransfer.files).filter((item) => item.type.startsWith('image/')); if (files.length) { event.preventDefault(); files.forEach((file, index) => void insertImageFile(file, index)); } }}>
        <div className="workspace-grid-pattern" />
        <div className={`canvas-centerer ${canvasViewMode === 'continuous' ? 'is-continuous' : ''}`}>
          {(canvasViewMode === 'single' ? [[page, activePageIndex] as const] : pages.map((candidate, index) => [candidate, index] as const)).map(([candidate, pageIndex]) => <VirtualCanvasPage
            key={`${candidate.metadata?.id ?? candidate.name}-${pageIndex}`}
            width={candidate.width * zoom}
            height={candidate.height * zoom}
            active={pageIndex === activePageIndex}
            onActivate={() => { if (pageIndex !== activePageIndex) setActivePage(pageIndex); }}
          >{pageIndex === activePageIndex && <WorkspaceRulers />}<EditorCanvas
            ref={pageIndex === activePageIndex ? canvasRef : undefined}
            document={candidate}
            selectedIds={pageIndex === activePageIndex ? selectedIds : []}
            zoom={zoom}
            onZoomChange={setZoom}
            onSelectMany={(ids) => { if (pageIndex !== activePageIndex) setActivePage(pageIndex); setSelectedIds(ids); }}
            tool={tool}
            brush={{ color: brushColor, width: brushWidth, opacity: brushOpacity }}
            onCreateElement={addElement}
            onErase={(id) => {
              useEditorStore.getState().setSelectedIds([id]);
              useEditorStore.getState().deleteSelected();
            }}
            playhead={currentTime}
            playing={playing}
            onSelect={(id, additive) => {
              if (pageIndex !== activePageIndex) setActivePage(pageIndex);
              if (!id) return setSelectedIds([]);
              const clicked = candidate.elements.find((element) => element.id === id);
              const groupedIds = clicked?.groupId ? candidate.elements.filter((element) => element.groupId === clicked.groupId || element.groupPath?.includes(clicked.groupId!)).map((element) => element.id) : [id];
              setSelectedIds(additive
                ? (selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
                : groupedIds);
            }}
            onChange={(id, changes, record) => { if (pageIndex !== activePageIndex) setActivePage(pageIndex); updateElement(id, changes, record); }}
          /></VirtualCanvasPage>)}
        </div>
        <div className="zoom-control">
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom - .1)} aria-label="Zoom out"><MinusIcon /></Button>
          <button className="zoom-value" onClick={fitCanvas}>{Math.round(zoom * 100)}%</button>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom + .1)} aria-label="Zoom in"><PlusIcon /></Button>
          <span className="h-4 w-px bg-border" />
          <Button variant="ghost" size="icon-sm" onClick={fitCanvas} aria-label="Fit canvas"><ScanIcon /></Button>
        </div>
      </main>
      <TimelineBar />
      <PageStrip />
      <MobileToolDock />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const bridge = installVisuallyWebMcp();
    return bridge.dispose;
  }, []);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar style={{ '--sidebar-width': '21rem', '--sidebar-width-icon': '3.5rem' } as React.CSSProperties} />
        <SidebarInset className="min-w-0 overflow-hidden">
          <EditorWorkspace />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
