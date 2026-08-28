export interface PresignUploadRequest {
  filename: string;
  contentType: string;
  size: number;
}

export interface PresignUploadResponse {
  key: string;
  uploadUrl: string;
  assetUrl: string | null;
  expiresAt: string;
  headers: Record<string, string>;
}

export interface UploadResult extends PresignUploadResponse {
  etag: string | null;
}

export interface UploadOptions {
  apiUrl: string;
  authToken?: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  fetcher?: typeof fetch;
  xhrFactory?: () => XMLHttpRequest;
}

const parseError = async (response: Response) => {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `Upload service returned ${response.status}`;
  } catch {
    return `Upload service returned ${response.status}`;
  }
};

export async function requestPresignedUpload(
  file: File,
  apiUrl: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  authToken?: string,
): Promise<PresignUploadResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetcher(`${apiUrl.replace(/\/$/, '')}/v1/uploads/presign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size } satisfies PresignUploadRequest),
    signal,
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<PresignUploadResponse>;
}

export function putFileWithProgress(
  file: File,
  presign: PresignUploadResponse,
  options: Pick<UploadOptions, 'signal' | 'onProgress' | 'xhrFactory'> = {},
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = options.xhrFactory?.() ?? new XMLHttpRequest();
    const abort = () => xhr.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    xhr.open('PUT', presign.uploadUrl);
    Object.entries(presign.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      options.signal?.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve(xhr.getResponseHeader('ETag'));
      } else {
        reject(new Error(`R2 upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('R2 upload failed. Check the bucket CORS policy and your connection.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    xhr.send(file);
  });
}

export async function uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
  const presign = await requestPresignedUpload(file, options.apiUrl, options.fetcher, options.signal, options.authToken);
  const etag = await putFileWithProgress(file, presign, options);
  return { ...presign, etag };
}
