import { useAgentActivityStore } from '@/store/agent-activity-store';
import { useEditorStore } from '@/store/editor-store';
import type { AgentActivity } from '@/store/agent-activity-store';
import type { WebMcpTool } from './types';
import {
  affectedElementLabels, affectedPageLabels, compactProjectSignature, resultAffectedLabels, summarizeToolInput,
} from './activity-receipts';
import { createDocumentTools } from './tools/document-tools';
import { createElementTools } from './tools/element-tools';
import { createQueryTools } from './tools/query-tools';
import { createCampaignTools } from './tools/campaign-tools';

const resultMessage = (result: unknown) => {
  if (!result || typeof result !== 'object') return 'Tool completed.';
  const value = result as { message?: unknown; error?: unknown };
  if (typeof value.message === 'string') return value.message;
  if (typeof value.error === 'string') return value.error;
  return 'Tool completed.';
};

const successful = (result: unknown) => Boolean(result && typeof result === 'object' && (result as { ok?: unknown }).ok === true);

const withActivityReceipt = (tool: WebMcpTool): WebMcpTool => ({
  ...tool,
  execute: async (input, options) => {
    const readOnly = Boolean(tool.annotations?.readOnlyHint);
    const before = useEditorStore.getState();
    const beforeSignature = readOnly ? '' : compactProjectSignature(before.pages);
    let result: unknown;
    try {
      result = await tool.execute(input, options);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : 'Tool execution failed.' };
    }
    const after = useEditorStore.getState();
    const afterSignature = readOnly ? '' : compactProjectSignature(after.pages);
    const pageChanged = !readOnly && beforeSignature !== afterSignature;
    const affected = [...new Set([
      ...(pageChanged ? affectedPageLabels(before.pages, after.pages) : []),
      ...(pageChanged ? affectedElementLabels(before.pages, after.pages) : []),
      ...(!readOnly ? resultAffectedLabels(result) : []),
    ])];
    const historyAdvanced = after.past.length > before.past.length
      || (pageChanged && before.past.length === 50 && after.past.length === 50 && after.future.length === 0);
    const undoSteps = historyAdvanced && successful(result) ? 1 : 0;
    const activity: AgentActivity = {
      id: crypto.randomUUID(),
      tool: tool.name,
      title: tool.title ?? tool.name,
      input: summarizeToolInput(input),
      receipt: resultMessage(result),
      affected,
      status: successful(result) ? 'complete' : 'error',
      readOnly,
      historyDepthAfter: after.past.length,
      undoSteps,
      pageSignature: readOnly ? undefined : afterSignature,
    };
    useAgentActivityStore.getState().appendActivity(activity);
    return result;
  },
});

/** Stable public Visually tool catalog. Every execution emits a sanitized activity receipt. */
export function createVisuallyWebMcpTools(): WebMcpTool[] {
  return [
    ...createQueryTools(),
    ...createElementTools(),
    ...createDocumentTools(),
    ...createCampaignTools(),
  ].map(withActivityReceipt);
}
