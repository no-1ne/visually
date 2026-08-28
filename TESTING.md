# Testing guide

Visually uses complementary test layers so canvas behavior is not trusted solely to DOM mocks.

## Test layers

### State and model tests

`src/store/editor-store.test.ts` validates:

- Initial state and zoom bounds
- Element insertion, updates, selection, duplication, and locked deletion
- Gesture transaction coalescing
- Undo, redo, redo-branch invalidation, and the 50-snapshot limit
- Page add, duplicate, switch, delete, template replacement, and project loading
- Layer ordering in every direction
- Clipboard copy/paste and unique IDs
- Grouping and ungrouping
- Complete reset behavior

`src/templates.test.ts` validates template metadata, dimensions, IDs, supported element types, geometry, opacity, and fresh-document creation.

### Component interaction tests

`src/components/panels/panels.test.tsx` uses Testing Library and user-level events to validate:

- Template application
- Text presets
- Shape and line insertion through accessible controls
- Local image upload via `FileReader`
- Browser-direct AI generation response handling
- Layer selection, visibility, and locking
- Text/property editing
- Duplicate, lock, and delete actions
- Page background changes and multi-page controls

### Real-browser E2E tests

`e2e/editor.spec.ts` runs in Chromium with two projects:

- Desktop Chrome at 1440×900
- Pixel 7 mobile emulation, including an orientation-style resize

The browser suite validates shell rendering, runtime errors, canvas creation, text/history keyboard flows, templates, core element types, uploads, pages, JSON and high-resolution PNG downloads, JSON import, zoom, mobile tool sheets, horizontal overflow, touch target sizing, responsive recovery, and the five-format judge workflow with activity receipts and safe undo.

Failed E2E runs retain traces, screenshots, and videos under ignored test-result folders.

### Browser infrastructure tests

- `src/lib/uploads/r2-upload.test.ts` covers presign requests, signed headers, progress, ETags, HTTP/network failures, aborts, and the composed upload flow.
- `src/lib/ai/pi-ai-browser-shim.test.ts` covers base64/URL image responses, configurable endpoints, validation, and provider errors.
- `src/lib/media/ffmpeg-client.test.ts` covers safe output naming, in-memory transcoding, progress, cleanup, malformed output, and cancellation without downloading the WASM core during tests.
- `src/lib/export/export.test.ts` validates the generated PPTX Open XML package, slide relationships, dimensions, metadata escaping, and image payloads alongside the other export formats.
- `src/lib/webmcp/*.test.ts` covers the 17-tool catalog, state/template queries, campaign creation and brand propagation, design audits, mutations and undo, input bounds, destructive confirmations, project import/export, unsupported browsers, registration lifecycle, errors, and legacy API compatibility.
- `src/store/upload-store.test.ts` covers upload task lifecycle and retention bounds.

The Playwright desktop suite also injects a browser-level `modelContext` host, verifies all tools register, invokes template and text mutations against the live canvas, confirms deletion is guarded, and reads an SVG export result. `e2e/winning-workflow.spec.ts` additionally proves the judge demo creates five editable formats, exposes campaign/update/audit receipts, restores the original project from the activity panel, and remains accessible on mobile.

### Cloudflare Worker tests

`backend/test/` validates upload policy, hostile filenames and keys, origin CORS, bearer auth, content-type-bound R2 signatures, public asset URLs, private download signatures, and API errors. The backend coverage gate is configured separately in `backend/vitest.config.ts`.

## Commands

```bash
npm test
npm run lint
npm run test:coverage
npm run test:e2e
npm run test:backend
npm run test:all
```

Coverage HTML is written to `coverage/`; the Playwright report is written to `playwright-report/`.

## Latest complete gate

- Frontend: 260 tests passed; 93.44% statement and 96.81% line coverage.
- Cloudflare Worker: 15 tests passed; 95.34% statement and 97.14% line coverage.
- Browser E2E: 26 applicable tests passed across desktop and Pixel 7 projects; 26 inverse-project cases were intentionally skipped.
- Lint, frontend and backend TypeScript checks, and the production Vite build passed.
