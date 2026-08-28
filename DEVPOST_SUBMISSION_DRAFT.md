# Visually — WebMCP Challenge submission draft

## Elevator pitch

The browser-first design studio where people and agents create on the same editable canvas.

## About the project

### Inspiration

Most creative web apps still treat an AI agent like an outside observer: it can describe what to click, but it cannot participate in the document with the same precision as the person editing it. We built Visually to explore a more useful model—a professional visual editor whose real product actions are available to both humans and agents.

### What it does

Visually is a responsive, local-first image and media editor built around an editable Konva canvas. A person can start from 18 polished templates, work across square, portrait, landscape, print, and custom formats, and directly edit text, shapes, images, drawing, tables, layers, media, effects, animation, and page timing.

The WebMCP layer registers 17 typed tools inside the page. An agent can inspect the open document, turn one brand brief into five coordinated formats, propagate semantic copy and visual-token updates across every page, run a read-only production audit, and continue with precise element, page, history, and export operations. Every tool returns a structured receipt. Destructive operations—deleting elements or pages and replacing the project—require an explicit `confirm: true` input and remain undoable.

The result is not “AI beside a design app.” It is one shared creative surface: the agent accelerates setup and repetitive changes; the human retains judgment, direct manipulation, and final control.

### How we used WebMCP

Visually feature-detects `document.modelContext` and progressively registers a catalog of JSON-schema tools with `document.modelContext.registerTool`. Registration is abortable and exposes a visible document status (`unsupported`, `registering`, `ready`, or `error`) for debugging and host integration. A legacy `navigator.modelContext` fallback keeps the prototype compatible with earlier browser builds without affecting the draft API path.

The tools are intentionally product-native rather than remote wrappers. They call the same Zustand document actions used by the visible React UI, so a WebMCP mutation immediately appears on the Konva canvas, enters the same transaction-aware history, persists locally, and can be refined by the person. Read tools are annotated as read-only; mutation schemas bound sizes, types, and input lengths; destructive tools require confirmation.

This creates a better UX than screen-coordinate automation:

- The agent can query semantic editor state instead of guessing from pixels.
- Actions use stable element IDs and constrained schemas.
- Mutations are visible, undoable, and saved in the same document model.
- The human can continue editing immediately after an agent action.
- The activity panel makes sanitized calls, receipts, and affected pages inspectable, with safe undo that refuses to overwrite a later human edit.
- The app still works normally when WebMCP is unavailable.

### How we built it

The application uses React 19, Vite, TypeScript, Konva, Zustand, Tailwind CSS, and shadcn/Base UI. The canvas and document engine are client-side. Project persistence uses browser storage; PNG, JPEG, WebP, SVG, PDF, printable HTML, PPTX, GIF, MP4, and WebM export paths run in the browser. Media conversion is loaded on demand through ffmpeg.wasm, and background removal uses a lazy browser ML pipeline with WebGPU/WASM fallback.

An optional Cloudflare Worker signs R2 uploads; files transfer directly from the browser with progress, cancellation, and retry. The editor itself is deployed as Cloudflare Workers Static Assets at the live URL.

### Challenges we ran into

The hardest part was making agent actions feel native rather than bolted on. WebMCP tools had to share the exact same mutation semantics as pointer, keyboard, and panel interactions—especially selection, grouping, page operations, undo/redo, and destructive confirmations. We also had to keep large media workflows browser-safe, responsive on mobile, and compatible with many canvas aspect ratios.

Another challenge was proving safety without making the interaction tedious. We separated read-only tools from mutations, bounded every schema, rejected incompatible element updates, and required confirmation only where the operation could replace or delete user work.

### Accomplishments that we're proud of

- 17 typed, product-native WebMCP tools with structured results.
- One brief becomes a coordinated Instagram post, story, YouTube thumbnail, poster, and landscape banner.
- Semantic brand updates change tagged copy, color tokens, and typography across every format in one operation.
- A read-only audit reports overflow, contrast, safe-area, missing-alt-text, and brand-consistency issues.
- A judge-ready activity panel exposes real tool receipts and offers conflict-aware one-click undo.
- Human and agent actions share one undoable Zustand document model.
- A serious browser editor with 18 original templates and responsive desktop/mobile UI.
- Client-side project, image, document, animation, and video export paths.
- Guarded destructive actions, progressive registration, and an unsupported-browser fallback.
- Extensive unit, component, integration, backend, and desktop/mobile end-to-end tests.

