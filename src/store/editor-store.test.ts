import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editor-store';
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from '@/types';
import type { DesignDocument, EditorElement, ImageElement, ShapeElement, TextElement } from '@/types';

const textElement = (id = 'text-1', overrides: Partial<TextElement> = {}): TextElement => ({
  id, type: 'text', name: 'Test text', text: 'Hello', x: 10, y: 20, width: 200, height: 80,
  rotation: 0, opacity: 1, fontSize: 32, fontFamily: 'Manrope', fontStyle: 'normal',
  fill: '#111111', align: 'left', letterSpacing: 0, lineHeight: 1.2, ...overrides,
});

const shapeElement = (id = 'shape-1', overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id, type: 'shape', name: 'Test shape', shape: 'rect', x: 30, y: 40, width: 120, height: 120,
  rotation: 0, opacity: 1, fill: '#7657ff', cornerRadius: 8, ...overrides,
});

const projectPage = (name = 'Imported'): DesignDocument => ({
  name, width: 800, height: 600, background: '#abcdef', elements: [textElement()],
});

const imageElement = (id = 'image-1', overrides: Partial<ImageElement> = {}): ImageElement => ({
  id, type: 'image', name: 'Test image', src: 'data:image/png;base64,AA==', x: 0, y: 0,
  width: 300, height: 200, rotation: 0, opacity: 1, cornerRadius: 0, ...overrides,
});

const state = () => useEditorStore.getState();

