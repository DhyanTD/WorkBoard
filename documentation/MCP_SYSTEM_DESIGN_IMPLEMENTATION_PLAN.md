# MCP System Design Workbench — Implementation Plan

Status: Active
Last updated: 2026-08-31
Audience: Dhyan and implementation agents
Scope: Evolve Open WorkBoard from a browser-local drawing board into a
semantic, reviewable system-design workbench that people and AI agents can use
through MCP.

## How to use this plan

- Implement milestones in order unless a milestone explicitly says it can run
  in parallel.
- Treat every milestone's exit criteria as a release gate. Do not begin the
  dependent milestone until the gate passes.
- Keep each milestone small enough to review and merge independently.
- Update the named files under `documentation/` as behavior is implemented.
- Read `documentation/MCP_SYSTEM_DESIGN_PROGRESS.md` before starting work to
  identify the current milestone, active task, blockers, and next gate.
- Do not create or modify database migrations. Dhyan generates and manages all
  migrations. The relevant milestones contain explicit migration handoff gates.
- All TypeScript must use concrete types, generics, library-provided types, and
  type guards. Do not introduce `any` or `unknown`.

## Progress tracking

Maintain a separate `documentation/MCP_SYSTEM_DESIGN_PROGRESS.md` file as the
operational status record for this program. This implementation plan is the
stable roadmap; the progress file is the frequently updated execution view.

The progress file must contain:

- overall program status;
- exactly one current milestone;
- milestone status;
- current task and owner;
- completed tasks and exit criteria;
- active blockers and unresolved decision gates;
- Dhyan-owned migration handoffs and their status;
- verification evidence, including commands and results;
- related commit or pull-request references when available;
- the next action and next milestone gate;
- a link back to this implementation plan.

Use these milestone statuses consistently:

- `not-started`: no implementation work has begun;
- `ready`: dependencies are complete and the milestone may start;
- `in-progress`: implementation or verification is active;
- `blocked`: progress cannot continue until the recorded blocker is resolved;
- `completed`: every exit criterion has passed and evidence is recorded.

Only one milestone may be `in-progress`. Update the progress file when a
milestone starts, a material task completes, a blocker or decision changes, a
migration handoff occurs, or an exit gate passes or fails. Do not use roadmap
checkboxes as the only status record because they do not capture ownership,
evidence, blockers, or chronological history.

Milestone 0 starting-status snapshot (the progress tracker is authoritative for
current execution status):

```text
Program status: Active
Current milestone: Milestone 0 — Guardrails and architectural decisions
Milestone status: In progress
Current task: Confirm decision gate D1, followed by D2–D5
Completed milestones: None
Next action: Resolve D1 and record the accepted decision
```

## Target outcome

At the end of this plan:

1. A design is a semantic model of elements, relationships, boundaries, and
   views rather than only a list of canvas strokes.
2. The web application and MCP server call the same application-service
   operations and enforce the same permissions and validation.
3. Every accepted design change creates an immutable revision.
4. Agents create reviewable change proposals instead of directly overwriting
   the accepted design.
5. Reviewers can attach change notes to design elements or relationships,
   request revisions, approve a proposal, and merge it.
6. Agents can read feedback, revise proposals, and explain how each note was
   addressed.
7. Codex and other MCP clients can use the application through a remote
   Streamable HTTP MCP endpoint.
8. The open web page can optionally expose WebMCP site tools for collaboration
   in the same signed-in canvas.

## Deliberate non-goals for the first production release

- Real-time multi-user cursors or CRDT-based concurrent canvas editing.
- Allowing an agent to write directly to the accepted design head.
- Supporting every diagram notation in the initial model.
- Replacing the current freehand drawing and annotation capabilities.
- Generating a complete architecture automatically from source repositories.
- Making MCP Apps UI or WebMCP a prerequisite for core MCP workflows.
- Long-running MCP Tasks until ordinary request/response tools are proven
  insufficient.

## Current repository baseline

The plan preserves the useful parts of the current implementation:

- `frontend/lib/board.ts` defines canvas tools, `Stroke`, geometry, hit testing,
  arrow bindings, and rendering helpers.
- `frontend/store/useBoardStore.ts` owns client editing state, history,
  selection, clipboard operations, and camera controls.
- `frontend/components/board/BoardCanvas.tsx` is the imperative canvas renderer
  and pointer interaction engine.
- `frontend/storage/board/` persists one browser-local board using Dexie and
  IndexedDB.
- `documentation/PERSISTENT_BOARD_STORAGE.md` documents the local persistence
  behavior and its limitations.

The main gaps are:

- `Stroke` combines meaning, appearance, and geometry.
- Some editing operations address items by array index rather than required,
  stable domain IDs.
- There is only one browser-local board and no shared server persistence.
- There are no workspaces, users, permissions, revisions, proposals, review
  notes, API contracts, or audit events.
- There is no headless service that an MCP server can safely expose.

## Canonical terminology

Use these terms consistently in code, tool schemas, UI copy, and documentation.

| Term | Meaning |
| --- | --- |
| Board | The current legacy drawing surface and its browser-local stroke data. |
| Design | The product-level record users open and collaborate on. |
| Design document | The versioned semantic content of a design: model, views, and metadata. |
| Element | A stable semantic node in the accepted initial vocabulary: person, software system, or container. |
| Relationship | A stable directed connection between two elements, with purpose and optional technology/protocol. |
| Boundary | A semantic grouping or ownership/scope boundary containing elements. |
| View | A diagram over part of the model, including view-specific layout and presentation. |
| Annotation | Freehand, text, or visual markup that is not part of the architecture model. |
| Revision | An immutable accepted snapshot of a design document. |
| Change proposal | A reviewable set of operations based on a specific revision. It does not change the accepted head. |
| Proposal version | An immutable iteration of a change proposal. |
| Review thread | A discussion anchored to a proposal, element, relationship, view, or the whole design. |
| Change note | A reviewer request inside a review thread. |
| Addressed | The proposal author or agent claims a note has been handled. |
| Resolved | A reviewer confirms that a note has been handled. |
| Accepted head | The latest merged revision of a design. |

