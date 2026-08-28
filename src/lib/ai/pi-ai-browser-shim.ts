/**
 * Browser-only subset inspired by @oh-my-pi/pi-ai's model/options boundary.
 * It intentionally avoids the package's Node/Bun streaming entrypoint and adds
 * image output, which pi-ai currently does not expose.
 */
export interface BrowserImageModel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
}

export interface GenerateImageOptions {
  apiKey: string;
  prompt: string;
  size?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  background?: 'opaque' | 'transparent' | 'auto';
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

interface ImagesResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
}

export const defaultImageModel: BrowserImageModel = {
  id: 'gpt-image-2',
  name: 'GPT Image 2',
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
};

export async function generateImage(model: BrowserImageModel, options: GenerateImageOptions): Promise<string> {
  if (!options.apiKey.trim()) throw new Error('Enter an API key for this browser session.');
  if (!options.prompt.trim()) throw new Error('Describe the image you want to create.');
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${model.baseUrl.replace(/\/$/, '')}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.id,
      prompt: options.prompt.trim(),
      size: options.size ?? '1024x1024',
      quality: options.quality ?? 'medium',
      background: options.background ?? 'auto',
    }),
    signal: options.signal,
  });
  const body = await response.json() as ImagesResponse;
  if (!response.ok) throw new Error(body.error?.message || `Image provider returned ${response.status}`);
  const image = body.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  throw new Error('The image provider returned no image data.');
}
