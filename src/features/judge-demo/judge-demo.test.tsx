import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentActivityControls } from '@/components/agent-activity-panel';
import { useAgentActivityStore } from '@/store/agent-activity-store';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';
import { canUndoJudgeDemo, runJudgeDemo, undoJudgeDemo } from './run-judge-demo';
import { createVisuallyWebMcpTools } from '@/lib/webmcp/visually-tools';

describe('judge demo', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.webmcp;
    useEditorStore.getState().reset();
    useAgentActivityStore.getState().reset();
    useToolStore.getState().setCanvasViewMode('single');
  });

  it('creates a branded five-format campaign through real WebMCP handlers and records their receipts', async () => {
    await runJudgeDemo();

    const editor = useEditorStore.getState();
    expect(editor.pages.map((page) => page.name)).toEqual([
      'NOVA — Instagram Post', 'NOVA — Instagram Story', 'NOVA — YouTube Thumbnail',
      'NOVA — Poster', 'NOVA — Landscape Banner',
    ]);
    expect(editor.pages.every((page) => page.elements.some((element) => element.name === 'Campaign headline' && element.type === 'text' && element.text === 'MAKE IDEAS MOVE.'))).toBe(true);
    expect(useToolStore.getState().canvasViewMode).toBe('continuous');
    expect(useAgentActivityStore.getState().activities.map((activity) => activity.tool)).toEqual([
      'visually_create_campaign', 'visually_apply_brand_update', 'visually_audit_design',
    ]);
    expect(canUndoJudgeDemo()).toBe(true);
  });

  it('undoes the complete run but refuses to overwrite a later human edit', async () => {
    const originalName = useEditorStore.getState().pages[0].name;
    await runJudgeDemo();
    expect(undoJudgeDemo()).toBe(true);
    expect(useEditorStore.getState().pages[0].name).toBe(originalName);
    expect(useAgentActivityStore.getState().activities[0].status).toBe('undone');

    await runJudgeDemo();
    useEditorStore.getState().updatePage({ name: 'Human art direction' });
    expect(canUndoJudgeDemo()).toBe(false);
    expect(undoJudgeDemo()).toBe(false);
    expect(useEditorStore.getState().pages[0].name).toBe('Human art direction');
  });

  it('exposes the campaign workflow and one-click undo in the activity sheet', async () => {
    const user = userEvent.setup();
    render(<AgentActivityControls />);

    await user.click(screen.getByRole('button', { name: 'Run judge demo' }));
    expect(await screen.findByRole('heading', { name: 'Agent activity' })).toBeInTheDocument();
    expect(screen.getByText('Guided demo')).toBeInTheDocument();
    expect(screen.getByText('visually_create_campaign')).toBeInTheDocument();
    expect(screen.getByText(/Created a coordinated 5-format campaign/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo agent changes' }));
    expect(useAgentActivityStore.getState().activities[0].status).toBe('undone');
  });

  it('logs and safely undoes a real host-style mutation outside the guided demo', async () => {
    const originalName = useEditorStore.getState().pages[0].name;
    const resize = createVisuallyWebMcpTools().find((tool) => tool.name === 'visually_resize_page');
    await resize?.execute({ name: 'Agent-renamed page' });

    expect(useAgentActivityStore.getState().activities[0]).toMatchObject({
      tool: 'visually_resize_page', status: 'complete', undoSteps: 1,
    });
    expect(useAgentActivityStore.getState().isOpen).toBe(false);
    expect(canUndoJudgeDemo()).toBe(true);
    expect(undoJudgeDemo()).toBe(true);
    expect(useEditorStore.getState().pages[0].name).toBe(originalName);
  });
});