Do not use `board`, `design`, `revision`, and `proposal` interchangeably.

## Target architecture

```text
Codex / ChatGPT / other MCP clients
                |
       Streamable HTTP + OAuth
                v
          MCP adapter (/mcp)
                |
Web UI ---------+--------- WebMCP site tools
                v
      Design application service
                |
      Repository interfaces + audit
                |
       Shared persistent database
```

Architecture rules:

1. Domain rules and operation application must remain pure and independent of
   React, Next.js, MCP, OAuth, and the database.
2. The application service is the only entry point for use cases that read or
   change designs.
3. HTTP routes, MCP tools, WebMCP handlers, and UI actions are adapters around
   the same application service.
4. The accepted design head is never mutated in place. A merge creates a new
   immutable revision and moves the head pointer atomically.
5. Positions, sizes, and presentation belong to a view. Element meaning belongs
   to the shared model.
6. Legacy strokes remain supported as annotations, but agents primarily operate
   on semantic elements and relationships.

## Decision gates

These choices have meaningful long-term cost. Confirm them before the milestone
that depends on them and record accepted decisions as ADRs.

### D1 — Deployment shape

Accepted 2026-08-31: start as a modular monolith inside the existing Next.js
application. Keep domain and application modules independent from Next.js and
expose the web API and MCP endpoint through Node-runtime adapters. See
[ADR 0001](../docs/adr/0001-modular-monolith-deployment.md).

Recommended starting decision: use a modular monolith inside the existing
Next.js application, with Node-runtime route handlers for the web API and MCP
endpoint. Keep domain and application modules independent so the MCP adapter can
be extracted into a separate service later without rewriting business logic.

Alternative: add a separate Node service immediately. Choose this only when the
deployment platform, scaling model, or authentication provider requires it.

Decision accepted; this gate is complete for Milestone 3.

### D2 — Revision persistence

Accepted 2026-08-31: persist every accepted revision as a complete, immutable
`DesignDocument` JSON/JSONB snapshot. Keep design metadata, proposal and review
workflow, permissions, audit events, and idempotency records in structured
tables. See
[ADR 0002](../docs/adr/0002-immutable-jsonb-design-revisions.md).

Recommended starting decision: store each immutable `DesignDocument` snapshot
as JSON/JSONB, while storing design metadata, proposal workflow, review threads,
permissions, audit events, and idempotency records in structured tables.

This makes exact revisions and rollback simple. Search projections can be added
later if querying inside large design documents becomes important.

Decision accepted; this gate is complete for Milestone 4.

### D3 — Database and access library

Accepted 2026-08-31: use PostgreSQL with TypeORM. Keep TypeORM entities,
repositories, transaction managers, and query details inside the persistence
adapter; domain and application contracts remain ORM-independent. Disable
automatic schema synchronization. Dhyan retains ownership of migration
generation and registration. See
[ADR 0003](../docs/adr/0003-postgresql-with-typeorm.md).

Recommended database: PostgreSQL. Select the database access library only after
checking hosting constraints and transaction/migration support. Hide it behind
repository interfaces so domain and MCP code do not depend on the library.

Decision accepted; this gate is complete for Milestone 4. Dhyan owns all
migration generation and registration.

### D4 — Authentication provider

Accepted 2026-08-31: use WorkOS AuthKit for browser identity and sessions and as
the OAuth authorization server for the remote MCP resource. Convert verified
identity and token claims into a provider-neutral `ActorContext`; Open WorkBoard
remains authoritative for workspace and design permissions. Standard MCP OAuth
is required, while WorkOS Agent Registration is an optional later enhancement.
See [ADR 0004](../docs/adr/0004-workos-authkit-for-user-and-mcp-auth.md).

Keep domain authorization provider-neutral through an `ActorContext`. Choose a
provider that can support browser sessions and OAuth 2.1-compatible access for
the remote MCP resource server.

Decision accepted for production completion of Milestone 4. Local development
may temporarily use an explicit development actor.

### D5 — Initial diagram vocabulary

Accepted 2026-08-31: the first semantic release supports C4 system-context and
container views. Its elements are people, software systems, and containers;
datastores and queues are container specializations, and an external system is
a software system marked external. Component, deployment, dynamic, data-flow,
and custom semantic views are deferred. Existing freehand and text content
remains available as annotations. The accepted vocabulary is recorded in
[`CONTEXT.md`](../CONTEXT.md).

Recommended starting decision: support C4 system-context and container views
first, while keeping the schema extensible for component, deployment, dynamic,
data-flow, and custom views.

Decision accepted; this gate is complete for Milestone 1.

## Milestone map

