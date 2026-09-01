# Design application service and HTTP API

Last updated: 2026-08-31

## Purpose

Milestone 3 provides one provider-neutral behavior boundary for the web UI and
future MCP adapters. `frontend/server/design/DesignService.ts` contains the use
cases and authorization checks. It depends on a `DesignRepository` interface,
not React, Zustand, Next.js, TypeORM, WorkOS, or MCP types.

The current runtime uses `InMemoryDesignRepository`. It is deterministic and
suitable for development and contract tests, but is not durable storage.

## Actor context and authorization

Every service call receives an `ActorContext` with an actor ID, Workspace ID,
roles, scopes, and correlation ID. Read use cases require `design:read`; create
and draft-save require `design:write`. Repository records are also checked
against the actor's Workspace at the application boundary.

Route Handlers currently adapt these development headers:

| Header | Example |
| --- | --- |
| `x-actor-id` | `actor-local-designer` |
| `x-workspace-id` | `workspace-acme` |
| `x-actor-roles` | `owner` |
| `x-actor-scopes` | `design:read,design:write` |
| `x-correlation-id` | caller-provided request identifier |

Missing headers receive local-development defaults. This is not production
authentication. Milestone 4 must replace the header adapter with verified
WorkOS session/token identity while retaining the same application context.

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

The browser calls these routes only through `frontend/client/designApi.ts`.
That client validates response envelopes before returning them to Zustand.

## Stable errors

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `not-found` | 404 | Design or snapshot does not exist |
| `forbidden` | 403 | Actor lacks the required permission or Workspace access |
| `conflict` | 409 | Duplicate ID, route/document mismatch, or stale expected revision |
| `invalid-operation` | 422 | Request schema, document, or operation batch is invalid |
| `unsupported-schema-version` | 422 | Design document schema version is not supported |
| `internal-failure` | 500 | Repository or unexpected application failure |

Callers should branch on codes and use `recoveryHint`; they must not parse
message strings. A stale draft response includes the current revision ID so a
client can refetch before retrying.

## Verification

Run `pnpm test:api` from `frontend/`. The suite covers service use cases,
application-boundary authorization, optimistic conflict handling, malformed
HTTP input, correlation/revision headers, direct-service/HTTP equivalence, and
the typed client against the in-memory Route Handlers.

## Operational caveats

- The singleton repository resets on process restart and does not coordinate
  across server instances.
- `initial` and `draft` snapshots are transitional application wrappers, not
  the accepted immutable Revision workflow defined for Milestone 5.
- Local actor headers are trusted only for this development milestone.
- There are no database entities or migrations. PostgreSQL/TypeORM persistence
  and WorkOS identity integration begin in Milestone 4, with migrations owned
  exclusively by Dhyan.
