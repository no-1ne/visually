import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { DesignDocument, EditorElement } from '@/types';
import type { FFmpegEngine } from '@/lib/media/ffmpeg-client';
import {
  createProjectFile, encodePagesWithFfmpeg, exportProjectJson, externalPptxAdapter,
  importProject, pageToSvg, pagesToPdf, pagesToPptxBlob, pagesToPrintableHtml, pdfBlob, safeFilename,
} from './index';

const elements: EditorElement[] = [
  {
    id: 'text<&', type: 'text', name: 'Title "one"', x: 10, y: 20, width: 200, height: 80,
    rotation: 5, opacity: 0.8, text: 'Hello & <world>\nSecond line', fontSize: 32,
    fontFamily: 'Arial & Sons', fontStyle: 'bold', fill: '#112233', align: 'center', letterSpacing: 1, lineHeight: 1.2,
  },
  {
    id: 'rectangle', type: 'shape', name: 'Rectangle', x: 20, y: 100, width: 120, height: 80,
    rotation: 0, opacity: 1, shape: 'rect', fill: '#ff0000', cornerRadius: 12, stroke: '#000000', strokeWidth: 2,
  },
  {
    id: 'circle', type: 'shape', name: 'Circle', x: 160, y: 100, width: 80, height: 60,
    rotation: 0, opacity: 1, shape: 'circle', fill: '#00ff00', cornerRadius: 0,
  },
  {
    id: 'star', type: 'shape', name: 'Star', x: 260, y: 100, width: 80, height: 80,
    rotation: 0, opacity: 1, shape: 'star', fill: '#0000ff', cornerRadius: 0,
  },
  {
    id: 'line', type: 'line', name: 'Line', x: 20, y: 210, width: 200, height: 20,
    rotation: 0, opacity: 1, fill: '#123456', strokeWidth: 4, dash: [8, 4],
  },
  {
    id: 'image', type: 'image', name: 'Image', x: 240, y: 200, width: 100, height: 80,
    rotation: 0, opacity: 1, src: 'data:image/png;base64,abc&def', cornerRadius: 8,
  },
  {
    id: 'hidden', type: 'shape', name: 'Hidden', x: 0, y: 0, width: 10, height: 10,
    rotation: 0, opacity: 1, hidden: true, shape: 'rect', fill: '#fff', cornerRadius: 0,
  },
];

const page = (name = 'Test & Design'): DesignDocument => ({
  name, width: 400, height: 300, background: '#fefefe', elements: structuredClone(elements),
});

