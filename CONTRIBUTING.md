# Contributing to Visually

Thanks for helping improve Visually. The project favors small, testable domain modules and accessible user-facing workflows.

## Local setup

Requirements:

- Node.js 20.19 or newer
- npm
- A Chromium browser for the Playwright suite

```bash
npm install
npx playwright install chromium
npm run dev
```

Copy `.env.example` to `.env.local` only when testing optional external services. Never commit credentials or generated `.dev.vars` files.

## Before opening a pull request

Run the frontend gate:

```bash
npm run check
```

For changes that affect browser workflows, the Worker, exports, uploads, or deployment behavior, run the complete gate:

```bash
npm run test:all
```

## Code organization

- Put serialized contracts in `src/types.ts` and keep them UI-independent.
- Put reusable pure logic under `src/features` or `src/lib`.
- Route document mutations through `src/store/editor-store.ts`.
- Keep shadcn-generated primitives in `src/components/ui`; build product components outside that folder.
- Keep export formats isolated under `src/lib/export`.
- Group WebMCP tools by domain under `src/lib/webmcp/tools`.
- Add a focused test next to the module it covers and a Playwright test for critical user workflows.

See `ARCHITECTURE.md` for dependency rules and `TESTING.md` for the test map.

## Pull-request expectations

- Explain the user-visible outcome and any document-schema impact.
- Include screenshots or a short recording for meaningful UI changes.
- Preserve keyboard and mobile behavior.
- Keep destructive actions undoable where possible.
- Do not copy Polotno, Canva, or other proprietary implementation code or assets.
- Update documentation and the parity checklist when behavior changes.

## Licensing status

The repository is being prepared for open-source publication, but a license has not yet been selected. A `LICENSE` file must be added before public release. Contributors should wait for that decision before submitting third-party code or assets.
