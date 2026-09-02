# MCP System Design Workbench — Progress

This is the operational status record for the work described in the
[implementation plan](./MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md). Update this
file whenever a task, decision, blocker, handoff, verification result, or
milestone status changes.

## Current status

| Field | Value |
| --- | --- |
| Program status | `active` |
| Current milestone | M4 — Shared persistence and authorization |
| Milestone status | `in-progress` |
| Current task | Dhyan generates/applies the M4 migration; then run PostgreSQL multi-user integration smoke tests |
| Task owner | Dhyan + implementation agent |
| Started | 2026-09-02 |
| Active blocker | Dhyan-owned PostgreSQL migration has not been generated or applied |
| Next action | Generate/review/apply the entity migration described in `SERVER_STORAGE_AND_AUTHORIZATION.md` |
| Next gate | Migration applied; persistent two-user/session, isolation, restart, idempotency, and rollback smoke tests pass |
| Related commits / pull requests | None yet |

Only one milestone or explicitly authorized parallel group may be
`in-progress`. Valid statuses are `not-started`, `ready`, `in-progress`,
`blocked`, and `completed`.

## Milestone overview

| Milestone | Status | Evidence / next gate |
| --- | --- | --- |
| M0 — Guardrails and decisions | `completed` | All tasks and exit criteria passed on 2026-08-31 |
| M1 — Semantic design domain | `completed` | All M1 tasks and exit criteria passed on 2026-08-31 |
| M2 — Semantic canvas adapter | `completed` | All tasks, UX scenarios, regression suites, and three-engine journeys passed on 2026-08-31 |
| M3 — Application service and web API | `completed` | Service, authorization, repository, typed routes/client, and equivalence contracts passed on 2026-08-31 |
| M4 — Shared persistence and authorization | `in-progress` | Code/security gates pass; Dhyan-owned migration and real PostgreSQL smoke tests remain |
| M5 — Revisions and change proposals | `not-started` | Requires M4 |
| M6 — Human review workflow | `not-started` | Requires M2 and M5 |
| M7 — MCP read and validation tools | `not-started` | Requires M5 |
| M8 — MCP proposal and feedback tools | `not-started` | Requires M6 and M7 |
| M9 — WebMCP and plugin packaging | `not-started` | Requires M8 |
| M10 — Export, evals, and production hardening | `not-started` | Requires M8; M9 is optional |

## Completed milestone: M0

### Tasks

| Task | Status | Owner | Evidence / next action |
| --- | --- | --- | --- |
| M0.1 Confirm D1–D5 | `completed` | Dhyan + implementation agent | All five decisions are accepted and documented |
| M0.2 Create `CONTEXT.md` after terminology is confirmed | `completed` | Dhyan + implementation agent | Diagram and workflow vocabulary confirmed and recorded |
| M0.3 Record accepted durable decisions as ADRs | `completed` | Implementation agent | ADRs 0001–0004 record D1–D4; D5 belongs in domain context rather than an ADR |
| M0.4 Define browser and MCP client support | `completed` | Implementation agent | [Support matrix](./MCP_SYSTEM_DESIGN_SUPPORT_MATRIX.md) classifies required, compatibility, and deferred targets |
| M0.5 Define the reusable fixture design | `completed` | Implementation agent | [Fixture specification](./MCP_SYSTEM_DESIGN_FIXTURE.md) covers both views and deterministic scenarios |
| M0.6 Record verification commands | `completed` | Implementation agent | [Verification contract](./MCP_SYSTEM_DESIGN_VERIFICATION.md) separates current commands from required stable scripts |
| M0.7 Capture IndexedDB behavior as a regression baseline | `completed` | Implementation agent | Version-1 fixture and 9-test characterization suite pass through `pnpm test:storage` |
| M0.8 Create the progress tracker | `completed` | Implementation agent | This file created on 2026-08-31 |

## Completed milestone: M1

### Tasks

