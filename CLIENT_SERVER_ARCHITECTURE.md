# Client/server boundary

Visually is deliberately local-first. Editing must remain responsive and usable when the network is unavailable.

| Capability | Runs where | Notes |
| --- | --- | --- |
| Konva editing, pages, history, layers, templates | Browser | Zustand state persists locally. |
| PNG/JSON export | Browser | No render server is needed. |
| Video/audio conversion | Browser | `ffmpeg.wasm` is loaded only when Media lab is used. The single-thread core avoids a mandatory cross-origin-isolated deployment. |
| AI image generation | Browser | The browser adapter uses a user-supplied, memory-only key and an editable OpenAI-compatible endpoint. |
| ML background removal | Browser | Transformers.js and the segmentation model load lazily; the image never leaves the device for processing. |
| Upload transfer | Browser → R2 | XHR sends bytes directly to a short-lived presigned PUT URL and reports real progress. |
| Upload authorization and object naming | Cloudflare Worker | The Worker checks origin/auth plus declared type/size, selects the object key, and signs PUT/GET URLs. It never proxies file bytes. |

## Server functionality that is still required

The minimal production backend has four responsibilities:

1. Authenticate the current user before issuing a URL. Connect `configureUploadAuthTokenProvider()` in `src/lib/uploads/upload-manager.ts` to the app's session provider. The included `PRESIGN_AUTH_TOKEN` is useful for local or private deployments, not as a secret embedded in public frontend JavaScript.
2. Apply upload policy and generate non-user-controlled object keys.
3. Hold the R2 S3 credentials and create short-lived, operation-specific signatures.
4. Return either a public custom-domain asset URL or a short-lived signed GET URL.

Presigned URLs are bearer tokens. A PUT URL can be reused until it expires. Content type is signed, but the request's declared `size` is only an authorization-time check: a malicious client can lie about it because browsers cannot set a signed `Content-Length` header. If hard byte quotas are required, add an R2 event/Queue cleanup job or a `/complete` endpoint backed by an R2 binding that verifies object metadata and deletes violations.

## AI security boundary

`@oh-my-pi/pi-ai`'s current model/context design informed the browser shim, but its current stream entrypoint imports Node filesystem/crypto modules and uses Bun globals. It also handles text/vision flows, not image output. `src/lib/ai/pi-ai-browser-shim.ts` therefore implements a small browser-native image-output adapter without bundling that server runtime.

User-owned keys can remain in component memory and go directly to a provider that permits browser CORS. Never put an app-owned provider key in a `VITE_*` variable: Vite variables are public bundle data. If you need app-paid AI, the additional server function is a narrow authenticated AI proxy or a provider-specific ephemeral-token broker with per-user quotas.

## Operational notes

Before production presigning works, configure R2 S3 credentials as Worker secrets (never as `vars` or frontend environment variables):

```bash
cd backend
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

The Worker health route can succeed without these credentials, so include a real `/v1/uploads/presign` smoke request in deployment verification.

- Configure R2 bucket CORS separately; Worker CORS and bucket CORS solve different hops.
- Use a custom R2 domain for public reads. R2 presigned URLs themselves use the S3 API domain.
- For private assets, request `/v1/downloads/presign` instead of setting `PUBLIC_ASSET_BASE_URL`.
- For large media and lower-end phones, enforce a client-side size warning. ffmpeg.wasm keeps the work private but is slower and more memory-hungry than native FFmpeg.
