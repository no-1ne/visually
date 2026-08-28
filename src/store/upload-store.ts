import { create } from 'zustand';

export type UploadStatus = 'local' | 'authorizing' | 'uploading' | 'complete' | 'error' | 'cancelled';

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  key?: string;
  assetUrl?: string | null;
}

interface UploadStore {
  tasks: UploadTask[];
  addTask: (task: UploadTask) => void;
  updateTask: (id: string, changes: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  tasks: [],
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks].slice(0, 12) })),
  updateTask: (id, changes) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === id ? { ...task, ...changes } : task),
  })),
  removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
  reset: () => set({ tasks: [] }),
}));
