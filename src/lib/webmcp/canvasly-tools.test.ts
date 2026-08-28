import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/store/editor-store';
import { templates } from '@/templates';
import { createVisuallyWebMcpTools } from './visually-tools';

type ToolResult = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: unknown;
};

const tools = createVisuallyWebMcpTools();
const run = async (name: string, input: Record<string, unknown> = {}) => {
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error(`Missing test tool ${name}`);
  return await tool.execute(input) as ToolResult;
};
const state = () => useEditorStore.getState();

describe('Visually WebMCP tools', () => {
  beforeEach(() => {
    localStorage.clear();
    state().reset();
  });

  it('publishes a unique, described, schema-backed tool catalog', () => {
    expect(tools).toHaveLength(17);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^visually_[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.execute).toBeTypeOf('function');
    }
  });

  it('returns compact editor state without embedding media payloads', async () => {
    const result = await run('visually_get_editor_state');
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ activePageIndex: 0, pageCount: 1, canUndo: false, canRedo: false });
    expect(JSON.stringify(result.data)).not.toContain('data:image');
  });

  it('lists and filters portrait and landscape templates', async () => {
    const all = await run('visually_list_templates');
    const presentation = await run('visually_list_templates', { category: 'Presentation' });
    const bloom = await run('visually_list_templates', { query: 'Bloom' });
    expect((all.data as unknown[]).length).toBe(templates.length);
    expect(presentation.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'aurora-summit', width: 1920, height: 1080 })]));
    expect(bloom.data).toEqual([expect.objectContaining({ id: 'bloom-sale', width: 1080, height: 1920 })]);
  });

  it('applies templates through the store and preserves undo', async () => {
    expect((await run('visually_apply_template', { templateId: 'missing' })).ok).toBe(false);
    const result = await run('visually_apply_template', { templateId: 'bloom-sale' });
    expect(result.ok).toBe(true);
    expect(state().pages[0]).toMatchObject({ name: 'Bloom Season Sale', width: 1080, height: 1920 });
    state().undo();
    expect(state().pages[0].name).toBe('Untitled summer post');
  });

  it('adds bounded text and shape elements and selects them', async () => {
    expect((await run('visually_add_text', { text: '' })).ok).toBe(false);
    await run('visually_add_text', { text: 'Agent headline', x: -99999, fontSize: 99999, fill: '#123456' });
    const addedText = state().pages[0].elements.at(-1);
    expect(addedText).toMatchObject({ type: 'text', text: 'Agent headline', x: -10000, fontSize: 1000, fill: '#123456' });
    expect(state().selectedIds).toEqual([addedText?.id]);

    expect((await run('visually_add_shape', { shape: 'hexagram' })).ok).toBe(false);
    await run('visually_add_shape', { shape: 'ellipse', width: 320, height: 180, fill: '#abcdef' });
    const addedShape = state().pages[0].elements.at(-1);
    expect(addedShape).toMatchObject({ type: 'shape', shape: 'ellipse', width: 320, height: 180, fill: '#abcdef' });
    expect(state().selectedIds).toEqual([addedShape?.id]);
  });

  it('selects only valid element IDs', async () => {
    const id = state().pages[0].elements[0].id;
    const result = await run('visually_select_elements', { elementIds: [id, 'missing'] });
    expect(result.ok).toBe(true);
    expect(state().selectedIds).toEqual([id]);
    expect((await run('visually_select_elements', { elementIds: 'not-an-array' })).ok).toBe(false);
  });

  it('updates whitelisted generic and type-specific properties', async () => {
    const textElement = state().pages[0].elements.find((element) => element.type === 'text');
    const shapeElement = state().pages[0].elements.find((element) => element.type === 'shape');
    expect(textElement && shapeElement).toBeTruthy();
    const textResult = await run('visually_update_element', {
      elementId: textElement?.id, text: 'WebMCP edit', fontSize: 72, x: 42, opacity: 3,
    });
    expect(textResult.ok).toBe(true);
    expect(state().pages[0].elements.find((element) => element.id === textElement?.id)).toMatchObject({ text: 'WebMCP edit', fontSize: 72, x: 42, opacity: 1 });
    const incompatible = await run('visually_update_element', { elementId: shapeElement?.id, text: 'not allowed' });
    expect(incompatible.ok).toBe(false);
    expect((await run('visually_update_element', { elementId: 'missing', x: 1 })).ok).toBe(false);
  });

  it('arranges, duplicates, and rejects invalid selection operations', async () => {
    const ids = state().pages[0].elements.slice(0, 2).map((element) => element.id);
    await run('visually_select_elements', { elementIds: ids });
    expect((await run('visually_arrange_selection', { operation: 'align', value: 'left' })).ok).toBe(true);
    const aligned = state().pages[0].elements.filter((element) => ids.includes(element.id));
    expect(new Set(aligned.map((element) => element.x)).size).toBe(1);
    const count = state().pages[0].elements.length;
    await run('visually_arrange_selection', { operation: 'duplicate' });
    expect(state().pages[0].elements).toHaveLength(count + 2);
    expect((await run('visually_arrange_selection', { operation: 'layer', value: 'sideways' })).ok).toBe(false);
  });

  it('requires explicit confirmation for selection deletion and keeps undo', async () => {
    const id = state().pages[0].elements[0].id;
    state().setSelectedIds([id]);
    expect((await run('visually_delete_selection', { confirm: false })).ok).toBe(false);
    expect(state().pages[0].elements.some((element) => element.id === id)).toBe(true);
    expect((await run('visually_delete_selection', { confirm: true })).ok).toBe(true);
    expect(state().pages[0].elements.some((element) => element.id === id)).toBe(false);
    state().undo();
    expect(state().pages[0].elements.some((element) => element.id === id)).toBe(true);
  });

  it('manages pages with bounds and deletion safeguards', async () => {
    expect((await run('visually_manage_page', { operation: 'delete', confirm: true, pageIndex: 0 })).ok).toBe(false);
    await run('visually_manage_page', { operation: 'add' });
    expect(state()).toMatchObject({ activePageIndex: 1 });
    expect(state().pages).toHaveLength(2);
    expect((await run('visually_manage_page', { operation: 'switch', pageIndex: 99 })).ok).toBe(false);
    expect((await run('visually_manage_page', { operation: 'delete', pageIndex: 1, confirm: false })).ok).toBe(false);
    expect((await run('visually_manage_page', { operation: 'delete', pageIndex: 1, confirm: true })).ok).toBe(true);
    expect(state().pages).toHaveLength(1);
  });

  it('resizes arbitrary aspect ratios and exposes history operations', async () => {
    await run('visually_resize_page', { width: 1600, height: 800, name: 'Panorama', background: '#001122' });
    expect(state().pages[0]).toMatchObject({ width: 1600, height: 800, name: 'Panorama', background: '#001122' });
    expect((await run('visually_history', { operation: 'undo' })).ok).toBe(true);
    expect(state().pages[0].width).toBe(1080);
    expect((await run('visually_history', { operation: 'redo' })).ok).toBe(true);
    expect(state().pages[0].width).toBe(1600);
    expect((await run('visually_resize_page')).ok).toBe(false);
  });

  it('exports JSON and SVG as read-only structured content', async () => {
    const json = await run('visually_export_design', { format: 'json' });
    const svg = await run('visually_export_design', { format: 'svg' });
    expect(JSON.parse((json.data as { content: string }).content)).toMatchObject({ schema: 'visually-project', version: 2 });
    expect((svg.data as { content: string }).content).toContain('<svg');
    expect((await run('visually_export_design', { format: 'png' })).ok).toBe(false);
  });

  it('validates import input and requires replacement confirmation', async () => {
    const project = JSON.stringify({ pages: [{ name: 'WebMCP imported', width: 500, height: 900, background: '#fff', elements: [] }] });
    expect((await run('visually_import_project', { projectJson: project, confirm: false })).ok).toBe(false);
    expect((await run('visually_import_project', { projectJson: '{bad', confirm: true })).error).toMatch(/invalid/i);
    const result = await run('visually_import_project', { projectJson: project, confirm: true });
    expect(result.ok).toBe(true);
    expect(state().pages[0]).toMatchObject({ name: 'WebMCP imported', width: 500, height: 900 });
    state().undo();
    expect(state().pages[0].name).toBe('Untitled summer post');
  });
});