| Milestone | Outcome | Depends on |
| --- | --- | --- |
| 0. Guardrails and decisions | Terminology, decisions, test strategy, and delivery boundaries are agreed | None |
| 1. Semantic design domain | Typed design document, operations, validation, and diff engine | 0 |
| 2. Semantic canvas adapter | Current UI can render and edit semantic elements while preserving annotations | 1 |
| 3. Application service and web API | UI-independent use cases with an in-memory repository and typed API | 1 |
| 4. Shared persistence and authorization | Multiple server-backed designs, users/workspaces, permissions, and audit | 3 |
| 5. Revisions and change proposals | Immutable accepted history, optimistic concurrency, and proposal versions | 4 |
| 6. Human review workflow | Visual diff, anchored notes, approval, and guarded merge | 2 and 5 |
| 7. MCP read and validation tools | Agents can discover, inspect, and dry-run design changes | 5 |
| 8. MCP proposal and feedback tools | Agents can propose, revise, and submit changes based on review notes | 6 and 7 |
| 9. WebMCP and plugin packaging | Same-page agent tools and an installable agent workflow | 8 |
| 10. Export, evals, and production hardening | Interchange formats, agent evaluations, observability, and launch gates | 8; 9 optional |

Milestones 2 and 3 may run in parallel after Milestone 1, provided both consume
the exact same domain contracts.

---

## Milestone 0 — Guardrails and architectural decisions

Goal: make later changes auditable and prevent implementation from embedding
unresolved product decisions.

### Steps

- [x] M0.1 Confirm D1–D5 or document an alternative for each.
- [x] M0.2 Create `CONTEXT.md` with the canonical terminology from this plan
  after Dhyan confirms it.
- [x] M0.3 Add ADRs only for accepted, hard-to-reverse decisions such as
  deployment shape and revision storage.
- [x] M0.4 Define the supported browser and MCP client matrix in
  `documentation/MCP_SYSTEM_DESIGN_SUPPORT_MATRIX.md`.
- [x] M0.5 Define a fixture design that every milestone will reuse in
  `documentation/MCP_SYSTEM_DESIGN_FIXTURE.md`. The fixture
  should contain at least one person, one software system, three containers
  (including one datastore specialization), four relationships, one boundary,
  and both accepted view kinds.
- [x] M0.6 Record the required verification commands for domain tests, component
  tests, API integration tests, MCP contract tests, lint, type-check, and build
  in `documentation/MCP_SYSTEM_DESIGN_VERIFICATION.md`.
- [x] M0.7 Capture the current IndexedDB board behavior as a regression fixture
  before changing persistence. The fixture and characterization suite live in
  `frontend/storage/board/` and run through `pnpm test:storage`.
- [x] M0.8 Create `documentation/MCP_SYSTEM_DESIGN_PROGRESS.md` using the fields,
  statuses, and initial state defined in the Progress tracking section. Link it
  back to this plan.

### Documentation

- Create `CONTEXT.md` only after terminology is confirmed.
- Create accepted ADRs under `docs/adr/`.
- Create `documentation/INDEX.md` and keep it current as documentation is added.

### Exit criteria

- [x] Every decision gate has an owner and an accepted answer or explicit
  deferral boundary.
- [x] The shared fixture and test command list exist.
- [x] The progress tracker exists, identifies Milestone 0 as current, and names
  the next actionable task.
- [x] No product behavior has changed.

---

## Milestone 1 — Semantic design domain and operation engine

Goal: introduce a deterministic, UI-independent source of truth for system
designs.

### Recommended module boundary

```text
frontend/domain/design/
├── types.ts
├── operations.ts
├── applyOperations.ts
├── validateDesign.ts
├── diffDesign.ts
├── identifiers.ts
└── fixtures.ts
```

The exact folder may change at D1, but these modules must remain safe to import
from browser, server, tests, and MCP code.

### Steps

- [ ] M1.1 Define a schema-versioned `DesignDocument` with required IDs and no
  framework-specific fields.
- [ ] M1.2 Separate the shared model from diagram views:
  - model elements;
  - relationships;
  - boundaries;
  - assumptions and decisions;
  - views containing included IDs and view-specific layout.
- [ ] M1.3 Define the first element kinds: `person`, `software-system`, and
  `container`. Model datastore and queue as container specializations and model
  an external system as a software system marked external. Reserve `component`
  without implementing it.
- [ ] M1.4 Define the first view kinds: `system-context` and `container`.
  Reserve but do not implement custom, component, deployment, dynamic, and
  data-flow views.
- [ ] M1.5 Define annotations separately from semantic elements. Add a legacy
  annotation payload capable of preserving current `Stroke` data.
- [ ] M1.6 Make IDs required in the semantic model. Add deterministic helpers
  for test IDs and collision-safe production ID creation.
- [ ] M1.7 Define a discriminated `DesignOperation` union:
  - add, update, and remove element;
  - add, update, and remove relationship;
  - add, update, and remove boundary;
  - add and update view;
  - set view layout;
  - add or remove annotation;
  - update design metadata.
- [ ] M1.8 Require removals to state their expected dependencies. Do not allow
  silent cascading deletion of relationships, child elements, or review
  anchors.
- [ ] M1.9 Implement a pure, atomic `applyDesignOperations` function. A failed
  operation set must return validation errors and no partial result.
- [ ] M1.10 Implement validation for:
  - unique IDs;
  - valid parent and boundary references;
  - valid relationship endpoints;
  - valid view references;
  - finite geometry;
  - allowed containment hierarchy;
  - supported schema version.
- [ ] M1.11 Implement a semantic diff that reports added, updated, moved, and
  removed IDs without depending on array order.
- [ ] M1.12 Add serialization round-trip tests and deterministic fixture tests.

### Suggested result contracts

Every operation application should return either:

```text
Success: document, changed IDs, warnings, semantic diff
Failure: stable error code, path/target ID, message, recovery hint
```

Do not throw for expected validation failures.

### Documentation

