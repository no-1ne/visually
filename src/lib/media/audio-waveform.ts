export interface WaveformOptions {
  /** Number of visual samples returned. */
  bucketCount?: number;
  /** Peak is more legible for speech; RMS better represents perceived energy. */
  mode?: 'peak' | 'rms';
  /** Scale the loudest bucket to 1. Defaults to true. */
  normalize?: boolean;
  /** Decimal places retained in the project document. Defaults to 4. */
  precision?: number;
  signal?: AbortSignal;
}

export interface DecodedAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly duration: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioDecodeContext {
  decodeAudioData(
    audioData: ArrayBuffer,
    successCallback?: (decodedData: DecodedAudioBuffer) => void,
    errorCallback?: (error: DOMException) => void,
  ): Promise<DecodedAudioBuffer> | void;
  close?(): Promise<void> | void;
}

export type AudioContextFactory = () => AudioDecodeContext;
export type AudioWaveformSource = Blob | ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

const abortError = () => new DOMException('Waveform extraction was aborted.', 'AbortError');
const throwIfAborted = (signal?: AbortSignal) => { if (signal?.aborted) throw abortError(); };
const finiteSample = (value: number | undefined) => Number.isFinite(value) ? Math.min(1, Math.abs(value!)) : 0;

/**
 * Converts decoded PCM channels into stable, normalized visual buckets.
 * Bucket boundaries are based on the longest channel and never depend on timing or browser state.
 */
export function bucketAudioChannels(
  channels: readonly ArrayLike<number>[],
  options: Omit<WaveformOptions, 'signal'> = {},
): number[] {
  const bucketCount = Math.max(1, Math.min(4096, Math.round(options.bucketCount ?? 96)));
  const precision = Math.max(0, Math.min(8, Math.round(options.precision ?? 4)));
  const sampleCount = channels.reduce((maximum, channel) => Math.max(maximum, channel.length), 0);
  if (!sampleCount || !channels.length) return Array(bucketCount).fill(0) as number[];

  const buckets = Array.from({ length: bucketCount }, (_, bucketIndex) => {
    const start = Math.min(sampleCount - 1, Math.floor(bucketIndex * sampleCount / bucketCount));
    const end = Math.min(sampleCount, Math.max(start + 1, Math.floor((bucketIndex + 1) * sampleCount / bucketCount)));
    let peak = 0;
    let sumSquares = 0;
    let values = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      for (const channel of channels) {
        if (sampleIndex >= channel.length) continue;
        const sample = finiteSample(channel[sampleIndex]);
        peak = Math.max(peak, sample);
        sumSquares += sample * sample;
        values += 1;
      }
    }
    return options.mode === 'rms' ? Math.sqrt(sumSquares / Math.max(1, values)) : peak;
  });

  const scale = options.normalize === false ? 1 : Math.max(...buckets);
  if (scale <= Number.EPSILON) return buckets.map(() => 0);
  const multiplier = 10 ** precision;
  return buckets.map((value) => Math.round(Math.min(1, value / scale) * multiplier) / multiplier);
}

function browserAudioContext(): AudioDecodeContext {
  const constructors = globalThis as typeof globalThis & {
    webkitAudioContext?: new () => AudioDecodeContext;
  };
  const Context = globalThis.AudioContext ?? constructors.webkitAudioContext;
  if (!Context) throw new DOMException('Web Audio decoding is unavailable in this browser.', 'NotSupportedError');
  return new Context() as unknown as AudioDecodeContext;
}

async function sourceBytes(source: AudioWaveformSource): Promise<ArrayBuffer> {
  if (source instanceof Blob) return source.arrayBuffer();
  if (source instanceof ArrayBuffer) return source.slice(0);
  const copy = new Uint8Array(source.byteLength);
  copy.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
  return copy.buffer;
}

function decode(context: AudioDecodeContext, bytes: ArrayBuffer): Promise<DecodedAudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (buffer: DecodedAudioBuffer) => { if (!settled) { settled = true; resolve(buffer); } };
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error); } };
    try {
      const result = context.decodeAudioData(bytes, succeed, fail);
      result?.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
  });
}

export async function extractAudioWaveform(
  source: AudioWaveformSource,
  options: WaveformOptions = {},
  contextFactory: AudioContextFactory = browserAudioContext,
): Promise<number[]> {
  throwIfAborted(options.signal);
  const bytes = await sourceBytes(source);
  throwIfAborted(options.signal);
  const context = contextFactory();
  try {
    const audio = await decode(context, bytes);
    throwIfAborted(options.signal);
    const channels = Array.from({ length: Math.max(0, audio.numberOfChannels) }, (_, channel) => audio.getChannelData(channel));
    return bucketAudioChannels(channels, options);
  } finally {
    try { await context.close?.(); } catch { /* Cleanup failure should not hide a successful decode. */ }
  }
}

/** Returns undefined when a codec or Web Audio is unavailable, while preserving explicit cancellation. */
export async function extractAudioWaveformSafe(
  source: AudioWaveformSource,
  options: WaveformOptions = {},
  contextFactory?: AudioContextFactory,
): Promise<number[] | undefined> {
  try {
    return await extractAudioWaveform(source, options, contextFactory);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return undefined;
  }
}
