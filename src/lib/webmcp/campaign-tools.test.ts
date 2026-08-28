import { beforeEach, describe, expect, it } from 'vitest';
import { useAgentActivityStore } from '@/store/agent-activity-store';
import { useEditorStore } from '@/store/editor-store';
import type { ImageElement } from '@/types';
import { createVisuallyWebMcpTools } from './visually-tools';

type ToolResult = { ok: boolean; message?: string; error?: string; data?: unknown };
const tools = createVisuallyWebMcpTools();
const run = async (name: string, input: Record<string, unknown> = {}) => {
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error(`Missing test tool ${name}`);
  return await tool.execute(input) as ToolResult;
};
const editor = () => useEditorStore.getState();

describe('campaign WebMCP tools', () => {
  beforeEach(() => {
    localStorage.clear();
    editor().reset();
    useAgentActivityStore.getState().reset();
  });

  it('creates requested campaign formats atomically and can undo in one step', async () => {
    const originalName = editor().pages[0].name;
    expect((await run('visually_create_campaign', { brandName: 'Nova', headline: 'Build the future', confirm: false })).ok).toBe(false);
    const result = await run('visually_create_campaign', {
      brandName: 'Nova', headline: 'Build the future', subheadline: 'One system. Every surface.',
      cta: 'JOIN NOW', formats: ['instagram_post', 'instagram_story', 'youtube_thumbnail'], confirm: true,
    });
    expect(result.ok).toBe(true);
    expect(editor().pages.map((page) => [page.width, page.height])).toEqual([[1080, 1080], [1080, 1920], [1280, 720]]);
    expect(editor().past).toHaveLength(1);
    for (const page of editor().pages) {
      expect(page.elements.find((element) => element.metadata?.semanticRole === 'headline')).toMatchObject({ type: 'text', text: 'Build the future' });
      expect(page.metadata?.tags).toContain('campaign');
    }
    editor().undo();
    expect(editor().pages).toHaveLength(1);
    expect(editor().pages[0].name).toBe(originalName);
  });

  it('propagates semantic copy, brand tokens, and typography across every page in one undo step', async () => {
    await run('visually_create_campaign', { brandName: 'Nova', headline: 'First message', confirm: true });
    useEditorStore.setState({ past: [], future: [] });
    const result = await run('visually_apply_brand_update', {
      brandName: 'Orbit', headline: 'A shared new message', cta: 'START', primaryColor: '#112244',
      secondaryColor: '#F0EFEA', accentColor: '#FFCC33', textColor: '#FFFFFF', fontFamily: 'DM Sans',
    });
    expect(result).toMatchObject({ ok: true, data: { updatedPages: 5, appliedFields: expect.arrayContaining(['brandName', 'headline', 'accentColor']) } });
    expect(editor().past).toHaveLength(1);
    for (const page of editor().pages) {
      expect(page.name).toMatch(/^Orbit —/);
      expect(page.background).toBe('#F0EFEA');
      expect(page.elements.find((element) => element.metadata?.semanticRole === 'headline')).toMatchObject({ text: 'A shared new message', fill: '#FFFFFF', fontFamily: 'DM Sans' });
      expect(page.elements.find((element) => element.metadata?.semanticRole === 'ctaBackground')).toMatchObject({ fill: '#FFCC33' });
    }
    editor().undo();
    expect(editor().pages[0].name).toMatch(/^Nova —/);
  });

  it('reports quality issues without mutating the document or history', async () => {
    await run('visually_create_campaign', { brandName: 'Nova', headline: 'Launch', confirm: true });
    const page = structuredClone(editor().pages[0]);
    const headline = page.elements.find((element) => element.metadata?.semanticRole === 'headline');
    if (!headline || headline.type !== 'text') throw new Error('Campaign headline missing');
    headline.x = -10;
    headline.fill = '#172034';
    page.elements.push({
      id: 'missing-alt', type: 'image', name: 'Product shot', src: 'product.png', x: 100, y: 100,
      width: 200, height: 200, rotation: 0, opacity: 1, cornerRadius: 0,
    } satisfies ImageElement);
    editor().loadProject([page]);
    useEditorStore.setState({ past: [], future: [] });
    const before = JSON.stringify(editor().pages);
    const result = await run('visually_audit_design', { scope: 'all_pages' });
    const report = result.data as { summary: { byCategory: Record<string, number> }; issues: Array<{ category: string }> };
    expect(result.ok).toBe(true);
    expect(report.summary.byCategory).toMatchObject({ overflow: 1, missing_alt: 1 });
    expect(report.issues.some((item) => item.category === 'contrast')).toBe(true);
    expect(JSON.stringify(editor().pages)).toBe(before);
    expect(editor().past).toEqual([]);
  });

  it('emits sanitized centralized activity receipts for existing and new tools', async () => {
    await run('visually_get_editor_state');
    await run('visually_create_campaign', { brandName: 'Nova', headline: 'Launch', confirm: true });
    const activities = useAgentActivityStore.getState().activities;
    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({ tool: 'visually_get_editor_state', readOnly: true, undoSteps: 0, affected: [] });
    expect(activities[1]).toMatchObject({ tool: 'visually_create_campaign', undoSteps: 1, historyDepthAfter: 1 });
    expect(activities[1].affected).toEqual(expect.arrayContaining(['5 pages', expect.stringMatching(/^\d+ elements$/)]));
    expect(activities[1].input).toContain('brandName: Nova');
    expect(activities[1].receipt).toMatch(/Created a coordinated 5-format campaign/);
  });
});
