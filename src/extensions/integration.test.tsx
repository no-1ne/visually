import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorPanel } from '@/components/editor-panel';
import { ContextToolbar } from '@/components/context-toolbar';
import { useEditorStore } from '@/store/editor-store';
import { editorExtensions, type EditorExtensionContext } from './registry';

function BrandPanel({ document }: EditorExtensionContext) {
  return <p>Brand tools for {document.name}</p>;
}

describe('extension UI integration', () => {
  beforeEach(() => {
    editorExtensions.clear();
    useEditorStore.getState().reset();
  });

  afterEach(() => editorExtensions.clear());

  it('mounts a registered panel through the real editor panel host', () => {
    editorExtensions.register({
      id: 'acme.brand-extension',
      panels: [{ id: 'acme.brand-panel', label: 'Brand kit', component: BrandPanel }],
    });
    useEditorStore.getState().setActivePanel('acme.brand-panel');
    render(<EditorPanel />);
    expect(screen.getByText(/Brand tools for Untitled summer post/i)).toBeVisible();
  });

  it('shows, disables, filters, and runs registered toolbar actions with editor context', async () => {
    const user = userEvent.setup();
    const run = vi.fn((context: EditorExtensionContext) => context.setSelectedIds([]));
    editorExtensions.register({
      id: 'acme.toolbar-extension',
      toolbarActions: [
        { id: 'acme.clear-selection', label: 'Clear custom', when: ({ selectedIds }) => selectedIds.length > 0, run },
        { id: 'acme.disabled', label: 'Disabled custom', disabled: () => true, run: vi.fn() },
        { id: 'acme.hidden', label: 'Hidden custom', when: () => false, run: vi.fn() },
      ],
    });
    const first = useEditorStore.getState().pages[0].elements[0].id;
    useEditorStore.getState().setSelectedIds([first]);
    render(<ContextToolbar />);
    expect(screen.queryByRole('button', { name: 'Hidden custom' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disabled custom' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Clear custom' }));
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0].selectedElements[0].id).toBe(first);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});
