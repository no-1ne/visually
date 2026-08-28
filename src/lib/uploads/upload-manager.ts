import { useUploadStore } from '@/store/upload-store';
import { uploadFile } from './r2-upload';

const files = new Map<string, File>();
const controllers = new Map<string, AbortController>();
let tokenProvider: () => Promise<string | undefined> = async () => undefined;

export function configureUploadAuthTokenProvider(provider: () => Promise<string | undefined>) {
  tokenProvider = provider;
}

export function getUploadApiUrl() {
  return (import.meta.env.VITE_UPLOAD_API_URL as string | undefined)?.trim() ?? '';
}

export async function startBackgroundUpload(file: File, id: string = crypto.randomUUID()) {
  const apiUrl = getUploadApiUrl();
  files.set(id, file);
  useUploadStore.getState().addTask({
    id, name: file.name, size: file.size, progress: 0,
    status: apiUrl ? 'authorizing' : 'local',
  });
  if (!apiUrl) return id;

  const controller = new AbortController();
  controllers.set(id, controller);
  try {
    const authToken = await tokenProvider();
    const result = await uploadFile(file, {
      apiUrl,
      authToken,
      signal: controller.signal,
      onProgress: (progress) => useUploadStore.getState().updateTask(id, { progress, status: 'uploading' }),
    });
    useUploadStore.getState().updateTask(id, {
      progress: 100, status: 'complete', key: result.key, assetUrl: result.assetUrl, error: undefined,
    });
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === 'AbortError';
    useUploadStore.getState().updateTask(id, {
      status: cancelled ? 'cancelled' : 'error',
      error: cancelled ? undefined : error instanceof Error ? error.message : 'Upload failed',
    });
  } finally {
    controllers.delete(id);
  }
  return id;
}

export function cancelUpload(id: string) {
  controllers.get(id)?.abort();
}

export function retryUpload(id: string) {
  const file = files.get(id);
  if (!file) return Promise.resolve(id);
  useUploadStore.getState().removeTask(id);
  return startBackgroundUpload(file, id);
}

export function forgetUpload(id: string) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  files.delete(id);
  useUploadStore.getState().removeTask(id);
}
