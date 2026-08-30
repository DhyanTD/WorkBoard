# ADR 0004: Use WorkOS AuthKit for user and MCP authentication

- Status: Accepted
- Date: 2026-08-31
- Decision owner: Dhyan
- Related gate: D4 in the
  [implementation plan](../../documentation/MCP_SYSTEM_DESIGN_IMPLEMENTATION_PLAN.md)

## Context

Open WorkBoard needs browser authentication for human collaborators and OAuth
authorization for remote MCP clients acting on a user's behalf. The provider
must support discoverable OAuth metadata, scoped tokens, user consent, and a
path toward organization-aware agent access without embedding provider-specific
objects in the domain model.

Clerk and WorkOS AuthKit were compared. Both support browser authentication and
MCP-compatible OAuth. WorkOS was selected because its published AuthKit model
aligns with multi-workspace collaboration, its standard MCP OAuth support is a
core capability, and its optional Agent Registration flow provides a future
path for claimed or service-bound agent identities.

At the time of this decision, WorkOS publishes AuthKit as free for the first one
million monthly active users and does not publish a per-organization charge.
Enterprise SSO and Directory Sync are charged per connection, and a custom
AuthKit domain has a separate monthly cost. These prices are operational
context, not fixed architectural guarantees, and must be rechecked before
production launch.

## Decision

Use WorkOS AuthKit as:

- the identity and browser-session provider for human users; and
- the OAuth authorization server for the remote MCP protected resource.

Apply the following boundaries:

- Verify WorkOS sessions or access tokens only at delivery adapters, then map
  their concrete claims into an application-owned `ActorContext`.
- `ActorContext` contains stable application concepts such as actor ID,
  workspace ID, authentication method, granted scopes, and agent delegation;
  it must not expose WorkOS SDK or token types.
- Link a WorkOS user identifier to an Open WorkBoard user record. Link a WorkOS
  organization identifier to an Open WorkBoard workspace where organization
  login is used.
- Do not use “WorkOS Organization” and “Workspace” interchangeably. The former
  is an identity-provider tenant; the latter owns designs, revisions,
  proposals, reviews, and application permissions.
- PostgreSQL workspace membership and resource permissions remain
  authoritative for application actions. Token scopes provide a coarse upper
  bound; every use case must still perform workspace- and resource-level
  authorization.
- Use standard OAuth authorization for the first remote MCP release, including
  protected-resource discovery, user consent, resource-bound tokens, PKCE, and
  narrow scopes.
- Treat WorkOS Agent Registration as optional. It may be evaluated for
  anonymous discovery or claimed agent identity only after enablement,
  production pricing, revocation, audit, and client-compatibility checks pass.
- Do not depend on early-access Cross App Access or Agent Registration for the
  initial production release.
- An explicit development actor may be used locally before Milestone 4, but it
  must be impossible to enable silently in production.

Initial MCP scopes should stay coarse and capability-oriented, such as design
read, proposal write, review read, and proposal submit. Application permissions
remain the final authorization decision.

## Consequences

### Positive

- Browser users and MCP clients share one identity provider and consent model.
- WorkOS handles OAuth authorization-server behavior while Open WorkBoard owns
  domain authorization.
- Provider-neutral `ActorContext` and external-ID mappings preserve a migration
  path to another identity provider.
- Optional agent-specific identity can be evaluated without blocking standard
  MCP interoperability.

### Negative

- Authentication availability and some future agent capabilities depend on a
  hosted provider.
- WorkOS organization and application workspace state must be synchronized and
  audited carefully.
- Custom domains, enterprise SSO, Directory Sync, and future Agent Registration
  availability may add cost.
- Standard OAuth consent remains necessary for the first agent workflow even if
  later WorkOS capabilities reduce that interaction.

### Follow-up constraints

- Milestone 3 must define `ActorContext` and application authorization ports
  without WorkOS imports.
- Milestone 4 must test user/workspace mappings, token validation, revocation
  behavior, and denial when token scope and application permission disagree.
- Milestone 7 must expose public protected-resource metadata and test at least
  one supported MCP client's complete OAuth flow.
- WorkOS pricing, MCP client compatibility, and Agent Registration availability
  must be revalidated before production launch.
- Any later entity changes stop at a migration handoff; Dhyan owns migration
  generation and registration.

## References

- [WorkOS MCP Auth](https://workos.com/mcp)
- [WorkOS AuthKit MCP documentation](https://workos.com/docs/authkit/mcp)
- [WorkOS Agent Registration](https://workos.com/docs/authkit/agent-auth)
- [WorkOS users and organizations](https://workos.com/docs/authkit/users-organizations)
- [WorkOS pricing](https://workos.com/pricing)
