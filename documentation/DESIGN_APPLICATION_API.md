# Design application service and HTTP API

Last updated: 2026-09-02

## Purpose

Milestone 3 provides one provider-neutral behavior boundary for the web UI and
future MCP adapters. `frontend/server/design/DesignService.ts` contains the use
cases and authorization checks. It depends on a `DesignRepository` interface,
not React, Zustand, Next.js, TypeORM, WorkOS, or MCP types.

The configured runtime uses `TypeOrmDesignRepository` when `DATABASE_URL` is
present. Development and tests can explicitly use `InMemoryDesignRepository`.
Production fails closed instead of silently selecting ephemeral storage.

## Actor context and authorization

Every service call receives an `ActorContext` with an actor ID, Workspace ID,
application role, bounded scopes, correlation ID, and authentication method.
Read use cases require `design:read`; create and draft-save require
`design:write`. Every repository query is scoped by Workspace.

Browser routes use verified WorkOS AuthKit sessions. WorkOS user and
organization IDs are mapped through application-owned identity, Workspace, and
membership tables. Provider permissions can narrow but never expand the
membership role. The explicit local/test adapter accepts:

| Header | Example |
| --- | --- |
| `x-open-workboard-development-auth` | `true` |
| `x-actor-id` | `actor-local-designer` |
| `x-workspace-id` | `workspace-acme` |
| `x-actor-roles` | `owner` |
| `x-actor-scopes` | `design:read,design:write` |
| `x-correlation-id` | caller-provided request identifier |

The application membership remains authoritative; `x-actor-roles` is ignored.
This adapter is unavailable in production unless `OPEN_WORKBOARD_DEV_AUTH=true`
is deliberately configured.

## Use cases and HTTP routes

| Use case | HTTP contract |
| --- | --- |
| List Designs | `GET /api/designs` |
| Create a Design | `POST /api/designs` with `{ "document": DesignDocument }` |
| Get current head-shaped snapshot | `GET /api/designs/{designId}` |
| Get a specific snapshot | `GET /api/designs/{designId}/revisions/{revisionId}` |
| Validate operations without saving | `POST /api/designs/{designId}/validate` with `{ "operations": DesignOperation[] }` |
| Save a transitional draft | `PUT /api/designs/{designId}/draft` with `{ "document": DesignDocument, "expectedRevisionId": string }` |

All bodies are validated with strict Zod schemas at the HTTP boundary. A
successful response has `ok: true`, typed `data`, a correlation ID, and when
applicable the current revision identifier. A failure has `ok: false`, a
stable error object, correlation ID, and optionally the current revision.
Responses also expose `x-correlation-id` and, when known,
`x-current-revision-id` headers.

`POST /api/designs` and `PUT /api/designs/{designId}/draft` accept an optional
`Idempotency-Key` header. Keys use up to 200 URL-safe characters. Equivalent
retries return the original revision; reuse for different intent returns 409.
Successful Design-head data now includes `workspaceId` so browser caches cannot
mix the same Design ID across organizations.

The browser calls these routes only through `frontend/client/designApi.ts`.
That client validates response envelopes before returning them to Zustand.

## Stable errors

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `unauthenticated` | 401 | No verified WorkOS session |
| `not-found` | 404 | Design or snapshot does not exist |
| `forbidden` | 403 | Actor lacks the required permission or Workspace access |
| `conflict` | 409 | Duplicate ID, route/document mismatch, or stale expected revision |
| `idempotency-conflict` | 409 | Idempotency key was reused for different intent |
| `invalid-operation` | 422 | Request schema, document, or operation batch is invalid |
| `unsupported-schema-version` | 422 | Design document schema version is not supported |
| `internal-failure` | 500 | Repository or unexpected application failure |

Callers should branch on codes and use `recoveryHint`; they must not parse
message strings. A stale draft response includes the current revision ID so a
client can refetch before retrying.

## Verification

Run `pnpm test:api` from `frontend/`. The suite covers service use cases,
application-boundary authorization, Workspace isolation, membership mapping,
idempotency, optimistic conflict handling, rollback, audit minimization,
malformed HTTP input, correlation/revision headers, direct-service/HTTP
equivalence, and the typed client against the in-memory Route Handlers.

## Operational caveats

- The in-memory development repository resets on process restart. PostgreSQL is
  the only production source of truth.
- `initial` and `draft` snapshots are transitional application wrappers, not
  the accepted immutable Revision workflow defined for Milestone 5.
- WorkOS identity alone grants no application access; mappings and active
  membership must be provisioned.
- TypeORM entities and the persistent adapter exist, but Dhyan must generate,
  review, register, and run the migration before PostgreSQL integration is
  enabled. See [server storage and authorization](./SERVER_STORAGE_AND_AUTHORIZATION.md).
