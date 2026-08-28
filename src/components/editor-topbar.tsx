import { useRef, useState } from 'react';
import {
  ChevronDownIcon, DownloadIcon, FileJsonIcon, HelpCircleIcon,
  Redo2Icon, Undo2Icon, UploadIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Progress } from '@/components/ui/progress';
import { useEditorStore } from '@/store/editor-store';
import {
  browserRasterizer, encodePagesWithFfmpeg, importProject, pagesToPdf, pagesToPptxBlob,
  printableHtmlBlob, projectJsonBlob, safeFilename, svgBlob, triggerBlobDownload,
} from '@/lib/export';
import { getFFmpegEngine } from '@/lib/media/ffmpeg-client';

interface EditorTopbarProps {
  onExportPng: () => void;
}

export function EditorTopbar({ onExportPng }: EditorTopbarProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const pages = useEditorStore((state) => state.pages);
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const updatePage = useEditorStore((state) => state.updatePage);
  const loadProject = useEditorStore((state) => state.loadProject);
  const [exportTask, setExportTask] = useState<{ label: string; progress: number } | null>(null);

  const exportJson = () => {
    triggerBlobDownload(projectJsonBlob(pages), 'visually-project.json');
  };

  const runExport = async (label: string, action: (progress: (value: number) => void) => Promise<Blob>, extension: string) => {
    setExportTask({ label, progress: 2 });
    try {
      const blob = await action((progress) => setExportTask({ label, progress }));
      triggerBlobDownload(blob, safeFilename(page.name, extension));
      setExportTask({ label: `${label} ready`, progress: 100 });
      window.setTimeout(() => setExportTask(null), 1400);
    } catch (error) {
      setExportTask(null);
      window.alert(error instanceof Error ? error.message : `Unable to export ${label}.`);
    }
  };

  const exportRaster = (mimeType: 'image/jpeg' | 'image/webp', extension: string) => runExport(extension.toUpperCase(), async (progress) => {
    progress(25);
    const blob = await browserRasterizer(page, 0, { pixelRatio: 2, mimeType, quality: .92 });
    progress(100);
    return blob;
  }, extension);

  const exportAnimation = (format: 'gif' | 'mp4' | 'webm') => runExport(format.toUpperCase(), async (onProgress) => {
    const engine = await getFFmpegEngine();
    return encodePagesWithFfmpeg(engine, { pages, onProgress }, { format, framesPerSecond: format === 'gif' ? 15 : 30, secondsPerPage: page.metadata?.duration ?? 1 });
  }, format);

  const importJson = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = importProject(String(reader.result));
        loadProject(parsed.pages);
        if (parsed.warnings.length) console.warn('Project imported with warnings:', parsed.warnings);
      } catch { window.alert('That file is not a valid Visually project.'); }
    };
    reader.readAsText(file);
  };

  return (
    <header className="editor-topbar">
      <div className="flex min-w-0 items-center gap-1.5">
        <SidebarTrigger className="size-9" />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <input
          className="design-name-input"
          value={page.name}
          onChange={(event) => updatePage({ name: event.target.value })}
          aria-label="Design name"
        />
        <span className="hidden text-[10px] font-medium text-muted-foreground lg:inline">Saved locally</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" disabled={!past.length} onClick={undo} aria-label="Undo"><Undo2Icon /></Button>
        <Button variant="ghost" size="icon" disabled={!future.length} onClick={redo} aria-label="Redo"><Redo2Icon /></Button>
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" />}><HelpCircleIcon /></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>Move faster around your design.</DialogDescription></DialogHeader>
            <div className="shortcut-grid">
              <span>Undo / redo</span><kbd>⌘ Z / ⇧⌘ Z</kbd>
              <span>Duplicate</span><kbd>⌘ D</kbd>
              <span>Delete</span><kbd>Del</kbd>
              <span>Nudge</span><kbd>Arrow keys</kbd>
              <span>Zoom</span><kbd>⌘ + / −</kbd>
              <span>Toggle tools</span><kbd>⌘ B</kbd>
            </div>
          </DialogContent>
        </Dialog>
        <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importJson(event.target.files?.[0])} />
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ className: 'ml-1 bg-[#7657ff] text-white hover:bg-[#6546ee]' })}>
            <DownloadIcon data-icon="inline-start" /> <span className="hidden sm:inline">Export</span><ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Download design</DropdownMenuLabel>
              <DropdownMenuItem onClick={onExportPng}><DownloadIcon /> PNG image <span className="ml-auto text-xs text-muted-foreground">2×</span></DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportRaster('image/jpeg', 'jpg')}><DownloadIcon /> JPEG image</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportRaster('image/webp', 'webp')}><DownloadIcon /> WebP image</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerBlobDownload(svgBlob(page), safeFilename(page.name, 'svg'))}><DownloadIcon /> SVG vector</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerBlobDownload(new Blob([Uint8Array.from(pagesToPdf(pages)).buffer], { type: 'application/pdf' }), safeFilename(page.name, 'pdf'))}><DownloadIcon /> PDF document</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerBlobDownload(printableHtmlBlob(pages), safeFilename(page.name, 'html'))}><DownloadIcon /> Printable HTML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runExport('PowerPoint', (onProgress) => pagesToPptxBlob(pages, { onProgress }), 'pptx')}><DownloadIcon /> PowerPoint</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAnimation('gif')}><DownloadIcon /> Animated GIF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAnimation('mp4')}><DownloadIcon /> MP4 video</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAnimation('webm')}><DownloadIcon /> WebM video</DropdownMenuItem>
              <DropdownMenuItem onClick={exportJson}><FileJsonIcon /> Project JSON</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => importRef.current?.click()}><UploadIcon /> Import project</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {exportTask && <div className="export-progress-card" role="status" aria-live="polite"><div className="mb-1 flex justify-between gap-4 text-xs"><span className="font-semibold">{exportTask.label}</span><span>{Math.round(exportTask.progress)}%</span></div><Progress value={exportTask.progress} /></div>}
    </header>
  );
}
