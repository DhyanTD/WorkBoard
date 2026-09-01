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
successful transitional in-memory API save. This makes conversion retry-safe
while the API is not durable. Milestone 4 must establish a verified
server-backed save and recovery policy before code may delete that record.

Semantic camera position, zoom, selected IDs, clipboard, connection source,
pointer gestures, and undo/redo stacks are also local UI state and are not part
of the accepted Design document. Element and boundary rectangles are different:
they are persisted presentation data inside the active View layout.

## Operational caveats

Persistence is local to the current browser profile and origin; it does not sync
between browsers, devices, or users. If IndexedDB is disabled, unavailable, or
full, the in-memory board continues to work but recent changes may not be
available after a reload. The Dexie database schema and persisted Zustand state
schema are both version `1`; future breaking changes require coordinated schema
handling before either version is increased. Keep `pnpm test:storage` passing
while adding conversion or shared-persistence behavior. The semantic converter
and real-browser retention journey are covered by `pnpm test:components` and
`pnpm test:e2e`, respectively.
