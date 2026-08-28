import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface TranscodeOptions {
  outputExtension: 'mp4' | 'webm' | 'gif' | 'mp3';
  args?: string[];
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface FFmpegEngine {
  on: (event: 'progress', callback: (event: { progress: number }) => void) => void;
  off: (event: 'progress', callback: (event: { progress: number }) => void) => void;
  terminate: () => void;
  writeFile: (path: string, data: Uint8Array) => Promise<unknown>;
  exec: (args: string[]) => Promise<unknown>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  deleteFile: (path: string) => Promise<unknown>;
}

let ffmpegPromise: Promise<FFmpeg> | null = null;

export function mediaFilename(name: string, extension: TranscodeOptions['outputExtension']) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'media';
  return `${stem}.${extension}`;
}

async function loadFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
      const ffmpeg = new FFmpeg();
      const base = (import.meta.env.VITE_FFMPEG_CORE_BASE_URL as string | undefined)
        ?? 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

export async function getFFmpegEngine(): Promise<FFmpegEngine> {
  return loadFFmpeg();
}

export async function transcodeMedia(file: File, options: TranscodeOptions): Promise<File> {
  const [{ fetchFile }, ffmpeg] = await Promise.all([import('@ffmpeg/util'), loadFFmpeg()]);
  return transcodeWithEngine(file, options, ffmpeg, fetchFile);
}

export async function transcodeWithEngine(
  file: File,
  options: TranscodeOptions,
  ffmpeg: FFmpegEngine,
  fetchInput: (file: File) => Promise<Uint8Array>,
): Promise<File> {
  const inputName = `input-${crypto.randomUUID()}.${file.name.split('.').pop() || 'bin'}`;
  const outputName = mediaFilename(file.name, options.outputExtension);
  const progress = ({ progress: value }: { progress: number }) => options.onProgress?.(Math.round(value * 100));
  const abort = () => ffmpeg.terminate();
  options.signal?.addEventListener('abort', abort, { once: true });
  ffmpeg.on('progress', progress);
  try {
    await ffmpeg.writeFile(inputName, await fetchInput(file));
    await ffmpeg.exec(['-i', inputName, ...(options.args ?? []), outputName]);
    const output = await ffmpeg.readFile(outputName);
    if (typeof output === 'string') throw new Error('FFmpeg returned an unexpected text result.');
    const bytes = Uint8Array.from(output);
    return new File([bytes.buffer], outputName, { type: mimeFor(options.outputExtension) });
  } finally {
    ffmpeg.off('progress', progress);
    options.signal?.removeEventListener('abort', abort);
    await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
  }
}

function mimeFor(extension: TranscodeOptions['outputExtension']) {
  return ({ mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', mp3: 'audio/mpeg' })[extension];
}
