# ADR 0003: Use PostgreSQL with TypeORM

- Status: Accepted
- Date: 2026-08-31
- Decision owner: Dhyan
- Related gate: D3 in the
  [implementation plan](../../documentation/MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md)

## Context

ADR 0002 requires PostgreSQL JSONB revision snapshots alongside structured
workflow records. Merges also require transactions that insert an immutable
revision, move the accepted-head pointer, and write audit and idempotency data
atomically.

The repository does not currently have a server database library or PostgreSQL
driver. The main access choices included a full ORM such as TypeORM, a typed SQL
builder, or direct driver queries. Dhyan selected TypeORM for the PostgreSQL
persistence adapter.

TypeORM currently supports PostgreSQL `jsonb` columns, `DataSource` connection
pools, and transaction callbacks. Its transaction contract requires every
operation in a transaction to use the callback's transactional
`EntityManager`, not a global manager or repository.

## Decision

Use PostgreSQL as the shared database and TypeORM as its access library.

- TypeORM belongs only in infrastructure/persistence modules.
- Domain types and application-service ports must not expose TypeORM entities,
  decorators, `Repository`, `EntityManager`, `QueryRunner`, or driver types.
- Map between persistence entities and concrete domain/application types at the
  repository boundary.
- Store immutable `DesignDocument` payloads in native PostgreSQL `jsonb`
  columns, not TypeORM's cross-database `simple-json` format.
- Use one initialized `DataSource`/connection pool per Node.js runtime instance
  rather than creating a new pool for every request.
- For an application operation requiring atomic writes, create one TypeORM
  transaction and pass repositories derived from its transactional
  `EntityManager` through the persistence adapter. Do not use global
  repositories inside that transaction.
- Set `synchronize: false` in every environment. Application startup must not
  infer or apply schema changes from entities.
- Keep automatic migration execution disabled unless Dhyan later defines an
  explicit deployment procedure for it.
- Pin TypeORM and the PostgreSQL driver to reviewed versions when Milestone 4
  introduces them.

Dhyan remains the sole owner of creating, editing, renaming, registering, or
deleting migrations. Agents may implement requested entity changes but must
stop at the documented migration handoff.

## Consequences

### Positive

- The selected library directly supports the JSONB storage decision.
- Transaction-scoped persistence can enforce atomic merge and idempotency
  behavior.
- Repository interfaces protect the domain and MCP contracts from ORM-specific
  representations.
- TypeORM provides entity mapping, queries, and transaction management within
  one persistence adapter.

### Negative

- Persistence mapping and transaction-scope plumbing are required to prevent
  TypeORM types from leaking into application services.
- A modular-monolith deployment must reuse its `DataSource` carefully during
  development reloads and production runtime reuse.
- ORM behavior does not replace database constraints or domain validation.
- Switching access libraries later requires replacing the persistence adapter
  and its tests.

### Follow-up constraints

- Milestone 3 must define repository and unit-of-work ports without TypeORM
  imports.
- Milestone 4 must add transaction integration tests for atomic head movement,
  permissions, audit writes, and idempotency.
- Hosting must provide a Node.js runtime and PostgreSQL connectivity compatible
  with the selected driver and connection-pool model.
- No migration work is authorized by this ADR.

## References

- [TypeORM PostgreSQL driver](https://typeorm.io/docs/drivers/postgres/)
- [TypeORM transactions](https://typeorm.io/docs/transactions/)
- [TypeORM migration setup](https://typeorm.io/docs/migrations/setup/)
- [TypeORM DataSource](https://typeorm.io/docs/data-source/data-source/)
