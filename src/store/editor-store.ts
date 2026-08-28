import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createInitialDocument } from '@/templates';
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from '@/types';
import type {
  AnimatableProperty, AnimationKeyframe, DesignDocument, EditorElement, ElementAnimation,
  MediaCrop, MediaEffects, PanelId,
} from '@/types';

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionAxis = 'horizontal' | 'vertical';

type ElementStyle = Record<string, unknown>;

type DocumentSnapshot = {
  pages: DesignDocument[];
  activePageIndex: number;
};

export interface EditorStore {
  pages: DesignDocument[];
  activePageIndex: number;
  selectedIds: string[];
  activePanel: PanelId;
  zoom: number;
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
  gestureStart: DocumentSnapshot | null;
  clipboard: EditorElement[];
  styleClipboard: ElementStyle | null;
  playhead: number;
  isPlaying: boolean;
  setActivePanel: (panel: PanelId) => void;
  setSelectedIds: (ids: string[]) => void;
  setZoom: (zoom: number) => void;
  setActivePage: (index: number) => void;
  addPage: () => void;
  duplicatePage: () => void;
  deletePage: (index: number) => void;
  reorderPage: (fromIndex: number, toIndex: number) => void;
  applyTemplate: (document: DesignDocument) => void;
  loadProject: (pages: DesignDocument[]) => void;
  updatePage: (changes: Partial<DesignDocument>) => void;
  addElement: (element: EditorElement) => void;
  updateElement: (id: string, changes: Partial<EditorElement>, commit?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (alignment: Alignment) => void;
  distributeSelected: (axis: DistributionAxis) => void;
  nudgeSelected: (deltaX: number, deltaY: number) => void;
  copyStyle: (id?: string) => void;
  pasteStyle: () => void;
  updateCrop: (id: string, crop: MediaCrop | undefined) => void;
  updateEffects: (id: string, effects: Partial<MediaEffects>) => void;
  updateElementAnimation: (id: string, changes: Partial<ElementAnimation>) => void;
  addAnimationKeyframe: (id: string, property: AnimatableProperty, keyframe: AnimationKeyframe) => void;
  removeAnimationKeyframe: (id: string, trackId: string, keyframeId: string) => void;
  setPlayhead: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  toggleLock: (id: string) => void;
  toggleHidden: (id: string) => void;
  moveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const clone = <T,>(value: T): T => structuredClone(value);

const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length - 1, index));

export const migrateDesignDocument = (page: DesignDocument): DesignDocument => ({
  ...clone(page),
  schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
  elements: Array.isArray(page.elements) ? clone(page.elements) : [],
  metadata: page.metadata ? clone(page.metadata) : undefined,
});

const migratePages = (pages: DesignDocument[]) => pages.map(migrateDesignDocument);

const elementGroupIds = (element: EditorElement): string[] => [
  ...(element.groupPath ?? []),
  ...(element.groupId && !element.groupPath?.includes(element.groupId) ? [element.groupId] : []),
];

const expandGroupSelection = (elements: EditorElement[], ids: string[]): string[] => {
  const selected = new Set(ids.filter((id) => elements.some((element) => element.id === id)));
  let changed = true;
  while (changed) {
    changed = false;
    const groupIds = new Set(elements.filter((element) => selected.has(element.id)).flatMap(elementGroupIds));
    for (const element of elements) {
      const selectedGroup = element.type === 'group' && selected.has(element.id);
      if (selectedGroup) {
        for (const childId of element.childIds) {
          if (!selected.has(childId)) { selected.add(childId); changed = true; }
        }
      }
      if (elementGroupIds(element).some((groupId) => groupIds.has(groupId)) && !selected.has(element.id)) {
        selected.add(element.id);
        changed = true;
      }
    }
  }
  return [...selected];
};

const cloneElementsWithNewIds = (elements: EditorElement[], offset = 0, suffix = ''): EditorElement[] => {
  const idMap = new Map(elements.map((element) => [element.id, crypto.randomUUID()]));
  const groupMap = new Map<string, string>();
  for (const element of elements) for (const groupId of elementGroupIds(element)) if (!groupMap.has(groupId)) groupMap.set(groupId, crypto.randomUUID());
  return elements.map((element) => {
    const copy = clone(element);
    copy.id = idMap.get(element.id)!;
    copy.name = suffix ? `${element.name}${suffix}` : element.name;
    copy.x += offset;
    copy.y += offset;
    if (copy.groupId) copy.groupId = groupMap.get(copy.groupId);
    if (copy.groupPath) copy.groupPath = copy.groupPath.map((groupId) => groupMap.get(groupId) ?? groupId);
    if (copy.parentId) copy.parentId = idMap.get(copy.parentId) ?? copy.parentId;
    if (copy.type === 'group') copy.childIds = copy.childIds.map((id) => idMap.get(id) ?? id);
    return copy;
  });
};

