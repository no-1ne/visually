import { describe, expect, it } from 'vitest';
import { handleRequest, type Env } from '../src/index';

const env: Env = {
  R2_ACCOUNT_ID: '1234567890abcdef',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'assets',
  ALLOWED_ORIGINS: 'https://editor.example.com,http://localhost:5173',
  PRESIGN_AUTH_TOKEN: 'test-token',
  PUBLIC_ASSET_BASE_URL: 'https://assets.example.com',
};

const request = (path: string, init: RequestInit = {}) => new Request(`https://worker.example.com${path}`, init);

describe('presign worker', () => {
  it('provides an unauthenticated health endpoint', async () => {
    const response = await handleRequest(request('/health'), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('answers CORS preflights only for configured origins', async () => {
    const allowed = await handleRequest(request('/v1/uploads/presign', { method: 'OPTIONS', headers: { Origin: 'https://editor.example.com' } }), env);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://editor.example.com');
    const denied = await handleRequest(request('/v1/uploads/presign', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
    expect(denied.status).toBe(403);
  });

  it('requires the configured bearer token', async () => {
    const response = await handleRequest(request('/v1/uploads/presign', { method: 'POST' }), env);
    expect(response.status).toBe(401);
  });

  it('creates a content-type-bound R2 PUT URL', async () => {
    const response = await handleRequest(request('/v1/uploads/presign', {
      method: 'POST',
      headers: { Origin: 'https://editor.example.com', Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'hero image.png', contentType: 'image/png', size: 2048 }),
    }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.key).toMatch(/^uploads\/\d{4}\/\d{2}\/.+-hero-image\.png$/);
    expect(body.assetUrl).toMatch(/^https:\/\/assets\.example\.com\/uploads\//);
    expect(body.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(String(body.uploadUrl)).toContain('X-Amz-Signature=');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://editor.example.com');
  });

  it('rejects unsafe download keys and signs safe keys', async () => {
    const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
    const bad = await handleRequest(request('/v1/downloads/presign', { method: 'POST', headers, body: JSON.stringify({ key: '../secret' }) }), env);
    expect(bad.status).toBe(400);
    const good = await handleRequest(request('/v1/downloads/presign', { method: 'POST', headers, body: JSON.stringify({ key: 'uploads/2026/08/image.png' }) }), env);
    expect(good.status).toBe(200);
    expect((await good.json() as { downloadUrl: string }).downloadUrl).toContain('X-Amz-Signature=');
  });

  it('returns useful validation and routing errors', async () => {
    const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
    const invalid = await handleRequest(request('/v1/uploads/presign', { method: 'POST', headers, body: JSON.stringify({ filename: 'bad.exe', contentType: 'application/octet-stream', size: 1 }) }), env);
    expect(invalid.status).toBe(400);
    const missing = await handleRequest(request('/missing', { headers } as RequestInit), env);
    expect(missing.status).toBe(404);
  });

});
