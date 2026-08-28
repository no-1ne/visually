import { useEffect, useRef, useState } from 'react';
import {
  BrushIcon, EraserIcon, HighlighterIcon, MousePointer2Icon, PauseIcon, PlayIcon,
  PlusIcon, Redo2Icon, Rows3Icon, SparklesIcon, UploadIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';
import { extractAudioWaveformSafe } from '@/lib/media/audio-waveform';
import {
  BackgroundRemovalError, blobToDataUrl, removeImageBackground,
  type BackgroundRemovalProgress,
} from '@/lib/ml/background-removal';
import { clampGuidePosition, orientPageDimensions, pageOrientation } from '@/features/advanced/rulers';
import type { AudioElement, EditorElement, MediaEffects, TableCell, TableElement, VideoElement } from '@/types';
import { PanelHeading } from './panel-heading';

const uid = () => crypto.randomUUID();
const numberValue = (value: number | readonly number[]) => Number(Array.isArray(value) ? value[0] : value);

export function DrawPanel() {
  const tool = useToolStore((state) => state.tool);
  const setTool = useToolStore((state) => state.setTool);
  const brushColor = useToolStore((state) => state.brushColor);
  const brushWidth = useToolStore((state) => state.brushWidth);
  const brushOpacity = useToolStore((state) => state.brushOpacity);
  const setBrush = useToolStore((state) => state.setBrush);
  return <>
    <PanelHeading title="Draw" note="Freehand brush, highlighter, and eraser" />
    <div className="grid grid-cols-2 gap-2">
      {([
        ['select', MousePointer2Icon, 'Select'], ['draw', BrushIcon, 'Brush'],
        ['highlighter', HighlighterIcon, 'Highlighter'], ['eraser', EraserIcon, 'Eraser'],
      ] as const).map(([id, Icon, label]) => <Button key={id} variant={tool === id ? 'default' : 'outline'} onClick={() => setTool(id)}><Icon />{label}</Button>)}
    </div>
    <label className="field-label mt-5 block">Stroke color<input className="color-input mt-2" type="color" value={brushColor} onChange={(event) => setBrush({ brushColor: event.target.value })} /></label>
    <label className="field-label mt-5 block">Width <span className="float-right">{brushWidth}px</span><Slider className="mt-3" min={1} max={80} value={[brushWidth]} onValueChange={(value) => setBrush({ brushWidth: numberValue(value) })} /></label>
    <label className="field-label mt-5 block">Opacity <span className="float-right">{Math.round(brushOpacity * 100)}%</span><Slider className="mt-3" min={5} max={100} value={[brushOpacity * 100]} onValueChange={(value) => setBrush({ brushOpacity: numberValue(value) / 100 })} /></label>
    <p className="mt-5 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">Draw directly on the page. Brush gestures are committed as editable vector paths and participate in undo/redo.</p>
  </>;
}

function createCells(rows: number, columns: number): TableCell[][] {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => ({
    id: uid(), text: row === 0 ? `Column ${column + 1}` : '', fill: row === 0 ? '#f1efff' : '#ffffff', fontWeight: row === 0 ? 700 : 400,
  })));
}

export function TablesPanel() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const addElement = useEditorStore((state) => state.addElement);
  const updateElement = useEditorStore((state) => state.updateElement);
  const selected = page.elements.find((element): element is TableElement => selectedIds.includes(element.id) && element.type === 'table');
  const addTable = (rows: number, columns: number) => addElement({
    id: uid(), type: 'table', name: `${rows} × ${columns} table`, x: 140, y: 180, width: 800, height: Math.max(180, rows * 72), rotation: 0, opacity: 1,
    rows, columns, cells: createCells(rows, columns), borderColor: '#c9cbd4', borderWidth: 1, borderStyle: 'solid',
  });
  const addRow = () => selected && updateElement(selected.id, { rows: selected.rows + 1, cells: [...selected.cells, createCells(1, selected.columns)[0]] });
  const addColumn = () => selected && updateElement(selected.id, {
    columns: selected.columns + 1,
    cells: selected.cells.map((row, index) => [...row, { id: uid(), text: index === 0 ? `Column ${selected.columns + 1}` : '', fill: index === 0 ? '#f1efff' : '#fff' }]),
  });
  return <>
    <PanelHeading title="Tables" note="Editable grids with per-cell styling" />
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => addTable(3, 3)}><Rows3Icon />3 × 3</Button>
      <Button variant="outline" onClick={() => addTable(4, 5)}><Rows3Icon />4 × 5</Button>
    </div>
    {selected && <div className="mt-5 rounded-xl border p-3">
      <p className="mb-3 text-xs font-semibold">Selected table</p>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={addRow}><PlusIcon />Row</Button><Button size="sm" variant="outline" onClick={addColumn}><PlusIcon />Column</Button></div>
    </div>}
  </>;
}

