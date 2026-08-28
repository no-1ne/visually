import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaFilename, transcodeWithEngine, type FFmpegEngine } from './ffmpeg-client';

const engine = {
  on: vi.fn(), off: vi.fn(), terminate: vi.fn(),
  writeFile: vi.fn(async () => undefined),
  exec: vi.fn(async () => 0),
  readFile: vi.fn(async (): Promise<Uint8Array | string> => new Uint8Array([1, 2, 3])),
  deleteFile: vi.fn(async () => true),
} satisfies FFmpegEngine;

const fetchInput = vi.fn(async () => new Uint8Array([9, 8]));

describe('ffmpeg media helpers', () => {
  beforeEach(() => {
    engine.exec.mockImplementation(async () => 0);
    engine.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    engine.on.mockClear();
    engine.off.mockClear();
    engine.deleteFile.mockClear();
    engine.terminate.mockClear();
  });

  it.each([
    ['My vacation.MOV', 'mp4', 'My-vacation.mp4'],
    ['voice memo.wav', 'mp3', 'voice-memo.mp3'],
    ['✨.mp4', 'webm', 'media.webm'],
    ['animation', 'gif', 'animation.gif'],
  ] as const)('creates a safe output name for %s', (input, extension, expected) => {
    expect(mediaFilename(input, extension)).toBe(expected);
  });

  it('transcodes a file in memory and reports experimental ffmpeg progress', async () => {
    const onProgress = vi.fn();
    engine.exec.mockImplementationOnce(async () => {
      const handler = engine.on.mock.calls.find(([event]) => event === 'progress')?.[1];
      handler?.({ progress: 0.42 });
      return 0;
    });
    const output = await transcodeWithEngine(
      new File(['video'], 'clip.mov', { type: 'video/quicktime' }),
      { outputExtension: 'mp4', args: ['-c:v', 'libx264'], onProgress }, engine, fetchInput,
    );
    expect(engine.writeFile).toHaveBeenCalledWith(expect.stringMatching(/^input-.+\.mov$/), new Uint8Array([9, 8]));
    expect(engine.exec).toHaveBeenCalledWith(expect.arrayContaining(['-c:v', 'libx264', 'clip.mp4']));
    expect(output).toMatchObject({ name: 'clip.mp4', type: 'video/mp4', size: 3 });
    expect(onProgress).toHaveBeenCalledWith(42);
    expect(engine.off).toHaveBeenCalledWith('progress', expect.any(Function));
    expect(engine.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('cleans temporary files when ffmpeg returns unexpected text', async () => {
    engine.readFile.mockResolvedValueOnce('unexpected output');
    await expect(transcodeWithEngine(new File(['audio'], 'voice.wav'), { outputExtension: 'mp3' }, engine, fetchInput)).rejects.toThrow('unexpected text');
    expect(engine.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('terminates processing when its AbortSignal fires', async () => {
    const controller = new AbortController();
    engine.exec.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException('stopped', 'AbortError');
    });
    await expect(transcodeWithEngine(new File(['video'], 'clip.webm'), { outputExtension: 'gif', signal: controller.signal }, engine, fetchInput)).rejects.toMatchObject({ name: 'AbortError' });
    expect(engine.terminate).toHaveBeenCalled();
  });
});
