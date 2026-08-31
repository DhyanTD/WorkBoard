# Shared system-design fixture

Fixture key: `commerce-platform-review-v1`

## Purpose

Every milestone uses this same small design to test domain rules, rendering,
API and MCP contracts, revisions, proposals, review notes, authorization, and
exports. IDs and expected meanings are stable. Milestone 1 encodes this
specification as typed fixtures and operation batches in
`frontend/domain/design/fixtures.ts`; later milestones must not silently rename
IDs or change the expected topology.

The fixture describes an online commerce platform used by a customer and
connected to an external payment provider. The platform contains a web app, an
order API, a datastore, and an event queue.

## Stable record IDs

| Record | ID |
| --- | --- |
| Workspace | `workspace-acme` |
| Design | `design-commerce-platform` |
| Initial accepted revision | `revision-commerce-v1` |
| System-context view | `view-commerce-context` |
| Container view | `view-commerce-containers` |
| Software-system boundary | `boundary-commerce-platform` |

Production IDs will use the project's collision-safe identifier strategy.
These readable IDs are reserved for deterministic tests, examples, and evals.

## Elements

| ID | Kind | Name | Classification / parent | Description |
| --- | --- | --- | --- | --- |
| `person-customer` | Person | Customer | External actor | Browses products and places orders. |
| `system-commerce-platform` | Software system | Commerce Platform | Owned target system | Provides the online ordering experience. |
| `system-payment-provider` | Software system | Payment Provider | External software system | Authorizes and captures card payments. |
| `container-web-app` | Container | Web Application | Application inside `system-commerce-platform` | Browser-facing customer experience. |
| `container-order-api` | Container | Order API | Application inside `system-commerce-platform` | Validates orders and coordinates payment and persistence. |
| `container-order-db` | Container | Order Database | Datastore inside `system-commerce-platform` | Stores orders and payment references. |
| `container-order-events` | Container | Order Events | Queue inside `system-commerce-platform` | Buffers order-created events for asynchronous consumers. |

The datastore and queue are Container specializations. The Payment Provider is
a Software system marked external, not a separate element kind.

## Boundary

`boundary-commerce-platform` represents the Commerce Platform software-system
boundary. It contains the four container elements and appears only in the
Container view. It is semantic containment, not a decorative rectangle.

## Relationships

| ID | Source | Destination | Purpose | Technology / protocol |
| --- | --- | --- | --- | --- |
| `relationship-customer-commerce` | `person-customer` | `system-commerce-platform` | Browses products and places orders | HTTPS |
| `relationship-commerce-payment` | `system-commerce-platform` | `system-payment-provider` | Processes customer payments | HTTPS/JSON |
| `relationship-customer-web` | `person-customer` | `container-web-app` | Uses the ordering interface | HTTPS |
| `relationship-web-api` | `container-web-app` | `container-order-api` | Submits and reads orders | HTTPS/JSON |
| `relationship-api-db` | `container-order-api` | `container-order-db` | Reads and writes order data | PostgreSQL protocol |
| `relationship-api-payment` | `container-order-api` | `system-payment-provider` | Authorizes and captures payment | HTTPS/JSON |
| `relationship-api-events` | `container-order-api` | `container-order-events` | Publishes order-created events | AMQP |

Relationships are directed. Their purpose is semantic content; connector paths
and bend points belong to individual Views.

## Views

### System-context view

ID: `view-commerce-context`

Included elements:

- `person-customer`
- `system-commerce-platform`
- `system-payment-provider`

Included relationships:

- `relationship-customer-commerce`
- `relationship-commerce-payment`

Expected layout:

| Element | X | Y | Width | Height |
| --- | ---: | ---: | ---: | ---: |
| `person-customer` | 80 | 220 | 180 | 120 |
| `system-commerce-platform` | 380 | 200 | 240 | 160 |
| `system-payment-provider` | 760 | 220 | 220 | 120 |

The context view must not reveal the Commerce Platform's containers.

### Container view

ID: `view-commerce-containers`

Included elements:

- `person-customer`
- `container-web-app`
- `container-order-api`
- `container-order-db`
- `container-order-events`
- `system-payment-provider`

Included relationships:

- `relationship-customer-web`
- `relationship-web-api`
- `relationship-api-db`
- `relationship-api-payment`
- `relationship-api-events`

Expected layout:

| Element | X | Y | Width | Height |
| --- | ---: | ---: | ---: | ---: |
| `person-customer` | 40 | 260 | 180 | 120 |
| `container-web-app` | 310 | 240 | 210 | 140 |
| `container-order-api` | 610 | 240 | 210 | 140 |
| `container-order-db` | 910 | 100 | 210 | 140 |
| `container-order-events` | 910 | 390 | 210 | 140 |
| `system-payment-provider` | 1240 | 240 | 220 | 120 |

Expected boundary layout:

| Boundary | X | Y | Width | Height |
| --- | ---: | ---: | ---: | ---: |
| `boundary-commerce-platform` | 270 | 50 | 900 | 540 |

The Person and external Payment Provider appear outside the boundary.

## Annotation seed

Add one non-semantic text annotation to the Container view:

| ID | Text | X | Y |
| --- | --- | ---: | ---: |
| `annotation-review-payment-timeout` | Review payment timeout and retry behavior | 1180 | 430 |

Removing or changing this annotation must not change the semantic model diff.

## Reusable change scenarios

| Scenario | Input | Expected result |
| --- | --- | --- |
| Valid metadata edit | Rename `container-order-api` to “Ordering API” | One updated Element; relationships and IDs remain stable |
| Valid layout edit | Move `container-order-db` in the Container view | View-layout diff only; no semantic Element update |
| Valid additive change | Add an external Fulfilment Provider and one API relationship | Atomic success with one Element and one Relationship added |
| Invalid dangling relationship | Point `relationship-api-payment` at a missing element ID | Validation failure and no partial document result |
| Invalid abstraction level | Include `container-order-api` in the System-context view | Validation failure |
| Invalid containment | Parent `container-order-db` under `container-web-app` | Validation failure |
| Guarded deletion | Remove `container-order-api` without acknowledging its dependent relationships | Validation failure listing every dependency |
| Annotation-only edit | Change `annotation-review-payment-timeout` text | Annotation diff only |
| Stale proposal | Base a proposal on `revision-commerce-v1` after accepted head advances | Merge conflict until explicit rebase succeeds |
| Review lifecycle | Agent marks a Change note Addressed | Note remains unresolved until a reviewer resolves it |

## Fixture invariants

- All IDs are unique and stable.
- Every relationship endpoint exists.
- Every Container belongs directly to `system-commerce-platform`.
- Both views reference only existing model records.
- The System-context view contains no Containers.
- The Container view includes the boundary and all four Containers.
- Layout values are finite numbers and belong to their View.
- Semantic and annotation changes remain distinguishable.
- Applying the same idempotency key to the same operation does not create a
  second revision or proposal version.
