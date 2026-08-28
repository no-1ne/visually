export interface UploadInput {
  filename: string;
  contentType: string;
  size: number;
}

const allowedContentTypes = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
]);

export function validateUpload(input: unknown, maxBytes: number): UploadInput {
  if (!input || typeof input !== 'object') throw new Error('Expected a JSON upload description.');
  const { filename, contentType, size } = input as Partial<UploadInput>;
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 180) throw new Error('Filename is required and must be at most 180 characters.');
  if (typeof contentType !== 'string' || !allowedContentTypes.has(contentType.toLowerCase())) throw new Error('This file type is not allowed.');
  if (!Number.isSafeInteger(size) || (size as number) <= 0) throw new Error('File size must be a positive integer.');
  if ((size as number) > maxBytes) throw new Error(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  return { filename: filename.trim(), contentType: contentType.toLowerCase(), size: size as number };
}

export function safeFilename(filename: string) {
  const normalized = filename.normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[-]+$/g, '');
  return (normalized || 'asset').slice(-120);
}

export function createObjectKey(filename: string, now = new Date(), id = crypto.randomUUID()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `uploads/${now.getUTCFullYear()}/${month}/${id}-${safeFilename(filename)}`;
}

export function isSafeObjectKey(key: unknown) {
  return typeof key === 'string'
    && key.startsWith('uploads/')
    && !key.includes('..')
    && !key.includes('\\')
    && key.length <= 512;
}

export function parsePositiveInteger(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export function assetUrl(baseUrl: string | undefined, key: string) {
  if (!baseUrl) return null;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl.replace(/\/$/, '')}/${encodedKey}`;
}