| Task | Status | Owner | Evidence / next action |
| --- | --- | --- | --- |
| M1.1–M1.8 Define document, model/view boundary, initial vocabulary, annotations, identifiers, operations, and guarded removals | `completed` | Implementation agent | Pure contracts added under `frontend/domain/design/` |
| M1.9 Apply operation batches atomically | `completed` | Implementation agent | Invalid batches return stable errors and no partial document |
| M1.10 Validate document invariants | `completed` | Implementation agent | IDs, references, containment, views, geometry, and annotations validated |
| M1.11 Produce order-independent semantic diffs | `completed` | Implementation agent | Semantic, layout, and annotation changes are classified by stable ID |
| M1.12 Add serialization and fixture tests | `completed` | Implementation agent | Domain suite includes JSON round-trip, fixture, operation, validation, diff, and identifier coverage |

### Exit criteria

- [x] The shared fixture can be created entirely through operations.
- [x] The fixture validates with no warnings.
- [x] A meaningful semantic diff is produced after an update.
- [x] Domain tests, lint, and type-check pass.

### Migration handoffs

None in Milestone 1. The domain document deliberately has no persistence
entity or migration. Dhyan remains the sole owner of migrations when shared
persistence begins in Milestone 4.

## Completed parallel milestones: M2 + M3

The implementation plan permits M2 and M3 to run in parallel after M1. Dhyan
authorized both together on 2026-08-31; both workstreams completed that day.

### Tasks

| Workstream | Status | Owner | Evidence / next action |
| --- | --- | --- | --- |
| M2.1–M2.7 Semantic adapter, theme mapping, ID selection, connectors, layouts, placement, and operation-driven editing | `completed` | Implementation agent | Implemented under `frontend/semantic/`, `frontend/store/`, and `frontend/components/design/` |
| M2.8–M2.12 UI-only state, annotations, legacy conversion, retention, and developer workbench | `completed` | Implementation agent | Workbench route, developer panel, and retry-safe import implemented |
| M3.1 Route/runtime documentation | `completed` | Implementation agent | Next.js 16 Route Handler, dynamic params, Vitest, and Playwright guides reviewed |
| M3.2–M3.6 Actor context, repositories, service use cases, and errors | `completed` | Implementation agent | Provider-neutral service and in-memory repository implemented |
| M3.7–M3.10 Typed routes, correlation/revision IDs, API client, and contract tests | `completed` | Implementation agent | Strict Zod routes, typed client, response metadata, and equivalence contracts implemented |

### Exit criteria

- [x] Existing Board behavior has regression coverage.
- [x] Semantic elements are editable without direct `Stroke[]` manipulation.
- [x] Shared fixture renders consistently in both supported views.
- [x] Shared fixture can be created, read, and validated through the API.
- [x] Authorization checks exist at the application-service boundary.
- [x] UI/API integration and direct-service/HTTP equivalence tests pass.

### Implementation summaries

- [Semantic canvas implementation](./SEMANTIC_CANVAS_IMPLEMENTATION.md)
- [Design application service and HTTP API](./DESIGN_APPLICATION_API.md)

### Migration handoffs

None in Milestones 2 or 3. The runtime is deliberately in-memory; no database
entities or migrations were created or changed. Milestone 4 then moved to
`ready`; Dhyan remains responsible for every generated migration.

## Active milestone: M4

Dhyan authorized direct M4 implementation on 2026-09-02. The application code,
security tests, browser recovery behavior, and schema handoff are complete.
The milestone remains `in-progress` because repository policy assigns migration
generation/application to Dhyan and the unapplied schema cannot yet receive a
real PostgreSQL integration test.

### Tasks