- Create `documentation/DESIGN_DOCUMENT_MODEL.md` covering the schema,
  operation API, invariants, examples, and compatibility rules.
- Update `INDEX.md` with the new domain modules.

### Tests

- [ ] Add/update/remove each supported entity.
- [ ] Reject duplicate and missing IDs.
- [ ] Reject relationships with missing endpoints.
- [ ] Reject stale dependency declarations on removal.
- [ ] Prove atomic failure behavior.
- [ ] Prove equivalent operation inputs produce deterministic results.
- [ ] Prove serialization does not discard supported fields.

### Exit criteria

- [ ] The shared fixture can be created entirely through operations.
- [ ] The fixture validates with no warnings.
- [ ] A meaningful semantic diff is produced after an update.
- [ ] Domain tests, lint, and type-check pass.

---

## Milestone 2 — Adapt the canvas to semantic designs

Goal: make the existing web experience an editor and renderer over
`DesignDocument` while retaining freehand annotations and current camera
behavior.

### Steps

- [ ] M2.1 Introduce a view-model adapter that maps semantic elements and
  relationships to renderable canvas primitives.
- [ ] M2.2 Keep element semantics separate from shape choice. Map element kinds
  to default visual styles through a theme/presentation layer.
- [ ] M2.3 Replace semantic selection by array index with stable ID selection.
  Annotation selection may remain separate internally.
- [ ] M2.4 Update connector behavior to bind relationships to element IDs and
  derive visible endpoints from view layout.
- [ ] M2.5 Move element positions and sizes into the active view's layout.
- [ ] M2.6 Add deterministic placement for elements without layout. Do not
  require an agent to provide pixel-perfect coordinates.
- [ ] M2.7 Translate UI actions into `DesignOperation` values and apply them
  through the domain engine.
- [ ] M2.8 Keep camera offset, scale, in-progress pointer state, selection,
  clipboard, and undo/redo presentation state outside the persisted semantic
  document.
- [ ] M2.9 Preserve pencil/eraser/text markup as annotations. Clearly distinguish
  semantic text labels from freeform annotation text.
- [ ] M2.10 Build a one-time legacy conversion function from persisted version-1
  `Stroke[]` data to a design containing an annotation layer.
- [ ] M2.11 Do not delete the legacy IndexedDB record after conversion until a
  verified server-backed save exists in Milestone 4.
- [ ] M2.12 Add a developer-only panel or fixture route that displays the active
  semantic document and validation errors during this transition.

### UX acceptance scenarios

- [ ] Create, move, resize, copy, paste, and delete a semantic element.
- [ ] Create a relationship and keep it attached while either endpoint moves.
- [ ] Edit element name, description, technology, and responsibilities.
- [ ] Switch between system-context and container views of the same model.
- [ ] Draw annotations without adding them to the semantic model.
- [ ] Reload a converted legacy board without losing visible content.

### Documentation

- Update `INDEX.md` to describe semantic rendering and ID-based selection.
- Update `documentation/PERSISTENT_BOARD_STORAGE.md` with the legacy conversion
  behavior and the distinction between accepted data and local UI state.

### Exit criteria

- [ ] Existing drawing, pan, zoom, theme, selection, copy/paste, and undo/redo
  behavior has regression coverage.
- [ ] Semantic elements are editable without direct `Stroke[]` manipulation.
- [ ] The shared fixture renders consistently in both supported views.

---

## Milestone 3 — Application service and typed web API

Goal: make all design use cases callable without React or Zustand so the web UI
and MCP server share one behavior boundary.

### Recommended application boundary

```text
frontend/server/design/
├── DesignService.ts
├── authorization.ts
├── errors.ts
├── repositories/
│   ├── DesignRepository.ts
│   └── InMemoryDesignRepository.ts
└── useCases/
```

### Steps

- [ ] M3.1 Resolve D1 and read the relevant Next.js 16 Route Handler and runtime
  documentation from `frontend/node_modules/next/dist/docs/` before writing
  routes.
- [ ] M3.2 Define a concrete `ActorContext` containing actor ID, workspace ID,
  roles/scopes, and request correlation ID.
- [ ] M3.3 Define repository interfaces using domain types rather than database
  records.
- [ ] M3.4 Implement an in-memory repository for deterministic service and API
  tests.
- [ ] M3.5 Implement initial application-service use cases:
  - list designs;
  - create design;
  - get design head;
  - get a specific revision-shaped snapshot;
  - validate operations without saving;
  - save an initial draft during the transition.
- [ ] M3.6 Define stable application error codes for not found, forbidden,
  conflict, invalid operation, unsupported schema version, and internal failure.
- [ ] M3.7 Add typed HTTP endpoints for the web application. Validate all input
  at the server boundary even when it came from the trusted UI.
- [ ] M3.8 Return correlation IDs and current revision identifiers in responses.
- [ ] M3.9 Add an API client adapter for the Zustand/UI layer. UI components must
  not call database or MCP code.
- [ ] M3.10 Add contract tests proving that HTTP and direct service calls return
  equivalent results.

### Documentation

- Create `documentation/DESIGN_APPLICATION_API.md` with use cases, HTTP
  contracts, authorization expectations, errors, and operational caveats.
- Update `INDEX.md` with the server and API modules.

### Exit criteria

- [ ] The shared fixture can be created, read, and validated through the API.
- [ ] Authorization checks exist at the application-service boundary.
- [ ] The UI can use the in-memory-backed API in an integration test.
- [ ] No MCP-specific types appear in the domain or application service.

---

## Milestone 4 — Shared persistence, workspaces, and authorization