async function readMediaDuration(file: File) {
  const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
  const url = URL.createObjectURL(file);
  media.preload = 'metadata';
  media.src = url;
  return new Promise<number>((resolve) => {
    media.onloadedmetadata = () => { const duration = Number.isFinite(media.duration) ? media.duration : 5; URL.revokeObjectURL(url); resolve(duration); };
    media.onerror = () => { URL.revokeObjectURL(url); resolve(5); };
  });
}

export function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addElement = useEditorStore((state) => state.addElement);
  const [busy, setBusy] = useState(false);
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const src = URL.createObjectURL(file);
      const audio = file.type.startsWith('audio/');
      const [duration, waveform] = await Promise.all([
        readMediaDuration(file),
        audio ? extractAudioWaveformSafe(file, { bucketCount: 96, mode: 'peak' }) : Promise.resolve(undefined),
      ]);
      const common = { id: uid(), name: file.name, x: 160, y: 220, width: 760, height: 430, rotation: 0, opacity: 1, src, mimeType: file.type, duration, trimStart: 0, trimEnd: duration, volume: 1, playbackRate: 1 };
      const element: AudioElement | VideoElement = file.type.startsWith('audio/')
        ? { ...common, type: 'audio', height: 120, ...(waveform?.length ? { waveform } : {}) }
        : { ...common, type: 'video', cornerRadius: 12 };
      addElement(element);
    }
    setBusy(false);
  };
  return <>
    <PanelHeading title="Media" note="Video, audio, and animated assets" />
    <input ref={inputRef} hidden type="file" multiple accept="video/*,audio/*,.gif" onChange={(event) => void addFiles(event.target.files)} />
    <button className="upload-dropzone" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadIcon /></span><span className="mt-3 text-sm font-semibold">{busy ? 'Reading media…' : 'Add video or audio'}</span><span className="mt-1 text-xs text-muted-foreground">Trim and animate locally</span></button>
  </>;
}

const animationPresets = [
  { name: 'Fade', property: 'opacity' as const, from: 0, to: 1 },
  { name: 'Slide', property: 'x' as const, from: -120, to: 0 },
  { name: 'Zoom', property: 'scaleX' as const, from: .3, to: 1 },
  { name: 'Rotate', property: 'rotation' as const, from: -25, to: 0 },
];

export function AnimationsPanel() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedId = useEditorStore((state) => state.selectedIds[0]);
  const updateElement = useEditorStore((state) => state.updateElement);
  const currentTime = useToolStore((state) => state.currentTime);
  const playing = useToolStore((state) => state.playing);
  const setPlaying = useToolStore((state) => state.setPlaying);
  const setCurrentTime = useToolStore((state) => state.setCurrentTime);
  const selected = page.elements.find((element) => element.id === selectedId);
  const duration = page.metadata?.duration ?? 5;
  const applyPreset = (preset: typeof animationPresets[number]) => {
    if (!selected) return;
    const target = preset.property === 'x' ? selected.x : preset.property === 'rotation' ? selected.rotation : preset.property === 'opacity' ? selected.opacity : selected.scaleX ?? 1;
    const start = preset.property === 'x' ? target - 120 : preset.property === 'rotation' ? target - 25 : preset.from;
    updateElement(selected.id, { animation: {
      enabled: true, duration: 1, iterationCount: 1,
      tracks: [{ id: uid(), property: preset.property, keyframes: [{ id: uid(), time: 0, value: start }, { id: uid(), time: 1, value: target, easing: { type: 'ease-out' } }] }],
    } });
  };
  return <>
    <PanelHeading title="Animations" note="Keyframes and page timing" />
    <div className="grid grid-cols-2 gap-2">{animationPresets.map((preset) => <Button key={preset.name} variant="outline" disabled={!selected} onClick={() => applyPreset(preset)}><SparklesIcon />{preset.name}</Button>)}</div>
    <div className="mt-5 rounded-xl border p-3">
      <div className="mb-3 flex items-center gap-2"><Button size="icon-sm" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <PauseIcon /> : <PlayIcon />}</Button><Button size="icon-sm" variant="ghost" onClick={() => setCurrentTime(0)} aria-label="Restart"><Redo2Icon /></Button><span className="ml-auto text-xs tabular-nums">{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span></div>
      <Slider min={0} max={duration * 100} value={[currentTime * 100]} onValueChange={(value) => setCurrentTime(numberValue(value) / 100)} />
    </div>
  </>;
}

