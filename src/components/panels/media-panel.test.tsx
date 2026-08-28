import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';

const waveformMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/media/audio-waveform', () => ({ extractAudioWaveformSafe: waveformMock }));

import { MediaPanel } from './advanced-panels';

describe('MediaPanel audio waveform integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().reset();
    waveformMock.mockReset();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:local-media'),
      revokeObjectURL: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => 7.5 });
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      set() { queueMicrotask(() => this.onloadedmetadata?.(new Event('loadedmetadata'))); },
    });
  });

  it('stores a decoded waveform on uploaded audio elements', async () => {
    waveformMock.mockResolvedValue([0.1, 0.6, 1, 0.4]);
    const { container } = render(<MediaPanel />);
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(screen.getByText('Reading media…')).toBeInTheDocument();
    await waitFor(() => expect(useEditorStore.getState().pages[0].elements.at(-1)).toMatchObject({
      type: 'audio', name: 'voice.wav', duration: 7.5, trimEnd: 7.5, waveform: [0.1, 0.6, 1, 0.4],
    }));
    expect(waveformMock).toHaveBeenCalledWith(file, { bucketCount: 96, mode: 'peak' });
    await waitFor(() => expect(screen.getByText('Add video or audio')).toBeInTheDocument());
  });

  it('still adds audio when browser decoding is unsupported', async () => {
    waveformMock.mockResolvedValue(undefined);
    const { container } = render(<MediaPanel />);
    const file = new File(['unknown'], 'legacy-audio.bin', { type: 'audio/x-unknown' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(useEditorStore.getState().pages[0].elements.at(-1)?.type).toBe('audio'));
    const audio = useEditorStore.getState().pages[0].elements.at(-1);
    expect(audio).not.toHaveProperty('waveform');
  });

  it('does not run the audio decoder for video files', async () => {
    const { container } = render(<MediaPanel />);
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(useEditorStore.getState().pages[0].elements.at(-1)?.type).toBe('video'));
    expect(waveformMock).not.toHaveBeenCalled();
  });
});
