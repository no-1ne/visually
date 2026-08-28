# Visually R2 presigner Worker

This Worker issues short-lived R2 PUT and GET URLs. Upload bytes travel directly between the browser and R2.

## Setup

1. Create an R2 bucket and an R2 Object Read & Write API token scoped to that bucket.
2. Copy `.dev.vars.example` to `.dev.vars` for local development. Do not commit `.dev.vars`.
3. Update `R2_BUCKET_NAME` and `ALLOWED_ORIGINS` in `wrangler.jsonc`.
4. Apply `r2-cors.example.json` in the bucket's CORS settings. Keep its origins in sync with the Worker configuration.
5. Install and verify:

   ```sh
   npm install
   npm run types
   npm test
   npm run check
   npm run dry-run
   ```

6. Store production secrets with Wrangler, then deploy:

   ```sh
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put PRESIGN_AUTH_TOKEN
   npx wrangler secret put PUBLIC_ASSET_BASE_URL
   npm run deploy
   ```

Do not embed `PRESIGN_AUTH_TOKEN` into a public client. In a real authenticated app, replace `verifyRequest()` with verification of your session/JWT (or Cloudflare Access identity) and provide that session token through the client's `configureUploadAuthTokenProvider()` hook.

## API

- `GET /health`
- `POST /v1/uploads/presign` with `{ "filename", "contentType", "size" }`
- `POST /v1/downloads/presign` with `{ "key" }`

Both presign endpoints accept `Authorization: Bearer <token>` when `PRESIGN_AUTH_TOKEN` is configured. PUT requests to the returned R2 URL must send the exact returned headers.

The public asset URL is returned only when `PUBLIC_ASSET_BASE_URL` is configured. Otherwise keep the bucket private and use the signed download endpoint.