export function EffectsPanel() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedId = useEditorStore((state) => state.selectedIds[0]);
  const updateElement = useEditorStore((state) => state.updateElement);
  const selected = page.elements.find((element) => element.id === selectedId);
  const media = selected && (selected.type === 'image' || selected.type === 'video') ? selected : null;
  const effects: MediaEffects = media?.effects ?? {};
  const [removalProgress, setRemovalProgress] = useState<BackgroundRemovalProgress | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const removalController = useRef<AbortController | null>(null);
  const patchEffect = (name: keyof MediaEffects, value: number) => media && updateElement(media.id, { effects: { ...effects, [name]: value } } as Partial<EditorElement>);
  useEffect(() => () => removalController.current?.abort(), [media?.id]);
  const removeBackground = async () => {
    if (media?.type !== 'image' || removalController.current) return;
    const controller = new AbortController();
    removalController.current = controller;
    setRemoving(true);
    setRemovalError(null);
    setRemovalProgress({ phase: 'loading-runtime', percent: 0 });
    try {
      const output = await removeImageBackground(media.src, { signal: controller.signal, onProgress: setRemovalProgress });
      const src = await blobToDataUrl(output);
      if (!controller.signal.aborted) updateElement(media.id, { src, mimeType: 'image/png' });
    } catch (error) {
      if (!(error instanceof BackgroundRemovalError && error.code === 'aborted')) {
        setRemovalError(error instanceof Error ? error.message : 'Background removal failed.');
      }
    } finally {
      if (removalController.current === controller) removalController.current = null;
      setRemoving(false);
      setRemovalProgress(null);
    }
  };
  return <>
    <PanelHeading title="Effects" note="Non-destructive filters and shadows" />
    {!media && <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Select an image or video to edit its effects.</p>}
    {media && (['brightness', 'contrast', 'saturation', 'hue', 'blur', 'grayscale', 'sepia'] as const).map((name) => <label key={name} className="field-label mb-5 block capitalize">{name}<span className="float-right">{Math.round(effects[name] ?? 0)}</span><Slider className="mt-2" min={name === 'hue' ? -180 : name === 'contrast' || name === 'brightness' || name === 'saturation' ? -100 : 0} max={name === 'hue' ? 180 : 100} value={[effects[name] ?? 0]} onValueChange={(value) => patchEffect(name, numberValue(value))} /></label>)}
    {media?.type === 'image' && <div className="mb-5 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Button className="flex-1" variant="outline" disabled={removing} onClick={() => void removeBackground()}><SparklesIcon />Remove background</Button>
        {removing && <Button variant="ghost" onClick={() => removalController.current?.abort()}>Cancel</Button>}
      </div>
      {removalProgress && <div className="mt-3" aria-live="polite">
        <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground"><span>{removalProgress.phase.replace('-', ' ')}</span><span>{Math.round(removalProgress.percent)}%</span></div>
        <Progress value={removalProgress.percent} aria-label="Background removal progress" />
      </div>}
      {removalError && <p role="alert" className="mt-2 text-xs text-destructive">{removalError}</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Runs locally in your browser. The ML model downloads lazily; your image is never uploaded for processing.</p>
    </div>}
    {media?.type === 'image' && <label className="field-label block">Clip mask<select className="control-select mt-2" value={media.maskId ?? ''} onChange={(event) => updateElement(media.id, { maskId: event.target.value || undefined })}><option value="">Rounded rectangle</option>{page.elements.filter((element) => element.type === 'shape').map((shape) => <option key={shape.id} value={shape.id}>{shape.name}</option>)}</select></label>}
  </>;
}

