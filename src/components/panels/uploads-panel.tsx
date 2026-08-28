import { useRef, useState } from 'react';
import {
  CheckCircle2Icon, CloudUploadIcon, CpuIcon, ImagePlusIcon, KeyRoundIcon,
  LoaderCircleIcon, RotateCcwIcon, SparklesIcon, XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { defaultImageModel, generateImage } from '@/lib/ai/pi-ai-browser-shim';
import { transcodeMedia, type TranscodeOptions } from '@/lib/media/ffmpeg-client';
import { fileToDataUrl, fitImageToPage, loadImageDimensions } from '@/lib/images/image-layout';
import {
  cancelUpload, forgetUpload, getUploadApiUrl, retryUpload, startBackgroundUpload,
} from '@/lib/uploads/upload-manager';
import { useEditorStore } from '@/store/editor-store';
import { useUploadStore, type UploadTask } from '@/store/upload-store';
import { PanelHeading } from './panel-heading';

const uid = () => crypto.randomUUID();

const readableSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function UploadRow({ task }: { task: UploadTask }) {
  const working = task.status === 'authorizing' || task.status === 'uploading';
  const label = {
    local: 'On this device', authorizing: 'Preparing secure upload…', uploading: `${task.progress}% uploaded`,
    complete: 'Stored in R2', error: task.error || 'Upload failed', cancelled: 'Upload cancelled',
  }[task.status];
  return (
    <div className="upload-task" data-status={task.status}>
      <div className="upload-task-icon">
        {task.status === 'complete' || task.status === 'local' ? <CheckCircle2Icon />
          : working ? <LoaderCircleIcon className="animate-spin" /> : <CloudUploadIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">{task.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{readableSize(task.size)}</span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</p>
        {working && <Progress className="mt-2" value={task.status === 'authorizing' ? 4 : task.progress} aria-label={`Uploading ${task.name}`} />}
      </div>
      <div className="flex shrink-0 gap-0.5">
        {(task.status === 'error' || task.status === 'cancelled') && (
          <Button size="icon-xs" variant="ghost" aria-label={`Retry ${task.name}`} onClick={() => void retryUpload(task.id)}><RotateCcwIcon /></Button>
        )}
        <Button
          size="icon-xs" variant="ghost"
          aria-label={working ? `Cancel ${task.name}` : `Remove ${task.name}`}
          onClick={() => working ? cancelUpload(task.id) : forgetUpload(task.id)}
        ><XIcon /></Button>
      </div>
    </div>
  );
}

export function UploadsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const addElement = useEditorStore((state) => state.addElement);
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const tasks = useUploadStore((state) => state.tasks);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(defaultImageModel.id);
  const [baseUrl, setBaseUrl] = useState(defaultImageModel.baseUrl);
  const [aiStatus, setAiStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [mediaStatus, setMediaStatus] = useState<{ name: string; progress: number } | null>(null);
  const [mediaError, setMediaError] = useState('');
  const hasUploadService = Boolean(getUploadApiUrl());

  const addImage = async (src: string, name: string, index = 0, mimeType?: string) => {
    const dimensions = await loadImageDimensions(src).catch(() => ({ width: 1024, height: 1024 }));
    const placement = fitImageToPage(dimensions, page, { cascadeIndex: index });
    addElement({
      id: uid(), type: 'image', name, src, mimeType, alt: name,
      intrinsicWidth: dimensions.width, intrinsicHeight: dimensions.height,
      x: placement.x, y: placement.y, width: placement.width, height: placement.height,
      rotation: 0, opacity: 1, cornerRadius: 20, objectFit: 'contain', aspectLocked: true,
    });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).filter((file) => file.type.startsWith('image/')).forEach((file, index) => {
      void fileToDataUrl(file).then((src) => addImage(src, file.name, index, file.type));
      void startBackgroundUpload(file);
    });
  };

  const handleGenerate = async () => {
    setAiStatus('generating');
    setAiError('');
    try {
      const src = await generateImage({ ...defaultImageModel, id: modelId.trim(), baseUrl: baseUrl.trim() }, {
        apiKey, prompt, quality: 'medium', size: '1024x1024',
      });
      await addImage(src, prompt.trim().slice(0, 42) || 'AI generated image');
      setAiStatus('idle');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Image generation failed');
      setAiStatus('error');
    }
  };

  const handleMedia = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setMediaError('');
    setMediaStatus({ name: file.name, progress: 0 });
    const outputExtension: TranscodeOptions['outputExtension'] = file.type.startsWith('audio/') ? 'mp3' : 'mp4';
    try {
      const output = await transcodeMedia(file, {
        outputExtension,
        onProgress: (progress) => setMediaStatus({ name: file.name, progress }),
      });
      const url = URL.createObjectURL(output);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = output.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMediaStatus(null);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Media conversion failed');
      setMediaStatus(null);
    } finally {
      if (mediaRef.current) mediaRef.current.value = '';
    }
  };

  return (
    <>
      <PanelHeading title="Uploads" note="Local-first assets with optional R2 sync." />
      <Tabs defaultValue="upload">
        <TabsList className="mb-3 grid w-full grid-cols-2">
          <TabsTrigger value="upload"><CloudUploadIcon /> Upload</TabsTrigger>
          <TabsTrigger value="generate"><SparklesIcon /> Generate</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <input ref={inputRef} hidden type="file" accept="image/*,.svg" multiple onChange={(event) => handleFiles(event.target.files)} />
          <button
            className="upload-dropzone" onClick={() => inputRef.current?.click()}
            onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }}
            onDragOver={(event) => event.preventDefault()}
          >
            <span className="upload-icon"><CloudUploadIcon /></span>
            <span className="mt-3 text-sm font-medium">Upload files</span>
            <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP or SVG</span>
          </button>
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/35 px-2.5 py-2 text-[10px] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${hasUploadService ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {hasUploadService ? 'R2 background sync enabled' : 'Local mode — configure VITE_UPLOAD_API_URL for R2'}
          </div>
          {tasks.length > 0 && <div className="mt-3 space-y-2">{tasks.map((task) => <UploadRow key={task.id} task={task} />)}</div>}

          <div className="mt-5 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><CpuIcon className="size-4 text-[#7657ff]" /> Media lab</div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Convert video or audio locally with ffmpeg.wasm. The ~31 MB engine loads only when used.</p>
            <input ref={mediaRef} hidden type="file" accept="video/*,audio/*" onChange={(event) => void handleMedia(event.target.files)} />
            <Button className="mt-3 w-full" variant="outline" size="sm" disabled={Boolean(mediaStatus)} onClick={() => mediaRef.current?.click()}>
              {mediaStatus ? <><LoaderCircleIcon className="animate-spin" /> Processing {mediaStatus.progress}%</> : 'Choose video or audio'}
            </Button>
            {mediaStatus && <Progress className="mt-2" value={mediaStatus.progress} aria-label={`Processing ${mediaStatus.name}`} />}
            {mediaError && <p className="mt-2 text-[10px] text-destructive">{mediaError}</p>}
          </div>
        </TabsContent>

        <TabsContent value="generate">
          <div className="rounded-xl border bg-gradient-to-br from-[#f7f5ff] to-white p-3">
            <div className="flex items-start gap-2.5">
              <span className="upload-icon size-9 rounded-xl"><ImagePlusIcon className="size-4" /></span>
              <div><p className="text-xs font-semibold">Browser AI generation</p><p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">Your key is kept only in component memory and sent directly to the provider.</p></div>
            </div>
            <label className="mt-4 block text-[10px] font-semibold text-muted-foreground">Prompt</label>
            <textarea
              className="mt-1 min-h-28 w-full resize-y rounded-lg border bg-white p-2.5 text-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
              value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A paper-cut illustration of a floating creative studio…"
            />
            <label className="mt-3 block text-[10px] font-semibold text-muted-foreground">Session API key</label>
            <div className="relative mt-1"><KeyRoundIcon className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><Input className="pl-8" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Not saved" /></div>
            <details className="mt-3 text-[10px] text-muted-foreground">
              <summary className="cursor-pointer font-semibold">Provider settings</summary>
              <label className="mt-2 block">Model<Input className="mt-1" value={modelId} onChange={(event) => setModelId(event.target.value)} /></label>
              <label className="mt-2 block">Base URL<Input className="mt-1" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
            </details>
            <Button className="mt-4 w-full bg-[#7657ff] hover:bg-[#6546ee]" disabled={aiStatus === 'generating'} onClick={() => void handleGenerate()}>
              {aiStatus === 'generating' ? <><LoaderCircleIcon className="animate-spin" /> Generating…</> : <><SparklesIcon /> Generate and add</>}
            </Button>
            {aiStatus === 'generating' && <div className="ai-generating-bar mt-3" aria-label="Generating image" />}
            {aiError && <p className="mt-2 text-[10px] leading-relaxed text-destructive">{aiError}</p>}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">For a public production app, do not distribute an app-owned AI key. Use user-owned keys, short-lived provider tokens, or add a narrow AI proxy later.</p>
        </TabsContent>
      </Tabs>
    </>
  );
}
