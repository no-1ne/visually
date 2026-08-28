import { describe, expect, it, vi } from 'vitest';
import {
  BackgroundRemovalError, blobToDataUrl, createBackgroundRemovalAdapter,
  type BackgroundRemovalModuleLoader,
} from './background-removal';

const png = new Blob(['transparent'], { type: 'image/png' });
const result = { toBlob: vi.fn(async () => png) };

describe('browser background removal adapter', () => {
  it('loads the runtime and model lazily once, reports progress, and encodes PNG output', async () => {
    const inference = vi.fn(async () => result);
    const pipeline = vi.fn(async (_task, _model, options: { progress_callback?: (info: unknown) => void }) => {
      options.progress_callback?.({ status: 'progress', progress: 50, file: 'model.onnx' });
      options.progress_callback?.({ status: 'ready' });
      return inference;
    });
    const loader = vi.fn(async () => ({ pipeline })) as unknown as BackgroundRemovalModuleLoader;
    const adapter = createBackgroundRemovalAdapter(loader);
    const onProgress = vi.fn();

    await expect(adapter.remove(new Blob(['one']), { device: 'wasm', onProgress })).resolves.toBe(png);
    await expect(adapter.remove(new Blob(['two']), { device: 'wasm' })).resolves.toBe(png);

    expect(loader).toHaveBeenCalledOnce();
    expect(pipeline).toHaveBeenCalledOnce();
    expect(inference).toHaveBeenCalledTimes(2);
    expect(result.toBlob).toHaveBeenCalledWith('image/png');
    expect(onProgress).toHaveBeenCalledWith({ phase: 'loading-model', percent: 40, detail: 'model.onnx' });
    expect(onProgress).toHaveBeenLastCalledWith({ phase: 'complete', percent: 100, detail: undefined });
  });

  it('rejects immediately when already cancelled without loading ML code', async () => {
    const loader = vi.fn() as unknown as BackgroundRemovalModuleLoader;
    const adapter = createBackgroundRemovalAdapter(loader);
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.remove('data:image/png;base64,AA==', { signal: controller.signal })).rejects.toMatchObject({
      name: 'BackgroundRemovalError', code: 'aborted',
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it('cancels a pending inference result and never encodes stale output', async () => {
    result.toBlob.mockClear();
    let finish!: (value: typeof result) => void;
    const inference = vi.fn(() => new Promise<typeof result>((resolve) => { finish = resolve; }));
    const loader = vi.fn(async () => ({ pipeline: vi.fn(async () => inference) })) as unknown as BackgroundRemovalModuleLoader;
    const adapter = createBackgroundRemovalAdapter(loader);
    const controller = new AbortController();
    const operation = adapter.remove(new Blob(['image']), { signal: controller.signal });
    await vi.waitFor(() => expect(inference).toHaveBeenCalledOnce());
    controller.abort();
    await expect(operation).rejects.toBeInstanceOf(BackgroundRemovalError);
    finish(result);
    await Promise.resolve();
    expect(result.toBlob).not.toHaveBeenCalled();
  });

  it('classifies runtime, model, inference, empty-output, and encoding failures', async () => {
    const runtimeFailure = createBackgroundRemovalAdapter(vi.fn(async () => { throw new Error('chunk'); }));
    await expect(runtimeFailure.remove('image')).rejects.toMatchObject({ code: 'load-failed' });

    const modelFailure = createBackgroundRemovalAdapter(vi.fn(async () => ({
      pipeline: vi.fn(async () => { throw new Error('model'); }),
    })) as unknown as BackgroundRemovalModuleLoader);
    await expect(modelFailure.remove('image')).rejects.toMatchObject({ code: 'load-failed' });

    const withInference = (value: unknown) => createBackgroundRemovalAdapter(vi.fn(async () => ({
      pipeline: vi.fn(async () => vi.fn(async () => {
        if (value instanceof Error) throw value;
        return value;
      })),
    })) as unknown as BackgroundRemovalModuleLoader);
    await expect(withInference(new Error('inference')).remove('image')).rejects.toMatchObject({ code: 'inference-failed' });
    await expect(withInference([]).remove('image')).rejects.toMatchObject({ code: 'inference-failed' });
    await expect(withInference({ toBlob: vi.fn(async () => { throw new Error('encode'); }) }).remove('image')).rejects.toMatchObject({ code: 'encode-failed' });
  });

  it('converts the local result blob to a data URL', async () => {
    await expect(blobToDataUrl(new Blob(['hello'], { type: 'image/png' }))).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