export function SizePanel() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const updatePage = useEditorStore((state) => state.updatePage);
  const [unit, setUnit] = useState<'px' | 'in' | 'mm'>('px');
  const factor = unit === 'px' ? 1 : unit === 'in' ? 96 : 96 / 25.4;
  const setDimension = (key: 'width' | 'height', value: number) => updatePage({ [key]: Math.max(1, Math.round(value * factor)) });
  const orientation = pageOrientation(page.width, page.height);
  const setOrientation = (next: 'portrait' | 'landscape') => {
    const dimensions = orientPageDimensions(page.width, page.height, next);
    updatePage({
      ...dimensions,
      metadata: {
        ...page.metadata,
        guides: page.metadata?.guides?.map((guide) => ({
          ...guide,
          position: clampGuidePosition(guide.position, guide.axis === 'x' ? dimensions.width : dimensions.height),
        })),
      },
    });
  };
  return <>
    <PanelHeading title="Resize" note="Canvas size, units, bleed, and safe areas" />
    <div className="mb-3 flex gap-2">{(['px', 'in', 'mm'] as const).map((value) => <Button key={value} size="sm" variant={unit === value ? 'default' : 'outline'} onClick={() => setUnit(value)}>{value}</Button>)}</div>
    <div className="mb-3 grid grid-cols-2 gap-2" aria-label="Page orientation">
      <Button variant={orientation === 'portrait' ? 'default' : 'outline'} aria-pressed={orientation === 'portrait'} onClick={() => setOrientation('portrait')}>Portrait</Button>
      <Button variant={orientation === 'landscape' ? 'default' : 'outline'} aria-pressed={orientation === 'landscape'} onClick={() => setOrientation('landscape')}>Landscape</Button>
    </div>
    <div className="grid grid-cols-2 gap-3"><label className="field-label">Width<Input className="mt-2" type="number" value={Number((page.width / factor).toFixed(2))} onChange={(event) => setDimension('width', Number(event.target.value))} /></label><label className="field-label">Height<Input className="mt-2" type="number" value={Number((page.height / factor).toFixed(2))} onChange={(event) => setDimension('height', Number(event.target.value))} /></label></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => updatePage({ width: 1080, height: 1080 })}>Square</Button><Button variant="outline" onClick={() => updatePage({ width: 1080, height: 1920 })}>Story</Button><Button variant="outline" onClick={() => updatePage({ width: 1920, height: 1080 })}>Video</Button><Button variant="outline" onClick={() => updatePage({ width: 2480, height: 3508 })}>A4</Button></div>
    <label className="field-label mt-5 block">Bleed (px)<Input className="mt-2" type="number" min="0" value={page.metadata?.bleed ?? 0} onChange={(event) => updatePage({ metadata: { ...page.metadata, bleed: Math.max(0, Number(event.target.value)) } })} /></label>
    <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => updatePage({ metadata: { ...page.metadata, guides: [...(page.metadata?.guides ?? []), { id: uid(), axis: 'x', position: page.width / 2 }] } })}>Vertical guide</Button><Button variant="outline" onClick={() => updatePage({ metadata: { ...page.metadata, guides: [...(page.metadata?.guides ?? []), { id: uid(), axis: 'y', position: page.height / 2 }] } })}>Horizontal guide</Button></div>
    <Button className="mt-2 w-full" variant="ghost" onClick={() => updatePage({ metadata: { ...page.metadata, guides: [] } })}>Clear guides</Button>
  </>;
}

export function FontsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const install = async (file?: File) => {
    if (!file) return;
    const family = file.name.replace(/\.[^.]+$/, '');
    const face = new FontFace(family, `url(${URL.createObjectURL(file)})`);
    await face.load();
    document.fonts.add(face);
    setFonts((current) => [...new Set([...current, family])]);
  };
  return <>
    <PanelHeading title="Fonts" note="Upload and register browser fonts" />
    <input ref={inputRef} hidden type="file" accept=".woff,.woff2,.ttf,.otf,font/*" onChange={(event) => void install(event.target.files?.[0])} />
    <Button className="w-full" variant="outline" onClick={() => inputRef.current?.click()}><UploadIcon />Upload font</Button>
    <div className="mt-4 space-y-2">{fonts.map((font) => <div key={font} className="rounded-xl border p-3 text-lg" style={{ fontFamily: font }}>{font}</div>)}</div>
  </>;
}