| Task | Status | Owner | Evidence / next action |
| --- | --- | --- | --- |
| M4.1 Accepted gates D2–D4 | `completed` | Dhyan + implementation agent | ADRs 0002–0004 reconciled with the implementation |
| M4.2–M4.4 entities, indexes, transactions, schema handoff | `completed` | Implementation agent | Eight TypeORM schemas and the handoff in [server storage and authorization](./SERVER_STORAGE_AND_AUTHORIZATION.md); no migration files changed |
| USER ACTION — PostgreSQL migration | `pending` | Dhyan | Generate, review, register, and apply from `frontend/server/persistence/entities.ts` |
| M4.5 persistent repository | `pending-integration` | Dhyan + implementation agent | Adapter implemented; activate and smoke-test after migration |
| M4.6 Workspace isolation and role/scope enforcement | `completed` | Implementation agent | WorkOS identity mapping plus application-owned active membership and Workspace-scoped queries |
| M4.7 idempotency | `completed` | Implementation agent | Actor/operation/key identity, SHA-256 fingerprint, result references, 24-hour expiry, replay/conflict tests |
| M4.8 audit | `completed` | Implementation agent | Sensitive reads, denials, writes, replay/correlation/result coverage; no bodies or credentials stored |
| M4.9–M4.10 cache/offline/import | `completed` | Implementation agent | Workspace-scoped Design cache, offline drafts, deterministic retry key, confirmed receipt, source retained |
| M4.11 operations | `completed` | Implementation agent | Backup, retention, expiry, deletion, restore, and source-retention policy documented |

### Exit criteria

- [ ] Two mapped users access permitted Designs across browser sessions and a
  server restart. Pending migration and PostgreSQL smoke test.
- [x] Workspace isolation unit/contract tests pass.
- [x] Legacy import is retry-safe and retains the version-1 source Board.
- [ ] Dhyan confirms the migration is applied in the target environment.

### Migration handoff

Status: `pending-user-action`. No migration was created, edited, renamed,
registered, or deleted. The exact tables, columns, JSONB field, constraints,
indexes, provisioning requirements, and post-apply smoke tests are documented
in [server storage and authorization](./SERVER_STORAGE_AND_AUTHORIZATION.md).

### Decision gates

| Gate | Status | Owner | Current recommendation | Decision / deferral |
| --- | --- | --- | --- | --- |
| D1 — Deployment shape | `accepted` | Dhyan | Modular monolith in the existing Next.js app, with extractable domain/application boundaries | Accepted 2026-08-31; [ADR 0001](../docs/adr/0001-modular-monolith-deployment.md) |
| D2 — Revision persistence | `accepted` | Dhyan | Immutable JSON/JSONB document snapshots plus structured workflow tables | Accepted 2026-08-31; [ADR 0002](../docs/adr/0002-immutable-jsonb-design-revisions.md) |
| D3 — Database and access library | `accepted` | Dhyan | PostgreSQL with TypeORM behind repository interfaces | Accepted 2026-08-31; [ADR 0003](../docs/adr/0003-postgresql-with-typeorm.md) |
| D4 — Authentication provider | `accepted` | Dhyan | WorkOS AuthKit for browser identity and standard MCP OAuth; provider-neutral application authorization | Accepted 2026-08-31; [ADR 0004](../docs/adr/0004-workos-authkit-for-user-and-mcp-auth.md) |
| D5 — Initial diagram vocabulary | `accepted` | Dhyan | C4 system-context and container views; no initial custom semantic view | Accepted 2026-08-31; recorded in [`CONTEXT.md`](../CONTEXT.md) |

### Exit criteria

- [x] Every decision gate has an owner and an accepted answer or explicit
  deferral boundary.
- [x] The shared fixture and test command list exist.
- [x] The progress tracker exists, identifies M0 as current, and names the next
  actionable task.
- [x] No product behavior has changed while starting M0.

### Migration handoffs

None in Milestone 0. Dhyan remains the sole owner of generating, editing,
registering, renaming, or deleting migrations in later milestones.

### Verification evidence

