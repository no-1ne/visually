import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '@/store/editor-store';
import type { DesignDocument, ImageElement } from '@/types';
import { EffectsPanel } from './advanced-panels';

const ml = vi.hoisted(() => ({
  remove: vi.fn(),
  toDataUrl: vi.fn(async () => 'data:image/png;base64,cutout'),
}));

vi.mock('@/lib/ml/background-removal', () => ({
  removeImageBackground: ml.remove,
  blobToDataUrl: ml.toDataUrl,
  BackgroundRemovalError: class BackgroundRemovalError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

const image = (): ImageElement => ({
  id: 'image', type: 'image', name: 'Portrait', src: 'data:image/jpeg;base64,original',
  x: 0, y: 0, width: 400, height: 500, rotation: 0, opacity: 1, cornerRadius: 0,
});

const page = (): DesignDocument => ({
  name: 'Effects', width: 1080, height: 1080, background: '#fff', elements: [image()],
});

describe('EffectsPanel background removal', () => {
  beforeEach(() => {
    ml.remove.mockReset();
    ml.toDataUrl.mockClear();
    useEditorStore.getState().reset();
    useEditorStore.getState().loadProject([page()]);
    useEditorStore.getState().setSelectedIds(['image']);
  });

  it('shows local model progress and commits the transparent PNG as one image update', async () => {
    const user = userEvent.setup();
    let finish!: (blob: Blob) => void;
    ml.remove.mockImplementation((_source, options) => {
      options.onProgress({ phase: 'loading-model', percent: 42, detail: 'model.onnx' });
      return new Promise<Blob>((resolve) => { finish = resolve; });
    });
    render(<EffectsPanel />);
    await user.click(screen.getByRole('button', { name: /remove background/i }));
    expect(screen.getByRole('progressbar', { name: /background removal progress/i })).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText(/image is never uploaded/i)).toBeVisible();
    finish(new Blob(['png'], { type: 'image/png' }));
    await waitFor(() => expect((useEditorStore.getState().pages[0].elements[0] as ImageElement).src).toBe('data:image/png;base64,cutout'));
    expect(ml.remove).toHaveBeenCalledWith('data:image/jpeg;base64,original', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect((useEditorStore.getState().pages[0].elements[0] as ImageElement).mimeType).toBe('image/png');
  });

  it('cancels without applying stale output and presents actionable inference errors', async () => {
    const user = userEvent.setup();
    ml.remove.mockImplementationOnce((_source, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'aborted' })), { once: true });
    }));
    const { unmount } = render(<EffectsPanel />);
    await user.click(screen.getByRole('button', { name: /remove background/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect((useEditorStore.getState().pages[0].elements[0] as ImageElement).src).toContain('original');
    unmount();

    ml.remove.mockRejectedValueOnce(new Error('Model files are unavailable offline.'));
    render(<EffectsPanel />);
    await user.click(screen.getByRole('button', { name: /remove background/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Model files are unavailable offline.');
  });
});
