import { create } from 'zustand';

export type EditorTool = 'select' | 'draw' | 'highlighter' | 'eraser' | 'pan';
export type CanvasViewMode = 'single' | 'continuous';

interface ToolStore {
  tool: EditorTool;
  brushColor: string;
  brushWidth: number;
  brushOpacity: number;
  currentTime: number;
  playing: boolean;
  timelineOpen: boolean;
  canvasViewMode: CanvasViewMode;
  setTool: (tool: EditorTool) => void;
  setBrush: (changes: Partial<Pick<ToolStore, 'brushColor' | 'brushWidth' | 'brushOpacity'>>) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setTimelineOpen: (open: boolean) => void;
  setCanvasViewMode: (mode: CanvasViewMode) => void;
}

export const useToolStore = create<ToolStore>((set) => ({
  tool: 'select',
  brushColor: '#191b24',
  brushWidth: 8,
  brushOpacity: 1,
  currentTime: 0,
  playing: false,
  timelineOpen: false,
  canvasViewMode: 'single',
  setTool: (tool) => set({ tool }),
  setBrush: (changes) => set(changes),
  setCurrentTime: (currentTime) => set({ currentTime: Math.max(0, currentTime) }),
  setPlaying: (playing) => set({ playing }),
  setTimelineOpen: (timelineOpen) => set({ timelineOpen }),
  setCanvasViewMode: (canvasViewMode) => set({ canvasViewMode }),
}));
