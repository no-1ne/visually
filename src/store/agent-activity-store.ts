import { create } from 'zustand';

export type AgentActivity = {
  id: string;
  tool: string;
  title: string;
  input: string;
  receipt: string;
  affected: string[];
  status: 'complete' | 'error' | 'undone';
  readOnly?: boolean;
  /** Snapshot metadata used to verify that one-click undo is still safe. */
  historyDepthAfter?: number;
  undoSteps?: number;
  pageSignature?: string;
};

type AgentRun = {
  historyDepthAfter: number;
  undoSteps: number;
  pageSignature: string;
};

interface AgentActivityStore {
  isOpen: boolean;
  activities: AgentActivity[];
  lastRun: AgentRun | null;
  setOpen: (open: boolean) => void;
  beginRun: () => void;
  finishRun: (lastRun: AgentRun) => void;
  showRun: (activities: AgentActivity[], lastRun: AgentRun) => void;
  appendActivity: (activity: AgentActivity) => void;
  markRunUndone: () => void;
  markActivityUndone: (id: string) => void;
  reset: () => void;
}

export const useAgentActivityStore = create<AgentActivityStore>((set) => ({
  isOpen: false,
  activities: [],
  lastRun: null,
  setOpen: (isOpen) => set({ isOpen }),
  beginRun: () => set({ activities: [], lastRun: null, isOpen: true }),
  finishRun: (lastRun) => set({ lastRun, isOpen: true }),
  showRun: (activities, lastRun) => set({ activities, lastRun, isOpen: true }),
  appendActivity: (activity) => set((state) => ({
    activities: [...state.activities.slice(-49), activity],
  })),
  markRunUndone: () => set((state) => ({
    activities: state.activities.map((activity) => activity.readOnly || activity.status !== 'complete' ? activity : { ...activity, status: 'undone' }),
    lastRun: null,
  })),
  markActivityUndone: (id) => set((state) => ({
    activities: state.activities.map((activity) => activity.id === id ? { ...activity, status: 'undone' } : activity),
  })),
  reset: () => set({ isOpen: false, activities: [], lastRun: null }),
}));
