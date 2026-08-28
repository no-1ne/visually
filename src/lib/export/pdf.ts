import type { DesignDocument, EditorElement } from '@/types';
import { assertPages, finite, positive } from './common';

export interface PdfExportOptions {
  /** CSS pixels to PDF points. The default maps 96 CSS pixels to 72 PDF points. */
  pixelScale?: number;
  title?: string;
  author?: string;
}

const encoder = new TextEncoder();
const num = (value: number) => String(Math.round(value * 1000) / 1000);
const pdfText = (value: string) => value
  .normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '?')
  .replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

function rgb(value: string | undefined): [number, number, number] {
  const color = String(value ?? '').trim();
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(color);
  const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (short) return [1, 2, 3].map((index) => parseInt(short[index] + short[index], 16) / 255) as [number, number, number];
  if (full) return [1, 2, 3].map((index) => parseInt(full[index], 16) / 255) as [number, number, number];
  const functional = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i.exec(color);
  return functional ? [Number(functional[1]) / 255, Number(functional[2]) / 255, Number(functional[3]) / 255] : [0, 0, 0];
}

const fill = (value: string | undefined) => `${rgb(value).map(num).join(' ')} rg`;
const stroke = (value: string | undefined) => `${rgb(value).map(num).join(' ')} RG`;

function transform(element: EditorElement, pageHeight: number): string {
  const angle = finite(element.rotation) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return `${num(cos)} ${num(-sin)} ${num(-sin)} ${num(-cos)} ${num(finite(element.x))} ${num(pageHeight - finite(element.y))} cm`;
}

function starPath(width: number, height: number): string {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.48;
  const inner = Math.min(width, height) * 0.22;
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 ? inner : outer;
    const point = `${num(cx + Math.cos(angle) * radius)} ${num(cy + Math.sin(angle) * radius)}`;
    return `${point} ${index ? 'l' : 'm'}`;
  }).join('\n') + '\nh';
}

function ellipsePath(width: number, height: number): string {
  const k = 0.552284749831;
  const rx = width / 2;
  const ry = height / 2;
  const cx = rx;
  const cy = ry;
  return `${num(cx + rx)} ${num(cy)} m
${num(cx + rx)} ${num(cy + k * ry)} ${num(cx + k * rx)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)} c
${num(cx - k * rx)} ${num(cy + ry)} ${num(cx - rx)} ${num(cy + k * ry)} ${num(cx - rx)} ${num(cy)} c
${num(cx - rx)} ${num(cy - k * ry)} ${num(cx - k * rx)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)} c
${num(cx + k * rx)} ${num(cy - ry)} ${num(cx + rx)} ${num(cy - k * ry)} ${num(cx + rx)} ${num(cy)} c h`;
}

function shapeCommands(element: Extract<EditorElement, { type: 'shape' }>): string {
  const width = positive(element.width, 1);
  const height = positive(element.height, 1);
  const path = element.shape === 'circle' ? ellipsePath(width, height)
    : element.shape === 'star' ? starPath(width, height)
      : `0 0 ${num(width)} ${num(height)} re`;
  const hasStroke = Boolean(element.stroke) && finite(element.strokeWidth) > 0;
  return `${fill(element.fill)}\n${hasStroke ? `${stroke(element.stroke)}\n${num(finite(element.strokeWidth))} w\n` : ''}${path}\n${hasStroke ? 'B' : 'f'}`;
}

function textCommands(element: Extract<EditorElement, { type: 'text' }>): string {
  const fontSize = positive(element.fontSize, 16);
  const lineHeight = positive(element.lineHeight, 1.2) * fontSize;
  const lines = String(element.text ?? '').split(/\r?\n/);
  return lines.map((line, index) => {
    const estimatedWidth = line.length * fontSize * 0.5 + Math.max(0, line.length - 1) * finite(element.letterSpacing);
    const x = element.align === 'center' ? (finite(element.width) - estimatedWidth) / 2 : element.align === 'right' ? finite(element.width) - estimatedWidth : 0;
    const baseline = fontSize + index * lineHeight;
    return `BT\n/F1 ${num(fontSize)} Tf\n${fill(element.fill)}\n${num(finite(element.letterSpacing))} Tc\n1 0 0 -1 ${num(x)} ${num(baseline)} Tm\n(${pdfText(line)}) Tj\nET`;
  }).join('\n');
}

