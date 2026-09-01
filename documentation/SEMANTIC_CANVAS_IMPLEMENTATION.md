# Semantic canvas implementation

Last updated: 2026-08-31

## Purpose

Milestone 2 adds an operation-driven system-design editor at
`/designs/workbench`. It renders the shared `DesignDocument` rather than
editing legacy `Stroke[]` values. The original freeform Board remains at `/`
and links to the new workbench.

## Main modules

| Module | Responsibility |
| --- | --- |
| `frontend/semantic/designCanvasAdapter.ts` | Maps one semantic View to renderable elements, boundaries, connectors, and annotations |
| `frontend/semantic/designCanvasTheme.ts` | Maps semantic classifications to presentation tokens without changing domain meaning |
| `frontend/semantic/editOperations.ts` | Translates UI intents into explicit `DesignOperation` batches |
| `frontend/semantic/legacyBoardToDesign.ts` | Converts persisted version-1 Board strokes into lossless annotations |
| `frontend/store/useSemanticDesignStore.ts` | Owns the client session, calls the typed API client, and applies operation batches |
| `frontend/components/design/` | Renders the workbench, canvas, tools, view navigation, inspector, and developer document panel |

## Usage and behavior

Open `/designs/workbench`. The initial in-memory API contains the Commerce
Platform fixture. Use the header tabs to switch between its system-context and
container views.

Semantic elements are selected by stable ID. Create, update, move, resize,
copy, paste, and delete actions become domain operations. Element rectangles
are stored only in the active View layout. Relationship endpoints are derived
from the current rectangles, so connectors remain attached after an endpoint
moves. Missing rectangles receive deterministic presentation-only placement.

The inspector edits element name, description, responsibilities, relationship
description, and relationship technology. Connect mode selects a source and
destination by ID. Pencil strokes and pinned review text are annotations and
do not add Elements or Relationships.

Camera scale/offset, selection, connection source, pointer gestures,
clipboard, undo/redo stacks, loading state, and messages are UI state. They are
not serialized into `DesignDocument`.

## Legacy conversion

The import action reads the existing `open-workboard-board` IndexedDB record,
converts every stroke to a `legacy-stroke` annotation, and submits the new
Design through the API client. It deliberately does not delete or rewrite the
legacy record. A successful server-backed persistence handoff and retry policy
must exist in Milestone 4 before deletion can be considered.

## Verification

From `frontend/`, run:

```bash
pnpm test:components
pnpm test:e2e
```

The component command covers adapters, operation translation, UI-only state,
legacy conversion, semantic store behavior, React integration, and the legacy
Board regression. Playwright exercises the production build in Chromium,
Firefox, and WebKit, including real-browser IndexedDB retention after import.

## Operational caveats

- The workbench uses the Milestone 3 in-memory API. A server restart resets
  drafts and imported Designs.
- Draft save is a transitional whole-document save with optimistic revision
  protection. It is not an accepted Revision or Change proposal.
- Freehand annotations currently use the lossless `legacy-stroke` annotation
  payload. Erasing and selecting individual semantic annotations are deferred.
- The three-panel desktop layout is a developer workbench; broader responsive
  and accessibility hardening remains in later milestones.
- No database entity or migration is introduced. Dhyan owns all future
  migrations.