The complete release gate passes 260 frontend tests with 93.44% statement and 96.81% line coverage, 15 Worker tests with 95.34% statement and 97.14% line coverage, 26 applicable desktop/mobile Chromium tests, backend type-checking, lint, TypeScript, and the production build.

### What we learned

WebMCP is most powerful when it exposes domain intent, not a second DOM. “Apply this template,” “arrange this selection,” and “resize this design” are safer and more useful than asking an agent to discover coordinates. The shared document model also matters: if agent output is not immediately editable and undoable by the person, the experience still feels like a handoff instead of collaboration.

### What's next

Next we want to add opt-in multi-user collaboration, richer typography flow, a discoverable third-party asset catalog with attribution, and reusable agent recipes for more campaign structures and brand-governance policies. We also want to publish the WebMCP tool contract as a small reference implementation for other canvas-based apps.

## Built with

`react` · `typescript` · `vite` · `konva` · `zustand` · `webmcp` · `shadcn-ui` · `base-ui` · `tailwind-css` · `cloudflare-workers` · `r2` · `ffmpeg-wasm` · `transformers-js` · `vitest` · `playwright`

## Try it out

https://visually.deeeplearn.com

## Testing instructions

1. Open the live URL in a WebMCP-capable browser or agent client.
2. Wait for the editor to load; the initial project is stored locally and no account is required.
3. Ask the client to call `visually_get_editor_state` and `visually_list_templates`.
4. For the fastest complete story, use **Judge demo** in the top bar. It executes `visually_create_campaign`, `visually_apply_brand_update`, and `visually_audit_design`, then opens **Agent activity** with the structured receipts.
5. For direct host testing, call `visually_create_campaign` with a brand name, headline, and `confirm: true` after approving project replacement.
6. Call `visually_apply_brand_update` with a new headline, accent color, or font and verify every tagged format updates while remaining directly editable.
7. Call `visually_audit_design` with `scope: "all_pages"`; it is read-only and returns categorized issues.
8. Use `visually_history` to undo and redo agent mutations, or use the activity panel's conflict-aware **Undo agent changes** before making another edit.
9. Call `visually_export_design` with `svg` or `json` to receive portable design data without forcing a download.
10. To test another destructive flow, select an unlocked element and call `visually_delete_selection` first without confirmation; it should refuse. Only pass `confirm: true` after explicit approval, then undo the deletion.

The visible UI remains fully operable throughout the tool sequence. On a browser without WebMCP, the editor continues normally and sets `data-webmcp="unsupported"` on the document root.

## Public repository

Public MIT-licensed repository: https://github.com/no-1ne/visually

## Video

An 84-second, seven-scene narrated HyperFrames composition was validated, rendered at 1920×1080, and published at https://youtu.be/YSbrnkRDycM. The YouTube upload is **Unlisted and viewable by anyone with the link**. It uses original product capture, local voice synthesis, locally bundled sound effects, and no music.

## Gallery media

Five original 1920×1080 submission stills are ready in `submission-media/`, ordered to tell the judging story: WebMCP actions, human direct manipulation, browser-local production, feature range, and the Visually lockup.

## Submitter fields

- Submitter type: Individual
- Country of residence: India
- App status: New
- Agents/clients tested: ChatGPT in-app Browser for live product UI, Google Chrome with WebMCP enabled, and the Chromium host E2E harness for registered-tool invocation, mutation receipts, safety gates, undo/redo, and responsive desktop/mobile flows.

## AI tools used during development

Codex was used for implementation, testing, deployment support, code review, and submission media authoring. HyperFrames was used to create the demonstration video. The application also includes an optional browser-direct image-generation adapter and a browser-only background-removal pipeline; these are product capabilities, not evidence that generated output was used in the submission.