function elementCommands(element: EditorElement, pageHeight: number): string {
  if (element.hidden) return '';
  let commands: string;
  if (element.type === 'shape') commands = shapeCommands(element);
  else if (element.type === 'text') commands = textCommands(element);
  else if (element.type === 'line') {
    commands = `${stroke(element.fill)}\n${num(positive(element.strokeWidth, 1))} w\n${element.dash.length ? `[${element.dash.map((part) => num(finite(part))).join(' ')}] 0 d\n` : ''}1 J\n0 ${num(finite(element.height) / 2)} m\n${num(finite(element.width))} ${num(finite(element.height) / 2)} l\nS`;
  } else {
    // PDF images require format-specific embedding. Keep the layout explicit rather than silently omitting it.
    commands = `0.92 0.93 0.95 rg\n0 0 ${num(positive(element.width, 1))} ${num(positive(element.height, 1))} re f\n0.55 0.58 0.65 RG\n1 w\n0 0 ${num(positive(element.width, 1))} ${num(positive(element.height, 1))} re S`;
  }
  return `q\n${transform(element, pageHeight)}\n${commands}\nQ`;
}

function pageStream(page: DesignDocument, scale: number): Uint8Array {
  const height = positive(page.height, 1080);
  const content = `q\n${num(scale)} 0 0 ${num(scale)} 0 0 cm\n${fill(page.background || '#ffffff')}\n0 0 ${num(positive(page.width, 1080))} ${num(height)} re f\n${(page.elements ?? []).map((element) => elementCommands(element, height)).join('\n')}\nQ`;
  return encoder.encode(content);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function pagesToPdf(pages: readonly DesignDocument[], options: PdfExportOptions = {}): Uint8Array {
  assertPages(pages);
  const scale = Math.max(0.01, finite(options.pixelScale, 0.75));
  const fontId = 3;
  const objects = new Map<number, Uint8Array>();
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.set(2, encoder.encode(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`));
  objects.set(fontId, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const streamId = pageId + 1;
    const stream = pageStream(page, scale);
    objects.set(pageId, encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(positive(page.width, 1080) * scale)} ${num(positive(page.height, 1080) * scale)}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`));
    objects.set(streamId, concat([encoder.encode(`<< /Length ${stream.length} >>\nstream\n`), stream, encoder.encode('\nendstream')]));
  });
  const infoId = 4 + pages.length * 2;
  objects.set(infoId, encoder.encode(`<< /Title (${pdfText(options.title ?? pages[0].name ?? 'Visually design')}) /Author (${pdfText(options.author ?? 'Visually')}) /Creator (Visually browser exporter) >>`));

  const header = encoder.encode('%PDF-1.7\n%Visually\n');
  const chunks: Uint8Array<ArrayBufferLike>[] = [header];
  const offsets = [0];
  let offset = header.length;
  for (let id = 1; id <= infoId; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`Internal PDF object ${id} is missing.`);
    const chunk = concat([encoder.encode(`${id} 0 obj\n`), body, encoder.encode('\nendobj\n')]);
    offsets[id] = offset;
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefOffset = offset;
  const xref = `xref\n0 ${infoId + 1}\n0000000000 65535 f \n${offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${infoId + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(encoder.encode(xref));
  return concat(chunks);
}

export function pdfBlob(pages: readonly DesignDocument[], options?: PdfExportOptions): Blob {
  const bytes = pagesToPdf(pages, options);
  return new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' });
}
