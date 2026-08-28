import type { DesignDocument, EditorElement } from '@/types';
import { createArcTextPath } from '@/features/advanced/curved-text';
import { escapeXml, finite, positive } from './common';

export interface SvgExportOptions {
  title?: string;
  includeHidden?: boolean;
  imageHref?: (src: string, element: Extract<EditorElement, { type: 'image' }>) => string;
}

const number = (value: unknown) => String(Math.round(finite(value) * 1000) / 1000);

function style(element: EditorElement): string {
  return `opacity="${number(Math.min(1, Math.max(0, finite(element.opacity, 1))))}"`;
}

function transform(element: EditorElement): string {
  const rotation = finite(element.rotation);
  return `translate(${number(element.x)} ${number(element.y)})${rotation ? ` rotate(${number(rotation)})` : ''}`;
}

function shapeSvg(element: Extract<EditorElement, { type: 'shape' }>): string {
  const width = positive(element.width, 1);
  const height = positive(element.height, 1);
  const paint = `fill="${escapeXml(element.fill || 'none')}" stroke="${escapeXml(element.stroke || 'none')}" stroke-width="${number(element.strokeWidth || 0)}"`;
  if (element.shape === 'circle') {
    return `<ellipse cx="${number(width / 2)}" cy="${number(height / 2)}" rx="${number(width / 2)}" ry="${number(height / 2)}" ${paint}/>`;
  }
  if (element.shape === 'star') {
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.min(width, height) * 0.48;
    const inner = Math.min(width, height) * 0.22;
    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 ? inner : outer;
      return `${number(cx + Math.cos(angle) * radius)},${number(cy + Math.sin(angle) * radius)}`;
    }).join(' ');
    return `<polygon points="${points}" ${paint}/>`;
  }
  if (element.shape === 'triangle') return `<polygon points="${number(width / 2)},0 ${number(width)},${number(height)} 0,${number(height)}" ${paint}/>`;
  if (element.shape === 'polygon') {
    const sides = Math.max(3, Math.round(element.sides ?? 6));
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;
    const points = Array.from({ length: sides }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
      return `${number(cx + Math.cos(angle) * radius)},${number(cy + Math.sin(angle) * radius)}`;
    }).join(' ');
    return `<polygon points="${points}" ${paint}/>`;
  }
  const radius = Math.max(0, finite(element.cornerRadius));
  return `<rect width="${number(width)}" height="${number(height)}" rx="${number(radius)}" ry="${number(radius)}" ${paint}/>`;
}

