import { AwsClient } from 'aws4fetch';
import {
  assetUrl, createObjectKey, isSafeObjectKey, parsePositiveInteger, validateUpload,
} from './policy';

export interface Env {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  ALLOWED_ORIGINS?: string;
  MAX_UPLOAD_BYTES?: string;
  PRESIGN_TTL_SECONDS?: string;
  PRESIGN_AUTH_TOKEN?: string;
  PUBLIC_ASSET_BASE_URL?: string;
}

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
};

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ Vary: 'Origin' });
  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return headers;
}

function verifyRequest(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) return 'Origin is not allowed.';
  if (env.PRESIGN_AUTH_TOKEN && request.headers.get('Authorization') !== `Bearer ${env.PRESIGN_AUTH_TOKEN}`) return 'Unauthorized.';
  return null;
}

function signer(env: Env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    throw new Error('R2 signing configuration is incomplete.');
  }
  return new AwsClient({
    service: 's3', region: 'auto',
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
}

function r2ObjectUrl(env: Env, key: string, ttl: number) {
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET_NAME)}/${key.split('/').map(encodeURIComponent).join('/')}`);
  url.searchParams.set('X-Amz-Expires', String(ttl));
  return url;
}

async function uploadPresign(request: Request, env: Env) {
  const maxBytes = parsePositiveInteger(env.MAX_UPLOAD_BYTES, 50 * 1024 * 1024, 5 * 1024 * 1024 * 1024);
  let input;
  try {
    input = validateUpload(await request.json(), maxBytes);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid upload request.' }, { status: 400 });
  }
  const ttl = parsePositiveInteger(env.PRESIGN_TTL_SECONDS, 300, 3600);
  const key = createObjectKey(input.filename);
  const signed = await signer(env).sign(new Request(r2ObjectUrl(env, key, ttl), {
    method: 'PUT', headers: { 'Content-Type': input.contentType },
  }), { aws: { signQuery: true } });
  return json({
    key,
    uploadUrl: signed.url,
    transport: 'direct-r2',
    assetUrl: assetUrl(env.PUBLIC_ASSET_BASE_URL, key),
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    headers: { 'Content-Type': input.contentType },
  });
}

async function downloadPresign(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as { key?: unknown } | null;
  if (!isSafeObjectKey(body?.key)) return json({ error: 'A valid uploads/ object key is required.' }, { status: 400 });
  const ttl = parsePositiveInteger(env.PRESIGN_TTL_SECONDS, 300, 3600);
  const signed = await signer(env).sign(new Request(r2ObjectUrl(env, body!.key as string, ttl)), { aws: { signQuery: true } });
  return json({ key: body!.key, downloadUrl: signed.url, transport: 'direct-r2', expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin');
    return new Response(null, { status: origin && allowedOrigins(env).includes(origin) ? 204 : 403, headers: cors });
  }
  if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'visually-r2-presigner' }, { headers: cors });
  const rejection = verifyRequest(request, env);
  if (rejection) return json({ error: rejection }, { status: rejection === 'Unauthorized.' ? 401 : 403, headers: cors });
  try {
    let response: Response;
    if (url.pathname === '/v1/uploads/presign' && request.method === 'POST') response = await uploadPresign(request, env);
    else if (url.pathname === '/v1/downloads/presign' && request.method === 'POST') response = await downloadPresign(request, env);
    else response = json({ error: 'Not found.' }, { status: 404 });
    cors.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to create presigned URL.' }, { status: 500, headers: cors });
  }
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
