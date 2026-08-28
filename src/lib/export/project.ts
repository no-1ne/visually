import type {
  AudioElement, DesignDocument, DrawingElement, EditorElement, GroupElement, ImageElement,
  LineElement, ShapeElement, SvgElement, TableElement, TextElement, VideoElement,
} from '@/types';
import { finite, positive } from './common';

export const PROJECT_SCHEMA = 'visually-project' as const;
export const LEGACY_PROJECT_SCHEMAS = ['canvasly-project'] as const;
export const PROJECT_VERSION = 2 as const;

export interface ProjectFile {
  schema: typeof PROJECT_SCHEMA;
  version: typeof PROJECT_VERSION;
  exportedAt: string;
  pages: DesignDocument[];
  metadata?: Record<string, unknown>;
}

export interface ProjectImportResult {
  pages: DesignDocument[];
  sourceVersion: number;
  warnings: string[];
}

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;
const bool = (value: unknown) => typeof value === 'boolean' ? value : undefined;
const identifier = (value: unknown, fallback: string) => string(value, fallback).slice(0, 256);

function baseElement(value: UnknownRecord, fallbackId: string) {
  return {
    id: identifier(value.id, fallbackId),
    name: string(value.name, 'Untitled element').slice(0, 512),
    x: finite(value.x),
    y: finite(value.y),
    width: positive(value.width, 100),
    height: positive(value.height, 100),
    rotation: finite(value.rotation),
    opacity: Math.min(1, Math.max(0, finite(value.opacity, 1))),
    ...(bool(value.locked) === undefined ? {} : { locked: bool(value.locked) }),
    ...(bool(value.hidden) === undefined ? {} : { hidden: bool(value.hidden) }),
    ...(typeof value.groupId === 'string' ? { groupId: value.groupId } : {}),
    ...(typeof value.parentId === 'string' ? { parentId: value.parentId } : {}),
    ...(bool(value.flipX) === undefined ? {} : { flipX: bool(value.flipX) }),
    ...(bool(value.flipY) === undefined ? {} : { flipY: bool(value.flipY) }),
    ...(typeof value.scaleX === 'number' ? { scaleX: finite(value.scaleX, 1) } : {}),
    ...(typeof value.scaleY === 'number' ? { scaleY: finite(value.scaleY, 1) } : {}),
    ...(typeof value.blendMode === 'string' ? { blendMode: value.blendMode as never } : {}),
    ...(record(value.shadow) ? { shadow: structuredClone(value.shadow) as never } : {}),
    ...(record(value.animation) ? { animation: structuredClone(value.animation) as never } : {}),
    ...(record(value.metadata) ? { metadata: structuredClone(value.metadata) } : {}),
  };
}

