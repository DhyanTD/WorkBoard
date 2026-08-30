# ADR 0002: Store immutable design revisions as JSONB snapshots

- Status: Accepted
- Date: 2026-08-31
- Decision owner: Dhyan
- Related gate: D2 in the
  [implementation plan](../../documentation/MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md)

## Context

An accepted design must be reproducible for human review and agent operations.
Users need to inspect an exact historical state, calculate semantic diffs,
restore prior content, and verify which base revision a proposal targeted.

The main alternatives were:

1. Store a complete immutable document snapshot for every accepted revision.
2. Normalize every versioned element, relationship, boundary, view, and layout
   field into relational rows.
3. Store only change events and rebuild each revision by replaying history.

Normalized or event-only storage can reduce duplication and support granular
queries, but makes exact reconstruction, schema evolution, and atomic validation
more complex during the first releases.

## Decision

Store every accepted revision as a complete, immutable, schema-versioned
`DesignDocument` in a PostgreSQL JSONB value.

- A revision payload is never updated after insertion.
- The design record points to its accepted-head revision.
- Moving the accepted head must atomically insert the new revision, update the
  head pointer, and write the associated audit and idempotency records.
- Each revision carries enough metadata to identify its design, schema version,
  parent/base revision, authoring actor, creation time, and content integrity.
- Design/workspace metadata, proposal and review lifecycle, permissions, audit
  events, and idempotency records remain structured relational data.
- Semantic validation and diffing operate on typed `DesignDocument` values in
  the application layer rather than depending on database-specific JSON paths.
- Search-specific relational or indexed projections may be derived later; they
  are not the authoritative revision record.

Reconsider projections when measured requirements demand cross-design queries
inside document content, such as finding all uses of a technology or reporting
relationship statistics across a large workspace. Reconsider snapshot
compaction only after storage volume and retrieval measurements justify it.

## Consequences

### Positive

- Every revision can be fetched and validated without replaying earlier events.
- Rollback, reproducible agent reads, and semantic comparison have a simple
  authoritative input.
- Document schema evolution is explicit and can be handled by version-aware
  readers.
- The domain model stays independent of the physical relational schema.

### Negative

- Small edits duplicate the complete design document.
- Queries inside many designs may require JSONB indexes or derived projections.
- Large designs need payload-size monitoring and explicit request limits.
- Atomic head movement still requires a database transaction spanning the
  revision and structured workflow records.

### Follow-up constraints

- Milestone 1 must define the document schema version and deterministic
  validation behavior.
- Milestone 4 repository contracts must treat revision payloads as immutable.
- Milestone 5 must reject merges whose base revision no longer matches the
  accepted head unless an explicit rebase succeeds.
- Dhyan owns all migration generation and registration; this ADR does not
  authorize creating or editing migrations.
