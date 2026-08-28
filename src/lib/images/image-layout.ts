export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImagePlacement extends ImageDimensions {
  x: number;
  y: number;
  orientation: 'portrait' | 'landscape' | 'square';
}

const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Fits any source aspect ratio inside a page while keeping the complete image visible. */
export function fitImageToPage(
  source: ImageDimensions,
  page: ImageDimensions,
  options: { padding?: number; cascadeIndex?: number } = {},
): ImagePlacement {
  const pageWidth = positive(page.width, 1080);
  const pageHeight = positive(page.height, 1080);
  const sourceWidth = positive(source.width, 1024);
  const sourceHeight = positive(source.height, 1024);
  const padding = clamp(options.padding ?? Math.min(pageWidth, pageHeight) * .08, 12, Math.min(pageWidth, pageHeight) * .24);
  const availableWidth = Math.max(24, pageWidth - padding * 2);
  const availableHeight = Math.max(24, pageHeight - padding * 2);
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const contentWidth = sourceWidth * scale;
  const contentHeight = sourceHeight * scale;
  // Keep even extreme panoramas selectable without stretching their pixels.
  const width = clamp(contentWidth, 24, availableWidth);
  const height = clamp(contentHeight, 24, availableHeight);
  const cascade = Math.max(0, Math.floor(options.cascadeIndex ?? 0)) % 6;
  const offset = cascade * Math.min(18, padding / 3);
  const centeredX = (pageWidth - width) / 2;
  const centeredY = (pageHeight - height) / 2;
  const x = clamp(centeredX + offset, padding, pageWidth - padding - width);
  const y = clamp(centeredY + offset, padding, pageHeight - padding - height);
  const ratio = sourceWidth / sourceHeight;
  const orientation = Math.abs(ratio - 1) < .01 ? 'square' : ratio > 1 ? 'landscape' : 'portrait';
  return { x, y, width, height, orientation };
}

export function loadImageDimensions(src: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({
      width: positive(image.naturalWidth, image.width || 1024),
      height: positive(image.naturalHeight, image.height || 1024),
    });
    image.onerror = () => reject(new Error('The selected image could not be decoded.'));
    image.src = src;
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