describe('editor store', () => {
  beforeEach(() => {
    localStorage.clear();
    state().reset();
  });

  describe('initial state and viewport', () => {
    it('starts with a fully populated page and clean history', () => {
      expect(state().pages).toHaveLength(1);
      expect(state().pages[0].elements.length).toBeGreaterThan(5);
      expect(state().activePageIndex).toBe(0);
      expect(state().selectedIds).toEqual([]);
      expect(state().past).toEqual([]);
      expect(state().future).toEqual([]);
    });

    it('changes panels without recording document history', () => {
      state().setActivePanel('layers');
      expect(state().activePanel).toBe('layers');
      expect(state().past).toHaveLength(0);
    });

    it('clamps zoom to the supported range', () => {
      state().setZoom(10);
      expect(state().zoom).toBe(1.5);
      state().setZoom(0.001);
      expect(state().zoom).toBe(0.15);
    });
  });

  describe('elements and selection', () => {
    it('adds and selects an element in one undoable operation', () => {
      const element = textElement();
      const before = state().pages[0].elements.length;
      state().addElement(element);
      expect(state().pages[0].elements).toHaveLength(before + 1);
      expect(state().selectedIds).toEqual([element.id]);
      expect(state().past).toHaveLength(1);
    });

    it('updates an element without mutating unrelated elements', () => {
      state().loadProject([{ ...projectPage(), elements: [textElement(), shapeElement()] }]);
      state().updateElement('text-1', { x: 99, opacity: 0.5 });
      expect(state().pages[0].elements[0]).toMatchObject({ x: 99, opacity: 0.5 });
      expect(state().pages[0].elements[1]).toMatchObject({ id: 'shape-1', x: 30 });
    });

    it('coalesces continuous gesture updates into one undo step', () => {
      state().loadProject([projectPage()]);
      useEditorStore.setState({ past: [], future: [] });
      state().updateElement('text-1', { x: 20 }, false);
      state().updateElement('text-1', { x: 30 }, false);
      state().updateElement('text-1', { x: 40 }, true);
      expect(state().past).toHaveLength(1);
      expect(state().pages[0].elements[0].x).toBe(40);
      state().undo();
      expect(state().pages[0].elements[0].x).toBe(10);
    });

    it('duplicates selected elements with new IDs and an offset', () => {
      state().loadProject([projectPage()]);
      state().setSelectedIds(['text-1']);
      state().duplicateSelected();
      const [original, copy] = state().pages[0].elements as TextElement[];
      expect(copy.id).not.toBe(original.id);
      expect(copy.name).toBe('Test text copy');
      expect(copy.x).toBe(original.x + 24);
      expect(copy.y).toBe(original.y + 24);
      expect(state().selectedIds).toEqual([copy.id]);
    });

    it('does nothing when duplicate has no selection', () => {
      state().loadProject([projectPage()]);
      state().setSelectedIds([]);
      const count = state().pages[0].elements.length;
      const history = state().past.length;
      state().duplicateSelected();
      expect(state().pages[0].elements).toHaveLength(count);
      expect(state().past).toHaveLength(history);
    });

    it('deletes selected unlocked elements but preserves locked ones', () => {
      state().loadProject([{ ...projectPage(), elements: [textElement(), shapeElement('locked', { locked: true })] }]);
      state().setSelectedIds(['text-1', 'locked']);
      state().deleteSelected();
      expect(state().pages[0].elements.map((element) => element.id)).toEqual(['locked']);
      expect(state().selectedIds).toEqual([]);
    });

    it('toggles visibility and locking', () => {
      state().loadProject([projectPage()]);
      state().toggleHidden('text-1');
      state().toggleLock('text-1');
      expect(state().pages[0].elements[0]).toMatchObject({ hidden: true, locked: true });
      state().toggleHidden('text-1');
      state().toggleLock('text-1');
      expect(state().pages[0].elements[0].hidden).toBe(false);
      expect(state().pages[0].elements[0].locked).toBe(false);
    });
  });

  describe('history', () => {
    it('undoes and redoes document operations', () => {
      const originalBackground = state().pages[0].background;
      state().updatePage({ background: '#000000' });
      expect(state().pages[0].background).toBe('#000000');
      state().undo();
      expect(state().pages[0].background).toBe(originalBackground);
      expect(state().future).toHaveLength(1);
      state().redo();
      expect(state().pages[0].background).toBe('#000000');
    });

    it('clears redo history after branching from an undo', () => {
      state().updatePage({ background: '#111111' });
      state().updatePage({ background: '#222222' });
      state().undo();
      expect(state().future).toHaveLength(1);
      state().updatePage({ background: '#333333' });
      expect(state().future).toEqual([]);
      state().redo();
      expect(state().pages[0].background).toBe('#333333');
    });

    it('safely ignores undo and redo at history boundaries', () => {
      state().undo();
      state().redo();
      expect(state().past).toEqual([]);
      expect(state().future).toEqual([]);
    });

    it('limits retained history to fifty snapshots', () => {
      for (let index = 0; index < 60; index += 1) state().updatePage({ name: `Page ${index}` });
      expect(state().past).toHaveLength(50);
    });
  });

  describe('pages and templates', () => {
    it('adds, selects, duplicates, and deletes pages', () => {
      state().addPage();
      expect(state().pages).toHaveLength(2);
      expect(state().activePageIndex).toBe(1);
      expect(state().pages[1].name).toBe('Page 2');
      state().duplicatePage();
      expect(state().pages).toHaveLength(3);
      expect(state().pages[2].name).toBe('Page 2 copy');
      state().deletePage(2);
      expect(state().pages).toHaveLength(2);
      expect(state().activePageIndex).toBe(1);
    });

    it('never deletes the final page', () => {
      state().deletePage(0);
      expect(state().pages).toHaveLength(1);
      expect(state().past).toHaveLength(0);
    });

    it('clears selection when switching pages', () => {
      state().addPage();
      state().setSelectedIds(['anything']);
      state().setActivePage(0);
      expect(state().activePageIndex).toBe(0);
      expect(state().selectedIds).toEqual([]);
    });

    it('duplicates page elements with fresh IDs', () => {
      state().loadProject([projectPage()]);
      state().duplicatePage();
      expect(state().pages[1].elements[0].id).not.toBe(state().pages[0].elements[0].id);
    });

    it('applies a template as an undoable page replacement', () => {
      const replacement = projectPage('Template');
      state().applyTemplate(replacement);
      expect(state().pages[0].name).toBe('Template');
      expect(state().pages[0].elements[0].id).not.toBe('text-1');
      state().undo();
      expect(state().pages[0].name).toBe('Untitled summer post');
    });

    it('loads and deeply clones imported project pages', () => {
      const imported = [projectPage()];
      state().loadProject(imported);
      imported[0].name = 'Mutated outside';
      expect(state().pages[0].name).toBe('Imported');
      expect(state().activePageIndex).toBe(0);
    });

    it('rejects an empty imported project', () => {
      const original = state().pages;
      state().loadProject([]);
      expect(state().pages).toBe(original);
    });

    it('reorders pages while preserving the active page identity', () => {
      state().loadProject([projectPage('One'), projectPage('Two'), projectPage('Three')]);
      state().setActivePage(1);
      state().reorderPage(0, 2);
      expect(state().pages.map((page) => page.name)).toEqual(['Two', 'Three', 'One']);
      expect(state().activePageIndex).toBe(0);
      state().undo();
      expect(state().pages.map((page) => page.name)).toEqual(['One', 'Two', 'Three']);
      expect(state().activePageIndex).toBe(1);
    });

    it('migrates legacy pages to the current schema without mutating the input', () => {
      const legacy = projectPage();
      state().loadProject([legacy]);
      expect(state().pages[0].schemaVersion).toBe(CURRENT_DOCUMENT_SCHEMA_VERSION);
      expect(legacy.schemaVersion).toBeUndefined();
    });
  });

  describe('layers, clipboard, and groups', () => {
    beforeEach(() => {
      state().loadProject([{ ...projectPage(), elements: [textElement(), shapeElement(), textElement('text-2')] }]);
      useEditorStore.setState({ past: [], future: [] });
    });

    it.each([
      ['up', ['shape-1', 'text-1', 'text-2']],
      ['top', ['shape-1', 'text-2', 'text-1']],
      ['bottom', ['text-1', 'shape-1', 'text-2']],
    ] as const)('moves a layer %s', (direction, expected) => {
      state().moveLayer('text-1', direction);
      expect(state().pages[0].elements.map((element) => element.id)).toEqual(expected);
    });

    it('moves a layer down and ignores impossible moves', () => {
      state().moveLayer('text-2', 'down');
      expect(state().pages[0].elements.map((element) => element.id)).toEqual(['text-1', 'text-2', 'shape-1']);
      const past = state().past.length;
      state().moveLayer('text-1', 'bottom');
      expect(state().past).toHaveLength(past);
    });

    it('copies and pastes selected elements with new IDs', () => {
      state().setSelectedIds(['text-1', 'shape-1']);
      state().copySelected();
      expect(state().clipboard).toHaveLength(2);
      state().pasteClipboard();
      expect(state().pages[0].elements).toHaveLength(5);
      expect(new Set(state().pages[0].elements.map((element) => element.id)).size).toBe(5);
      expect(state().selectedIds).toHaveLength(2);
    });

    it('does not paste an empty clipboard', () => {
      useEditorStore.setState({ clipboard: [] });
      state().pasteClipboard();
      expect(state().pages[0].elements).toHaveLength(3);
      expect(state().past).toHaveLength(0);
    });

    it('groups and ungroups multiple selected elements', () => {
      state().setSelectedIds(['text-1', 'shape-1']);
      state().groupSelected();
      const grouped = state().pages[0].elements.filter((element) => ['text-1', 'shape-1'].includes(element.id));
      expect(grouped[0].groupId).toBeTruthy();
      expect(grouped[0].groupId).toBe(grouped[1].groupId);
      state().ungroupSelected();
      expect(state().pages[0].elements.every((element) => !element.groupId)).toBe(true);
    });

    it('requires at least two elements to create a group', () => {
      state().setSelectedIds(['text-1']);
      state().groupSelected();
      expect(state().pages[0].elements[0].groupId).toBeUndefined();
      expect(state().past).toHaveLength(0);
    });

    it('expands selection to the whole group and duplicates it as an independent group', () => {
      state().setSelectedIds(['text-1', 'shape-1']);
      state().groupSelected();
      const originalGroup = state().pages[0].elements[0].groupId;
      state().setSelectedIds(['text-1']);
      expect(state().selectedIds).toEqual(['text-1', 'shape-1']);
      state().duplicateSelected();
      const copies = state().pages[0].elements.filter((element) => state().selectedIds.includes(element.id));
      expect(copies).toHaveLength(2);
      expect(copies[0].groupId).toBe(copies[1].groupId);
      expect(copies[0].groupId).not.toBe(originalGroup);
    });

    it('creates nested logical groups and restores the inner group when ungrouping', () => {
      state().setSelectedIds(['text-1', 'shape-1']);
      state().groupSelected();
      const innerGroup = state().pages[0].elements.find((element) => element.id === 'text-1')?.groupId;

      state().setSelectedIds(['text-1', 'text-2']);
      state().groupSelected();
      const nested = state().pages[0].elements;
      const outerGroup = nested.find((element) => element.id === 'text-1')?.groupId;
      expect(outerGroup).toBeTruthy();
      expect(outerGroup).not.toBe(innerGroup);
      expect(nested.find((element) => element.id === 'text-1')?.groupPath).toEqual([innerGroup, outerGroup]);
      expect(nested.find((element) => element.id === 'shape-1')?.groupPath).toEqual([innerGroup, outerGroup]);
      expect(nested.find((element) => element.id === 'text-2')?.groupPath).toEqual([outerGroup]);

      state().ungroupSelected();
      const restored = state().pages[0].elements;
      expect(restored.find((element) => element.id === 'text-1')?.groupId).toBe(innerGroup);
      expect(restored.find((element) => element.id === 'shape-1')?.groupId).toBe(innerGroup);
      expect(restored.find((element) => element.id === 'text-2')?.groupId).toBeUndefined();
    });
  });

  describe('layout and styles', () => {
    beforeEach(() => {
      state().loadProject([{ ...projectPage(), elements: [
        shapeElement('a', { x: 10, y: 20, width: 20, height: 20, fill: '#111111' }),
        shapeElement('b', { x: 80, y: 80, width: 40, height: 30, fill: '#222222' }),
        shapeElement('c', { x: 230, y: 160, width: 20, height: 40, fill: '#333333' }),
      ] }]);
      useEditorStore.setState({ past: [], future: [] });
      state().setSelectedIds(['a', 'b', 'c']);
    });

    it('aligns and nudges unlocked selected elements as undoable operations', () => {
      state().alignSelected('left');
      expect(state().pages[0].elements.map((element) => element.x)).toEqual([10, 10, 10]);
      state().nudgeSelected(4, -3);
      expect(state().pages[0].elements.map((element) => [element.x, element.y])).toEqual([
        [14, 17], [14, 77], [14, 157],
      ]);
      state().undo();
      expect(state().pages[0].elements.map((element) => element.x)).toEqual([10, 10, 10]);
    });

    it('distributes selected element centers evenly', () => {
      state().distributeSelected('horizontal');
      const centers = state().pages[0].elements.map((element) => element.x + element.width / 2);
      expect(centers[1] - centers[0]).toBeCloseTo(centers[2] - centers[1]);
    });

    it('copies visual style without replacing geometry or content', () => {
      state().copyStyle('a');
      state().setSelectedIds(['b']);
      state().pasteStyle();
      const target = state().pages[0].elements[1] as ShapeElement;
      expect(target.fill).toBe('#111111');
      expect(target.x).toBe(80);
      expect(target.width).toBe(40);
      expect(target.name).toBe('Test shape');
    });
  });

  describe('media effects and timeline metadata', () => {
    beforeEach(() => {
      state().loadProject([{ ...projectPage(), elements: [imageElement()] }]);
      useEditorStore.setState({ past: [], future: [] });
    });

    it('stores crop and incrementally updates effects', () => {
      state().updateCrop('image-1', { x: 0.1, y: 0.2, width: 0.7, height: 0.6 });
      state().updateEffects('image-1', { brightness: 1.1 });
      state().updateEffects('image-1', { contrast: 0.8 });
      expect(state().pages[0].elements[0]).toMatchObject({
        crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
        effects: { brightness: 1.1, contrast: 0.8 },
      });
    });

    it('manages animation tracks, sorted keyframes, playback state, and removal', () => {
      state().updateElementAnimation('image-1', { enabled: true, duration: 3 });
      state().addAnimationKeyframe('image-1', 'opacity', { id: 'late', time: 2, value: 0 });
      state().addAnimationKeyframe('image-1', 'opacity', { id: 'early', time: 0, value: 1 });
      const animation = state().pages[0].elements[0].animation!;
      expect(animation.duration).toBe(3);
      expect(animation.tracks[0].keyframes.map((keyframe) => keyframe.id)).toEqual(['early', 'late']);
      state().removeAnimationKeyframe('image-1', animation.tracks[0].id, 'early');
      expect(state().pages[0].elements[0].animation?.tracks[0].keyframes.map((keyframe) => keyframe.id)).toEqual(['late']);
      state().setPlayhead(-2);
      state().setIsPlaying(true);
      expect(state()).toMatchObject({ playhead: 0, isPlaying: true });
    });
  });

  describe('guard paths and advanced variants', () => {
    it('handles every alignment direction and leaves locked elements untouched', () => {
      const elements = [
        shapeElement('a', { x: 10, y: 20, width: 20, height: 20 }),
        shapeElement('b', { x: 80, y: 90, width: 40, height: 30 }),
        shapeElement('locked', { x: 400, y: 500, locked: true }),
      ];
      for (const alignment of ['center', 'right', 'top', 'middle', 'bottom'] as const) {
        state().loadProject([{ ...projectPage(), elements }]);
        state().setSelectedIds(elements.map((element) => element.id));
        state().alignSelected(alignment);
        expect(state().pages[0].elements.find((element) => element.id === 'locked')).toMatchObject({ x: 400, y: 500 });
      }
      expect(state().pages[0].elements.filter((element) => !element.locked).map((element) => element.y + element.height)).toEqual([120, 120]);
    });

    it('covers vertical distribution and no-op layout guards', () => {
      state().loadProject([{ ...projectPage(), elements: [
        shapeElement('a', { y: 0, height: 20 }),
        shapeElement('b', { y: 40, height: 20 }),
        shapeElement('c', { y: 140, height: 20 }),
        shapeElement('locked', { y: 300, locked: true }),
      ] }]);
      state().setSelectedIds(['a', 'b', 'c']);
      state().distributeSelected('vertical');
      expect(state().pages[0].elements.slice(0, 3).map((element) => element.y)).toEqual([0, 70, 140]);
      const history = state().past.length;
      state().setSelectedIds(['a']);
      state().alignSelected('left');
      state().distributeSelected('horizontal');
      state().nudgeSelected(0, 0);
      expect(state().past).toHaveLength(history);
      state().setSelectedIds(['locked']);
      state().nudgeSelected(1, 1);
      expect(state().pages[0].elements[3].y).toBe(300);
    });

    it('exercises page reorder validation and active-index shifts', () => {
      state().loadProject([projectPage('One'), projectPage('Two'), projectPage('Three')]);
      const history = state().past.length;
      state().reorderPage(-1, 1);
      state().reorderPage(0, 3);
      state().reorderPage(1, 1);
      expect(state().past).toHaveLength(history);
      state().setActivePage(1);
      state().reorderPage(2, 0);
      expect(state().activePageIndex).toBe(2);
      state().reorderPage(0, 1);
      expect(state().activePageIndex).toBe(2);
    });

    it('supports explicit group elements and parent references during duplication', () => {
      const child = shapeElement('child', { parentId: 'group-node' });
      const group = {
        id: 'group-node', type: 'group', name: 'Group', childIds: ['child', 'external'], x: 0, y: 0,
        width: 120, height: 120, rotation: 0, opacity: 1,
      } satisfies EditorElement;
      state().loadProject([{ ...projectPage(), elements: [child, group] }]);
      state().setSelectedIds(['group-node']);
      expect(new Set(state().selectedIds)).toEqual(new Set(['group-node', 'child', 'external']));
      state().duplicateSelected();
      const copies = state().pages[0].elements.slice(2);
      const copiedGroup = copies.find((element) => element.type === 'group')!;
      const copiedChild = copies.find((element) => element.type === 'shape')!;
      expect(copiedChild.parentId).toBe(copiedGroup.id);
      expect(copiedGroup.type === 'group' && copiedGroup.childIds).toContain(copiedChild.id);
      expect(copiedGroup.type === 'group' && copiedGroup.childIds).toContain('external');
    });

    it('handles empty style, invalid media, and clearing crop paths', () => {
      state().loadProject([{ ...projectPage(), elements: [imageElement(), shapeElement()] }]);
      const history = state().past.length;
      state().copyStyle('missing');
      state().pasteStyle();
      state().updateCrop('missing', undefined);
      state().updateCrop('shape-1', { x: 0, y: 0, width: 1, height: 1 });
      state().updateEffects('shape-1', { blur: 1 });
      expect(state().past).toHaveLength(history);
      state().updateCrop('image-1', { x: 0, y: 0, width: 1, height: 1 });
      state().updateCrop('image-1', undefined);
      expect((state().pages[0].elements[0] as ImageElement).crop).toBeUndefined();
      state().setSelectedIds(['image-1']);
      state().copyStyle();
      state().setSelectedIds(['shape-1']);
      state().toggleLock('shape-1');
      const beforePaste = state().past.length;
      state().pasteStyle();
      expect(state().past).toHaveLength(beforePaste);
    });

    it('updates video and SVG effects and rejects missing animation targets', () => {
      const common = { name: 'Media', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
      const video = { ...common, id: 'video', type: 'video', src: 'video.mp4' } satisfies EditorElement;
      const svg = { ...common, id: 'svg', type: 'svg', markup: '<svg />' } satisfies EditorElement;
      state().loadProject([{ ...projectPage(), elements: [video, svg] }]);
      state().updateCrop('video', { x: 0, y: 0, width: 1, height: 1 });
      state().updateEffects('video', { saturation: 0.5 });
      state().updateEffects('svg', { blur: 2 });
      expect(state().pages[0].elements).toMatchObject([
        { crop: { width: 1 }, effects: { saturation: 0.5 } },
        { effects: { blur: 2 } },
      ]);
      const history = state().past.length;
      state().updateElementAnimation('missing', { enabled: true });
      state().addAnimationKeyframe('missing', 'x', { id: 'none', time: 0, value: 0 });
      state().removeAnimationKeyframe('video', 'missing', 'none');
      expect(state().past).toHaveLength(history);
    });

    it('replaces animation tracks and overwrites an existing keyframe by ID', () => {
      state().loadProject([{ ...projectPage(), elements: [imageElement()] }]);
      state().updateElementAnimation('image-1', {
        enabled: true,
        tracks: [{ id: 'track', property: 'x', keyframes: [{ id: 'frame', time: 1, value: 10 }] }],
      });
      state().addAnimationKeyframe('image-1', 'x', { id: 'frame', time: 2, value: 20 });
      const track = state().pages[0].elements[0].animation?.tracks[0];
      expect(track?.keyframes).toEqual([{ id: 'frame', time: 2, value: 20 }]);
      state().removeAnimationKeyframe('image-1', 'track', 'frame');
      state().removeAnimationKeyframe('image-1', 'track', 'frame');
      expect(state().pages[0].elements[0].animation?.tracks[0].keyframes).toEqual([]);
    });

    it('ignores missing lock, visibility, and layer targets', () => {
      const history = state().past.length;
      state().toggleLock('missing');
      state().toggleHidden('missing');
      state().moveLayer('missing', 'top');
      expect(state().past).toHaveLength(history);
    });
  });

  it('resets all document and transient state', () => {
    state().addPage();
    state().setActivePanel('layers');
    state().setZoom(1.2);
    useEditorStore.setState({ clipboard: [shapeElement()] as EditorElement[] });
    state().reset();
    expect(state()).toMatchObject({
      activePageIndex: 0, activePanel: 'templates', zoom: 0.56,
      selectedIds: [], past: [], future: [], gestureStart: null, clipboard: [],
    });
    expect(state().pages).toHaveLength(1);
  });
});
