# MCP System Design Workbench — Progress

This is the operational status record for the work described in the
[implementation plan](./MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md). Update this
file whenever a task, decision, blocker, handoff, verification result, or
milestone status changes.

## Current status

| Field | Value |
| --- | --- |
| Program status | `active` |
| Current milestone | M0 — Guardrails and architectural decisions |
| Milestone status | `completed` |
| Current task | Milestone handoff — authorize M1 start |
| Task owner | Dhyan |
| Started | 2026-08-31 |
| Active blocker | None |
| Next action | Start M1.1 when Dhyan directly requests Milestone 1 implementation |
| Next gate | Move M1 from `ready` to `in-progress` and define the schema-versioned `DesignDocument` |
| Related commits / pull requests | None yet |

Only one milestone may be `in-progress`. Valid statuses are `not-started`,
`ready`, `in-progress`, `blocked`, and `completed`.

## Milestone overview

| Milestone | Status | Evidence / next gate |
| --- | --- | --- |
| M0 — Guardrails and decisions | `completed` | All tasks and exit criteria passed on 2026-08-31 |
| M1 — Semantic design domain | `ready` | M0 is complete; awaiting explicit start authorization |
| M2 — Semantic canvas adapter | `not-started` | Requires M1 |
| M3 — Application service and web API | `not-started` | Requires M1 |
| M4 — Shared persistence and authorization | `not-started` | Requires M3 |
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
| 2026-08-31 | Product code and database migrations changed | No |

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

## Update protocol

1. Read this file before doing program work.
2. Keep exactly one current milestone. While implementation is active, keep
   exactly one current task and one `in-progress` milestone.
3. Record accepted decisions here immediately; add an ADR when the decision is
   durable, surprising, and costly to reverse.
4. Attach commands and results to verification evidence rather than marking a
   task complete without proof.
5. Record blockers and Dhyan-owned migration handoffs explicitly.
6. Mark a milestone `completed` only after every exit criterion passes.