| Date | Check | Result |
| --- | --- | --- |
| 2026-08-31 | Root and frontend `AGENTS.md` reviewed | Passed |
| 2026-08-31 | Existing `documentation/` and `docs/adr/` inventory | `documentation/` had the plan and storage summary; `docs/adr/` and `CONTEXT.md` did not exist |
| 2026-08-31 | Existing IndexedDB behavior summary reviewed | Passed; M0.7 subsequently added the executable regression baseline |
| 2026-08-31 | Documentation visibility in Git checked | Removed the broad `documentation` ignore rule; program documents are now versionable |
| 2026-08-31 | `git diff --check` | Passed after starting M0 |
| 2026-08-31 | D1 cross-checked against the repository baseline | Accepted architecture fits the existing single Next.js application and preserves an extraction boundary |
| 2026-08-31 | D2 persistence trade-off reviewed | Complete immutable snapshots selected over normalized mutable graph rows or event-only reconstruction |
| 2026-08-31 | D3 checked against current TypeORM documentation | PostgreSQL JSONB and transaction-scoped entity managers are supported; automatic schema synchronization will remain disabled |
| 2026-08-31 | D4 provider and pricing reviewed against current official documentation | WorkOS AuthKit supports MCP OAuth; Agent Registration requires enablement and remains optional; published pricing caveats recorded in ADR 0004 |
| 2026-08-31 | D5 vocabulary reconciled with the roadmap | Initial custom/component semantics removed; datastore and queue are container specializations; freeform content remains annotation |
| 2026-08-31 | Workflow glossary confirmed | `CONTEXT.md` now distinguishes workspace, board, design, revision, proposal, proposal version, and review-note states |
| 2026-08-31 | Browser and MCP support researched | Next.js browser floor, current canvas input behavior, official OpenAI MCP surfaces, WorkOS compatibility, and MCP Inspector were reviewed |
| 2026-08-31 | Shared fixture specification reviewed | Deterministic IDs, two C4 views, layout, relationship coverage, and valid/invalid change scenarios are defined |
| 2026-08-31 | Verification command contract reviewed | Current lint/type-check/build commands and stable domain, storage, component, API, MCP, and E2E command names are explicit |
| 2026-08-31 | `pnpm test:storage` | Passed: Vitest 4.1.11, 1 file and 9 tests; `fake-indexeddb` 6.2.5 |
| 2026-08-31 | `pnpm lint` | Passed |
| 2026-08-31 | `pnpm exec tsc --noEmit` | Passed |
| 2026-08-31 | `pnpm build` | Passed: Next.js 16.2.10 production build |
| 2026-08-31 | `pnpm test:domain` | Passed: Vitest 4.1.11, 1 file and 8 tests |
| 2026-08-31 | `pnpm test:storage` | Passed: legacy version-1 regression baseline remains green after M1 |
| 2026-08-31 | `pnpm typecheck` | Passed after adding the M1 stable command alias and pure domain package |
| 2026-08-31 | M1 production build | Passed: Next.js 16.2.10 compiled the domain package in the production build |
| 2026-08-31 | M1 product code changed | Yes: pure framework-independent domain package and tests; no UI, API, persistence, or migration behavior changed |
| 2026-08-31 | M1 database migrations changed | No |
| 2026-08-31 | `pnpm test:components` | Passed: Vitest 4.1.11, 8 files and 15 tests |
| 2026-08-31 | `pnpm test:api` | Passed: Vitest 4.1.11, 2 files and 6 tests |
| 2026-08-31 | M2/M3 production build | Passed: Next.js 16.2.10, workbench plus five dynamic Design API routes |
| 2026-08-31 | Playwright Chromium and Firefox | Passed: 2 production journeys per engine, including real IndexedDB retention |
| 2026-08-31 | Playwright WebKit | Passed: 2 production journeys using Playwright 1.62.1 fallback WebKit on Fedora with user-local ICU/JPEG compatibility libraries |
| 2026-08-31 | `pnpm verify` | Passed: lint, type-check, 38 Vitest tests, production build, and 6 Playwright runs across Chromium, Firefox, and WebKit |
| 2026-08-31 | M2/M3 database migrations changed | No |
| 2026-08-31 | M0 product code and database migrations changed | No |
| 2026-09-02 | M4 decision/contract reconciliation | D2 JSONB snapshots, D3 TypeORM transaction boundary, D4 WorkOS identity plus app-owned membership remain aligned; no new ADR required |
| 2026-09-02 | M4 database migrations changed | No; entity/schema handoff recorded for Dhyan |
| 2026-09-02 | M4 security and recovery tests | Passed: cross-Workspace not-found behavior, viewer write denial, idempotent replay/key conflict, minimized audit, rollback, WorkOS membership mapping, Workspace-scoped cache, confirmed import receipt |
| 2026-09-02 | `pnpm verify` | Passed: lint, type-check, 48 Vitest tests, TypeORM metadata build, production build, and 6 Playwright journeys across Chromium, Firefox, and WebKit |
| 2026-09-02 | Real PostgreSQL/WorkOS multi-user smoke test | Pending Dhyan-owned migration, provider configuration, and mapping seed |

