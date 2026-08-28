# WebMCP Challenge implementation notes

This document maps Visually's WebMCP submission claims to source and tests. It is evidence of the challenge-specific interaction layer, not a claim about the project's pre-challenge history.

## WebMCP architecture

- Registration lifecycle: `src/lib/webmcp/install.ts`
- Tool catalog assembly: `src/lib/webmcp/visually-tools.ts`
- JSON-schema helpers and result envelopes: `src/lib/webmcp/tools/shared.ts`
- Editor inspection, template discovery, and template application: `src/lib/webmcp/tools/query-tools.ts`
- Text, shape, selection, update, arrangement, and guarded deletion: `src/lib/webmcp/tools/element-tools.ts`
- Page management, resize, history, guarded import, and data export: `src/lib/webmcp/tools/document-tools.ts`
- Multi-format campaign creation, semantic brand propagation, and design auditing: `src/lib/webmcp/tools/campaign-tools.ts`
- Campaign document generation and metadata contract: `src/lib/campaign.ts`
- Production-readiness audit engine: `src/lib/design-audit.ts`
- Agent call receipts and judge workflow: `src/store/agent-activity-store.ts`, `src/components/agent-activity-panel.tsx`, and `src/features/judge-demo/`
- Browser API types: `src/lib/webmcp/types.ts`

## Registered tools

| Tool | Purpose | Safety posture |
| --- | --- | --- |
| `visually_get_editor_state` | Read pages, active canvas, elements, selection, zoom, history availability | Read-only annotation |
| `visually_list_templates` | Discover original templates and identifiers | Read-only annotation |
| `visually_apply_template` | Replace the active page with a selected template | Undoable mutation |
| `visually_add_text` | Add selected editable text | Bounded schema, undoable |
| `visually_add_shape` | Add a selected typed shape | Enum + bounds, undoable |
| `visually_select_elements` | Select by stable element IDs | Validates active-page IDs |
| `visually_update_element` | Update safe compatible visual properties | Type-aware allowlist, bounds |
| `visually_arrange_selection` | Align, distribute, group, duplicate, or change layer order | Enum-constrained, undoable |
| `visually_delete_selection` | Delete selected unlocked elements | Requires `confirm: true`, undoable |
| `visually_manage_page` | Add, duplicate, switch, or delete pages | Delete requires `confirm: true` |
| `visually_resize_page` | Resize/name/recolor the active page | Bounds 1–10,000 px, undoable |
| `visually_history` | Undo or redo | Refuses unavailable operations |
| `visually_export_design` | Return project JSON or active-page SVG | Read-only annotation |
| `visually_import_project` | Validate and load project JSON | 5 MB cap, requires `confirm: true` |
| `visually_create_campaign` | Create coordinated pages for up to five campaign formats from one brief | Requires `confirm: true`, one undo snapshot |
| `visually_apply_brand_update` | Propagate tagged copy, colors, and typography across campaign pages | Semantic allowlist, one undo snapshot |
| `visually_audit_design` | Report overflow, contrast, safe-area, alt-text, and brand consistency issues | Read-only annotation |

## Fast judge path

1. Select **Judge demo** in the top bar.
2. Watch the shared document become five editable campaign formats.
3. Open **Agent activity** to inspect the real tool names, sanitized inputs, structured receipts, and affected pages.
4. Continue editing any page directly to demonstrate human control, or select **Undo agent changes** before making a human edit to restore the prior project.

The undo control verifies both history depth and a document signature before acting. It disables itself after a later human edit so the demo cannot silently discard the person's work.

## Human-agent continuity

The WebMCP tools call the same Zustand actions as the visible editor. A successful agent mutation therefore:

1. updates the Konva canvas immediately;
2. updates selection and panels where relevant;
3. enters transaction-aware undo/redo history;
4. persists through the same local autosave path; and
5. remains directly editable by the person.

This is the core product thesis: WebMCP exposes semantic design operations without creating a parallel agent-only document.

## Verification

- Registration and progressive fallback: `src/lib/webmcp/install.test.ts`
- Core tool behavior, confirmation gates, import/export, and history: `src/lib/webmcp/canvasly-tools.test.ts`
- Campaign creation, semantic propagation, audit categories, receipts, and safe undo: `src/lib/webmcp/campaign-tools.test.ts`
- Real browser campaign, activity receipt, undo, and mobile-access workflow: `e2e/winning-workflow.spec.ts`
- Shared state engine: `src/store/editor-store.test.ts`
- Desktop and mobile browser flows: `e2e/`

Run the complete gate with:

```bash
npm run test:all
```

The live application is deployed at https://visually.deeeplearn.com.
