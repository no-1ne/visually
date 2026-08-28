import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bucketAudioChannels, extractAudioWaveform, extractAudioWaveformSafe,
  type AudioDecodeContext, type DecodedAudioBuffer,
} from './audio-waveform';

const decoded = (channels: number[][]): DecodedAudioBuffer => ({
  numberOfChannels: channels.length,
  length: Math.max(0, ...channels.map((channel) => channel.length)),
  duration: 1,
  sampleRate: 48_000,
  getChannelData: (channel) => Float32Array.from(channels[channel]),
});

describe('bucketAudioChannels', () => {
  it('returns the requested stable number of silence buckets', () => {
    expect(bucketAudioChannels([], { bucketCount: 4 })).toEqual([0, 0, 0, 0]);
    expect(bucketAudioChannels([new Float32Array(0)], { bucketCount: 3 })).toEqual([0, 0, 0]);
  });

  it('uses deterministic peak buckets and normalizes the loudest to one', () => {
    expect(bucketAudioChannels([[0.1, -0.5, 0.25, -1]], { bucketCount: 2 })).toEqual([0.5, 1]);
  });

  it('combines channels and tolerates unequal channel lengths', () => {
    expect(bucketAudioChannels([[0.2, 0.1, 0.4, 0.2], [0.1, 0.8]], { bucketCount: 2, normalize: false }))
      .toEqual([0.8, 0.4]);
  });

  it('supports RMS energy without peak bias', () => {
    const waveform = bucketAudioChannels([[1, 0, 1, 0]], { bucketCount: 2, mode: 'rms', normalize: false, precision: 4 });
    expect(waveform).toEqual([0.7071, 0.7071]);
  });

  it('clamps samples, ignores non-finite values, rounds output, and repeats samples when buckets exceed input', () => {
    expect(bucketAudioChannels([[2, Number.NaN]], { bucketCount: 4, normalize: false, precision: 2 }))
      .toEqual([1, 1, 0, 0]);
  });

  it('clamps unreasonable bucket and precision settings', () => {
    expect(bucketAudioChannels([[0.5]], { bucketCount: 0 })).toHaveLength(1);
    expect(bucketAudioChannels([[0.5]], { bucketCount: 9_999 })).toHaveLength(4096);
  });
});

describe('extractAudioWaveform', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('decodes an isolated byte copy, buckets every channel, and closes the context', async () => {
    const close = vi.fn(async () => undefined);
    const decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => {
      expect([...new Uint8Array(bytes)]).toEqual([2, 3]);
      return decoded([[0, 0.5], [0.25, 1]]);
    });
    const backing = new Uint8Array([1, 2, 3, 4]);
    const result = await extractAudioWaveform(backing.subarray(1, 3), { bucketCount: 2 }, () => ({ decodeAudioData, close }));
    expect(result).toEqual([0.25, 1]);
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('supports callback-style Safari decoders', async () => {
    const context: AudioDecodeContext = {
      decodeAudioData: (_bytes, success) => { queueMicrotask(() => success?.(decoded([[0.2, 0.4]]))); },
      close: vi.fn(),
    };
    await expect(extractAudioWaveform(new ArrayBuffer(2), { bucketCount: 2 }, () => context)).resolves.toEqual([0.5, 1]);
  });

  it('closes the context after decode errors and lets the safe API gracefully fall back', async () => {
    const close = vi.fn(async () => undefined);
    const factory = () => ({ decodeAudioData: vi.fn(async () => { throw new DOMException('Unsupported codec', 'EncodingError'); }), close });
    await expect(extractAudioWaveform(new ArrayBuffer(1), {}, factory)).rejects.toThrow('Unsupported codec');
    await expect(extractAudioWaveformSafe(new ArrayBuffer(1), {}, factory)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('falls back when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    await expect(extractAudioWaveformSafe(new ArrayBuffer(1))).resolves.toBeUndefined();
  });

  it('preserves cancellation without constructing an audio context', async () => {
    const controller = new AbortController();
    const factory = vi.fn();
    controller.abort();
    await expect(extractAudioWaveformSafe(new ArrayBuffer(1), { signal: controller.signal }, factory)).rejects.toMatchObject({ name: 'AbortError' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('closes the decoder when cancellation happens during decoding', async () => {
    const controller = new AbortController();
    const close = vi.fn();
    const context: AudioDecodeContext = {
      decodeAudioData: async () => { controller.abort(); return decoded([[1]]); }, close,
    };
    await expect(extractAudioWaveform(new ArrayBuffer(1), { signal: controller.signal }, () => context)).rejects.toMatchObject({ name: 'AbortError' });
    expect(close).toHaveBeenCalledOnce();
  });
});
