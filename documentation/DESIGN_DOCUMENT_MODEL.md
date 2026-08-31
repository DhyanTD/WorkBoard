# Design document model

Last updated: 2026-08-31

## Purpose

Milestone 1 introduces the framework-independent semantic core of Open
WorkBoard. A `DesignDocument` describes an architecture model, its diagram
views, and non-semantic annotations. It is safe to import from browser code,
server code, tests, and future MCP adapters.

The public entry point is `frontend/domain/design/index.ts`. The implementation
is intentionally separate from React, Next.js, Dexie, TypeORM, OAuth, and MCP.

## Schema version and document shape

The current and only supported schema is version `1`:

```text
DesignDocument
├── id, schemaVersion, metadata
├── elements[]        semantic people, software systems, and containers
├── relationships[]   directed semantic interactions
├── boundaries[]      semantic container groupings
├── views[]           context/container diagrams and their layouts
└── annotations[]     non-semantic text or preserved legacy strokes
```

`metadata` carries a name, optional description, assumptions, and identified
decision statements. All document records—elements, relationships, boundaries,
views, and annotations—use globally unique, non-empty IDs.

The document has no database fields such as workspace IDs, revision IDs,
timestamps, author identities, permissions, or persistence metadata. Those
belong to the application and persistence layers introduced in later
milestones. A future accepted Revision persists this full value as the JSONB
snapshot defined in ADR 0002.

## Initial vocabulary

| Record | Supported values and rules |
| --- | --- |
| Element | `person`, `software-system`, or `container` |
| Software system | Has `external: boolean`; an external system is not a separate kind |
| Container | Has an owned software-system `parentId` and `containerType` of `application`, `datastore`, or `queue` |
| Boundary | Belongs to one owned software system and contains only that system's direct containers |
| Relationship | Directed; both endpoint IDs must exist and be different; description is required and technology is optional |
| System-context view | Includes its target software system, people, and external software systems; it cannot expose containers or boundaries |
| Container view | Is centered on an owned software system and includes its containers plus people or external software systems for context |
| Annotation | `text` or `legacy-stroke`; annotations attach to a view but do not change semantic architecture |

`component` is reserved as an element kind. `component`, `deployment`,
`dynamic`, `data-flow`, and `custom` are reserved view kinds. They are not
valid in schema version 1.

Layouts live exclusively in a view. Each layout is a finite `x`, `y`, `width`,
and `height` rectangle keyed by included element or boundary ID. Relationship
routing remains presentation work for a later milestone.

## Legacy annotations

`legacy-stroke` stores the current Board stroke shape losslessly: tool, color,
line width, points, bounds, optional text/font size, and optional connector
bindings. This lets Milestone 2 convert legacy browser-local `Stroke[]` data
into a semantic Design annotation layer without treating freehand marks as
architecture records.

## Operations

Use `applyDesignOperations(document, operations)` for every domain change.
Supported operations add, update, or remove elements, relationships, and
boundaries; add/update/remove views; set a view layout; add/remove annotations;
and replace document metadata.

The function first validates the input document, applies operations to a deep
clone, validates the final candidate, and returns one of these results:

```text
Success: document, changedIds, warnings, diff
Failure: stable errors, warnings
```

Expected validation failures never throw and never return a partially changed
document. Successful results do not mutate the source document or operation
payloads.

### Guarded removals

Every remove operation includes `expectedDependentIds`. The list must match the
complete current direct dependency set exactly, including child containers,
relationships, boundary membership, view references, or annotations attached
to a view where applicable. A mismatch produces `dependency-mismatch`.

Acknowledging a dependency does not delete it. The caller must also add
explicit remove or update operations that eliminate those references. Because
the final document is validated only after the batch, a caller can declare the
dependencies, remove a record, then explicitly remove or update each dependent
record in the same atomic batch. This is deliberate: no relationship, view
reference, boundary membership, or future review anchor is silently cascaded.

## Validation and error contract

`validateDesignDocument` returns either `{ ok: true, warnings }` or
`{ ok: false, errors, warnings }`. Each issue has a stable code, a path, a
message, a recovery hint, and an optional target ID.

Current error codes cover unsupported schema versions, invalid documents,
duplicate IDs, missing references, invalid containment, invalid views, invalid
layout, invalid annotations, missing operation targets, and dependency
mismatches. Consumers should branch on the code and show the recovery hint;
they should not parse the message text.

## Diffs and ID creation

`diffDesignDocuments(before, after)` compares record IDs rather than array
positions. Its `semantic` section reports added, updated, and removed
elements/relationships/boundaries plus metadata changes. Its `presentation`
section reports view and annotation changes, along with element and boundary
IDs whose view-layout rectangle moved.

`createTestId` creates readable deterministic IDs for fixtures and evals.
`createProductionId` uses `crypto.randomUUID()` when available, with a
timestamp, process-local sequence, and random fallback for constrained
environments. Production callers must still rely on storage-level uniqueness
constraints when persistence is introduced.

## Fixture and verification

`commerce-platform-review-v1` is encoded as fresh operation objects in
`frontend/domain/design/fixtures.ts`. It recreates the documented customer,
Commerce Platform, Payment Provider, four container, boundary, relationship,
two-view, and annotation fixture without any fixture-specific bypass.

Run the domain suite from `frontend/`:

```bash
pnpm test:domain
```

The suite covers creation, validation, JSON round-trip preservation, all
operation categories, guarded deletion, atomic failure, layout/abstraction
validation, order-independent diffs, and ID helpers.

## Compatibility and operational caveats

- Version 1 readers reject any other schema version. Add an explicit migration
  reader before accepting a newer schema version.
- The model does not yet parse arbitrary untrusted JSON; HTTP and MCP adapters
  must validate request schema before constructing a typed `DesignDocument`.
- The document model is pure and mutable at the TypeScript object level. Treat
  an accepted revision payload as immutable in the application/persistence
  layer; do not mutate an object after it is submitted for persistence.
- No database migration is created in Milestone 1. Dhyan remains responsible
  for migrations when server persistence begins.