Goal: replace the singleton browser-local source of truth with shared,
permissioned server persistence while retaining a safe local cache/import path.

### Proposed persistent records

- Workspace and workspace membership.
- Design metadata and `headRevisionId`.
- Immutable design revision snapshots.
- Audit events.
- Idempotency records.
- Authentication/authorization provider mappings as required by D4.

Proposal and review records are added in Milestone 5.

### Steps

- [ ] M4.1 Resolve D2, D3, and D4 and record accepted decisions.
- [ ] M4.2 Define persistence entities and indexes without coupling them to the
  public design document schema.
- [ ] M4.3 Define transaction boundaries for create design, create revision, and
  move head pointer.
- [ ] M4.4 Hand the entity/schema changes to Dhyan.
- [ ] **USER ACTION — MIGRATION:** Dhyan generates, reviews, registers, and runs
  the required database migration. Implementation must not create or modify it.
- [ ] M4.5 Implement the persistent repository adapter after the migration is
  available.
- [ ] M4.6 Enforce workspace isolation and role/scope checks in every repository
  call through the application service.
- [ ] M4.7 Implement idempotency storage with actor, operation name, key, request
  fingerprint, result reference, and expiry/retention policy.
- [ ] M4.8 Add audit events for authenticated reads of sensitive designs and all
  writes. Avoid storing raw prompts or secrets.
- [ ] M4.9 Change browser persistence from canonical storage to local cache,
  offline draft, and legacy import source.
- [ ] M4.10 Add an explicit, retry-safe import workflow for the version-1 local
  board. Remove or mark the legacy record imported only after the server confirms
  the resulting revision.
- [ ] M4.11 Add backup, retention, and deletion behavior to the operational
  documentation.

### Security tests

- [ ] A user cannot enumerate or read another workspace's designs.
- [ ] A read-only actor cannot create or update a design.
- [ ] A repeated idempotency key with the same request returns the same result.
- [ ] A repeated idempotency key with a different request is rejected.
- [ ] Audit records contain correlation and result IDs but no credentials.
- [ ] A failed transaction cannot leave a design without a valid head revision.

### Documentation

- Create `documentation/SERVER_STORAGE_AND_AUTHORIZATION.md`.
- Update `documentation/PERSISTENT_BOARD_STORAGE.md` to describe the cache and
  legacy import roles.
- Update `INDEX.md`.

### Exit criteria

- [ ] Two different users can access permitted designs across browser sessions.
- [ ] Workspace isolation tests pass.
- [ ] Legacy import is retry-safe and does not delete the only surviving copy.
- [ ] Dhyan confirms the migration has been applied in the target environment.

---

## Milestone 5 — Immutable revisions and change proposals

Goal: introduce the version-control boundary that makes agent changes safe and
reviewable.

### Proposed workflow records

- `ChangeProposal`: design, creator, base revision, current proposal version,
  status, timestamps.
- `ChangeProposalVersion`: immutable operation set, computed document, semantic
  diff, author explanation, validation warnings.
- `ReviewThread`: target anchor, status, creator, timestamps.
- `ReviewComment`: immutable comment history and author.
- Optional `ReviewDecision`: approval or rejection actor, proposal version, and
  timestamp.

### Status rules

```text
draft -> in-review -> changes-requested -> in-review -> approved -> merged
   |             |             |             |
   +-------------+-------------+-------------+-> superseded
```

- Only a draft or changes-requested proposal can receive a new proposal version.
- A new proposal version invalidates approval of the previous version.
- An agent may mark a note addressed, but only a reviewer may resolve it.
- Merge requires the exact approved proposal version.

### Steps

- [ ] M5.1 Define proposal, proposal-version, review, and approval domain types.
- [ ] M5.2 Add a state-transition function that rejects illegal workflow moves.
- [ ] M5.3 Apply proposal operations to the immutable base revision and store the
  resulting candidate document and semantic diff.
- [ ] M5.4 Add `expectedHeadRevisionId` and `expectedProposalVersion` concurrency
  checks to every relevant write.
- [ ] M5.5 Define conflict responses containing the current head/proposal version
  and a safe instruction to refetch and rebase.
- [ ] M5.6 Implement proposal creation and immutable proposal revisions.
- [ ] M5.7 Implement submit, request changes, approve, reject/supersede, and
  guarded merge operations.
- [ ] M5.8 Make merge atomic: verify approval, open-note policy, expected head,
  and permissions; create revision; move head; mark proposal merged; write audit
  event.
- [ ] M5.9 Store the merge commit message/change summary and actor provenance.
- [ ] M5.10 Add service and repository integration tests, then hand new entity
  changes to Dhyan.
- [ ] **USER ACTION — MIGRATION:** Dhyan generates, reviews, registers, and runs
  the proposal/review database migration.

### Concurrency scenarios

- [ ] Two proposals can share one base revision without corrupting one another.
- [ ] Merging one proposal makes the other's stale merge fail cleanly.
- [ ] Retrying a completed merge is idempotent.
- [ ] An approval for proposal version 1 cannot merge proposal version 2.
- [ ] Removing an element with unresolved anchored feedback is rejected or
  explicitly handled according to the accepted policy.

### Documentation

- Create `documentation/REVISION_AND_PROPOSAL_WORKFLOW.md`.
- Document state transitions, concurrency, approvals, merge policy, rollback,
  and audit behavior.

### Exit criteria

- [ ] No proposal API directly mutates the accepted head.
- [ ] Every merge produces one immutable revision and one audit trail.
- [ ] Stale revisions and invalid status transitions have deterministic errors.
- [ ] Dhyan confirms the workflow migration has been applied.