function migrateElement(value: unknown, pageIndex: number, elementIndex: number, warnings: string[]): EditorElement | null {
  if (!record(value)) {
    warnings.push(`Page ${pageIndex + 1}, element ${elementIndex + 1} was not an object and was skipped.`);
    return null;
  }
  const base = baseElement(value, `imported-${pageIndex + 1}-${elementIndex + 1}`);
  if (value.type === 'text') {
    const fontStyle = value.fontStyle === 'bold' || value.fontStyle === 'italic' || value.fontStyle === 'bold italic' ? value.fontStyle : 'normal';
    const align = value.align === 'center' || value.align === 'right' || value.align === 'justify' ? value.align : 'left';
    return {
      ...base, type: 'text', text: string(value.text, ''), fontSize: positive(value.fontSize, 32),
      fontFamily: string(value.fontFamily, 'Arial'), fontStyle,
      fill: string(value.fill, '#111111'), align,
      letterSpacing: finite(value.letterSpacing), lineHeight: positive(value.lineHeight, 1.2),
      ...(Array.isArray(value.runs) ? { runs: structuredClone(value.runs) as TextElement['runs'] } : {}),
      ...(typeof value.fontWeight === 'number' ? { fontWeight: finite(value.fontWeight, 400) } : {}),
      ...(typeof value.verticalAlign === 'string' ? { verticalAlign: value.verticalAlign as TextElement['verticalAlign'] } : {}),
      ...(typeof value.textDecoration === 'string' ? { textDecoration: value.textDecoration as TextElement['textDecoration'] } : {}),
      ...(typeof value.padding === 'number' ? { padding: Math.max(0, finite(value.padding)) } : {}),
      ...(typeof value.stroke === 'string' ? { stroke: value.stroke } : {}),
      ...(typeof value.strokeWidth === 'number' ? { strokeWidth: Math.max(0, finite(value.strokeWidth)) } : {}),
    } satisfies TextElement;
  }
  if (value.type === 'shape') {
    const shapes = ['rect', 'circle', 'star', 'triangle', 'polygon', 'ellipse'] as const;
    const shape = shapes.find((item) => item === value.shape) ?? 'rect';
    return {
      ...base, type: 'shape', shape, fill: string(value.fill, '#7657ff'),
      cornerRadius: Math.max(0, finite(value.cornerRadius)),
      ...(typeof value.stroke === 'string' ? { stroke: value.stroke } : {}),
      ...(typeof value.strokeWidth === 'number' ? { strokeWidth: Math.max(0, finite(value.strokeWidth)) } : {}),
      ...(typeof value.sides === 'number' ? { sides: Math.max(3, Math.round(finite(value.sides, 6))) } : {}),
      ...(typeof value.innerRadius === 'number' ? { innerRadius: Math.max(0, finite(value.innerRadius)) } : {}),
      ...(typeof value.pathData === 'string' ? { pathData: value.pathData } : {}),
    } satisfies ShapeElement;
  }
  if (value.type === 'image') {
    return {
      ...base, type: 'image', src: string(value.src, ''), cornerRadius: Math.max(0, finite(value.cornerRadius)),
      ...(typeof value.intrinsicWidth === 'number' ? { intrinsicWidth: positive(value.intrinsicWidth, 1) } : {}),
      ...(typeof value.intrinsicHeight === 'number' ? { intrinsicHeight: positive(value.intrinsicHeight, 1) } : {}),
      ...(typeof value.aspectLocked === 'boolean' ? { aspectLocked: value.aspectLocked } : {}),
      ...(typeof value.alt === 'string' ? { alt: value.alt } : {}), ...(typeof value.mimeType === 'string' ? { mimeType: value.mimeType } : {}),
      ...(record(value.crop) ? { crop: structuredClone(value.crop) as unknown as ImageElement['crop'] } : {}),
      ...(record(value.effects) ? { effects: structuredClone(value.effects) as ImageElement['effects'] } : {}),
      ...(typeof value.objectFit === 'string' ? { objectFit: value.objectFit as ImageElement['objectFit'] } : {}),
    } satisfies ImageElement;
  }
  if (value.type === 'line') {
    return {
      ...base, type: 'line', fill: string(value.fill, '#111111'), strokeWidth: positive(value.strokeWidth, 2),
      dash: Array.isArray(value.dash) ? value.dash.map((part) => Math.max(0, finite(part))).slice(0, 64) : [],
      ...(Array.isArray(value.points) ? { points: value.points.map((part) => finite(part)).slice(0, 20_000) } : {}),
      ...(typeof value.lineCap === 'string' ? { lineCap: value.lineCap as LineElement['lineCap'] } : {}),
      ...(typeof value.lineJoin === 'string' ? { lineJoin: value.lineJoin as LineElement['lineJoin'] } : {}),
    } satisfies LineElement;
  }
  if (value.type === 'svg') {
    return {
      ...base, type: 'svg', ...(typeof value.src === 'string' ? { src: value.src } : {}),
      ...(typeof value.markup === 'string' ? { markup: value.markup } : {}),
      ...(typeof value.viewBox === 'string' ? { viewBox: value.viewBox } : {}),
      ...(typeof value.fill === 'string' ? { fill: value.fill } : {}),
      ...(typeof value.stroke === 'string' ? { stroke: value.stroke } : {}),
      ...(typeof value.preserveAspectRatio === 'string' ? { preserveAspectRatio: value.preserveAspectRatio } : {}),
      ...(record(value.effects) ? { effects: structuredClone(value.effects) as SvgElement['effects'] } : {}),
    } satisfies SvgElement;
  }
  if (value.type === 'drawing') {
    return {
      ...base, type: 'drawing', points: Array.isArray(value.points) ? value.points.map((part) => finite(part)).slice(0, 100_000) : [],
      stroke: string(value.stroke, '#111111'), strokeWidth: positive(value.strokeWidth, 2),
      ...(typeof value.lineCap === 'string' ? { lineCap: value.lineCap as DrawingElement['lineCap'] } : {}),
      ...(typeof value.lineJoin === 'string' ? { lineJoin: value.lineJoin as DrawingElement['lineJoin'] } : {}),
      ...(Array.isArray(value.dash) ? { dash: value.dash.map((part) => Math.max(0, finite(part))) } : {}),
      ...(typeof value.closed === 'boolean' ? { closed: value.closed } : {}), ...(typeof value.fill === 'string' ? { fill: value.fill } : {}),
    } satisfies DrawingElement;
  }
  if (value.type === 'table') {
    const rows = Math.max(1, Math.round(finite(value.rows, 1)));
    const columns = Math.max(1, Math.round(finite(value.columns, 1)));
    const cells = Array.isArray(value.cells) ? structuredClone(value.cells) as TableElement['cells'] : [];
    return {
      ...base, type: 'table', rows, columns, cells,
      ...(Array.isArray(value.columnWidths) ? { columnWidths: value.columnWidths.map((part) => positive(part, 1)) } : {}),
      ...(Array.isArray(value.rowHeights) ? { rowHeights: value.rowHeights.map((part) => positive(part, 1)) } : {}),
      ...(typeof value.borderColor === 'string' ? { borderColor: value.borderColor } : {}),
      ...(typeof value.borderWidth === 'number' ? { borderWidth: Math.max(0, finite(value.borderWidth)) } : {}),
    } satisfies TableElement;
  }
  if (value.type === 'audio' || value.type === 'video') {
    const media = {
      ...base, type: value.type, src: string(value.src, ''), ...(typeof value.mimeType === 'string' ? { mimeType: value.mimeType } : {}),
      ...(typeof value.duration === 'number' ? { duration: Math.max(0, finite(value.duration)) } : {}),
      ...(typeof value.trimStart === 'number' ? { trimStart: Math.max(0, finite(value.trimStart)) } : {}),
      ...(typeof value.trimEnd === 'number' ? { trimEnd: Math.max(0, finite(value.trimEnd)) } : {}),
      ...(typeof value.loop === 'boolean' ? { loop: value.loop } : {}), ...(typeof value.muted === 'boolean' ? { muted: value.muted } : {}),
      ...(typeof value.volume === 'number' ? { volume: Math.min(1, Math.max(0, finite(value.volume, 1))) } : {}),
    };
    if (value.type === 'audio') return {
      ...media, type: 'audio', ...(Array.isArray(value.waveform) ? { waveform: value.waveform.map((part) => finite(part)).slice(0, 20_000) } : {}),
      ...(typeof value.poster === 'string' ? { poster: value.poster } : {}),
    } satisfies AudioElement;
    return {
      ...media, type: 'video', ...(typeof value.poster === 'string' ? { poster: value.poster } : {}),
      ...(typeof value.cornerRadius === 'number' ? { cornerRadius: Math.max(0, finite(value.cornerRadius)) } : {}),
      ...(record(value.crop) ? { crop: structuredClone(value.crop) as unknown as VideoElement['crop'] } : {}),
      ...(record(value.effects) ? { effects: structuredClone(value.effects) as VideoElement['effects'] } : {}),
    } satisfies VideoElement;
  }
  if (value.type === 'group') {
    return {
      ...base, type: 'group', childIds: Array.isArray(value.childIds) ? value.childIds.filter((id): id is string => typeof id === 'string') : [],
      ...(typeof value.clipPathId === 'string' ? { clipPathId: value.clipPathId } : {}),
    } satisfies GroupElement;
  }
  warnings.push(`Page ${pageIndex + 1}, element ${elementIndex + 1} has unsupported type "${String(value.type)}" and was skipped.`);
  return null;
}

