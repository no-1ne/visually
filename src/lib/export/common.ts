import type { DesignDocument } from '@/types';

export const finite = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const positive = (value: unknown, fallback: number) => Math.max(1, finite(value, fallback));

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function escapeHtml(value: unknown): string {
  return escapeXml(value).replaceAll('&#39;', '&#039;');
}

export function safeFilename(name: string, extension: string): string {
  const stem = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'visually-design';
  return `${stem}.${extension.replace(/^\./, '')}`;
}

export function assertPages(pages: readonly DesignDocument[]): void {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('At least one page is required.');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
