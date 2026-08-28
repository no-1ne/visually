import type { DesignDocument } from '@/types';

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

/** Compact identity for safe undo checks; media payloads are hashed rather than retained. */
export const compactPageSignature = (page: DesignDocument | undefined) => {
  if (!page) return 'missing';
  const semanticJson = JSON.stringify(page, (key, value: unknown) => {
    if (typeof value === 'string' && ['src', 'poster', 'markup'].includes(key)) return `[${key}:${value.length}:${hashString(value)}]`;
    if (key === 'waveform' && Array.isArray(value)) return `[waveform:${value.length}:${hashString(value.join(','))}]`;
    return value;
  });
  return `${semanticJson.length}:${hashString(semanticJson)}`;
};

export const compactProjectSignature = (pages: DesignDocument[]) => pages.map(compactPageSignature).join('|');

export const affectedPageLabels = (before: DesignDocument[], after: DesignDocument[]) => {
  const length = Math.max(before.length, after.length);
  const affected: string[] = [];
  for (let pageIndex = 0; pageIndex < length; pageIndex += 1) {
    if (compactPageSignature(before[pageIndex]) === compactPageSignature(after[pageIndex])) continue;
    const page = after[pageIndex] ?? before[pageIndex];
    affected.push(`Page ${pageIndex + 1}: ${page?.name ?? 'Removed page'}`);
  }
  return affected;
};

export const affectedElementLabels = (before: DesignDocument[], after: DesignDocument[]) => {
  const changedIds: string[] = [];
  const pageCount = Math.max(before.length, after.length);
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const beforeElements = new Map((before[pageIndex]?.elements ?? []).map((element) => [element.id, JSON.stringify(element, (key, value: unknown) => (
      typeof value === 'string' && ['src', 'poster', 'markup'].includes(key) ? `[${value.length}:${hashString(value)}]` : value
    ))]));
    const afterElements = new Map((after[pageIndex]?.elements ?? []).map((element) => [element.id, JSON.stringify(element, (key, value: unknown) => (
      typeof value === 'string' && ['src', 'poster', 'markup'].includes(key) ? `[${value.length}:${hashString(value)}]` : value
    ))]));
    const ids = new Set([...beforeElements.keys(), ...afterElements.keys()]);
    for (const elementId of ids) if (beforeElements.get(elementId) !== afterElements.get(elementId)) changedIds.push(elementId);
  }
  if (changedIds.length > 8) return [`${changedIds.length} elements`];
  return changedIds.map((elementId) => `Element ${elementId}`);
};

export const resultAffectedLabels = (result: unknown) => {
  if (!result || typeof result !== 'object') return [];
  const data = (result as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return [];
  const value = data as Record<string, unknown>;
  const labels: string[] = [];
  if (typeof value.elementId === 'string') labels.push(`Element ${value.elementId}`);
  if (value.element && typeof value.element === 'object' && typeof (value.element as { id?: unknown }).id === 'string') labels.push(`Element ${(value.element as { id: string }).id}`);
  if (Array.isArray(value.elementIds)) labels.push(...value.elementIds.filter((id): id is string => typeof id === 'string').slice(0, 8).map((id) => `Element ${id}`));
  if (Array.isArray(value.selectedIds)) labels.push(...value.selectedIds.filter((id): id is string => typeof id === 'string').slice(0, 8).map((id) => `Element ${id}`));
  if (typeof value.updatedElements === 'number') labels.push(`${value.updatedElements} elements updated`);
  if (typeof value.updatedPages === 'number') labels.push(`${value.updatedPages} pages updated`);
  if (typeof value.pageCount === 'number') labels.push(`${value.pageCount} pages`);
  return labels;
};

export const summarizeToolInput = (input: Record<string, unknown>) => Object.entries(input).map(([key, value]) => {
  if (key === 'projectJson') return `${key}: [project JSON]`;
  if (typeof value === 'string' && (key.toLowerCase().includes('src') || value.startsWith('data:'))) return `${key}: [media source]`;
  if (Array.isArray(value)) return `${key}: ${value.slice(0, 5).join(', ')}`;
  if (typeof value === 'string') return `${key}: ${value.slice(0, 80)}`;
  return `${key}: ${String(value)}`;
}).join(' · ') || 'No input';