describe('SVG export', () => {
  it('serializes all supported elements, transforms, clipping, and XML escaping', () => {
    const svg = pageToSvg(page());
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 400 300"');
    expect(svg).toContain('Test &amp; Design');
    expect(svg).toContain('Hello &amp; &lt;world&gt;');
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('stroke-dasharray="8 4"');
    expect(svg).toContain('<clipPath');
    expect(svg).toContain('abc&amp;def');
    expect(svg).not.toContain('id="hidden"');
  });

  it('can include hidden elements and rewrite image URLs', () => {
    const svg = pageToSvg(page(), { includeHidden: true, imageHref: () => 'data:image/png;base64,replaced' });
    expect(svg).toContain('id="hidden"');
    expect(svg).toContain('base64,replaced');
  });

  it.each([
    ['contain', 'xMidYMid meet'],
    ['cover', 'xMidYMid slice'],
    ['fill', 'none'],
  ] as const)('preserves image %s behavior in SVG and raster export sources', (objectFit, expected) => {
    const design = page();
    const image = design.elements.find((element) => element.type === 'image');
    if (image?.type === 'image') image.objectFit = objectFit;
    expect(pageToSvg(design)).toContain(`preserveAspectRatio="${expected}"`);
  });

  it('exports newer drawing, table, SVG, and media elements without executable inline markup', () => {
    const advanced = page();
    advanced.elements = [
      { id: 'd', type: 'drawing', name: 'Draw', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, points: [0, 0, 20, 30], stroke: '#000', strokeWidth: 2 },
      { id: 't', type: 'table', name: 'Table', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, rows: 1, columns: 1, cells: [[{ id: 'cell', text: 'Value' }]] },
      { id: 's', type: 'svg', name: 'Vector', x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, markup: '<svg><script>alert(1)</script></svg>' },
      { id: 'v', type: 'video', name: 'Video', x: 0, y: 0, width: 120, height: 80, rotation: 0, opacity: 1, src: 'movie.mp4' },
      { id: 'a', type: 'audio', name: 'Audio', x: 0, y: 0, width: 120, height: 40, rotation: 0, opacity: 1, src: 'sound.mp3', waveform: [0.2, 0.8] },
    ];
    const svg = pageToSvg(advanced);
    expect(svg).toContain('<polyline');
    expect(svg).toContain('Value');
    expect(svg).toContain('data:image/svg+xml,%3Csvg%3E%3Cscript%3E');
    expect(svg).not.toContain('<script>alert');
    expect(svg).toContain('aria-label="Video"');
    expect(svg).toContain('aria-label="Audio"');
  });

  it('exports merged table ranges once at their combined track size', () => {
    const design = page();
    design.elements = [{
      id: 'merged-table', type: 'table', name: 'Merged table', x: 0, y: 0, width: 120, height: 80,
      rotation: 0, opacity: 1, rows: 2, columns: 2, columnWidths: [50, 70], rowHeights: [30, 50],
      cells: [
        [{ id: 'anchor', text: 'Combined', rowSpan: 2, colSpan: 2 }, { id: 'covered-1', text: 'Hidden', rowSpan: 0, colSpan: 0 }],
        [{ id: 'covered-2', text: 'Hidden', rowSpan: 0, colSpan: 0 }, { id: 'covered-3', text: 'Hidden', rowSpan: 0, colSpan: 0 }],
      ],
    }];
    const svg = pageToSvg(design);
    expect(svg).toContain('width="120" height="80"');
    expect(svg).toContain('Combined');
    expect(svg).not.toContain('Hidden');
  });

  it('preserves curved text as an SVG text path while leaving rich text on the safe straight branch', () => {
    const design = page();
    const curved = design.elements[0];
    if (curved.type !== 'text') throw new Error('Expected text fixture');
    curved.textPath = { enabled: true, type: 'arc', bend: 50, reverse: true };
    curved.align = 'center';
    const svg = pageToSvg(design);
    expect(svg).toContain('<textPath href="#text-path-0-text"');
    expect(svg).toContain('startOffset="50%"');
    expect(svg).toMatch(/<path id="text-path-0-text" d="M 200 .* A .* 0 0 0 0 /);

    curved.runs = [{ text: 'Styled', fontWeight: 700 }];
    const richSvg = pageToSvg(design);
    expect(richSvg).not.toContain('<textPath');
    expect(richSvg).toContain('<tspan');
  });
});

describe('printable HTML and PDF export', () => {
  it('builds a standalone, multi-page print document', () => {
    const html = pagesToPrintableHtml([page('One'), page('Two')], { title: 'Deck <name>', autoPrint: true });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Deck &lt;name&gt;</title>');
    expect(html.match(/class="sheet"/g)).toHaveLength(2);
    expect(html).toContain('@media print');
    expect(html).toContain('=>print()');
  });

  it('writes a multi-page, cross-reference-addressable PDF', () => {
    const bytes = pagesToPdf([page('One'), page('Two')], { title: 'PDF title', pixelScale: 0.75 });
    const pdf = new TextDecoder().decode(bytes);
    expect(pdf.startsWith('%PDF-1.7')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('/MediaBox [0 0 300 225]');
    expect(pdf).toContain('(Hello & <world>) Tj');
    expect(pdf).toContain('/Title (PDF title)');
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
    const startXref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(startXref, startXref + 4)).toBe('xref');
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    offsets.forEach((offset, index) => expect(pdf.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`)));
    expect(pdfBlob([page()]).type).toBe('application/pdf');
  });
});

describe('PowerPoint export', () => {
  it('creates a dependency-light Open XML package with one image-backed slide per page', async () => {
    const progress: number[] = [];
    const rasterizer = vi.fn(async () => new Blob([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ], { type: 'image/png' }));
    const blob = await pagesToPptxBlob([page('Slide & one'), page('Slide two')], {
      title: 'Visually <deck>', author: 'Test author', pixelRatio: 1,
      rasterizer, onProgress: (percent) => progress.push(percent),
    });
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(bytes);

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(rasterizer).toHaveBeenCalledTimes(2);
    expect(rasterizer).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Slide & one' }), 0, { pixelRatio: 1, mimeType: 'image/png' });
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      '[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml', 'ppt/media/image1.png', 'ppt/media/image2.png',
      'ppt/theme/theme1.xml', 'docProps/core.xml',
    ]));
    expect(await zip.file('ppt/presentation.xml')?.async('string')).toContain('<p:sldId id="257" r:id="rId3"/>');
    expect(await zip.file('ppt/slides/slide1.xml')?.async('string')).toContain('name="Slide &amp; one"');
    expect(await zip.file('docProps/core.xml')?.async('string')).toContain('Visually &lt;deck&gt;');
    expect(progress.at(-1)).toBe(100);
  });
});

describe('project JSON migrations', () => {
  it('exports a versioned deterministic envelope and imports it', () => {
    const json = exportProjectJson([page()], { exportedAt: new Date('2026-01-02T03:04:05Z'), metadata: { owner: 'browser' } });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed).toMatchObject({ schema: 'visually-project', version: 2, exportedAt: '2026-01-02T03:04:05.000Z' });
    expect(importProject(json).pages[0].elements).toHaveLength(elements.length);
    expect(createProjectFile([page()]).pages).not.toBe(page());
  });

  it('continues importing legacy Canvasly envelopes after the Visually rename', () => {
    const result = importProject({ schema: 'canvasly-project', version: 2, pages: [page()] });
    expect(result.pages[0].elements).toHaveLength(elements.length);
    expect(result.sourceVersion).toBe(2);
  });

  it('migrates legacy page arrays, applies defaults, skips unknowns, and repairs duplicate ids', () => {
    const result = importProject([{ width: 0, height: Number.NaN, elements: [
      { type: 'text', id: 'same', text: 'A' }, { type: 'text', id: 'same', text: 'B' },
      { type: 'future-widget' }, null,
    ] }]);
    expect(result.sourceVersion).toBe(0);
    expect(result.pages[0]).toMatchObject({ name: 'Page 1', width: 1, height: 1080, background: '#ffffff' });
    expect(result.pages[0].elements.map((element) => element.id)).toEqual(['same', 'same-2']);
    expect(result.warnings).toHaveLength(3);
  });

  it('rejects invalid JSON, empty data, and future versions', () => {
    expect(() => importProject('{no')).toThrow('Project JSON is invalid');
    expect(() => importProject({ nope: true })).toThrow('does not contain any pages');
    expect(() => importProject({ version: 99, pages: [page()] })).toThrow('newer than this editor supports');
    expect(() => importProject([])).toThrow('usable page');
  });

  it('round-trips the expanded client element model', () => {
    const legacy = { version: 1, pages: [{ name: 'Advanced', width: 100, height: 100, background: '#fff', elements: [
      { id: 'draw', type: 'drawing', name: 'Ink', x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, points: [0, 0, 2, 3], stroke: '#000', strokeWidth: 1 },
      { id: 'group', type: 'group', name: 'Group', x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, childIds: ['draw'] },
      { id: 'video', type: 'video', name: 'Clip', x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, src: 'clip.webm', trimStart: 1, trimEnd: 2 },
    ] }] };
    const result = importProject(legacy);
    expect(result.pages[0].elements.map((element) => element.type)).toEqual(['drawing', 'group', 'video']);
    expect(result.pages[0].elements[2]).toMatchObject({ src: 'clip.webm', trimStart: 1, trimEnd: 2 });
  });
});

describe('client encoder adapters', () => {
  it('encodes rasterized pages with an injected ffmpeg.wasm engine and cleans temporary files', async () => {
    const files = new Map<string, Uint8Array>();
    let progressListener: ((event: { progress: number }) => void) | undefined;
    const engine: FFmpegEngine = {
      on: vi.fn((_event, listener) => { progressListener = listener; }), off: vi.fn(), terminate: vi.fn(),
      writeFile: vi.fn(async (name, data) => { files.set(name, data); }),
      exec: vi.fn(async (args) => { progressListener?.({ progress: 0.7 }); files.set(String(args.at(-1)), new Uint8Array([71, 73, 70])); }),
      readFile: vi.fn(async (name) => files.get(name)!), deleteFile: vi.fn(async (name) => { files.delete(name); }),
    };
    const progress = vi.fn();
    const blob = await encodePagesWithFfmpeg(engine, { pages: [page('One'), page('Two')], onProgress: progress }, {
      format: 'gif', secondsPerPage: 0.5,
      rasterizer: async () => new Blob([new Uint8Array([1, 2, 3]).buffer], { type: 'image/png' }),
    });
    expect(blob.type).toBe('image/gif');
    expect(await blob.arrayBuffer()).toEqual(new Uint8Array([71, 73, 70]).buffer);
    expect(engine.writeFile).toHaveBeenCalledTimes(3);
    expect(engine.exec).toHaveBeenCalledWith(expect.arrayContaining(['-f', 'concat', '-i']));
    expect(engine.deleteFile).toHaveBeenCalledTimes(4);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('provides an injectable PPTX contract and safe filenames', async () => {
    const exporter = vi.fn(async () => new Blob(['pptx'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    const adapter = externalPptxAdapter(exporter);
    expect(adapter.isSupported()).toBe(true);
    expect((await adapter.export({ pages: [page()] }, {})).type).toContain('presentationml');
    expect(safeFilename(' Café poster! ', '.pdf')).toBe('Cafe-poster.pdf');
  });
});
