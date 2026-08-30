# Browser and MCP client support matrix

Last verified: 2026-08-31

## Purpose

This document defines which user and agent surfaces are release requirements
for the MCP system-design workbench. “Supported” means the surface has an
explicit verification gate. “Compatibility” means it should work where its
standards support is sufficient but does not block a release. “Deferred” means
it is intentionally outside the named milestone.

Because browsers, MCP clients, and authentication profiles evolve, revalidate
this matrix before Milestones 7, 9, and 10 are completed.

## Browser matrix

The application uses the Next.js browser floor as an absolute minimum but tests
the current and previous stable major release of each supported desktop browser.

| Surface | Status | Minimum framework floor | Required verification |
| --- | --- | --- | --- |
| Google Chrome desktop | Supported | Chrome 111 | Automated Chromium tests plus current-stable manual smoke test |
| Microsoft Edge desktop | Supported | Edge 111 | Current-stable manual smoke test; Chromium automation supplies the shared engine baseline |
| Mozilla Firefox desktop | Supported | Firefox 111 | Automated Firefox tests plus current-stable manual smoke test |
| Apple Safari desktop | Supported | Safari 16.4 | Automated WebKit tests plus current-stable Safari smoke test when macOS is available |
| Mobile Safari | Compatibility: review first | Modern version with Pointer Events and IndexedDB | View, comment, and review smoke tests; semantic editing does not block the first release |
| Chrome on Android | Compatibility: review first | Modern version with Pointer Events and IndexedDB | View, comment, and review smoke tests; semantic editing does not block the first release |
| Legacy browsers and Internet Explorer | Unsupported | Not applicable | No polyfills or release testing |

### Browser behavior boundaries

- The first release is desktop-first for full diagram authoring.
- Mobile view, review, change-note, and approval flows are compatibility goals.
  Full mobile canvas authoring becomes supported only after dedicated
  multi-touch, gesture, viewport, toolbar, and virtual-keyboard tests exist.
- The existing canvas uses Pointer Events and pointer capture, but zoom/pan also
  relies on wheel and keyboard-oriented interactions. Pointer Events alone are
  not evidence of a complete mobile editing experience.
- IndexedDB is required for durable legacy Board persistence. When unavailable,
  the current in-memory Board remains usable but is session-only. Shared Designs
  introduced later use server persistence.
- Accessibility support is evaluated independently from browser-engine support;
  passing this matrix does not waive keyboard, focus, contrast, or screen-reader
  requirements.

## MCP protocol baseline

| Capability | Requirement |
| --- | --- |
| Primary transport | Remote Streamable HTTP over HTTPS |
| Primary protocol revision | MCP `2026-07-28`, using the stable v2 SDK line |
| Compatibility revision | Negotiate/fall back to the supported 2025-era protocol where the selected SDK permits it |
| Authentication | WorkOS AuthKit OAuth with Protected Resource Metadata, resource-bound access tokens, PKCE, and narrow scopes |
| Client registration | CIMD preferred; DCR enabled only as a compatibility fallback |
| Server mode | Stateless request handling; no business state hidden in MCP sessions |
| Legacy HTTP+SSE | Unsupported for new integrations |
| STDIO | Test/development adapter only; not the production endpoint |

The server must publish protected-resource metadata and return the appropriate
`WWW-Authenticate` challenge. It must validate token signature, issuer,
audience/resource, expiry, and scopes before creating `ActorContext`. Application
permissions remain the final authorization decision.

## MCP client matrix

| Client or host | Status | Milestone gate | Required verification |
| --- | --- | --- | --- |
| ChatGPT desktop app / Codex host | Supported | M7–M8 | Discover server, complete WorkOS OAuth, list tools, read a Design, validate operations, and create a proposal |
| Codex CLI | Supported | M7–M8 | Configure Streamable HTTP server, run OAuth login, execute the same read/write contract, and refresh credentials |
| OpenAI IDE extension | Supported | M7–M8 | Reuse shared Codex MCP configuration, authenticate, and complete read plus proposal smoke tests |
| Official MCP Inspector web/CLI | Required test client | M7 onward | Protocol negotiation, discovery, schemas, invalid-input errors, OAuth challenge, and representative tool calls |
| ChatGPT web | Deferred | M9 | Install the project plugin and verify its bundled remote MCP tools in Chat and Work |
| Other standards-compatible MCP hosts | Compatibility | M10 | Documented best effort after Streamable HTTP, OAuth discovery, CIMD/DCR, and protocol-negotiation checks |
| Clients requiring legacy HTTP+SSE only | Unsupported | None | No compatibility adapter planned |
| WorkOS Agent Registration | Deferred enhancement | Post-M8 evaluation | Availability, pricing, claim ceremony, revocation, audit, and client support must pass before adoption |

The three local Codex surfaces share MCP configuration, but each surface still
gets a smoke test because shared configuration does not prove equivalent user
interaction or credential handling.

## Compatibility rules

- Enable WorkOS CIMD for current clients and DCR only for older clients that
  have not adopted CIMD.
- Configure an exact MCP Resource Indicator and validate the matching token
  audience.
- Provide the current protected-resource metadata endpoint. A proxied legacy
  authorization-server metadata endpoint may be supplied only for documented
  client compatibility; it must not become a second source of truth.
- Do not claim support for a client based only on successful tool discovery.
  OAuth login, token refresh, error handling, read operations, validation, and
  proposal creation must be exercised where the milestone requires them.
- Pin tested client and Inspector versions in verification evidence rather than
  embedding fast-aging versions in this policy.

## Evidence sources

- Local Next.js 16 documentation:
  `frontend/node_modules/next/dist/docs/03-architecture/supported-browsers.md`
- [Official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)
- [WorkOS AuthKit MCP documentation](https://workos.com/docs/authkit/mcp)
- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Official MCP Inspector](https://github.com/modelcontextprotocol/inspector)
