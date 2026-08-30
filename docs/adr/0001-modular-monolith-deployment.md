# ADR 0001: Start with a modular monolith deployment

- Status: Accepted
- Date: 2026-08-31
- Decision owner: Dhyan
- Related gate: D1 in the
  [implementation plan](../../documentation/MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md)

## Context

Open WorkBoard is currently one Next.js application. The planned web UI, web
API, and MCP endpoint must apply the same design validation, permissions, and
workflow rules. Starting with a separate MCP service would introduce a second
deployment, inter-service authentication, distributed observability, and
failure handling before independent scaling is known to be necessary.

Keeping every concern inside Next.js without explicit boundaries would create a
different problem: domain behavior could become coupled to React, route
handlers, or browser-only storage and become expensive to extract later.

The considered alternatives were:

1. A modular monolith in the existing Next.js application.
2. A separate Node service for the API and MCP endpoint from the beginning.

## Decision

Start with a modular monolith inside the existing Next.js application.

- Run the web API and Streamable HTTP MCP endpoint in Node-runtime adapters.
- Keep domain modules independent of React, Next.js, MCP, OAuth, databases, and
  browser APIs.
- Keep application services independent of delivery protocols. Web UI, HTTP,
  MCP, and optional WebMCP integrations call the same use cases.
- Access persistence through repository interfaces rather than importing a
  database library into domain or adapter code.
- Do not import the existing IndexedDB adapter into server-side application
  services.

Reconsider extracting the MCP/API adapter into a separate service when at least
one concrete operational need appears, such as:

- MCP traffic requires independent scaling or deployment cadence;
- the hosting platform cannot support the required long-lived HTTP behavior;
- authentication or network isolation requires a separate trust boundary; or
- reliability targets require isolating MCP failures from the web application.

Extraction must preserve the application-service contracts rather than
reimplementing business rules in the new service.

## Consequences

### Positive

- The first releases use one deployment and one application-service boundary.
- Web and MCP behavior can share validation, authorization, idempotency, and
  audit rules without network duplication.
- The independent domain and application modules provide a deliberate path to
  later service extraction.

### Negative

- Web and MCP adapters initially share deployment resources and a failure
  domain.
- Node-runtime requirements must be considered when selecting hosting.
- Module boundaries require active enforcement; directory placement alone does
  not prevent accidental framework coupling.

### Follow-up constraints

- Milestone 1 tests must prove domain operations run without Next.js or browser
  globals.
- Milestone 3 must route HTTP and UI use cases through the same application
  service.
- Production readiness must test whether the chosen hosting platform satisfies
  Streamable HTTP MCP connection and timeout requirements.