## Activity log

| Date | Event | Outcome |
| --- | --- | --- |
| 2026-08-31 | Milestone 0 started | Program changed from proposed to active; D1 became the current task |
| 2026-08-31 | Progress tracker created | M0.8 and the tracker-related exit criterion completed |
| 2026-08-31 | Documentation ignore rule corrected | `documentation/` is now visible to Git; the root-only `INDEX.md` ignore remains anchored at `/INDEX.md` |
| 2026-08-31 | D1 accepted | Modular monolith selected and recorded in ADR 0001; D2 became the current decision |
| 2026-08-31 | D2 accepted | Immutable JSON/JSONB revision snapshots selected and recorded in ADR 0002; D3 became the current decision |
| 2026-08-31 | D3 accepted | PostgreSQL with TypeORM selected and recorded in ADR 0003; D4 became the current decision |
| 2026-08-31 | D4 accepted | WorkOS AuthKit selected and recorded in ADR 0004; D5 became the current decision |
| 2026-08-31 | D5 accepted | Initial C4 vocabulary recorded in `CONTEXT.md`; M0.1 completed and M0.2 became current |
| 2026-08-31 | Workflow glossary accepted | M0.2 completed and M0.4 became the current task |
| 2026-08-31 | Support matrix completed | M0.4 completed and M0.5 became the current task |
| 2026-08-31 | Shared fixture completed | M0.5 completed and M0.6 became the current task |
| 2026-08-31 | Verification contract completed | M0.6 completed and M0.7 became the current task |
| 2026-08-31 | IndexedDB baseline completed | M0.7 completed with a version-1 fixture and 9 passing characterization tests |
| 2026-08-31 | Milestone 0 completed | Every task and exit criterion passed; M1 moved to `ready` without starting implementation |
| 2026-08-31 | Milestone 1 started | Dhyan authorized implementation; M1.1–M1.8 became the active task |
| 2026-08-31 | Milestone 1 completed | Typed domain package, fixture, tests, documentation, lint, type-check, and build passed; M2 and M3 moved to `ready` |
| 2026-08-31 | Milestones 2 and 3 started | Dhyan authorized the roadmap's parallel semantic UI and application/API workstreams |
| 2026-08-31 | Milestones 2 and 3 completed | Semantic workbench, retained legacy import, provider-neutral service, typed API/client, documentation, and all exit criteria passed; M4 moved to `ready` |
| 2026-09-02 | Milestone 4 started | Dhyan authorized direct implementation without optional decision pauses |
| 2026-09-02 | M4 implementation and handoff completed | Persistent adapter, entities, WorkOS adaptation, isolation, idempotency, audit, browser cache/import, operations documentation, and full verification pass; milestone remains in progress pending migration/application smoke test |

## Update protocol

1. Read this file before doing program work.
2. Keep exactly one current milestone or plan-authorized parallel milestone
   group. Only use parallel `in-progress` statuses when the roadmap permits it
   and Dhyan explicitly authorizes the grouped milestones.
3. Record accepted decisions here immediately; add an ADR when the decision is
   durable, surprising, and costly to reverse.
4. Attach commands and results to verification evidence rather than marking a
   task complete without proof.
5. Record blockers and Dhyan-owned migration handoffs explicitly.
6. Mark a milestone `completed` only after every exit criterion passes.