---

## Milestone 6 — Human review and change-note UI

Goal: let people understand proposed changes, anchor feedback, and control what
becomes accepted.

### Steps

- [ ] M6.1 Add a design header showing accepted revision, proposal status, author,
  and review state.
- [ ] M6.2 Add a proposal diff mode with before, after, and overlay views.
- [ ] M6.3 Use the semantic diff to highlight added, changed, moved, and removed
  elements and relationships.
- [ ] M6.4 Add a review sidebar grouped by open, addressed, and resolved threads.
- [ ] M6.5 Allow a reviewer to anchor a thread to the whole proposal, an element,
  a relationship, a view, or a location fallback.
- [ ] M6.6 Preserve anchors when layout changes. When a target is removed, show
  the thread against the removed item in the diff instead of silently dropping
  it.
- [ ] M6.7 Add reviewer actions: comment, request changes, resolve/reopen note,
  approve, and merge.
- [ ] M6.8 Add author/agent actions: reply and mark addressed. Do not expose
  reviewer-only resolution through the author path.
- [ ] M6.9 Display validation warnings and assumptions alongside the visual diff.
- [ ] M6.10 Add keyboard and screen-reader support for navigating changed items
  and review threads.
- [ ] M6.11 Add end-to-end tests for the full feedback cycle.

### Required review scenario

1. Create a proposal adding a payment service and two relationships.
2. Reviewer adds one note to the service and one to a relationship.
3. Reviewer requests changes.
4. Author submits proposal version 2 and marks both notes addressed with an
   explanation.
5. Reviewer reopens one note, then later resolves it.
6. Reviewer approves the exact proposal version.
7. Merge creates a new accepted revision.

### Documentation

- Create `documentation/DESIGN_REVIEW_WORKFLOW.md` with user roles, statuses,
  anchoring behavior, approval semantics, and accessibility behavior.

### Exit criteria

- [ ] A reviewer can understand the semantic and visual difference without
  reading raw JSON.
- [ ] Review threads survive proposal layout changes and target removals.
- [ ] Only an authorized reviewer can resolve, approve, or merge.
- [ ] The required review scenario passes end to end.

---

## Milestone 7 — MCP read and validation tools

Goal: let agents safely discover and understand designs before any MCP write
capability is introduced.

### Initial tool surface

| Tool | Side effect | Required result fields |
| --- | --- | --- |
| `list_designs` | None | design IDs, titles, kinds, head revision IDs, review summary |
| `get_design_context` | None | semantic document or filtered context, head revision, assumptions, open notes, URLs |
| `get_change_proposal` | None | base revision, proposal version, operations, diff, validation, review status |
| `validate_design_changes` | None | normalized operations, errors, warnings, semantic diff preview |

### Steps

- [ ] M7.1 Use the current official TypeScript MCP SDK version chosen for the
  project. Pin it and record the supported MCP protocol revisions.
- [ ] M7.2 Prefer Streamable HTTP for production and support a local development
  connection. Do not make transport sessions the location of application state.
- [ ] M7.3 Support the current `2026-07-28` protocol and legacy negotiation needed
  by target clients through the SDK rather than hand-written wire branching.
- [ ] M7.4 Add a Node-runtime `/mcp` endpoint or the D1-approved equivalent.
- [ ] M7.5 Add concise server instructions describing the required workflow:
  read context, validate, propose, inspect feedback, revise, submit. Keep the
  most important guidance self-contained at the beginning.
- [ ] M7.6 Register the four read/validation tools in deterministic order.
- [ ] M7.7 Give each tool an explicit input schema, output schema, stable error
  mapping, title, intent-based description, and accurate annotations.
- [ ] M7.8 Return structured content plus a concise text fallback.
- [ ] M7.9 Paginate or filter large design lists and large design contexts.
- [ ] M7.10 Add optional MCP resources only after tools work across all target
  clients:
  - `workboard://designs/{id}/revisions/{revisionId}`;
  - `workboard://designs/{id}/review-context`;
  - `workboard://proposals/{id}/diff`;
  - `workboard://schemas/design-document/v1`.
- [ ] M7.11 Enforce `design:read` on the server; never trust an ID merely because
  an agent supplied it.
- [ ] M7.12 Test through the MCP Inspector, Codex, and at least one independent
  MCP client.

### Tool annotation policy

- All four tools: `readOnlyHint: true`.
- All four tools: `openWorldHint: false` unless a later implementation calls an
  external system.
- Descriptions and annotations are hints, not authorization. Enforce every rule
  server-side.

### Documentation

- Create `documentation/MCP_INTEGRATION.md` with configuration, tools, schemas,
  permissions, examples, errors, version compatibility, and operational caveats.

### Exit criteria

- [ ] An agent can locate the fixture design without guessing identifiers.
- [ ] An agent can retrieve revision and review context in one bounded workflow.
- [ ] Invalid, unauthorized, and stale identifiers return stable errors.
- [ ] `validate_design_changes` never writes persistent state.
- [ ] The MCP Inspector and target-client smoke tests pass.

---

## Milestone 8 — MCP proposal and feedback tools

Goal: let agents create reviewable work and revise it based on human feedback
without bypassing review controls.

### Write tool surface

| Tool | Behavior | Initial annotation posture |
| --- | --- | --- |
| `create_design` | Creates a draft design with an initial immutable revision | Additive write; non-destructive |
| `propose_design_changes` | Creates a proposal based on an explicit revision | Additive write; non-destructive |
| `revise_change_proposal` | Appends an immutable proposal version and note responses | Additive write; non-destructive |
| `submit_change_proposal` | Moves a proposal to review | Write; non-destructive |
| `merge_approved_proposal` | Merges only an already approved exact version | Consequential; approval required |

