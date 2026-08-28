import type { DesignDocument } from '@/types';
import { assertPages, escapeHtml } from './common';
import { pageToSvg, type SvgExportOptions } from './svg';

export interface PrintableHtmlOptions extends SvgExportOptions {
  title?: string;
  pageGap?: number;
  autoPrint?: boolean;
}

export function pagesToPrintableHtml(pages: readonly DesignDocument[], options: PrintableHtmlOptions = {}): string {
  assertPages(pages);
  const title = options.title ?? pages[0].name ?? 'Visually design';
  const gap = Math.max(0, options.pageGap ?? 24);
  const sheets = pages.map((page, index) =>
    `<section class="sheet" aria-label="Page ${index + 1}">${pageToSvg(page, options)}</section>`,
  ).join('\n');
  const autoPrint = options.autoPrint ? '<script>addEventListener("load",()=>print(),{once:true})</script>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;background:#e5e7eb;color:#111827;font-family:system-ui,sans-serif}body{display:grid;justify-items:center;gap:${gap}px;padding:${gap}px}.sheet{background:#fff;box-shadow:0 8px 30px #0002;break-after:page;page-break-after:always;max-width:100%}.sheet:last-child{break-after:auto;page-break-after:auto}.sheet>svg{display:block;max-width:100%;height:auto}@media print{@page{margin:0}html,body{background:#fff}.sheet{box-shadow:none;max-width:none}body{display:block;padding:0}.sheet>svg{width:100vw;height:100vh}}</style></head><body>${sheets}${autoPrint}</body></html>`;
}

export const printableHtmlBlob = (pages: readonly DesignDocument[], options?: PrintableHtmlOptions) =>
  new Blob([pagesToPrintableHtml(pages, options)], { type: 'text/html;charset=utf-8' });

export function openPrintPreview(pages: readonly DesignDocument[], options?: PrintableHtmlOptions): Window {
  const url = URL.createObjectURL(printableHtmlBlob(pages, options));
  const preview = window.open(url, '_blank');
  if (!preview) {
    URL.revokeObjectURL(url);
    throw new Error('The print preview was blocked by the browser.');
  }
  preview.opener = null;
  // The new document may not have consumed the blob by the next microtask. Keep it briefly, then release it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return preview;
}
