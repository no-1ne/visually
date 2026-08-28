import { useEditorStore } from '@/store/editor-store';
import { templates } from '@/templates';
import type { WebMcpTool } from '../types';
import {
  inputText, objectSchema, readOnlyTool, stringField, success, summarizeElement, fail,
} from './shared';

export const createQueryTools = (): WebMcpTool[] => [
  {
    name: 'visually_get_editor_state',
    title: 'Inspect Visually editor',
    description: 'Get the active page, page list, element summaries, current selection, zoom, and undo/redo availability.',
    inputSchema: objectSchema(),
    annotations: readOnlyTool,
    execute: () => {
      const state = useEditorStore.getState();
      const page = state.pages[state.activePageIndex];
      return success('Visually editor state read.', {
        activePageIndex: state.activePageIndex,
        pageCount: state.pages.length,
        pages: state.pages.map((item, index) => ({
          index,
          name: item.name,
          width: item.width,
          height: item.height,
          elementCount: item.elements.length,
          active: index === state.activePageIndex,
        })),
        activePage: {
          name: page.name,
          width: page.width,
          height: page.height,
          background: page.background,
          elements: page.elements.map(summarizeElement),
        },
        selectedIds: state.selectedIds,
        zoom: state.zoom,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
      });
    },
  },
  {
    name: 'visually_list_templates',
    title: 'List Visually templates',
    description: 'List premade design templates, optionally filtered by name or category. Returns dimensions and identifiers accepted by visually_apply_template.',
    inputSchema: objectSchema({
      query: stringField('Optional case-insensitive template name search.'),
      category: stringField('Optional exact template category.'),
    }),
    annotations: readOnlyTool,
    execute: (input) => {
      const query = inputText(input, 'query').trim().toLowerCase();
      const category = inputText(input, 'category').trim().toLowerCase();
      const matches = templates.filter((item) =>
        (!query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
        && (!category || item.category.toLowerCase() === category),
      );
      return success(`Found ${matches.length} template${matches.length === 1 ? '' : 's'}.`, matches.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        width: item.document.width,
        height: item.document.height,
        background: item.background,
        accent: item.accent,
      })));
    },
  },
  {
    name: 'visually_apply_template',
    title: 'Apply a Visually template',
    description: 'Replace the active page with a premade template. The change is undoable.',
    inputSchema: objectSchema({ templateId: stringField('Template identifier from visually_list_templates.') }, ['templateId']),
    execute: (input) => {
      const template = templates.find((item) => item.id === inputText(input, 'templateId'));
      if (!template) return fail('Unknown templateId. Call visually_list_templates to get valid identifiers.');
      useEditorStore.getState().applyTemplate(template.document);
      return success(`Applied template “${template.name}”.`, { templateId: template.id, page: template.document.name });
    },
  },
];