### Required common inputs

- Explicit workspace and design/proposal identifiers.
- `baseRevisionId` or `expectedProposalVersion` as applicable.
- Idempotency key.
- Human-readable summary and rationale.
- Bounded `DesignOperation[]` rather than a replacement document blob.

### Required common outputs

- Correlation/request ID.
- Design ID and relevant revision ID.
- Proposal ID and proposal version when applicable.
- Changed element, relationship, and view IDs.
- Validation warnings and unresolved note count.
- Human review URL.

### Steps

- [ ] M8.1 Implement `create_design` through the application service.
- [ ] M8.2 Implement `propose_design_changes` as an atomic additive action. It
  must never advance the accepted head.
- [ ] M8.3 Implement `revise_change_proposal`. Require a response for every note
  the agent claims to have addressed.
- [ ] M8.4 Implement `submit_change_proposal` with workflow-state validation.
- [ ] M8.5 Keep merge disabled for agents initially. Enable
  `merge_approved_proposal` only after approval, scope, audit, idempotency, stale
  head, and client confirmation tests all pass.
- [ ] M8.6 Require `design:propose`, `design:review`, and `design:merge` scopes
  separately.
- [ ] M8.7 Configure target clients to prompt for writes. Apply a stricter
  per-tool approval mode to merge.
- [ ] M8.8 Reject raw full-document replacement, array-index targeting,
  undeclared cascade deletion, and unknown operation kinds.
- [ ] M8.9 Rate-limit mutation tools by actor and workspace.
- [ ] M8.10 Record actor/client identity metadata for observability only, never as
  the basis for authorization.
- [ ] M8.11 Add MCP contract and agent workflow tests.

### Required agent scenarios

- [ ] Create a valid design from a natural-language requirement.
- [ ] Propose a three-operation change without altering unrelated elements.
- [ ] Receive an unknown-ID error, refetch context, and recover.
- [ ] Receive a stale-revision conflict and produce a rebased proposal.
- [ ] Revise a proposal from two anchored change notes and explain each response.
- [ ] Repeat a tool call with the same idempotency key without duplicate state.
- [ ] Fail safely when asked to merge an unapproved proposal.
- [ ] Refuse or fail safely when asked to access another workspace.

### Documentation

- Extend `documentation/MCP_INTEGRATION.md` with write workflows, approvals,
  idempotency, concurrency, rate limits, and audit behavior.
- Add examples that show the full read -> validate -> propose -> revise -> submit
  workflow.

### Exit criteria

- [ ] Agents cannot directly mutate accepted designs.
- [ ] Every MCP write creates an attributable, reviewable record.
- [ ] Feedback revision is anchored to the exact proposal version and note IDs.
- [ ] Merge remains human-controlled or exact-version approval-gated.
- [ ] All required agent scenarios pass repeatedly.

---

## Milestone 9 — WebMCP and plugin packaging

Goal: make agent collaboration convenient in supported browser surfaces and
package the repeatable workflow without making either feature a core dependency.

### WebMCP steps

- [ ] M9.1 Register site tools from the top-level page using JavaScript feature
  detection.
- [ ] M9.2 Reuse the web application's existing API client, authentication,
  authorization, validation, and proposal workflow.
- [ ] M9.3 Start with a small page-scoped tool set:
  - get current design context;
  - get current selection context;
  - validate suggested changes;
  - create a proposal;
  - add or reply to a review comment.
- [ ] M9.4 Do not expose merge or permission changes through WebMCP initially.
- [ ] M9.5 Make tool registration follow the open page and design selection.
- [ ] M9.6 Return enough information for the agent to verify visible results.
- [ ] M9.7 Preserve all normal UI paths when WebMCP is unavailable.

### Plugin steps

- [ ] M9.8 Package the remote MCP server with a focused system-design skill.
- [ ] M9.9 The skill should instruct agents to:
  1. find the design;
  2. inspect the current revision and feedback;
  3. validate operations;
  4. create or revise a proposal;
  5. report assumptions and warnings;
  6. submit for human review.
- [ ] M9.10 Keep workflow rules in the skill and cross-tool invariants in MCP
  server instructions; do not duplicate long instructions in every tool.
- [ ] M9.11 Test the packaged plugin in every intended OpenAI surface.

### Optional MCP App steps

- [ ] M9.12 Add an MCP App only if an embedded proposal summary or diff clearly
  improves review inside compatible clients.
- [ ] M9.13 Keep every tool fully useful without the embedded UI.
- [ ] M9.14 Limit the component to bounded inspection, comparison, navigation,
  and confirmation; retain the full editor in the web application.

### Documentation

- Create `documentation/WEBMCP_INTEGRATION.md` if WebMCP ships.
- Add plugin installation and workflow guidance to
  `documentation/MCP_INTEGRATION.md`.

### Exit criteria

- [ ] The same proposal created from WebMCP and remote MCP has identical domain
  validation and authorization behavior.
- [ ] Unsupported browsers retain the full human workflow.
- [ ] Plugin instructions produce the intended tool sequence in evaluations.
- [ ] Optional UI does not become necessary for headless agents.

---

## Milestone 10 — Export, evaluations, observability, and production hardening

Goal: prove interoperability, safety, reliability, and operability before broad
release.

### Export and interchange

- [ ] M10.1 Export the semantic model to a stable JSON format with schema
  version and revision provenance.
