import { describe, expect, it, vi } from 'vitest';
import { putFileWithProgress, requestPresignedUpload, uploadFile, type PresignUploadResponse } from './r2-upload';

const file = new File(['image'], 'hero.png', { type: 'image/png' });
const presign: PresignUploadResponse = {
  key: 'uploads/hero.png', uploadUrl: 'https://r2.test/upload', assetUrl: 'https://assets.test/hero.png',
  expiresAt: '2026-08-26T00:05:00.000Z', headers: { 'Content-Type': 'image/png' },
};

class FakeXhr {
  status = 200;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  getResponseHeader = vi.fn(() => '"etag"');
  send = vi.fn(() => {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
    this.onload?.();
  });
  abort = vi.fn(() => this.onabort?.());
}

describe('R2 browser uploads', () => {
  it('requests a presigned URL with file metadata', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(presign), { status: 200 }));
    await expect(requestPresignedUpload(file, 'https://api.test/', fetcher as typeof fetch)).resolves.toEqual(presign);
    expect(fetcher).toHaveBeenCalledWith('https://api.test/v1/uploads/presign', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ filename: 'hero.png', contentType: 'image/png', size: file.size }),
    }));
  });

  it('forwards a current session token without storing it', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(presign), { status: 200 }));
    await requestPresignedUpload(file, 'https://api.test', fetcher as typeof fetch, undefined, 'session-jwt');
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session-jwt' }),
    }));
  });

  it('uses the service error body when authorization fails', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 }));
    await expect(requestPresignedUpload(file, 'https://api.test', fetcher as typeof fetch)).rejects.toThrow('Unauthorized');
  });

  it('falls back to an HTTP status if the error is not JSON', async () => {
    const fetcher = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    await expect(requestPresignedUpload(file, 'https://api.test', fetcher as typeof fetch)).rejects.toThrow('502');
  });

  it('uploads with signed headers, byte progress, and ETag reporting', async () => {
    const xhr = new FakeXhr();
    const onProgress = vi.fn();
    await expect(putFileWithProgress(file, presign, { onProgress, xhrFactory: () => xhr as unknown as XMLHttpRequest })).resolves.toBe('"etag"');
    expect(xhr.open).toHaveBeenCalledWith('PUT', presign.uploadUrl);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(onProgress).toHaveBeenNthCalledWith(1, 50);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it('rejects unsuccessful R2 responses and network errors', async () => {
    const bad = new FakeXhr();
    bad.status = 403;
    await expect(putFileWithProgress(file, presign, { xhrFactory: () => bad as unknown as XMLHttpRequest })).rejects.toThrow('403');
    const offline = new FakeXhr();
    offline.send = vi.fn(() => offline.onerror?.());
    await expect(putFileWithProgress(file, presign, { xhrFactory: () => offline as unknown as XMLHttpRequest })).rejects.toThrow('CORS');
  });

  it('aborts an in-flight XHR through an AbortSignal', async () => {
    const xhr = new FakeXhr();
    xhr.send = vi.fn();
    const controller = new AbortController();
    const promise = putFileWithProgress(file, presign, { signal: controller.signal, xhrFactory: () => xhr as unknown as XMLHttpRequest });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr.abort).toHaveBeenCalled();
  });

  it('composes presigning and uploading', async () => {
    const xhr = new FakeXhr();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(presign), { status: 200 }));
    await expect(uploadFile(file, { apiUrl: 'https://api.test', fetcher: fetcher as typeof fetch, xhrFactory: () => xhr as unknown as XMLHttpRequest })).resolves.toMatchObject({ key: presign.key, etag: '"etag"' });
  });
});
