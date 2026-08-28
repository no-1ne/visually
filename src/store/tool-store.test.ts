import { beforeEach, describe, expect, it } from 'vitest';
import { useToolStore } from './tool-store';

describe('editor tool store', () => {
  beforeEach(() => useToolStore.setState({ tool: 'select', brushColor: '#191b24', brushWidth: 8, brushOpacity: 1, currentTime: 0, playing: false, timelineOpen: false, canvasViewMode: 'single' }));

  it('switches drawing modes and brush attributes', () => {
    useToolStore.getState().setTool('highlighter');
    useToolStore.getState().setBrush({ brushColor: '#ff00aa', brushWidth: 24, brushOpacity: .35 });
    expect(useToolStore.getState()).toMatchObject({ tool: 'highlighter', brushColor: '#ff00aa', brushWidth: 24, brushOpacity: .35 });
  });

  it('clamps negative timeline time and controls playback UI state', () => {
    useToolStore.getState().setCurrentTime(-4);
    useToolStore.getState().setPlaying(true);
    useToolStore.getState().setTimelineOpen(true);
    expect(useToolStore.getState()).toMatchObject({ currentTime: 0, playing: true, timelineOpen: true });
  });

  it('switches between focused and virtual continuous page views', () => {
    useToolStore.getState().setCanvasViewMode('continuous');
    expect(useToolStore.getState().canvasViewMode).toBe('continuous');
  });
});
