import { useEditorStore } from '@/store/editor-store';
import type { EditorElement } from '@/types';

export type ToolInput = Record<string, unknown>;

export const objectSchema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const stringField = (description: string, extra: Record<string, unknown> = {}) => ({
  type: 'string', description, ...extra,
});

export const numberField = (description: string, minimum?: number, maximum?: number) => ({
  type: 'number', description,
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});

export const booleanField = (description: string) => ({ type: 'boolean', description });

export const success = (message: string, data?: unknown) => ({
  ok: true,
  message,
  ...(data === undefined ? {} : { data }),
});

export const fail = (message: string) => ({ ok: false, error: message });

export const inputText = (input: ToolInput, key: string, fallback = '') =>
  typeof input[key] === 'string' ? String(input[key]) : fallback;

export const inputNumber = (input: ToolInput, key: string, fallback: number) =>
  typeof input[key] === 'number' && Number.isFinite(input[key]) ? Number(input[key]) : fallback;

export const inputBoolean = (input: ToolInput, key: string, fallback = false) =>
  typeof input[key] === 'boolean' ? input[key] : fallback;

export const bounded = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getActivePage = () => {
  const state = useEditorStore.getState();
  return state.pages[state.activePageIndex];
};

export const summarizeElement = (element: EditorElement) => ({
  id: element.id,
  name: element.name,
  type: element.type,
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
  rotation: element.rotation,
  opacity: element.opacity,
  locked: Boolean(element.locked),
  hidden: Boolean(element.hidden),
  ...(element.type === 'text' ? { text: element.text } : {}),
  ...(element.type === 'shape' ? { shape: element.shape, fill: element.fill } : {}),
});

export const readOnlyTool = { readOnlyHint: true } as const;

