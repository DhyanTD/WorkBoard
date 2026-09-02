# Persistent board storage

## Purpose

Open WorkBoard saves the current board in the browser so drawings and drawing
preferences return after a page reload or browser restart.

## Storage and usage

The Zustand board store uses a custom asynchronous adapter backed by Dexie and
IndexedDB. The `open-workboard` database contains a `boards` object store. Its
singleton `open-workboard-board` record contains the persisted Zustand state,
the state schema version, and an update timestamp. Persistence is automatic; no
user action is required.

The saved state contains:

- committed strokes and shapes;
- the active drawing tool;
- the selected drawing color; and
- the selected line width.

The Clear action also saves the empty board, so cleared content does not return
on the next reload.

## Regression baseline

Run the executable characterization suite from `frontend/`:

```bash
pnpm test:storage
```

The version-1 fixture is defined in
`storage/board/fixtures/boardStorageV1.fixture.ts`. It includes a shape, text,
and a bound connector. The suite exercises:

- the `open-workboard` version-1 database and singleton record;
- valid legacy import, IndexedDB precedence, malformed legacy rejection, and
  retention of legacy data when an import fails;
- serialized writes, identical-value write suppression, and record deletion;
- hydration of durable fields while transient controls keep defaults; and
- persistence of only the durable state, including an explicitly cleared
  board.

Vitest runs the Dexie adapter against `fake-indexeddb`. This provides a
deterministic adapter baseline; later browser end-to-end coverage must retain a
journey against a real browser IndexedDB implementation.

## Important behavior

Storage hydration runs after the application mounts. The board UI remains behind
a short restoration state until IndexedDB has been read, which keeps the initial
client render aligned with Next.js prerendered HTML and prevents an early action
from overwriting saved data.

Existing version-`1` data under the old `localStorage` key is validated and
imported automatically when IndexedDB does not yet contain a board. The legacy
record is removed only after the IndexedDB write succeeds.

IndexedDB writes are serialized so a slower earlier write cannot replace a newer
board. Updates that only change transient Zustand state are skipped when the
persisted state references and preferences have not changed.

Undo and redo history, selections, clipboard contents, paste count, and camera
position/zoom are session-only. Reloading starts those controls in their default
state while retaining the committed board content.

## Semantic Design conversion

Milestone 2 adds an explicit import action in `/designs/workbench`. It reads the
same version-1 `open-workboard-board` record and converts every committed
Stroke into a lossless `legacy-stroke` annotation attached to a new semantic
Design. The converter does not infer people, systems, containers,
relationships, or responsibilities from drawing geometry.

The original IndexedDB record is retained after conversion, including after a
successful server save. Import derives a deterministic Design ID and
`Idempotency-Key` from a SHA-256 fingerprint of the version-1 Board. A separate
receipt is stored only after the server confirms the resulting revision. The
source Board is never deleted by Milestone 4, so a failed request cannot remove
the only surviving copy.

## Semantic Design cache and offline drafts

PostgreSQL is the canonical Design store. The separate
`open-workboard-design-cache` IndexedDB database holds Workspace-scoped cached
Designs and confirmed legacy-import receipts. It never changes authorization
and is never treated as proof that the current user can access a Design.

After a successful fetch/save, the cache records the confirmed document and
revision. Semantic operations mark that cached copy as an offline draft. When
the API is unavailable, the workbench may load a cache only when both the
stored Workspace ID and Design ID match. When IndexedDB is disabled or full,
the server-backed UI continues without cache recovery.

Semantic camera position, zoom, selected IDs, clipboard, connection source,
pointer gestures, and undo/redo stacks are also local UI state and are not part
of the accepted Design document. Element and boundary rectangles are different:
they are persisted presentation data inside the active View layout.

## Operational caveats

Browser persistence is local to the current profile and origin; only the
PostgreSQL-backed Design syncs across sessions/users. If IndexedDB is disabled,
unavailable, or full, recent offline changes may not survive reload. Both
Dexie databases currently use schema version `1`; future breaking changes need
coordinated schema handling. Keep `pnpm test:storage` passing. The semantic
converter and real-browser retention journey are covered by
`pnpm test:components` and `pnpm test:e2e`, respectively.
