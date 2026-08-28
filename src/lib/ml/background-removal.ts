export type BackgroundRemovalPhase = 'loading-runtime' | 'loading-model' | 'processing' | 'encoding' | 'complete';

export interface BackgroundRemovalProgress {
  phase: BackgroundRemovalPhase;
  percent: number;
  detail?: string;
}

export interface BackgroundRemovalOptions {
  signal?: AbortSignal;
  onProgress?: (progress: BackgroundRemovalProgress) => void;
  model?: string;
  device?: 'auto' | 'wasm' | 'webgpu';
}

export type BackgroundRemovalErrorCode = 'aborted' | 'load-failed' | 'inference-failed' | 'encode-failed';

export class BackgroundRemovalError extends Error {
  constructor(public readonly code: BackgroundRemovalErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BackgroundRemovalError';
  }
}

interface RawImageResult {
  toBlob(type?: string, quality?: number): Promise<Blob>;
}

interface BackgroundRemovalPipeline {
  (input: Blob | string): Promise<RawImageResult | RawImageResult[]>;
}

interface TransformersModule {
  pipeline(
    task: 'background-removal',
    model: string,
    options: { device?: 'wasm' | 'webgpu'; progress_callback?: (info: unknown) => void },
  ): Promise<BackgroundRemovalPipeline>;
}

export type BackgroundRemovalModuleLoader = () => Promise<TransformersModule>;

const DEFAULT_MODEL = 'Xenova/modnet';
const defaultLoader: BackgroundRemovalModuleLoader = () => import('@huggingface/transformers');

const abortError = () => new BackgroundRemovalError('aborted', 'Background removal was cancelled.');

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

async function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function loadingPercent(info: unknown): { percent: number; detail?: string } | null {
  if (!info || typeof info !== 'object') return null;
  const value = info as Record<string, unknown>;
  const raw = typeof value.progress === 'number' ? value.progress : undefined;
  const percent = raw === undefined ? (value.status === 'ready' ? 100 : undefined) : raw <= 1 ? raw * 100 : raw;
  if (percent === undefined) return null;
  const detail = typeof value.file === 'string' ? value.file : typeof value.status === 'string' ? value.status : undefined;
  return { percent: Math.min(100, Math.max(0, percent)), detail };
}

export interface BackgroundRemovalAdapter {
  remove(source: Blob | string, options?: BackgroundRemovalOptions): Promise<Blob>;
}

/**
 * Creates a lazy, browser-only background-removal adapter. Cancellation stops the
 * caller and prevents applying stale output. Transformers.js does not currently
 * expose interruption of an ONNX inference already in progress, so that work may
 * finish in the background and warm the browser cache.
 */
export function createBackgroundRemovalAdapter(loader: BackgroundRemovalModuleLoader = defaultLoader): BackgroundRemovalAdapter {
  let modulePromise: Promise<TransformersModule> | null = null;
  const pipelines = new Map<string, Promise<BackgroundRemovalPipeline>>();

  return {
    async remove(source, options = {}) {
      const report = (phase: BackgroundRemovalPhase, percent: number, detail?: string) =>
        options.onProgress?.({ phase, percent: Math.min(100, Math.max(0, percent)), detail });
      throwIfAborted(options.signal);
      report('loading-runtime', 2);

      if (!modulePromise) modulePromise = loader().catch((cause) => {
        modulePromise = null;
        throw new BackgroundRemovalError('load-failed', 'Could not load the local background-removal runtime.', { cause });
      });
      const transformers = await abortable(modulePromise, options.signal);
      const model = options.model ?? DEFAULT_MODEL;
      const device = options.device === 'auto' || !options.device
        ? ((navigator as Navigator & { gpu?: unknown }).gpu ? 'webgpu' : 'wasm')
        : options.device;
      const pipelineKey = `${model}:${device}`;
      let pipelinePromise = pipelines.get(pipelineKey);
      if (!pipelinePromise) {
        pipelinePromise = transformers.pipeline('background-removal', model, {
          device,
          progress_callback: (info) => {
            const progress = loadingPercent(info);
            if (progress) report('loading-model', 5 + progress.percent * .7, progress.detail);
          },
        }).catch((cause) => {
          pipelines.delete(pipelineKey);
          throw new BackgroundRemovalError('load-failed', 'Could not download or initialize the background-removal model.', { cause });
        });
        pipelines.set(pipelineKey, pipelinePromise);
      }

      const pipeline = await abortable(pipelinePromise, options.signal);
      throwIfAborted(options.signal);
      report('processing', 80);
      let output: RawImageResult | RawImageResult[];
      try {
        output = await abortable(pipeline(source), options.signal);
      } catch (cause) {
        if (cause instanceof BackgroundRemovalError) throw cause;
        throw new BackgroundRemovalError('inference-failed', 'The image could not be processed locally.', { cause });
      }
      const image = Array.isArray(output) ? output[0] : output;
      if (!image) throw new BackgroundRemovalError('inference-failed', 'The model returned no foreground image.');
      report('encoding', 95);
      try {
        const blob = await abortable(image.toBlob('image/png'), options.signal);
        report('complete', 100);
        return blob;
      } catch (cause) {
        if (cause instanceof BackgroundRemovalError) throw cause;
        throw new BackgroundRemovalError('encode-failed', 'The transparent image could not be encoded.', { cause });
      }
    },
  };
}

const browserBackgroundRemoval = createBackgroundRemovalAdapter();

export const removeImageBackground = browserBackgroundRemoval.remove;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the processed image.'));
    reader.readAsDataURL(blob);
  });
}
