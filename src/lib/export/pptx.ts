import type { DesignDocument } from '@/types';
import { browserRasterizer } from './adapters';
import { assertPages } from './common';

/** Creates an editable presentation container in the browser, with each design page embedded at full resolution. */
export async function pagesToPptxBlob(
  pages: readonly DesignDocument[],
  options: {
    title?: string;
    author?: string;
    pixelRatio?: number;
    onProgress?: (percent: number) => void;
    rasterizer?: typeof browserRasterizer;
  } = {},
): Promise<Blob> {
  assertPages(pages);
  const first = pages[0];
  const slideWidth = Math.max(1, first.width / 96);
  const slideHeight = Math.max(1, first.height / 96);
  const rasterize = options.rasterizer ?? browserRasterizer;
  const slides: Array<{ name: string; image: Blob }> = [];

  for (const [index, page] of pages.entries()) {
    const image = await rasterize(page, index, { pixelRatio: options.pixelRatio ?? 2, mimeType: 'image/png' });
    slides.push({ name: page.name, image });
    options.onProgress?.(Math.round(((index + 1) / pages.length) * 90));
  }

  const { createPptxPackage } = await import('./pptx-openxml');
  return createPptxPackage({
    widthInches: slideWidth,
    heightInches: slideHeight,
    title: options.title ?? first.name,
    author: options.author ?? 'Visually',
    slides,
    onProgress: options.onProgress,
  });
}