const STYLE_KEYS = [
  'opacity', 'blendMode', 'shadow', 'flipX', 'flipY', 'fill', 'stroke', 'strokeWidth',
  'cornerRadius', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'align', 'verticalAlign',
  'letterSpacing', 'lineHeight', 'textDecoration', 'textTransform', 'padding', 'lineCap',
  'lineJoin', 'dash', 'startMarker', 'endMarker', 'effects', 'objectFit',
] as const;

const elementStyle = (element: EditorElement): ElementStyle => Object.fromEntries(
  STYLE_KEYS.filter((key) => key in element).map((key) => {
    const value = (element as unknown as ElementStyle)[key];
    return [key, value === undefined ? undefined : clone(value)];
  }),
);

const currentSnapshot = (state: Pick<EditorStore, 'pages' | 'activePageIndex'>): DocumentSnapshot => ({
  pages: clone(state.pages),
  activePageIndex: state.activePageIndex,
});

const record = (state: EditorStore): Pick<EditorStore, 'past' | 'future'> => ({
  past: [...state.past.slice(-49), currentSnapshot(state)],
  future: [],
});

const emptyPage = (index: number): DesignDocument => ({
  schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
  name: `Page ${index + 1}`,
  width: 1080,
  height: 1080,
  background: '#FFFFFF',
  elements: [],
});

const STORAGE_KEY = 'visually-project-v1';
const LEGACY_STORAGE_KEY = 'canvasly-project-v1';

function migrateLegacyStorage() {
  if (typeof window === 'undefined') return;
  try {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) window.localStorage.setItem(STORAGE_KEY, legacy);
    }
  } catch {
    // Storage can be disabled by privacy settings; persistence then degrades safely.
  }
}

