import { createVisuallyWebMcpTools } from '@/lib/webmcp/visually-tools';
import { compactProjectSignature } from '@/lib/webmcp/activity-receipts';
import { useAgentActivityStore } from '@/store/agent-activity-store';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';

const projectSignature = () => compactProjectSignature(useEditorStore.getState().pages);

const executeTool = async (name: string, input: Record<string, unknown>) => {
  const tool = createVisuallyWebMcpTools().find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Judge demo requires ${name}.`);
  const result = await tool.execute(input);
  if (!result || typeof result !== 'object' || (result as { ok?: boolean }).ok !== true) {
    const message = result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string'
      ? (result as { error: string }).error : `${name} failed.`;
    throw new Error(message);
  }
  return result;
};

/** Runs the same public tool handlers exposed to a WebMCP host. */
export async function runJudgeDemo() {
  const beforeDepth = useEditorStore.getState().past.length;
  useAgentActivityStore.getState().beginRun();

  try {
    await executeTool('visually_create_campaign', {
      brandName: 'NOVA', headline: 'ONE IDEA. EVERY FORMAT.',
      subheadline: 'A launch system built for every screen.', cta: 'COMING SOON',
      primaryColor: '#0D1220', secondaryColor: '#070A12', accentColor: '#94A3B8', textColor: '#F8FAFC',
      formats: ['instagram_post', 'instagram_story', 'youtube_thumbnail', 'poster', 'landscape_banner'],
      confirm: true,
    });
    await executeTool('visually_apply_brand_update', {
      headline: 'MAKE IDEAS MOVE.', subheadline: 'One launch. Five formats. Fully editable.',
      cta: 'JOIN THE DROP  →', primaryColor: '#15112B', secondaryColor: '#070A12',
      accentColor: '#67E8F9', textColor: '#F8FAFC',
    });
    await executeTool('visually_audit_design', { scope: 'all_pages' });
  } catch (error) {
    useAgentActivityStore.getState().setOpen(true);
    console.error('Judge demo failed.', error);
    return false;
  }

  useToolStore.getState().setCanvasViewMode('continuous');
  const editorAfter = useEditorStore.getState();
  const undoSteps = useAgentActivityStore.getState().activities.reduce((total, activity) => total + (activity.undoSteps ?? 0), 0);
  useAgentActivityStore.getState().finishRun({
    historyDepthAfter: editorAfter.past.length,
    undoSteps: Math.max(editorAfter.past.length - beforeDepth, undoSteps),
    pageSignature: projectSignature(),
  });
  return true;
}

const latestUndoableActivity = () => [...useAgentActivityStore.getState().activities]
  .reverse()
  .find((activity) => activity.status === 'complete' && !activity.readOnly && activity.undoSteps && activity.pageSignature);

export function canUndoAgentChanges() {
  const activityState = useAgentActivityStore.getState();
  const editor = useEditorStore.getState();
  const target = activityState.lastRun ?? latestUndoableActivity();
  return Boolean(target && target.undoSteps && editor.past.length === target.historyDepthAfter && projectSignature() === target.pageSignature);
}

export function undoAgentChanges() {
  const activityStore = useAgentActivityStore.getState();
  const latestActivity = latestUndoableActivity();
  const target = activityStore.lastRun ?? latestActivity;
  if (!target || !canUndoAgentChanges()) return false;
  const undoSteps = target.undoSteps ?? 0;
  for (let index = 0; index < undoSteps; index += 1) useEditorStore.getState().undo();
  if (activityStore.lastRun) {
    useToolStore.getState().setCanvasViewMode('single');
    activityStore.markRunUndone();
  } else if (latestActivity) activityStore.markActivityUndone(latestActivity.id);
  return true;
}

export const canUndoJudgeDemo = canUndoAgentChanges;
export const undoJudgeDemo = undoAgentChanges;
