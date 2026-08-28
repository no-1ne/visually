import { describe, expect, it, vi } from 'vitest';
import { defaultImageModel, generateImage } from './pi-ai-browser-shim';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('browser AI image shim', () => {
  it('maps an aionly-style model descriptor to the images endpoint', async () => {
    const fetcher = vi.fn(async () => response({ data: [{ b64_json: 'abc123' }] }));
    await expect(generateImage({ ...defaultImageModel, baseUrl: 'https://provider.test/v1/' }, {
      apiKey: ' session-key ', prompt: ' paper art ', fetcher: fetcher as typeof fetch,
    })).resolves.toBe('data:image/png;base64,abc123');
    expect(fetcher).toHaveBeenCalledWith('https://provider.test/v1/images/generations', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer session-key' }),
    }));
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'gpt-image-2', prompt: 'paper art', size: '1024x1024', quality: 'medium' });
  });

  it('supports compatible providers that return a URL', async () => {
    const fetcher = vi.fn(async () => response({ data: [{ url: 'https://images.test/out.png' }] }));
    await expect(generateImage(defaultImageModel, { apiKey: 'key', prompt: 'art', fetcher: fetcher as typeof fetch })).resolves.toBe('https://images.test/out.png');
  });

  it('validates secrets and prompts before networking', async () => {
    await expect(generateImage(defaultImageModel, { apiKey: '', prompt: 'art' })).rejects.toThrow('API key');
    await expect(generateImage(defaultImageModel, { apiKey: 'key', prompt: ' ' })).rejects.toThrow('Describe');
  });

  it('surfaces provider errors and malformed successful responses', async () => {
    const denied = vi.fn(async () => response({ error: { message: 'Quota exceeded' } }, 429));
    await expect(generateImage(defaultImageModel, { apiKey: 'key', prompt: 'art', fetcher: denied as typeof fetch })).rejects.toThrow('Quota exceeded');
    const empty = vi.fn(async () => response({ data: [] }));
    await expect(generateImage(defaultImageModel, { apiKey: 'key', prompt: 'art', fetcher: empty as typeof fetch })).rejects.toThrow('no image');
  });
});
