# Server storage and authorization

Last updated: 2026-09-02

## Purpose

Milestone 4 makes PostgreSQL the canonical Design store and WorkOS AuthKit the
browser identity/session provider. The application database—not a WorkOS role
claim or a caller-supplied identifier—is authoritative for Workspace
membership and role. WorkOS permission slugs are an upper bound on that role.

The domain and application service remain independent of WorkOS, Next.js, and
TypeORM. Delivery adapters map a verified session to `ActorContext`; repository
adapters map immutable `DesignDocument` snapshots to JSONB.

## Runtime configuration

Production requires all of the following:

- `DATABASE_URL` for PostgreSQL;
- `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and a 32-character-or-longer
  `WORKOS_COOKIE_PASSWORD`;
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, configured to
  `/auth/callback` on the same deployment; and
- WorkOS dashboard Sign-in URL set to `/sign-in`.

`DATABASE_SSL=require` enables certificate-verified PostgreSQL TLS.
`DATABASE_LOGGING=true` enables TypeORM query logging and should be used only
for controlled diagnostics.

`OPEN_WORKBOARD_DEV_AUTH=true` and `OPEN_WORKBOARD_USE_IN_MEMORY=true` are
explicit development/test escape hatches. Production does not fall back to an
ephemeral repository when `DATABASE_URL` is absent. Development headers are
ignored unless development auth is explicitly enabled (or Next.js is running
in development/test mode), and their role claim is never trusted: an active
application membership must still exist.

WorkOS AuthKit setup follows the official
[Next.js SDK guide](https://workos.com/docs/sdks/authkit-nextjs). Session claims
are adapted in `server/auth/resolveRequestActor.ts`; authorization remains
close to persistence as recommended by the
[Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication).

## Persistent model

| Table | Purpose | Important constraints/indexes |
| --- | --- | --- |
| `workspaces` | Application Workspace and WorkOS organization mapping | Unique `workosOrganizationId` |
| `principals` | Human, agent, or service application actor | Stable application-owned ID |
| `external_identities` | WorkOS user to Principal mapping | Unique provider/subject; Principal FK |
| `workspace_memberships` | Authoritative role in one Workspace | Unique Workspace/Principal; active-status index |
| `designs` | Design metadata and current head pointer | Workspace/update index; Workspace and head FKs |
| `design_revisions` | Immutable full `DesignDocument` JSONB snapshot | Design/created index; Design FK |
| `idempotency_records` | Retry identity and result reference | Unique Workspace/actor/operation/key; expiry index |
| `audit_events` | Authentication-aware reads, denials, and writes | Workspace/time, resource, and correlation indexes |

`DesignDocument` is stored as JSONB without turning its public fields into ORM
entities. Proposal/review tables remain a Milestone 5 concern.

## Transaction and concurrency behavior

Create Design runs in one TypeORM transaction: check idempotency, insert the
Design with a temporary null head, insert the immutable initial revision, move
the head, write the idempotency result, and write the audit event. Draft save
locks the Workspace-scoped Design row, verifies `expectedRevisionId`, inserts
the revision, moves the head, and writes idempotency/audit records in the same
transaction. Only the callback's transaction-scoped `EntityManager` is used.

The nullable head column is an insertion mechanism, not a valid committed
application state. Repository reads reject a committed Design without a head,
and a transaction failure rolls back both rows. A future database-level
deferred constraint/trigger may strengthen this invariant after operational
experience, but it must not be hand-authored outside Dhyan's migration process.

`Idempotency-Key` is supported on Design create and draft save. Identity is
Workspace + actor + operation + key. Records store a SHA-256 request
fingerprint, result Design/revision references, and a 24-hour expiry. Repeating
the same intent returns the original result; changing intent while reusing the
key returns HTTP 409 `idempotency-conflict`.

## Authorization and isolation

The request flow is:

1. AuthKit verifies/refreshes the browser session in the Next.js 16 proxy.
2. The adapter takes only the verified WorkOS user, organization, session, and
   `design:read`/`design:write` permissions.
3. The actor directory resolves WorkOS IDs to an application Principal,
   Workspace, and active membership role.
4. The application service intersects permission scopes with role capabilities.
5. Every repository read includes the resolved Workspace ID in its query.

An ID from another Workspace therefore produces the same not-found result as a
missing ID; it cannot be used for enumeration. Viewer membership never gains
write access from a WorkOS claim or development header.

Audit records contain actor, Workspace, authentication method, action,
resource/result IDs, outcome, correlation ID, and timestamp. They deliberately
exclude access/refresh tokens, cookies, authorization headers, request bodies,
Design documents, prompts, and user-authored descriptions.

## Migration handoff for Dhyan

No migration file was created or changed. Before enabling PostgreSQL runtime:

1. Generate a TypeORM migration from the eight schemas in
   `frontend/server/persistence/entities.ts`.
2. Review table/constraint/index names listed above and confirm every revision
   `document` column is PostgreSQL `jsonb`.
3. Confirm `synchronize: false` and `migrationsRun: false` remain set.
4. Apply the migration to a non-production target.
5. Provision at least one Workspace, Principal, WorkOS external identity, and
   active Workspace membership; there is intentionally no implicit
   just-in-time authorization bootstrap.
6. Run a PostgreSQL integration smoke test for two mapped users, Workspace
   isolation, create/restart/read, idempotent retry, stale draft conflict, and
   rollback behavior.
7. Record migration/application evidence in the progress tracker.

M4 remains `in-progress` until this handoff is confirmed. The persistent
adapter is implemented but has not been exercised against the unapplied schema.

## Backup, retention, and deletion

- Enable provider-managed point-in-time recovery before production writes and
  verify a restore drill at least quarterly. Keep daily recoverable points for
  30 days unless compliance requires longer.
- Retain immutable revisions for the lifetime of the Design. A Design deletion
  cascades its revisions and idempotency result rows only after the product's
  future deletion workflow authorizes it.
- Purge expired idempotency rows after 24 hours with an operational job. Reads
  already treat expired rows as absent.
- Retain audit events for 365 days by default, then archive or delete according
  to policy. Workspace deletion is restricted while audit rows remain; archive
  and verify them before the explicit Workspace purge.
- Never use browser IndexedDB as a backup. A server-confirmed cache is
  reconstructable; an offline draft must be surfaced to the user before local
  browser data is cleared.
- The version-1 Board record is intentionally retained after import. A receipt
  is written only after a server revision is confirmed; source deletion is not
  implemented in M4.

## Verification

`pnpm test:api` covers membership adaptation, read-only enforcement, Workspace
isolation, idempotency, audit minimization, and simulated transaction rollback.
`pnpm test:storage` covers Workspace-scoped cache and confirmed import receipts.
`pnpm verify` remains the complete repository gate. Real PostgreSQL integration
evidence is pending Dhyan's migration.
