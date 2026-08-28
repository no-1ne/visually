# Visually

An independent Canva-style design editor built with React 19, Vite, TypeScript, Konva, Zustand, and shadcn/Base UI.

> Open-source preparation is in progress. No license has been selected yet, so the code is not licensed for redistribution until a `LICENSE` file is added.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Architecture

- `src/store/editor-store.ts` — persisted Zustand document, selection, viewport, and transaction-aware history state.
- `src/EditorCanvas.tsx` — Konva rendering and transforms for typed elements.
- `src/components/panels/` — focused tools and property inspectors.
- `src/components/ui/` — generated shadcn components using Base UI primitives.
- `src/lib/uploads/` — R2 presign client, progress-aware XHR transfer, cancellation, and retry.
- `src/lib/media/` — lazily loaded ffmpeg.wasm media processing.
- `src/lib/ai/` — browser-safe, memory-key image generation adapter.
- `src/lib/webmcp/` — progressive WebMCP registration and typed editor tools.
- `backend/` — independently deployable Cloudflare Worker that signs R2 PUT/GET URLs.
- `src/templates.ts` — original editable starter designs.
- `src/types.ts` — document schema and element types.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module boundaries and [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow.

The downloaded Polotno package is kept under ignored `.reference/` storage for feature-surface review only. It is not installed as a dependency, imported, copied into, or shipped with this application.

## Included now

- Responsive desktop sidebar and mobile off-canvas tools with bottom navigation
- Editable multi-page designs with 18 polished, searchable square/portrait/landscape templates across 15 categories
- Text, shapes, lines, and local image/SVG uploads
- Optional direct-to-R2 uploads with live progress, cancel, and retry
- Browser-side AI image generation with a user-owned session key
- Lazy browser-side video/audio conversion with ffmpeg.wasm
- Drag, resize, rotate, marquee/multi-select, object/page/guide snapping, rulers, alignment/distribution, layer ordering, visibility, locking, nested grouping, duplication, and deletion
- Orientation-aware portrait, landscape, square, panoramic, and oversized image fitting with intrinsic ratio locking
- Character-range rich text, curved arc text, custom fonts, and editable inline text
- Vector drawing/highlighter/eraser, mergeable tables with resizable tracks, image filters/crop/masks, guides, bleed, and safe areas
- Video/audio elements with trim, playback, decoded waveforms, timing, animation presets, keyframes, and a timeline
- Virtualized continuous multi-page editing, focused-page mode, and portrait/landscape canvas controls
- Lazy browser-only ML background removal with WebGPU/WASM fallback and no image upload
- Typed live extension points for panels, toolbar actions, Konva renderers, and animation presets
- Contextual toolbars and properties
- Undo/redo, clipboard shortcuts, selection shortcuts, nudge controls, zoom, fit-to-workspace
- Local autosave and versioned JSON import/export
- Client-only PNG, JPEG, WebP, SVG, PDF, printable HTML, PPTX, GIF, MP4, and WebM exports
- WebMCP agent access through 14 typed browser tools with guarded destructive actions and legacy API fallback

See [FEATURE_PARITY.md](./FEATURE_PARITY.md) for the precise implementation boundary and [CLIENT_SERVER_ARCHITECTURE.md](./CLIENT_SERVER_ARCHITECTURE.md) for the client/server and security decisions.

## Testing

```bash
npm test              # Vitest unit and component tests
npm run test:coverage # coverage report with enforced thresholds
npm run test:e2e      # Playwright desktop and mobile Chromium matrix
npm run test:backend  # Worker unit/integration tests with coverage
npm run test:all      # complete CI-style gate plus production build
npm run deploy:worker # build and deploy the SPA as Workers Static Assets
```

Workers deployment uses `wrangler.jsonc` and serves `dist/` with SPA fallback. Put the deployed presign endpoint in ignored `.env.production.local` before running `npm run deploy:worker`; `.env.example` contains the expected variable shape.

The current suite covers the Zustand state engine, history transactions, document templates, tool panels, properties, uploads, layers, pages, keyboard commands, JSON/PNG exports, and responsive mobile behavior. See [TESTING.md](./TESTING.md) for the test map.

## WebMCP

On supporting browsers, Visually registers its tool catalog through `document.modelContext`. Unsupported browsers continue normally and expose `data-webmcp="unsupported"` on the root element; supporting hosts progress through `registering` to `ready` (or `error`). The bridge includes read tools for state/templates/export and mutation tools for templates, elements, selection, pages, resize, and history. Element/page deletion and whole-project import require an explicit `confirm: true` argument.
