# MCP system-design verification contract

Last updated: 2026-08-31

## Purpose

This document assigns a stable repository command to every verification layer
required by the MCP system-design roadmap. It is a command contract, not a
claim that every command exists today. Milestones must add the named scripts as
their corresponding behavior is introduced and record the command result in
the progress tracker.

Run commands from `frontend/`. `pnpm` is the canonical package runner for this
repository.

## Commands available today

| Command | Purpose | Current status |
| --- | --- | --- |
| `pnpm lint` | ESLint checks | Available |
| `pnpm typecheck` | Strict TypeScript check | Available; stable alias introduced in M1 |
| `pnpm build` | Next.js production build | Available |
| `pnpm test:storage` | Version-1 Dexie/IndexedDB and persisted-store regression contract | Available; 9 characterization tests established in M0.7 |
| `pnpm test:domain` | Design document, operations, validation, fixture, diff, and serialization contract | Available; M1 domain suite |
| `pnpm test:components` | Semantic adapters/store, React workbench, annotations, and legacy Board behavior | Available; M2 suite, 8 files / 15 tests |
| `pnpm test:api` | Application service, authorization, HTTP contracts, and typed client integration | Available; M3 suite, 2 files / 6 tests |
| `pnpm test:e2e` | Production browser journeys in Chromium, Firefox, and WebKit | Available; M2 suite, 2 journeys per engine |
| `pnpm verify` | Lint, type-check, implemented suites, production build, and browser matrix | Available; introduced in M2 |

The repository now contains Vitest environments for domain, storage,
component, and API coverage plus Playwright production-build journeys. The MCP
contract-test harness remains future work; do not report `test:mcp` as passing
until Milestone 7 introduces it.

## Required stable command names

| Command | Required scope | Introduced by |
| --- | --- | --- |
| `pnpm typecheck` | Run `tsc --noEmit` with the repository's strict configuration | M1 |
| `pnpm test:domain` | Pure design types, operations, validation, serialization, deterministic diffing, and shared fixture invariants in a Node environment | M1 |
| `pnpm test:storage` | Dexie adapter, schema-version behavior, legacy local-storage migration, serialized writes, and legacy conversion safeguards | M0.7 initially; extended in M2 and M4 |
| `pnpm test:components` | Semantic canvas, review UI, accessibility-facing interactions, and adapter behavior in a browser-like DOM | M2 |
| `pnpm test:api` | Application-service and HTTP contract tests, including authentication, authorization, idempotency, concurrency, and stable error bodies | M3 initially; extended in M4–M6 |
| `pnpm test:mcp` | MCP negotiation, discovery, JSON schemas, OAuth challenges, tool authorization, valid calls, and invalid-input errors | M7 initially; extended in M8 |
| `pnpm test:e2e` | Production-build browser journeys in Chromium, Firefox, and WebKit | M2 initially; release gate in M6, M8, and M10 |
| `pnpm verify` | Lint, type-check, all implemented non-E2E suites, production build, and the E2E suite | M2, after all constituent commands exist |

Milestones may add narrower watch or debugging commands, but they must not
replace these stable CI-facing names.

## Test-tool boundaries

- Use Vitest in its Node environment for pure domain and service-level tests.
- Use Vitest with a DOM environment and React Testing Library for component
  behavior. Async Server Component behavior belongs in end-to-end tests rather
  than component tests.
- Use Playwright against a production build for user journeys and the required
  Chromium, Firefox, and WebKit engine matrix.
- Use an IndexedDB test implementation for deterministic storage adapter tests,
  then retain at least one Playwright journey against a real browser IndexedDB
  implementation.
- Use the official MCP Inspector CLI as one part of `test:mcp`. Direct protocol
  tests must still assert application-specific schemas, permissions, errors,
  and idempotency behavior.
- Pin the reviewed version of a test dependency when it is introduced. Record
  tested browser, MCP client, protocol, and Inspector versions in evidence
  rather than in this long-lived command contract.

## Milestone gates

| Milestone | Minimum verification gate |
| --- | --- |
| M0 | Current lint, type-check, and build commands remain available; the storage regression fixture passes |
| M1 | `test:domain`, `typecheck`, and `lint` pass |
| M2 | `test:domain`, `test:storage`, `test:components`, `test:e2e`, `typecheck`, `lint`, and `build` pass |
| M3 | `test:domain`, `test:api`, `typecheck`, `lint`, and `build` pass |
| M4–M6 | All implemented domain, storage, component, API, and E2E suites pass; Dhyan-owned migration status is recorded separately |
| M7 | `test:mcp` read/validation contract plus the M7 application suites pass |
| M8 | Full MCP proposal/feedback contract, API, workflow, and supported-client smoke tests pass |
| M9 | Plugin and ChatGPT web checks pass when this optional milestone is undertaken |
| M10 | `verify` and the complete support-matrix release evidence pass |

## Verification evidence format

For a milestone gate, record:

- date and commit or working-tree reference;
- exact command;
- relevant test-runner, browser, MCP protocol/client, or Inspector version;
- exit status and pass/fail/skip totals;
- intentional exclusions or environmental skips;
- artifact path or CI link when one exists;
- migration handoff status when database entities changed.

A missing command, skipped required target, or unrecorded failing test leaves the
gate open. A documentation-only milestone may record that product suites were
not yet present, but must not present that absence as a passing test result.

## Operational caveats

- `pnpm build` does not replace the explicit type-check or test commands.
- Browser automation does not replace the current-stable Edge and Safari smoke
  checks defined in the support matrix.
- MCP tool discovery alone does not establish support; authentication, reads,
  validation, writes, errors, and refresh behavior must be exercised where the
  milestone requires them.
- Database migrations remain Dhyan's responsibility and are never generated or
  changed by implementation agents.
- Playwright downloads a fallback Ubuntu WebKit build on Fedora. The local
  engine needs compatible ICU 74 and JPEG 8 libraries and skips Playwright's
  Ubuntu package-name preflight; actual browser launch remains required. CI
  should use Playwright's supported Linux image or install its documented host
  dependencies.