function textSvg(element: Extract<EditorElement, { type: 'text' }>, index: number): string {
  const lines = String(element.text ?? '').split(/\r?\n/);
  const size = positive(element.fontSize, 16);
  const lineHeight = positive(element.lineHeight, 1.2) * size;
  const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
  const x = element.align === 'center' ? finite(element.width) / 2 : element.align === 'right' ? finite(element.width) : 0;
  if (element.textPath?.enabled && !element.runs?.length) {
    const id = `text-path-${index}-${String(element.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const path = createArcTextPath(element.width, element.height, element.textPath);
    const offset = element.align === 'center' ? '50%' : element.align === 'right' ? '100%' : '0%';
    return `<defs><path id="${id}" d="${path.data}"/></defs><text fill="${escapeXml(element.fill)}" font-family="${escapeXml(element.fontFamily)}" font-size="${number(size)}" font-weight="${element.fontStyle.includes('bold') ? '700' : '400'}" font-style="${element.fontStyle.includes('italic') ? 'italic' : 'normal'}" letter-spacing="${number(element.letterSpacing)}" text-anchor="${anchor}"><textPath href="#${id}" startOffset="${offset}">${escapeXml(element.text)}</textPath></text>`;
  }
  const tspans = lines.map((line, index) =>
    `<tspan x="${number(x)}" dy="${index ? number(lineHeight) : '0'}">${escapeXml(line)}</tspan>`,
  ).join('');
  return `<text x="${number(x)}" y="${number(size)}" fill="${escapeXml(element.fill)}" font-family="${escapeXml(element.fontFamily)}" font-size="${number(size)}" font-weight="${element.fontStyle === 'bold' ? '700' : '400'}" letter-spacing="${number(element.letterSpacing)}" text-anchor="${anchor}">${tspans}</text>`;
}

function elementSvg(element: EditorElement, options: SvgExportOptions, index: number): string {
  if (element.hidden && !options.includeHidden) return '';
  let content: string;
  if (element.type === 'text') content = textSvg(element, index);
  else if (element.type === 'shape') content = shapeSvg(element);
  else if (element.type === 'line') {
    content = `<line x1="0" y1="${number(finite(element.height) / 2)}" x2="${number(element.width)}" y2="${number(finite(element.height) / 2)}" stroke="${escapeXml(element.fill)}" stroke-width="${number(element.strokeWidth)}" stroke-dasharray="${element.dash.map(number).join(' ')}" stroke-linecap="round"/>`;
  } else if (element.type === 'image') {
    const href = options.imageHref?.(element.src, element) ?? element.src;
    const clipId = `image-clip-${index}-${String(element.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const radius = Math.min(Math.max(0, finite(element.cornerRadius)), finite(element.width) / 2, finite(element.height) / 2);
    const aspect = element.objectFit === 'contain' ? 'xMidYMid meet' : element.objectFit === 'fill' ? 'none' : 'xMidYMid slice';
    content = `<defs><clipPath id="${clipId}"><rect width="${number(element.width)}" height="${number(element.height)}" rx="${number(radius)}"/></clipPath></defs><image href="${escapeXml(href)}" width="${number(element.width)}" height="${number(element.height)}" preserveAspectRatio="${aspect}" clip-path="url(#${clipId})"/>`;
  } else if (element.type === 'svg') {
    const source = element.src || (element.markup ? `data:image/svg+xml,${encodeURIComponent(element.markup)}` : '');
    content = `<image href="${escapeXml(source)}" width="${number(element.width)}" height="${number(element.height)}" preserveAspectRatio="${escapeXml(element.preserveAspectRatio ?? 'xMidYMid meet')}"/>`;
  } else if (element.type === 'drawing') {
    const points = element.points.reduce<string[]>((result, point, pointIndex) => {
      if (pointIndex % 2 === 0 && element.points[pointIndex + 1] !== undefined) result.push(`${number(point)},${number(element.points[pointIndex + 1])}`);
      return result;
    }, []).join(' ');
    const tag = element.closed ? 'polygon' : 'polyline';
    content = `<${tag} points="${points}" fill="${escapeXml(element.closed ? element.fill ?? 'none' : 'none')}" stroke="${escapeXml(element.stroke)}" stroke-width="${number(element.strokeWidth)}" stroke-linecap="${element.lineCap ?? 'round'}" stroke-linejoin="${element.lineJoin ?? 'round'}"${element.dash?.length ? ` stroke-dasharray="${element.dash.map(number).join(' ')}"` : ''}/>`;
  } else if (element.type === 'table') {
    const columns = Math.max(1, element.columns);
    const rows = Math.max(1, element.rows);
    const columnWidths = element.columnWidths?.length === columns ? element.columnWidths : Array(columns).fill(finite(element.width) / columns);
    const rowHeights = element.rowHeights?.length === rows ? element.rowHeights : Array(rows).fill(finite(element.height) / rows);
    let y = 0;
    const cells: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      let x = 0;
      for (let column = 0; column < columns; column += 1) {
        const cell = element.cells[row]?.[column];
        const cellWidth = finite(columnWidths[column]);
        const covered = cell?.rowSpan === 0 || cell?.colSpan === 0;
        if (!covered) {
          const spanWidth = columnWidths.slice(column, column + Math.max(1, cell?.colSpan ?? 1)).reduce((sum, value) => sum + finite(value), 0);
          const spanHeight = rowHeights.slice(row, row + Math.max(1, cell?.rowSpan ?? 1)).reduce((sum, value) => sum + finite(value), 0);
          cells.push(`<rect x="${number(x)}" y="${number(y)}" width="${number(spanWidth)}" height="${number(spanHeight)}" fill="${escapeXml(cell?.fill ?? 'transparent')}" stroke="${escapeXml(element.borderColor ?? '#d1d5db')}" stroke-width="${number(element.borderWidth ?? 1)}"/><text x="${number(x + (cell?.padding ?? 6))}" y="${number(y + (cell?.fontSize ?? 14) + (cell?.padding ?? 6))}" fill="${escapeXml(cell?.textColor ?? '#111827')}" font-family="${escapeXml(cell?.fontFamily ?? 'Arial')}" font-size="${number(cell?.fontSize ?? 14)}">${escapeXml(cell?.text ?? '')}</text>`);
        }
        x += cellWidth;
      }
      y += finite(rowHeights[row]);
    }
    content = cells.join('');
  } else if (element.type === 'video') {
    content = element.poster ? `<image href="${escapeXml(element.poster)}" width="${number(element.width)}" height="${number(element.height)}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${number(element.width)}" height="${number(element.height)}" fill="#111827"/><path d="M ${number(element.width * .42)} ${number(element.height * .32)} L ${number(element.width * .7)} ${number(element.height / 2)} L ${number(element.width * .42)} ${number(element.height * .68)} Z" fill="#fff"/>`;
  } else if (element.type === 'audio') {
    const waveform = element.waveform?.length ? element.waveform : [0.2, 0.6, 0.9, 0.45, 0.7, 0.3];
    const step = finite(element.width) / waveform.length;
    content = `<rect width="${number(element.width)}" height="${number(element.height)}" rx="8" fill="#f3f4f6"/>${waveform.map((amplitude, waveIndex) => `<line x1="${number(step * (waveIndex + .5))}" y1="${number(element.height * (.5 - amplitude * .4))}" x2="${number(step * (waveIndex + .5))}" y2="${number(element.height * (.5 + amplitude * .4))}" stroke="#7c3aed" stroke-width="${number(Math.max(1, step * .4))}" stroke-linecap="round"/>`).join('')}`;
  } else {
    content = '';
  }
  return `<g id="${escapeXml(element.id)}" aria-label="${escapeXml(element.name)}" transform="${transform(element)}" ${style(element)}>${content}</g>`;
}

export function pageToSvg(page: DesignDocument, options: SvgExportOptions = {}): string {
  const width = positive(page.width, 1080);
  const height = positive(page.height, 1080);
  const title = options.title ?? page.name ?? 'Visually design';
  const elements = (page.elements ?? []).map((element, index) => elementSvg(element, options, index)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}" role="img" aria-labelledby="document-title"><title id="document-title">${escapeXml(title)}</title><rect width="100%" height="100%" fill="${escapeXml(page.background || '#ffffff')}"/>${elements}</svg>`;
}

export const svgBlob = (page: DesignDocument, options?: SvgExportOptions) =>
  new Blob([pageToSvg(page, options)], { type: 'image/svg+xml;charset=utf-8' });
