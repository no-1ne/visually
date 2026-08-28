import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '@/store/editor-store';
import type { DesignDocument } from '@/types';
import { SizePanel } from './advanced-panels';

const page: DesignDocument = {
  name: 'Portrait', width: 600, height: 900, background: '#fff', elements: [],
  metadata: { guides: [{ id: 'x', axis: 'x', position: 800 }, { id: 'y', axis: 'y', position: 800 }] },
};

describe('SizePanel orientation controls', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.setState({ pages: [structuredClone(page)], activePageIndex: 0, past: [], future: [] });
  });

  it('swaps dimensions, exposes pressed state, and clamps guides to the resized page', async () => {
    const user = userEvent.setup();
    render(<SizePanel />);
    expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Landscape' }));
    expect(useEditorStore.getState().pages[0]).toMatchObject({ width: 900, height: 600 });
    expect(useEditorStore.getState().pages[0].metadata?.guides).toMatchObject([{ position: 800 }, { position: 600 }]);
    expect(screen.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Portrait' }));
    expect(useEditorStore.getState().pages[0]).toMatchObject({ width: 600, height: 900 });
    expect(useEditorStore.getState().pages[0].metadata?.guides?.[0].position).toBe(600);
  });
});
