# Documentation index

- [Domain context](../CONTEXT.md) — confirmed domain vocabulary and abstraction
  boundaries for semantic system designs.
- [MCP system design implementation plan](./MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md)
  — milestone roadmap for turning Open WorkBoard into an agent-accessible,
  reviewable system-design workbench.
- [MCP system design progress](./MCP_SYSTEM_DESIGN_PROGRESS.md) — current
  milestone, task, decisions, blockers, handoffs, and verification evidence.
- [Browser and MCP support matrix](./MCP_SYSTEM_DESIGN_SUPPORT_MATRIX.md) —
  supported, compatibility, test-only, and deferred client surfaces.
- [Shared system-design fixture](./MCP_SYSTEM_DESIGN_FIXTURE.md) — stable model,
  views, layout, and change scenarios reused across milestones.
- [Design document model](./DESIGN_DOCUMENT_MODEL.md) — version-1 semantic
  schema, operation API, validation, diff, fixture, and compatibility rules.
- [Semantic canvas implementation](./SEMANTIC_CANVAS_IMPLEMENTATION.md) —
  operation-driven rendering, stable-ID selection, annotations, workbench
  usage, and legacy Board conversion behavior.
- [Design application service and HTTP API](./DESIGN_APPLICATION_API.md) —
  provider-neutral use cases, authorization boundary, typed Route Handlers,
  client adapter, errors, and transitional runtime caveats.
- [Server storage and authorization](./SERVER_STORAGE_AND_AUTHORIZATION.md) —
  PostgreSQL/TypeORM model, WorkOS membership mapping, transaction and
  idempotency behavior, migration handoff, backup, retention, and deletion.
- [MCP system-design verification contract](./MCP_SYSTEM_DESIGN_VERIFICATION.md)
  — stable command names, test-layer boundaries, milestone gates, and evidence
  requirements.
- [Persistent board storage](./PERSISTENT_BOARD_STORAGE.md) — current
  browser-local Dexie/IndexedDB persistence, semantic import retention, and
  local UI-state caveats.
- [ADR 0001: Modular monolith deployment](../docs/adr/0001-modular-monolith-deployment.md)
  — accepted initial deployment shape and conditions for later MCP service
  extraction.
- [ADR 0002: Immutable JSONB design revisions](../docs/adr/0002-immutable-jsonb-design-revisions.md)
  — accepted revision storage model and projection boundaries.
- [ADR 0003: PostgreSQL with TypeORM](../docs/adr/0003-postgresql-with-typeorm.md)
  — accepted database access technology and ORM isolation constraints.
- [ADR 0004: WorkOS AuthKit](../docs/adr/0004-workos-authkit-for-user-and-mcp-auth.md)
  — accepted user and MCP authentication provider with agent-auth boundaries.
