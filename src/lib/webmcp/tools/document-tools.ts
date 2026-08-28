import { exportProjectJson, importProject, pageToSvg } from '@/lib/export';
import { useEditorStore } from '@/store/editor-store';
import type { WebMcpTool } from '../types';
import {
  booleanField, bounded, fail, getActivePage, inputBoolean, inputNumber, inputText,
  numberField, objectSchema, readOnlyTool, stringField, success,
} from './shared';

export const createDocumentTools = (): WebMcpTool[] => [
  {
    name: 'visually_manage_page',
    title: 'Manage Visually pages',
    description: 'Add, duplicate, switch, or delete pages. Deletion requires confirm=true. Document mutations are undoable.',
    inputSchema: objectSchema({
      operation: stringField('Page operation.', { enum: ['add', 'duplicate', 'switch', 'delete'] }),
      pageIndex: { type: 'integer', description: 'Zero-based page index for switch/delete.', minimum: 0 },
      confirm: booleanField('Must be true for page deletion.'),
    }, ['operation']),
    execute: (input) => {
      const state = useEditorStore.getState();
      const operation = inputText(input, 'operation');
      const pageIndex = Math.floor(inputNumber(input, 'pageIndex', state.activePageIndex));
      if (operation === 'add') state.addPage();
      else if (operation === 'duplicate') state.duplicatePage();
      else if (operation === 'switch') {
        if (pageIndex < 0 || pageIndex >= state.pages.length) return fail('pageIndex is out of range.');
        state.setActivePage(pageIndex);
      } else if (operation === 'delete') {
        if (!inputBoolean(input, 'confirm')) return fail('Page deletion was not confirmed. Pass confirm=true only after the user has approved it.');
        if (state.pages.length === 1) return fail('The only page cannot be deleted.');
        if (pageIndex < 0 || pageIndex >= state.pages.length) return fail('pageIndex is out of range.');
        state.deletePage(pageIndex);
      } else return fail('Unsupported page operation.');
      const next = useEditorStore.getState();
      return success(`Completed page operation “${operation}”.`, { activePageIndex: next.activePageIndex, pageCount: next.pages.length });
    },
  },
  {
    name: 'visually_resize_page',
    title: 'Resize the Visually page',
    description: 'Set the active page dimensions, name, or background. Supports square, portrait, landscape, print, and custom sizes. The change is undoable.',
    inputSchema: objectSchema({
      width: numberField('Page width in pixels.', 1, 10000),
      height: numberField('Page height in pixels.', 1, 10000),
      name: stringField('Optional page/design name.'),
      background: stringField('Optional CSS background color.'),
    }),
    execute: (input) => {
      const changes: Record<string, unknown> = {};
      if (typeof input.width === 'number') changes.width = bounded(inputNumber(input, 'width', 1080), 1, 10000);
      if (typeof input.height === 'number') changes.height = bounded(inputNumber(input, 'height', 1080), 1, 10000);
      if (typeof input.name === 'string') changes.name = input.name.slice(0, 512);
      if (typeof input.background === 'string') changes.background = input.background.slice(0, 128);
      if (!Object.keys(changes).length) return fail('Provide at least one page field to update.');
      useEditorStore.getState().updatePage(changes);
      const page = getActivePage();
      return success('Updated the active page.', { name: page.name, width: page.width, height: page.height, background: page.background });
    },
  },
  {
    name: 'visually_history',
    title: 'Undo or redo in Visually',
    description: 'Undo or redo the latest document change.',
    inputSchema: objectSchema({ operation: stringField('History operation.', { enum: ['undo', 'redo'] }) }, ['operation']),
    execute: (input) => {
      const operation = inputText(input, 'operation');
      const state = useEditorStore.getState();
      if (operation === 'undo') {
        if (!state.past.length) return fail('There is nothing to undo.');
        state.undo();
      } else if (operation === 'redo') {
        if (!state.future.length) return fail('There is nothing to redo.');
        state.redo();
      } else return fail('operation must be undo or redo.');
      const next = useEditorStore.getState();
      return success(`Completed ${operation}.`, { canUndo: next.past.length > 0, canRedo: next.future.length > 0 });
    },
  },
  {
    name: 'visually_export_design',
    title: 'Export Visually design data',
    description: 'Return either the full project JSON or the active page as SVG without starting a download.',
    inputSchema: objectSchema({ format: stringField('Export format.', { enum: ['json', 'svg'] }) }, ['format']),
    annotations: readOnlyTool,
    execute: (input) => {
      const format = inputText(input, 'format');
      const state = useEditorStore.getState();
      if (format === 'json') return success('Exported Visually project JSON.', { format, content: exportProjectJson(state.pages) });
      if (format === 'svg') return success('Exported active page SVG.', { format, content: pageToSvg(state.pages[state.activePageIndex]) });
      return fail('format must be json or svg.');
    },
  },
  {
    name: 'visually_import_project',
    title: 'Import a Visually project',
    description: 'Validate and load Visually project JSON. Replacing the open project requires confirm=true and is undoable.',
    inputSchema: objectSchema({
      projectJson: stringField('Visually or legacy Canvasly project JSON, page object, or page array. Maximum 5 MB.'),
      confirm: booleanField('Must be true to replace the currently open project.'),
    }, ['projectJson', 'confirm']),
    execute: (input) => {
      if (!inputBoolean(input, 'confirm')) return fail('Import was not confirmed. Pass confirm=true only after the user has approved replacing the open project.');
      const projectJson = inputText(input, 'projectJson');
      if (projectJson.length > 5_000_000) return fail('Project JSON exceeds the 5 MB WebMCP import limit.');
      try {
        const imported = importProject(projectJson);
        useEditorStore.getState().loadProject(imported.pages);
        return success(`Imported ${imported.pages.length} page${imported.pages.length === 1 ? '' : 's'}.`, {
          pageCount: imported.pages.length,
          sourceVersion: imported.sourceVersion,
          warnings: imported.warnings,
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Project import failed.');
      }
    },
  },
];