function migratePage(value: unknown, pageIndex: number, warnings: string[]): DesignDocument | null {
  if (!record(value)) {
    warnings.push(`Page ${pageIndex + 1} was not an object and was skipped.`);
    return null;
  }
  const rawElements = Array.isArray(value.elements) ? value.elements : [];
  if (!Array.isArray(value.elements)) warnings.push(`Page ${pageIndex + 1} had no valid element list; an empty list was used.`);
  const elements = rawElements
    .map((element, index) => migrateElement(element, pageIndex, index, warnings))
    .filter((element): element is EditorElement => element !== null);
  const seen = new Set<string>();
  for (const [index, element] of elements.entries()) {
    if (seen.has(element.id)) {
      const original = element.id;
      element.id = `${original}-${index + 1}`;
      warnings.push(`Duplicate element id "${original}" was renamed to "${element.id}".`);
    }
    seen.add(element.id);
  }
  return {
    schemaVersion: PROJECT_VERSION,
    name: string(value.name, `Page ${pageIndex + 1}`).slice(0, 512),
    width: positive(value.width, 1080), height: positive(value.height, 1080),
    background: string(value.background, '#ffffff'), elements,
    ...(record(value.metadata) ? { metadata: structuredClone(value.metadata) as DesignDocument['metadata'] } : {}),
  };
}

