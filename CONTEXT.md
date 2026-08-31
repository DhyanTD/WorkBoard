# Open WorkBoard domain context

Status: Active

This file is the canonical source for confirmed domain language. Terms are
added when they are resolved. Proposed terms in planning documents are not
canonical until they appear here.

## Product context

Open WorkBoard is evolving from a freeform drawing board into a collaborative
system-design workbench. A semantic system design can be created or revised by
people and agents, reviewed by people, and presented through multiple diagram
views without changing the meaning of the underlying architecture.

## Confirmed initial diagram vocabulary

| Term | Meaning |
| --- | --- |
| Element | A stable semantic node in a system design. The initial kinds are person, software system, and container. |
| Person | A human role or persona that uses or interacts with a software system. It is not an application user account. |
| Software system | The highest-level software boundary modeled in the initial vocabulary. It may be owned by the design's organization or marked external. |
| External software system | A software system outside the modeled ownership or change boundary. “External system” is a classification, not a separate element kind. |
| Container | A separately runnable or deployable application or data-bearing unit inside a software system. It does not mean an operating-system or Docker container. |
| Datastore | A container specialization whose primary responsibility is persistent data storage. It is not a separate top-level element kind. |
| Queue | A container specialization whose primary responsibility is asynchronous message transport or buffering. It is not a separate top-level element kind. |
| Relationship | A directed semantic interaction between two elements, including its purpose and optional technology or protocol. |
| Boundary | A semantic ownership or scope grouping. It is not merely a visual box. |
| View | A diagram over a selected part of the shared semantic model. Layout and presentation belong to the view. |
| System-context view | A C4-style view centered on one software system, the people who use it, and the external software systems it interacts with. |
| Container view | A C4-style view of the containers inside one software system and their interactions with people and external systems. |
| Annotation | Freehand, text, or other visual markup that does not change the semantic architecture model. |
| Design operation | A typed, explicit requested change to a Design document. Operations are applied as one atomic batch or not at all. |
| Dependency declaration | The complete list of current direct references an author expects before removing a semantic record. It prevents a removal from silently deleting relationships, view references, or boundary membership. |
| Semantic diff | An order-independent comparison of two Design documents that separates architecture changes from view-layout movement and annotation changes. |

## Confirmed abstraction rules

- The first semantic release supports only system-context and container views.
- A system-context view does not expose the target software system's internal
  containers.
- A container view belongs to one software system and may reference people or
  external systems for context.
- Datastores and queues participate in relationships as containers.
- Freeform board content remains available as annotations and does not create
  semantic elements implicitly.
- Component, deployment, dynamic, data-flow, and custom semantic views are
  deferred. Their names are reserved but their semantics are not yet defined.

## Confirmed collaboration and review vocabulary

| Term | Meaning |
| --- | --- |
| Workspace | The Open WorkBoard collaboration and ownership boundary for designs, members, and permissions. It may map to a WorkOS Organization, but the two are not the same domain concept. |
| Board | The legacy freeform drawing surface and its browser-local stroke data. A Board is not a semantic Design. |
| Design | The product-level record that people and agents collaborate on inside a Workspace. |
| Design document | The versioned content of a Design: semantic model, views, annotations, and document metadata. |
| Revision | An immutable accepted snapshot of a Design document. |
| Accepted head | The latest merged Revision of a Design. |
| Change proposal | A reviewable set of operations based on a specific Revision. It does not modify the Accepted head. |
| Proposal version | An immutable iteration of a Change proposal. |
| Review thread | A discussion anchored to a Change proposal, Element, Relationship, View, or whole Design. |
| Change note | A reviewer-requested change inside a Review thread. |
| Addressed | The proposal author or agent claims that a Change note has been handled. |
| Resolved | A reviewer confirms that a Change note has been handled. |
| Actor | A human, agent, or service performing an operation through a provider-neutral identity context. |

## Confirmed workflow rules

- Board, Design, Design document, Revision, and Change proposal are distinct
  concepts and must not be used interchangeably.
- Accepted Design content changes only by merging a Change proposal into a new
  immutable Revision and moving the Accepted head.
- Every Change proposal is based on an explicit Revision.
- Editing a proposal creates a new Proposal version; it does not rewrite a
  previously reviewed version.
- An author or agent may mark a Change note Addressed but cannot mark its own
  note Resolved. Reviewer confirmation is required for resolution.
- Identity-provider organization membership alone does not grant access to a
  Workspace or Design; application permissions remain authoritative.
