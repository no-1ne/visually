# Independent editor feature checklist

This checklist tracks high-level capabilities exposed by the public Polotno 4.10 package. It is a requirements list only; no Polotno implementation code, assets, styles, hosted APIs, license checks, or branding are used.

## Implemented

- [x] React + TypeScript + Konva editor with a Zustand document store
- [x] Current shadcn `sidebar-03` foundation using Base UI primitives
- [x] Desktop collapsible sidebar and mobile off-canvas sidebar with bottom tool dock
- [x] Typed, version-ready document structure with stable element IDs
- [x] Multi-page add, clone, select, delete, per-page background, and page strip
- [x] Text, image/SVG upload, rectangle, circle, star, and line elements
- [x] Single and modifier multi-selection
- [x] Shared Konva transformer for move, resize, and rotate with normalized dimensions
- [x] Page-edge and page-center snapping
- [x] Layer select, visibility, lock, reorder, bring forward/back, and delete
- [x] Logical group/ungroup, duplicate, select all, and in-editor copy/cut/paste
- [x] Selection-aware page and element toolbar modes
- [x] Text content, family, size, fill, alignment, line height, spacing, and opacity model
- [x] Shape fill, corners, opacity, and line weight/color controls
- [x] Keyboard-safe undo/redo, duplicate, delete, grouping, nudge, select-all, and zoom shortcuts
- [x] Transaction-aware drag history and 50-step undo/redo
- [x] Zoom, fit-to-workspace, fixed-size high-resolution PNG export, and hidden export transformer
- [x] Local JSON project import/export and persisted browser autosave
- [x] Optional direct-to-R2 background upload with presigning, progress, cancel, and retry
- [x] Browser-direct AI image generation adapter with a memory-only user key
- [x] Lazy ffmpeg.wasm video/audio conversion and download utility
- [x] Mobile safe-area layout, independent panel/canvas scrolling, and 44px primary touch controls
- [x] Original editable templates and layer/property panels

## Advanced client features implemented in this delivery

- [x] Double-click inline text editing with a DOM overlay and run-based mixed-format rendering
- [x] Modifier multi-selection, marquee selection, and logical group-aware selection
- [x] Page-edge/center snap guides, custom guides, alignment, and distribution
- [x] Image crop, fit, masks, flip, Konva filters, shadows, and blend modes
- [x] Freehand brush, highlighter, vector eraser, point smoothing, and editable paths
- [x] Tables with editable cells, add-row/add-column controls, span-ready data, TSV grid utilities, and per-cell styling
- [x] Video decoding, playback, trimming, rate/loop/volume controls, and animation timeline
- [x] Audio tracks, waveforms, trim, volume, mute/loop, and timing controls
- [x] Versioned animation tracks, easing, keyframes, presets, playback, and page duration
- [x] PDF, SVG, printable HTML, PPTX, JPEG, WebP, animated GIF, MP4, and WebM client exports
- [x] Browser font upload/registration, px/in/mm units, DPI-aware raster ratios, bleed, safe area, and guides
- [x] Progressive WebMCP integration with 17 typed tools for state, templates, elements, layout, pages, history, campaign-wide brand workflows, design auditing, and client-side import/export
- [x] Character-range rich-text formatting with lossless run splitting and edit-aware style preservation
- [x] Curved arc text with bend/reverse controls, Konva rendering, and SVG path export
- [x] Object-to-object edge/center snapping with nearest-target selection and zoom-aware thresholds
- [x] Accessible draggable rulers and guides with keyboard movement, locking, cancellation, and drag-out removal
- [x] Virtualized continuous multi-page canvas plus focused single-page view and portrait/landscape orientation controls
- [x] Nested logical groups with shared visual transforms, independent cloning, and stepwise ungrouping
- [x] Cell merge/split UI, lossless covered-cell data, draggable row/column tracks, and merged-cell SVG export
- [x] Decoded multichannel audio waveforms with peak/RMS bucketing and codec-safe fallback
- [x] Browser-only ML background removal with lazy WebGPU/WASM runtime and model loading
- [x] Public live extension registry for panels, toolbar actions, canvas renderers, and animation presets

## Remaining client-side differences

- [ ] Advanced typography engines such as widow/orphan control, multi-column flow, and font-feature authoring
- [ ] Sandboxed arbitrary HTML elements inside the Konva document (typed custom Konva renderers are supported)

## Requires application-owned backend/services

- [ ] Durable accounts, cloud project metadata, sharing, and access control
- [ ] Stock media/template/font catalogues and provider attribution
- [ ] App-paid AI proxy, quota enforcement, and AI writing
- [ ] Background removal service
- [ ] Optional server MP4 rendering and render-job polling for large/complex projects
- [ ] CORS-safe third-party media proxy, rate limits, abuse controls, and production session verification

Polotno is proprietary and subject to its own license. This project does not attempt to reproduce or bypass its licensing, hosted endpoints, or protected implementation.