migrateLegacyStorage();

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      pages: [migrateDesignDocument(createInitialDocument())],
      activePageIndex: 0,
      selectedIds: [],
      activePanel: 'templates',
      zoom: .56,
      past: [],
      future: [],
      gestureStart: null,
      clipboard: [],
      styleClipboard: null,
      playhead: 0,
      isPlaying: false,

      setActivePanel: (activePanel) => set({ activePanel }),
      setSelectedIds: (ids) => set((state) => ({
        selectedIds: expandGroupSelection(state.pages[state.activePageIndex].elements, ids),
      })),
      setZoom: (zoom) => set({ zoom: Math.min(1.5, Math.max(.15, zoom)) }),
      setActivePage: (activePageIndex) => set({ activePageIndex, selectedIds: [] }),

      addPage: () => set((state) => ({
        ...record(state),
        pages: [...state.pages, emptyPage(state.pages.length)],
        activePageIndex: state.pages.length,
        selectedIds: [],
      })),

      duplicatePage: () => set((state) => {
        const copy = clone(state.pages[state.activePageIndex]);
        copy.name = `${copy.name} copy`;
        copy.elements = cloneElementsWithNewIds(copy.elements);
        const pages = [...state.pages];
        pages.splice(state.activePageIndex + 1, 0, copy);
        return { ...record(state), pages, activePageIndex: state.activePageIndex + 1, selectedIds: [] };
      }),

      deletePage: (index) => set((state) => {
        if (state.pages.length === 1) return state;
        const pages = state.pages.filter((_, pageIndex) => pageIndex !== index);
        return {
          ...record(state), pages,
          activePageIndex: Math.min(state.activePageIndex, pages.length - 1), selectedIds: [],
        };
      }),

      reorderPage: (fromIndex, toIndex) => set((state) => {
        if (fromIndex < 0 || fromIndex >= state.pages.length || toIndex < 0 || toIndex >= state.pages.length || fromIndex === toIndex) return state;
        const pages = [...state.pages];
        const [page] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, page);
        let activePageIndex = state.activePageIndex;
        if (activePageIndex === fromIndex) activePageIndex = toIndex;
        else if (fromIndex < activePageIndex && activePageIndex <= toIndex) activePageIndex -= 1;
        else if (toIndex <= activePageIndex && activePageIndex < fromIndex) activePageIndex += 1;
        return { ...record(state), pages, activePageIndex, selectedIds: [] };
      }),

      applyTemplate: (document) => set((state) => {
        const pages = [...state.pages];
        pages[state.activePageIndex] = migrateDesignDocument(document);
        pages[state.activePageIndex].elements = cloneElementsWithNewIds(pages[state.activePageIndex].elements);
        return { ...record(state), pages, selectedIds: [] };
      }),

      loadProject: (pages) => set((state) => {
        if (!pages.length) return state;
        return { ...record(state), pages: migratePages(pages), activePageIndex: 0, selectedIds: [], playhead: 0, isPlaying: false };
      }),

      updatePage: (changes) => set((state) => {
        const pages = [...state.pages];
        pages[state.activePageIndex] = { ...pages[state.activePageIndex], ...changes };
        return { ...record(state), pages };
      }),

      addElement: (element) => set((state) => {
        const pages = [...state.pages];
        const page = pages[state.activePageIndex];
        pages[state.activePageIndex] = { ...page, elements: [...page.elements, element] };
        return { ...record(state), pages, selectedIds: [element.id] };
      }),

      updateElement: (id, changes, commit = true) => set((state) => {
        const pages = [...state.pages];
        const page = pages[state.activePageIndex];
        pages[state.activePageIndex] = {
          ...page,
          elements: page.elements.map((element) => element.id === id ? ({ ...element, ...changes } as EditorElement) : element),
        };
        if (!commit) {
          return { pages, gestureStart: state.gestureStart ?? currentSnapshot(state) };
        }
        if (state.gestureStart) {
          return { pages, past: [...state.past.slice(-49), state.gestureStart], future: [], gestureStart: null };
        }
        return { ...record(state), pages };
      }),

      deleteSelected: () => set((state) => {
        if (!state.selectedIds.length) return state;
        const pages = [...state.pages];
        const page = pages[state.activePageIndex];
        pages[state.activePageIndex] = { ...page, elements: page.elements.filter((element) => !state.selectedIds.includes(element.id) || element.locked) };
        return { ...record(state), pages, selectedIds: [] };
      }),

      duplicateSelected: () => set((state) => {
        const page = state.pages[state.activePageIndex];
        const copies = cloneElementsWithNewIds(
          page.elements.filter((element) => state.selectedIds.includes(element.id)), 24, ' copy',
        );
        if (!copies.length) return state;
        const pages = [...state.pages];
        pages[state.activePageIndex] = { ...page, elements: [...page.elements, ...copies] };
        return { ...record(state), pages, selectedIds: copies.map((element) => element.id) };
      }),

      copySelected: () => set((state) => ({
        clipboard: clone(state.pages[state.activePageIndex].elements.filter((element) => state.selectedIds.includes(element.id))),
      })),

      pasteClipboard: () => set((state) => {
        if (!state.clipboard.length) return state;
        const copies = cloneElementsWithNewIds(state.clipboard, 28, ' copy');
        const pages = [...state.pages];
        const page = pages[state.activePageIndex];
        pages[state.activePageIndex] = { ...page, elements: [...page.elements, ...copies] };
        return { ...record(state), pages, clipboard: copies, selectedIds: copies.map((element) => element.id) };
      }),

      groupSelected: () => set((state) => {
        const selectedIds = expandGroupSelection(state.pages[state.activePageIndex].elements, state.selectedIds);
        if (selectedIds.length < 2) return state;
        const groupId = crypto.randomUUID();
        const pages = clone(state.pages);
        pages[state.activePageIndex].elements.forEach((element) => {
          if (!selectedIds.includes(element.id)) return;
          const path = elementGroupIds(element);
          element.groupPath = [...path, groupId];
          element.groupId = groupId;
        });
        return { ...record(state), pages, selectedIds };
      }),

      ungroupSelected: () => set((state) => {
        const groups = new Set(state.pages[state.activePageIndex].elements.filter((element) => state.selectedIds.includes(element.id)).map((element) => element.groupId).filter(Boolean));
        if (!groups.size) return state;
        const pages = clone(state.pages);
        pages[state.activePageIndex].elements.forEach((element) => {
          if (!element.groupId || !groups.has(element.groupId)) return;
          const path = elementGroupIds(element).filter((groupId) => !groups.has(groupId));
          if (path.length) {
            element.groupPath = path;
            element.groupId = path.at(-1);
          } else {
            delete element.groupPath;
            delete element.groupId;
          }
        });
        return { ...record(state), pages };
      }),

      alignSelected: (alignment) => set((state) => {
        const selectedIds = expandGroupSelection(state.pages[state.activePageIndex].elements, state.selectedIds);
        const selected = state.pages[state.activePageIndex].elements.filter((element) => selectedIds.includes(element.id) && !element.locked);
        if (selected.length < 2) return state;
        const left = Math.min(...selected.map((element) => element.x));
        const right = Math.max(...selected.map((element) => element.x + element.width));
        const top = Math.min(...selected.map((element) => element.y));
        const bottom = Math.max(...selected.map((element) => element.y + element.height));
        const pages = clone(state.pages);
        for (const element of pages[state.activePageIndex].elements) {
          if (!selectedIds.includes(element.id) || element.locked) continue;
          if (alignment === 'left') element.x = left;
          else if (alignment === 'center') element.x = (left + right - element.width) / 2;
          else if (alignment === 'right') element.x = right - element.width;
          else if (alignment === 'top') element.y = top;
          else if (alignment === 'middle') element.y = (top + bottom - element.height) / 2;
          else element.y = bottom - element.height;
        }
        return { ...record(state), pages, selectedIds };
      }),

      distributeSelected: (axis) => set((state) => {
        const selectedIds = expandGroupSelection(state.pages[state.activePageIndex].elements, state.selectedIds);
        const selected = state.pages[state.activePageIndex].elements.filter((element) => selectedIds.includes(element.id) && !element.locked);
        if (selected.length < 3) return state;
        const coordinate = (element: EditorElement) => axis === 'horizontal' ? element.x + element.width / 2 : element.y + element.height / 2;
        const ordered = [...selected].sort((a, b) => coordinate(a) - coordinate(b));
        const start = coordinate(ordered[0]);
        const step = (coordinate(ordered[ordered.length - 1]) - start) / (ordered.length - 1);
        const positions = new Map(ordered.map((element, index) => [element.id, start + step * index]));
        const pages = clone(state.pages);
        for (const element of pages[state.activePageIndex].elements) {
          const center = positions.get(element.id);
          if (center === undefined) continue;
          if (axis === 'horizontal') element.x = center - element.width / 2;
          else element.y = center - element.height / 2;
        }
        return { ...record(state), pages, selectedIds };
      }),

      nudgeSelected: (deltaX, deltaY) => set((state) => {
        if ((!deltaX && !deltaY) || !state.selectedIds.length) return state;
        const selectedIds = expandGroupSelection(state.pages[state.activePageIndex].elements, state.selectedIds);
        const movable = state.pages[state.activePageIndex].elements.some((element) => selectedIds.includes(element.id) && !element.locked);
        if (!movable) return state;
        const pages = clone(state.pages);
        for (const element of pages[state.activePageIndex].elements) {
          if (!selectedIds.includes(element.id) || element.locked) continue;
          element.x += deltaX;
          element.y += deltaY;
        }
        return { ...record(state), pages, selectedIds };
      }),

      copyStyle: (id) => set((state) => {
        const sourceId = id ?? state.selectedIds[0];
        const source = state.pages[state.activePageIndex].elements.find((element) => element.id === sourceId);
        return source ? { styleClipboard: elementStyle(source) } : state;
      }),

      pasteStyle: () => set((state) => {
        if (!state.styleClipboard || !state.selectedIds.length) return state;
        const pages = clone(state.pages);
        let changed = false;
        pages[state.activePageIndex].elements = pages[state.activePageIndex].elements.map((element) => {
          if (!state.selectedIds.includes(element.id) || element.locked) return element;
          changed = true;
          return { ...element, ...clone(state.styleClipboard) } as EditorElement;
        });
        return changed ? { ...record(state), pages } : state;
      }),

      updateCrop: (id, crop) => set((state) => {
        const pages = clone(state.pages);
        const element = pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!element || (element.type !== 'image' && element.type !== 'video')) return state;
        element.crop = crop ? clone(crop) : undefined;
        return { ...record(state), pages };
      }),

      updateEffects: (id, changes) => set((state) => {
        const pages = clone(state.pages);
        const element = pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!element || (element.type !== 'image' && element.type !== 'video' && element.type !== 'svg')) return state;
        element.effects = { ...element.effects, ...changes };
        return { ...record(state), pages };
      }),

      updateElementAnimation: (id, changes) => set((state) => {
        const pages = clone(state.pages);
        const element = pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!element) return state;
        element.animation = {
          enabled: true,
          ...element.animation,
          ...clone(changes),
          tracks: changes.tracks ? clone(changes.tracks) : clone(element.animation?.tracks ?? []),
        };
        return { ...record(state), pages };
      }),

      addAnimationKeyframe: (id, property, keyframe) => set((state) => {
        const pages = clone(state.pages);
        const element = pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!element) return state;
        const animation = element.animation ?? { enabled: true, tracks: [] };
        let track = animation.tracks.find((item) => item.property === property);
        if (!track) {
          track = { id: crypto.randomUUID(), property, keyframes: [] };
          animation.tracks.push(track);
        }
        track.keyframes = [...track.keyframes.filter((item) => item.id !== keyframe.id), clone(keyframe)].sort((a, b) => a.time - b.time);
        element.animation = animation;
        return { ...record(state), pages };
      }),

      removeAnimationKeyframe: (id, trackId, keyframeId) => set((state) => {
        const source = state.pages[state.activePageIndex].elements.find((item) => item.id === id);
        const track = source?.animation?.tracks.find((item) => item.id === trackId);
        if (!track?.keyframes.some((item) => item.id === keyframeId)) return state;
        const pages = clone(state.pages);
        const element = pages[state.activePageIndex].elements.find((item) => item.id === id)!;
        const targetTrack = element.animation!.tracks.find((item) => item.id === trackId)!;
        targetTrack.keyframes = targetTrack.keyframes.filter((item) => item.id !== keyframeId);
        return { ...record(state), pages };
      }),

      setPlayhead: (playhead) => set({ playhead: Math.max(0, playhead) }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),

      toggleLock: (id) => set((state) => {
        const element = state.pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!element) return state;
        const pages = clone(state.pages);
        const target = pages[state.activePageIndex].elements.find((item) => item.id === id)!;
        target.locked = !target.locked;
        return { ...record(state), pages };
      }),

      toggleHidden: (id) => set((state) => {
        const pages = clone(state.pages);
        const target = pages[state.activePageIndex].elements.find((item) => item.id === id);
        if (!target) return state;
        target.hidden = !target.hidden;
        return { ...record(state), pages };
      }),

      moveLayer: (id, direction) => set((state) => {
        const pages = clone(state.pages);
        const elements = pages[state.activePageIndex].elements;
        const index = elements.findIndex((element) => element.id === id);
        if (index < 0) return state;
        const target = direction === 'top' ? elements.length - 1 : direction === 'bottom' ? 0 : direction === 'up' ? Math.min(elements.length - 1, index + 1) : Math.max(0, index - 1);
        if (target === index) return state;
        const [element] = elements.splice(index, 1);
        elements.splice(target, 0, element);
        return { ...record(state), pages };
      }),

      undo: () => set((state) => {
        if (!state.past.length) return state;
        const previous = state.past[state.past.length - 1];
        return {
          pages: clone(previous.pages), activePageIndex: previous.activePageIndex,
          past: state.past.slice(0, -1), future: [currentSnapshot(state), ...state.future],
          selectedIds: [], gestureStart: null,
        };
      }),

      redo: () => set((state) => {
        if (!state.future.length) return state;
        const next = state.future[0];
        return {
          pages: clone(next.pages), activePageIndex: next.activePageIndex,
          past: [...state.past, currentSnapshot(state)], future: state.future.slice(1),
          selectedIds: [], gestureStart: null,
        };
      }),

      reset: () => set({
        pages: [migrateDesignDocument(createInitialDocument())], activePageIndex: 0, selectedIds: [],
        past: [], future: [], gestureStart: null, zoom: .56, activePanel: 'templates',
        clipboard: [], styleClipboard: null, playhead: 0, isPlaying: false,
      }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pages: state.pages, activePageIndex: state.activePageIndex }),
      version: CURRENT_DOCUMENT_SCHEMA_VERSION,
      migrate: (persisted) => {
        const legacy = persisted as Partial<Pick<EditorStore, 'pages' | 'activePageIndex'>>;
        const pages = legacy.pages?.length ? migratePages(legacy.pages) : [migrateDesignDocument(createInitialDocument())];
        return {
          ...legacy,
          pages,
          activePageIndex: clampIndex(legacy.activePageIndex ?? 0, pages.length),
        };
      },
    },
  ),
);
