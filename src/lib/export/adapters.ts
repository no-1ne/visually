import type { DesignDocument } from '@/types';
import type { FFmpegEngine } from '@/lib/media/ffmpeg-client';
import { pageToSvg, type SvgExportOptions } from './svg';

export type ClientExportFormat = 'gif' | 'mp4' | 'webm' | 'pptx';

export interface ClientExportContext {
  pages: readonly DesignDocument[];
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface ClientExportAdapter<Options = unknown> {
  readonly format: ClientExportFormat;
  readonly mimeType: string;
  isSupported(): boolean;
  export(context: ClientExportContext, options: Options): Promise<Blob>;
}

export interface PageRasterizeOptions extends SvgExportOptions {
  pixelRatio?: number;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
}

export type PageRasterizer = (page: DesignDocument, index: number, options?: PageRasterizeOptions) => Promise<Blob>;

export const browserRasterizer: PageRasterizer = async (page, _index, options = {}) => {
  const ratio = Math.max(0.1, options.pixelRatio ?? 1);
  const svg = pageToSvg(page, options);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The page could not be rasterized. Check that image sources allow cross-origin use.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(page.width * ratio);
    canvas.height = Math.ceil(page.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the page image.')),
      options.mimeType ?? 'image/png', options.quality,
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
};

export interface FfmpegAnimationOptions {
  format: 'gif' | 'mp4' | 'webm';
  framesPerSecond?: number;
  secondsPerPage?: number;
  rasterizer?: PageRasterizer;
  rasterize?: PageRasterizeOptions;
  ffmpegArgs?: string[];
}

const animationMime = { gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' } as const;

/**
 * Encodes page snapshots entirely in the browser using an already-loaded ffmpeg.wasm engine.
 * Keeping engine loading outside this function lets the UI reuse one worker and present its own progress state.
 */
export async function encodePagesWithFfmpeg(
  engine: FFmpegEngine,
  context: ClientExportContext,
  options: FfmpegAnimationOptions,
): Promise<Blob> {
  if (!context.pages.length) throw new Error('At least one page is required.');
  const fps = Math.max(1, Math.min(60, Math.round(options.framesPerSecond ?? 24)));
  const seconds = Math.max(0.05, options.secondsPerPage ?? 1);
  const rasterize = options.rasterizer ?? browserRasterizer;
  const nonce = crypto.randomUUID();
  const inputs: string[] = [];
  const progress = ({ progress }: { progress: number }) => context.onProgress?.(Math.round(Math.min(1, Math.max(0, progress)) * 100));
  const abort = () => engine.terminate();
  context.signal?.addEventListener('abort', abort, { once: true });
  engine.on('progress', progress);
  try {
    for (const [index, page] of context.pages.entries()) {
      if (context.signal?.aborted) throw new DOMException('Export aborted.', 'AbortError');
      const filename = `visually-${nonce}-${String(index).padStart(6, '0')}.png`;
      const frame = await rasterize(page, index, { ...options.rasterize, mimeType: 'image/png' });
      await engine.writeFile(filename, new Uint8Array(await frame.arrayBuffer()));
      inputs.push(filename);
      context.onProgress?.(Math.round(((index + 1) / context.pages.length) * 30));
    }
    const concatName = `visually-${nonce}-pages.txt`;
    const concat = inputs.flatMap((filename) => [`file '${filename}'`, `duration ${seconds}`]);
    concat.push(`file '${inputs.at(-1)}'`);
    await engine.writeFile(concatName, new TextEncoder().encode(concat.join('\n')));
    inputs.push(concatName);
    const outputName = `visually-${nonce}.${options.format}`;
    const defaults = options.format === 'gif'
      ? ['-vf', `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`]
      : options.format === 'mp4' ? ['-r', String(fps), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
        : ['-r', String(fps), '-c:v', 'libvpx-vp9'];
    await engine.exec(['-f', 'concat', '-safe', '0', '-i', concatName, ...(options.ffmpegArgs ?? defaults), outputName]);
    const output = await engine.readFile(outputName);
    if (typeof output === 'string') throw new Error('ffmpeg.wasm returned an unexpected text result.');
    inputs.push(outputName);
    const bytes = Uint8Array.from(output);
    context.onProgress?.(100);
    return new Blob([bytes.buffer], { type: animationMime[options.format] });
  } finally {
    engine.off('progress', progress);
    context.signal?.removeEventListener('abort', abort);
    await Promise.allSettled(inputs.map((filename) => engine.deleteFile(filename)));
  }
}

export function ffmpegAnimationAdapter(engine: FFmpegEngine, format: FfmpegAnimationOptions['format']): ClientExportAdapter<Omit<FfmpegAnimationOptions, 'format'>> {
  return {
    format,
    mimeType: animationMime[format],
    isSupported: () => typeof WebAssembly !== 'undefined',
    export: (context, options) => encodePagesWithFfmpeg(engine, context, { ...options, format }),
  };
}

/** PPTX packages are ZIP containers. Consumers can inject PptxGenJS (or another browser encoder) here. */
export interface PptxExportAdapter extends ClientExportAdapter<Record<string, unknown>> {
  readonly format: 'pptx';
  readonly mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

export function externalPptxAdapter(
  exporter: (context: ClientExportContext, options: Record<string, unknown>) => Promise<Blob>,
): PptxExportAdapter {
  return {
    format: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    isSupported: () => true,
    export: exporter,
  };
}
