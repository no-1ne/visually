import { useEditorStore, type Alignment, type DistributionAxis } from '@/store/editor-store';
import type { EditorElement, ShapeKind, TextElement } from '@/types';
import type { WebMcpTool } from '../types';
import {
  booleanField, bounded, fail, getActivePage, inputBoolean, inputNumber, inputText,
  numberField, objectSchema, stringField, success, summarizeElement,
} from './shared';

const shapeKinds: ShapeKind[] = ['rect', 'circle', 'ellipse', 'triangle', 'polygon', 'star'];
const alignments: Alignment[] = ['left', 'center', 'right', 'top', 'middle', 'bottom'];
const distributionAxes: DistributionAxis[] = ['horizontal', 'vertical'];
const layerDirections = ['up', 'down', 'top', 'bottom'] as const;

export const createElementTools = (): WebMcpTool[] => [
  {
    name: 'visually_add_text',
    title: 'Add text to Visually',
    description: 'Add and select an editable text element on the active page. The change is undoable.',
    inputSchema: objectSchema({
      text: stringField('Text content, up to 10,000 characters.'),
      name: stringField('Optional layer name.'),
      x: numberField('Left position in page pixels.'),
      y: numberField('Top position in page pixels.'),
      width: numberField('Text box width in pixels.', 1, 10000),
      height: numberField('Text box height in pixels.', 1, 10000),
      fontSize: numberField('Font size in pixels.', 1, 1000),
      fontFamily: stringField('CSS font family.'),
      fill: stringField('CSS text color.'),
      align: stringField('Horizontal alignment.', { enum: ['left', 'center', 'right', 'justify'] }),
    }, ['text']),
    execute: (input) => {
      const page = getActivePage();
      const value = inputText(input, 'text').slice(0, 10_000);
      if (!value) return fail('Text content cannot be empty.');
      const requestedAlignment = inputText(input, 'align');
      const element: TextElement = {
        id: crypto.randomUUID(),
        type: 'text',
        name: inputText(input, 'name', 'Agent text').slice(0, 128),
        text: value,
        x: bounded(inputNumber(input, 'x', page.width * .15), -10000, 10000),
        y: bounded(inputNumber(input, 'y', page.height * .2), -10000, 10000),
        width: bounded(inputNumber(input, 'width', page.width * .7), 1, 10000),
        height: bounded(inputNumber(input, 'height', Math.max(100, page.height * .18)), 1, 10000),
        rotation: 0,
        opacity: 1,
        fontSize: bounded(inputNumber(input, 'fontSize', 64), 1, 1000),
        fontFamily: inputText(input, 'fontFamily', 'Manrope').slice(0, 128),
        fontStyle: 'normal',
        fill: inputText(input, 'fill', '#171923').slice(0, 128),
        align: ['left', 'center', 'right', 'justify'].includes(requestedAlignment)
          ? requestedAlignment as TextElement['align']
          : 'left',
        letterSpacing: 0,
        lineHeight: 1.2,
      };
      useEditorStore.getState().addElement(element);
      return success(`Added text layer “${element.name}”.`, { element: summarizeElement(element) });
    },
  },
  {
    name: 'visually_add_shape',
    title: 'Add a shape to Visually',
    description: 'Add and select a rectangle, circle, ellipse, triangle, polygon, or star on the active page. The change is undoable.',
    inputSchema: objectSchema({
      shape: stringField('Shape kind.', { enum: shapeKinds }),
      name: stringField('Optional layer name.'),
      x: numberField('Left position in page pixels.'),
      y: numberField('Top position in page pixels.'),
      width: numberField('Shape width in pixels.', 1, 10000),
      height: numberField('Shape height in pixels.', 1, 10000),
      fill: stringField('CSS fill color.'),
      stroke: stringField('Optional CSS stroke color.'),
      strokeWidth: numberField('Optional stroke width.', 0, 1000),
      cornerRadius: numberField('Corner radius for rectangles.', 0, 5000),
    }, ['shape']),
    execute: (input) => {
      const shape = inputText(input, 'shape') as ShapeKind;
      if (!shapeKinds.includes(shape)) return fail('Unsupported shape kind.');
      const page = getActivePage();
      const element: EditorElement = {
        id: crypto.randomUUID(), type: 'shape', shape,
        name: inputText(input, 'name', `Agent ${shape}`).slice(0, 128),
        x: bounded(inputNumber(input, 'x', page.width * .25), -10000, 10000),
        y: bounded(inputNumber(input, 'y', page.height * .25), -10000, 10000),
        width: bounded(inputNumber(input, 'width', page.width * .3), 1, 10000),
        height: bounded(inputNumber(input, 'height', page.height * .3), 1, 10000),
        rotation: 0,
        opacity: 1,
        fill: inputText(input, 'fill', '#7657ff').slice(0, 128),
        cornerRadius: bounded(inputNumber(input, 'cornerRadius', shape === 'rect' ? 24 : 0), 0, 5000),
        ...(inputText(input, 'stroke') ? { stroke: inputText(input, 'stroke').slice(0, 128) } : {}),
        ...(typeof input.strokeWidth === 'number' ? { strokeWidth: bounded(inputNumber(input, 'strokeWidth', 0), 0, 1000) } : {}),
      };
      useEditorStore.getState().addElement(element);
      return success(`Added ${shape} layer “${element.name}”.`, { element: summarizeElement(element) });
    },
  },
  {
    name: 'visually_select_elements',
    title: 'Select Visually elements',
    description: 'Select active-page elements by their IDs. Pass an empty array to clear selection.',
    inputSchema: objectSchema({
      elementIds: { type: 'array', description: 'Element IDs from visually_get_editor_state.', items: { type: 'string' }, uniqueItems: true, maxItems: 1000 },
    }, ['elementIds']),
    execute: (input) => {
      if (!Array.isArray(input.elementIds) || input.elementIds.some((id) => typeof id !== 'string')) {
        return fail('elementIds must be an array of strings.');
      }
      const valid = new Set(getActivePage().elements.map((element) => element.id));
      const ids = input.elementIds.filter((id): id is string => typeof id === 'string' && valid.has(id));
      useEditorStore.getState().setSelectedIds(ids);
      return success(`Selected ${ids.length} element${ids.length === 1 ? '' : 's'}.`, {
        selectedIds: useEditorStore.getState().selectedIds,
      });
    },
  },
  {
    name: 'visually_update_element',
    title: 'Update a Visually element',
    description: 'Update safe visual properties of one active-page element. Type-specific fields are applied only to compatible elements. The change is undoable.',
    inputSchema: objectSchema({
      elementId: stringField('Element ID from visually_get_editor_state.'),
      name: stringField('Layer name.'),
      x: numberField('Left position.'), y: numberField('Top position.'),
      width: numberField('Width.', 1, 10000), height: numberField('Height.', 1, 10000),
      rotation: numberField('Rotation in degrees.', -36000, 36000), opacity: numberField('Opacity.', 0, 1),
      locked: booleanField('Whether editing is locked.'), hidden: booleanField('Whether the layer is hidden.'),
      text: stringField('Text content for text elements.'), fontSize: numberField('Font size for text elements.', 1, 1000),
      fontFamily: stringField('Font family for text elements.'), fill: stringField('Text or shape fill color.'),
      cornerRadius: numberField('Corner radius for shape or image elements.', 0, 5000),
    }, ['elementId']),
    execute: (input) => {
      const id = inputText(input, 'elementId');
      const element = getActivePage().elements.find((item) => item.id === id);
      if (!element) return fail('Element not found on the active page.');
      const changes: Record<string, unknown> = {};
      if (typeof input.name === 'string') changes.name = input.name.slice(0, 512);
      if (typeof input.x === 'number') changes.x = bounded(inputNumber(input, 'x', element.x), -10000, 10000);
      if (typeof input.y === 'number') changes.y = bounded(inputNumber(input, 'y', element.y), -10000, 10000);
      if (typeof input.width === 'number') changes.width = bounded(inputNumber(input, 'width', element.width), 1, 10000);
      if (typeof input.height === 'number') changes.height = bounded(inputNumber(input, 'height', element.height), 1, 10000);
      if (typeof input.rotation === 'number') changes.rotation = bounded(inputNumber(input, 'rotation', element.rotation), -36000, 36000);
      if (typeof input.opacity === 'number') changes.opacity = bounded(inputNumber(input, 'opacity', element.opacity), 0, 1);
      if (typeof input.locked === 'boolean') changes.locked = input.locked;
      if (typeof input.hidden === 'boolean') changes.hidden = input.hidden;
      if (element.type === 'text') {
        if (typeof input.text === 'string') changes.text = input.text.slice(0, 10_000);
        if (typeof input.fontSize === 'number') changes.fontSize = bounded(inputNumber(input, 'fontSize', element.fontSize), 1, 1000);
        if (typeof input.fontFamily === 'string') changes.fontFamily = input.fontFamily.slice(0, 128);
        if (typeof input.fill === 'string') changes.fill = input.fill.slice(0, 128);
      }
      if (element.type === 'shape' && typeof input.fill === 'string') changes.fill = input.fill.slice(0, 128);
      if ((element.type === 'shape' || element.type === 'image' || element.type === 'video') && typeof input.cornerRadius === 'number') {
        changes.cornerRadius = bounded(inputNumber(input, 'cornerRadius', 0), 0, 5000);
      }
      if (!Object.keys(changes).length) return fail('No compatible update fields were provided.');
      useEditorStore.getState().updateElement(id, changes as Partial<EditorElement>);
      return success(`Updated element “${element.name}”.`, { elementId: id, changedFields: Object.keys(changes) });
    },
  },
  {
    name: 'visually_arrange_selection',
    title: 'Arrange Visually selection',
    description: 'Align, distribute, group, ungroup, duplicate, or move selected layers in the stack. The change is undoable.',
    inputSchema: objectSchema({
      operation: stringField('Arrangement operation.', { enum: ['align', 'distribute', 'group', 'ungroup', 'duplicate', 'layer'] }),
      value: stringField('For align: left, center, right, top, middle, bottom. For distribute: horizontal or vertical. For layer: up, down, top, bottom.'),
    }, ['operation']),
    execute: (input) => {
      const state = useEditorStore.getState();
      if (!state.selectedIds.length) return fail('Select at least one element first.');
      const operation = inputText(input, 'operation');
      const value = inputText(input, 'value');
      if (operation === 'duplicate') state.duplicateSelected();
      else if (operation === 'group') state.groupSelected();
      else if (operation === 'ungroup') state.ungroupSelected();
      else if (operation === 'align' && alignments.includes(value as Alignment)) state.alignSelected(value as Alignment);
      else if (operation === 'distribute' && distributionAxes.includes(value as DistributionAxis)) state.distributeSelected(value as DistributionAxis);
      else if (operation === 'layer' && layerDirections.includes(value as typeof layerDirections[number])) {
        state.moveLayer(state.selectedIds[0], value as typeof layerDirections[number]);
      } else return fail('The operation or its value is invalid.');
      return success(`Completed selection operation “${operation}”.`, { selectedIds: useEditorStore.getState().selectedIds });
    },
  },
  {
    name: 'visually_delete_selection',
    title: 'Delete Visually selection',
    description: 'Delete selected, unlocked elements. This destructive tool requires confirm=true and remains undoable.',
    inputSchema: objectSchema({ confirm: booleanField('Must be true to delete the selected elements.') }, ['confirm']),
    execute: (input) => {
      const state = useEditorStore.getState();
      if (!inputBoolean(input, 'confirm')) return fail('Deletion was not confirmed. Pass confirm=true only after the user has approved it.');
      if (!state.selectedIds.length) return fail('No elements are selected.');
      const selectedIds = [...state.selectedIds];
      state.deleteSelected();
      return success(`Deleted ${selectedIds.length} selected element${selectedIds.length === 1 ? '' : 's'}; locked elements were preserved.`, {
        deletedSelectionIds: selectedIds,
      });
    },
  },
];
