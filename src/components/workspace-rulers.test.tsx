import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import type { DesignDocument } from '@/types';
import { WorkspaceRulers } from './workspace-rulers';

const page = (guides: NonNullable<DesignDocument['metadata']>['guides'] = []): DesignDocument => ({
  name: 'Guide page', width: 200, height: 100, background: '#fff', elements: [], metadata: { guides },
});

const guides = () => useEditorStore.getState().pages[0].metadata?.guides ?? [];

function setPage(next: DesignDocument, zoom = 2) {
  useEditorStore.setState({ pages: [next], activePageIndex: 0, zoom, past: [], future: [], selectedIds: [] });
}

function mockBounds() {
  const root = screen.getByTestId('workspace-rulers');
  root.getBoundingClientRect = () => ({
    x: 100, y: 100, left: 100, top: 100, width: 400, height: 200,
    right: 500, bottom: 300, toJSON: () => ({}),
  });
  return root;
}

describe('WorkspaceRulers', () => {
  beforeEach(() => {
    localStorage.clear();
    setPage(page());
  });

  it('creates centered guides from both rulers using the keyboard', () => {
    render(<WorkspaceRulers />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Add vertical guide' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Add horizontal guide' }), { key: ' ' });
    expect(guides()).toMatchObject([{ axis: 'x', position: 100 }, { axis: 'y', position: 50 }]);
  });

  it('moves, accelerates, bounds, locks, unlocks, and removes a guide from the keyboard', () => {
    setPage(page([{ id: 'brand', axis: 'x', position: 50 }]));
    render(<WorkspaceRulers />);
    let slider = screen.getByRole('slider', { name: 'vertical guide' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(guides()[0].position).toBe(51);
    slider = screen.getByRole('slider', { name: 'vertical guide' });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(guides()[0].position).toBe(61);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(guides()[0].position).toBe(200);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'l' });
    expect(guides()[0].locked).toBe(true);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Locked vertical guide' }), { key: 'ArrowLeft' });
    expect(guides()[0].position).toBe(200);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'L' });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Delete' });
    expect(guides()).toEqual([]);
  });

  it('previews pointer movement and commits one drag on release', () => {
    setPage(page([{ id: 'brand', axis: 'x', position: 20 }]));
    render(<WorkspaceRulers />);
    const root = mockBounds();
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 140, clientY: 150 });
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 180, clientY: 150 });
    expect(guides()[0].position).toBe(20);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 180, clientY: 150 });
    expect(guides()[0].position).toBe(40);
  });

  it('drags a new guide from a ruler and removes an existing guide outside its drop zone', () => {
    render(<WorkspaceRulers />);
    const root = mockBounds();
    const ruler = screen.getByRole('button', { name: 'Add vertical guide' });
    fireEvent.pointerDown(ruler, { pointerId: 2, clientX: 120, clientY: 90 });
    fireEvent.pointerMove(root, { pointerId: 2, clientX: 250, clientY: 160 });
    fireEvent.pointerUp(root, { pointerId: 2, clientX: 250, clientY: 160 });
    expect(guides()).toMatchObject([{ axis: 'x', position: 75 }]);

    fireEvent.pointerDown(screen.getByRole('slider'), { pointerId: 3, clientX: 250, clientY: 160 });
    fireEvent.pointerMove(root, { pointerId: 3, clientX: 260, clientY: 40 });
    fireEvent.pointerUp(root, { pointerId: 3, clientX: 260, clientY: 40 });
    expect(guides()).toEqual([]);
  });

  it('cancels a drag without changing document history', () => {
    setPage(page([{ id: 'brand', axis: 'y', position: 25 }]));
    render(<WorkspaceRulers />);
    const root = mockBounds();
    fireEvent.pointerDown(screen.getByRole('slider'), { pointerId: 4, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(root, { pointerId: 4, clientX: 200, clientY: 200 });
    fireEvent.pointerCancel(root, { pointerId: 4 });
    expect(guides()[0].position).toBe(25);
    expect(useEditorStore.getState().past).toHaveLength(0);
  });
});