function unpack(input: unknown): { pages: unknown[]; sourceVersion: number } {
  if (Array.isArray(input)) return { pages: input, sourceVersion: 0 };
  if (!record(input)) throw new Error('Project data must be an object or page array.');
  if (Array.isArray(input.pages)) return { pages: input.pages, sourceVersion: Math.max(0, finite(input.version, 0)) };
  if ('elements' in input) return { pages: [input], sourceVersion: 0 };
  throw new Error('Project data does not contain any pages.');
}

export function importProject(input: string | unknown): ProjectImportResult {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try { parsed = JSON.parse(input) as unknown; }
    catch (error) { throw new Error('Project JSON is invalid.', { cause: error }); }
  }
  const { pages: rawPages, sourceVersion } = unpack(parsed);
  if (sourceVersion > PROJECT_VERSION) throw new Error(`Project version ${sourceVersion} is newer than this editor supports.`);
  const warnings: string[] = [];
  const pages = rawPages.map((page, index) => migratePage(page, index, warnings)).filter((page): page is DesignDocument => page !== null);
  if (!pages.length) throw new Error('Project does not contain a usable page.');
  return { pages, sourceVersion, warnings };
}

export function createProjectFile(
  pages: readonly DesignDocument[],
  options: { exportedAt?: Date; metadata?: Record<string, unknown> } = {},
): ProjectFile {
  const normalized = importProject({ version: PROJECT_VERSION, pages }).pages;
  return {
    schema: PROJECT_SCHEMA, version: PROJECT_VERSION,
    exportedAt: (options.exportedAt ?? new Date()).toISOString(), pages: normalized,
    ...(options.metadata ? { metadata: structuredClone(options.metadata) } : {}),
  };
}

export function exportProjectJson(
  pages: readonly DesignDocument[],
  options: { pretty?: boolean; exportedAt?: Date; metadata?: Record<string, unknown> } = {},
): string {
  return JSON.stringify(createProjectFile(pages, options), null, options.pretty === false ? undefined : 2);
}

export const projectJsonBlob = (pages: readonly DesignDocument[], options?: Parameters<typeof exportProjectJson>[1]) =>
  new Blob([exportProjectJson(pages, options)], { type: 'application/json;charset=utf-8' });
