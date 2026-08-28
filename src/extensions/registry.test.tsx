import { describe, expect, it, vi } from 'vitest';
import type { EditorElement } from '@/types';
import { EditorExtensionRegistry, type EditorExtension } from './registry';

const NullComponent = () => null;
const shape = (): EditorElement => ({
  id: 'shape', type: 'shape', name: 'Shape', shape: 'rect', x: 0, y: 0,
  width: 100, height: 100, rotation: 0, opacity: 1, fill: '#000000', cornerRadius: 0,
});

describe('editor extension registry', () => {
  it('activates, publishes one update, and cleans up exactly once', () => {
    const registry = new EditorExtensionRegistry();
    const listener = vi.fn();
    const cleanup = vi.fn();
    const activate = vi.fn(() => cleanup);
    const unsubscribe = registry.subscribe(listener);

    const registration = registry.register({ id: 'acme.lifecycle', activate });
    expect(registry.has('acme.lifecycle')).toBe(true);
    expect(activate).toHaveBeenCalledWith({ registry, extensionId: 'acme.lifecycle' });
    expect(listener).toHaveBeenCalledTimes(1);

    registration.dispose();
    registration.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(registry.has('acme.lifecycle')).toBe(false);
    unsubscribe();
    registry.register({ id: 'acme.after-unsubscribe' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate extension and contribution IDs without partial registration', () => {
    const registry = new EditorExtensionRegistry();
    registry.register({
      id: 'acme.first',
      panels: [{ id: 'acme.assets', label: 'Assets', component: NullComponent }],
    });
    expect(() => registry.register({ id: 'acme.first' })).toThrow(/already registered/i);
    expect(() => registry.register({
      id: 'acme.second',
      panels: [{ id: 'acme.assets', label: 'Duplicate', component: NullComponent }],
      toolbarActions: [{ id: 'acme.action', label: 'Action', run: vi.fn() }],
    })).toThrow(/panels contribution ID/i);
    expect(registry.has('acme.second')).toBe(false);
    expect(registry.getToolbarActions()).toEqual([]);
    expect(() => registry.register({
      id: 'acme.internal-duplicate',
      animationPresets: [
        { id: 'acme.fade', label: 'Fade one', create: () => ({ enabled: true, tracks: [] }) },
        { id: 'acme.fade', label: 'Fade two', create: () => ({ enabled: true, tracks: [] }) },
      ],
    })).toThrow(/animationPresets contribution ID/i);
  });

  it('rolls back registration when activation fails', () => {
    const registry = new EditorExtensionRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    expect(() => registry.register({
      id: 'acme.broken',
      panels: [{ id: 'acme.broken-panel', label: 'Broken', component: NullComponent }],
      activate: () => { throw new Error('activation failed'); },
    })).toThrow('activation failed');
    expect(registry.has('acme.broken')).toBe(false);
    expect(registry.getPanels()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('sorts contributions deterministically and resolves the first matching renderer', () => {
    const registry = new EditorExtensionRegistry();
    const extension: EditorExtension = {
      id: 'acme.contributions',
      panels: [
        { id: 'z.panel', label: 'Z', order: 20, component: NullComponent },
        { id: 'a.panel', label: 'A', order: 10, component: NullComponent },
      ],
      toolbarActions: [
        { id: 'z.action', label: 'Z', order: 0, run: vi.fn() },
        { id: 'a.action', label: 'A', order: 0, run: vi.fn() },
      ],
      canvasRenderers: [
        { id: 'first.renderer', order: -10, matches: (element) => element.type === 'shape', component: NullComponent },
        { id: 'second.renderer', matches: () => true, component: NullComponent },
      ],
      animationPresets: [
        { id: 'acme.fade', label: 'Fade', create: () => ({ enabled: true, duration: 1, tracks: [] }) },
      ],
    };
    registry.register(extension);
    expect(registry.getPanels().map(({ id }) => id)).toEqual(['a.panel', 'z.panel']);
    expect(registry.getToolbarActions().map(({ id }) => id)).toEqual(['a.action', 'z.action']);
    expect(registry.findCanvasRenderer(shape())?.id).toBe('first.renderer');
    expect(registry.getAnimationPresets()[0].create(shape())).toMatchObject({ enabled: true, duration: 1 });
    expect(registry.unregister('missing')).toBe(false);
    registry.clear();
    expect(registry.getCanvasRenderers()).toEqual([]);
  });

  it('always removes an extension even when its cleanup throws', () => {
    const registry = new EditorExtensionRegistry();
    registry.register({
      id: 'acme.cleanup-error',
      activate: () => () => { throw new Error('cleanup failed'); },
    });
    expect(() => registry.unregister('acme.cleanup-error')).toThrow('cleanup failed');
    expect(registry.has('acme.cleanup-error')).toBe(false);
  });
});