- [ ] M10.2 Add Structurizr DSL export for supported C4 views.
- [ ] M10.3 Add Mermaid export only for diagram types with a faithful mapping.
- [ ] M10.4 Clearly report lossy conversions and unsupported fields.
- [ ] M10.5 Add snapshot tests for every supported export format.

### Agent evaluations

- [ ] M10.6 Build deterministic eval fixtures and graders for:
  - semantic correctness;
  - preservation of unrelated design content;
  - valid identifiers and references;
  - feedback coverage;
  - conflict recovery;
  - authorization boundaries;
  - idempotency;
  - useful summaries and warnings.
- [ ] M10.7 Add adversarial prompts attempting full-document overwrite,
  cross-workspace access, hidden deletion, permission changes, and approval
  bypass.
- [ ] M10.8 Track pass rate by client/model without weakening server rules for a
  specific model.

### Operations

- [ ] M10.9 Add structured logs with redaction, correlation IDs, actor/workspace
  IDs, tool/use-case name, duration, outcome, and result IDs.
- [ ] M10.10 Add metrics for MCP calls, errors, conflicts, validation failures,
  proposal revisions, approvals, merge failures, and latency.
- [ ] M10.11 Add tracing across MCP/HTTP adapter, application service,
  repository, and audit write.
- [ ] M10.12 Define rate limits, request size limits, operation count limits, and
  timeouts.
- [ ] M10.13 Define data retention, workspace deletion, audit retention, backup,
  and restore procedures.
- [ ] M10.14 Run accessibility, performance, and browser compatibility testing
  on large but realistic designs.
- [ ] M10.15 Run MCP conformance/Inspector tests and smoke tests against all
  supported protocol eras and target clients.
- [ ] M10.16 Document rollback procedures for application releases and design
  revisions separately.

### Production launch gate

- [ ] No open critical authorization or data-loss defects.
- [ ] All mutation tools have server-side input validation, authorization,
  idempotency, audit, and concurrency checks.
- [ ] Restore from backup has been tested.
- [ ] Cross-workspace isolation tests pass.
- [ ] Agent feedback-loop evals meet the agreed pass threshold.
- [ ] Human reviewers can identify and reject every proposed deletion in the
  visual diff.
- [ ] Documentation accurately describes the deployed behavior.

---

## Initial MCP workflow contract

Implementation agents should preserve this sequence unless a later ADR changes
it:

```text
list_designs
  -> get_design_context
  -> validate_design_changes
  -> propose_design_changes
  -> get_change_proposal
  -> submit_change_proposal
  -> human review/change notes
  -> get_design_context or get_change_proposal
  -> revise_change_proposal
  -> submit_change_proposal
  -> human approval
  -> guarded merge
```

The server must make unsafe shortcuts impossible rather than relying only on the
agent following these instructions.

## Cross-cutting implementation rules

### Compatibility

- Every persisted document has a schema version.
- Readers either support the version or return a stable unsupported-version
  error; they must not silently discard fields.
- MCP transport/version compatibility is handled by the official SDK and tested
  against actual target clients.
- Legacy local storage is imported through an explicit adapter, not treated as
  the new domain model.

### Concurrency

- Every accepted write uses an expected revision/version.
- Conflicts return current identifiers and a refetch/rebase path.
- No last-writer-wins behavior for proposals or accepted design heads.

### Safety

- Read and write tools are separate.
- Proposal writes are preferred over accepted-head writes.
- Deletion is explicit and dependency-aware.
- Approval applies to an exact immutable proposal version.
- Tool annotations improve host behavior but never replace authorization.

### Token and payload control

- Allow agents to request a view, selection, element set, or summary instead of
  returning every annotation and layout record by default.
- Paginate lists and review histories.
- Return stable IDs and concise summaries with links for follow-up calls.
- Set hard limits on operations per proposal call and payload size.

### Documentation discipline

For every implemented feature:

- update the relevant summary under `documentation/`;
- update `documentation/MCP_SYSTEM_DESIGN_PROGRESS.md` with current status,
  evidence, blockers, migration handoffs, and next action;
- update `INDEX.md` when structure or architecture changes;
- document API/tool schemas, important behavior, and operational caveats;
- note any required user-managed database migration before declaring the
  milestone complete.

## Definition of done for the program

- [ ] A user can create and review a semantic system-context/container design.
- [ ] A user can see immutable accepted revision history.
- [ ] An agent can discover and inspect a design through MCP.
- [ ] An agent can validate and create a proposal without changing accepted
  content.
- [ ] A reviewer can leave anchored notes and request changes.
- [ ] The agent can create a new proposal version addressing those notes.
- [ ] Only an authorized human or exact-version approval-gated operation can
  merge.
- [ ] Stale writes, repeated requests, invalid references, and unauthorized
  access fail safely and predictably.
- [ ] The web UI, HTTP API, MCP server, and WebMCP tools use the same domain and
  application-service behavior.
- [ ] Legacy browser-local work has a documented, retry-safe preservation/import
  path.
- [ ] All required migrations were generated and applied by Dhyan.
- [ ] Documentation, tests, observability, backup, and restore procedures are
  current.

## Reference baseline

- [OpenAI Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)
- [OpenAI WebMCP site tools](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI plugin architecture](https://developers.openai.com/plugins/concepts/plugins)
- [OpenAI tool design guidance](https://developers.openai.com/plugins/plan/tools)
- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [C4 diagram guidance](https://c4model.com/diagrams)
- [Structurizr model and views](https://docs.structurizr.com/dsl/tutorial)
