# Architecture

Visually is a browser-first editor. The frontend owns document state, rendering, history, import/export, media conversion, and optional AI calls. The only server component is a narrowly scoped Cloudflare Worker that can issue direct-to-R2 upload and download URLs.

## Module map

```text
src/
├── components/          React editor shell, panels, rulers, toolbars, and shadcn UI
├── extensions/          Typed third-party contribution registry and hooks
├── features/advanced/   Pure helpers for drawing, text, snapping, rulers, tables, media, and animation
├── lib/
│   ├── ai/              Browser-safe AI provider adapter
│   ├── export/          Format-specific client export modules
│   ├── images/          Intrinsic-size and orientation-aware placement
│   ├── media/           Lazy ffmpeg.wasm loading and conversion
│   ├── ml/              Lazy browser-only background removal adapter
│   ├── uploads/         Presign client, progress transport, and upload orchestration
│   └── webmcp/          Browser agent bridge and domain-grouped tools
├── store/               Zustand editor, tool, and upload stores
├── EditorCanvas.tsx     Konva scene orchestration and interaction boundary
├── templates.ts         Original editable design templates
└── types.ts             Versioned document and element contracts

backend/
├── src/index.ts         Worker routes and R2 request signing
├── src/policy.ts        Upload key, size, type, and origin policy
└── test/                Worker policy and request tests
```

## Dependency direction

Keep dependencies flowing in one direction:

```text
types/templates → stores and pure feature modules → UI/canvas/WebMCP → App
```

- `types.ts` must not import UI or stores.
- Pure helpers should live under `features/` or `lib/` and remain usable without React.
- React panels call store actions; they do not mutate documents directly.
- WebMCP handlers reuse the same store actions as the UI so history and invariants remain consistent.
- Format-specific exports do not depend on mounted components.
- Network credentials never enter persisted Zustand state.

## State and history

`editor-store.ts` is the authoritative document model. Mutating actions record a document snapshot before applying changes. High-frequency gestures use a transaction-style start snapshot and commit once, avoiding one undo entry per pointer event.

The separate tool and upload stores hold transient UI/tool state and background transfer progress. Persisted editor state is versioned and migrated when loaded.

## Canvas boundary

`EditorCanvas.tsx` translates typed document elements into Konva nodes. It owns pointer gestures, transforms, selection geometry, inline/curved text rendering, object and guide snapping, and animation-time rendering. Business operations such as duplication, nested grouping, layer order, and deletion stay in the store. The workspace mounts pages through a viewport-aware virtual wrapper so continuous documents do not require every Konva stage to remain active.

The extension registry is the public customization boundary. Extensions contribute panels, toolbar actions, renderer overrides, and animation definitions without importing store internals. Registration is atomic and disposable, and React consumers subscribe to immutable snapshots.

Background removal dynamically imports Transformers.js and downloads the model only on first use. The model and ONNX runtime are cached by the browser. Cancellation prevents stale results from being applied; the underlying ONNX inference may still finish because the runtime does not expose hard mid-inference interruption.

## WebMCP boundary

`src/lib/webmcp/install.ts` handles progressive browser registration and lifecycle cleanup. The public catalog is composed from:

- `tools/query-tools.ts` — state inspection and templates
- `tools/element-tools.ts` — element creation, selection, editing, and layout
- `tools/document-tools.ts` — pages, history, resize, import, and export
- `tools/shared.ts` — JSON schemas, bounded input readers, and response helpers

Destructive handlers require explicit confirmation and all imported data passes through the normal project validator.

PPTX export is generated directly as a small Open XML package with lazily loaded JSZip. This avoids a server renderer and keeps image parsing out of the dependency graph.

## Server boundary

The Worker does not receive file bodies. It validates metadata and returns a short-lived signed R2 URL. The browser uploads directly to R2 and reports progress from `XMLHttpRequest.upload`. See `CLIENT_SERVER_ARCHITECTURE.md` for the deployment and trust model.

## Adding a feature

1. Extend the document types if the serialized model changes.
2. Add migration/validation support for imported older projects.
3. Implement state changes as tested store actions or pure feature helpers.
4. Add UI without bypassing the store boundary.
5. Extend export/render adapters where the new element or property is relevant.
6. Add unit tests and at least one browser test for a user-visible workflow.
7. Update `FEATURE_PARITY.md` without claiming behavior that is not tested.
