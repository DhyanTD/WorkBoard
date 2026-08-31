import { describe, expect, it } from "vitest";
import {
  applyDesignOperations,
  createEmptyDesignDocument,
  type ApplyDesignOperationsResult,
} from "@/domain/design/applyOperations";
import { diffDesignDocuments } from "@/domain/design/diffDesign";
import {
  createCommercePlatformFixture,
  createCommercePlatformInitialDocument,
  createCommercePlatformOperations,
} from "@/domain/design/fixtures";
import { createProductionId, createTestId } from "@/domain/design/identifiers";
import type { DesignDocument, DesignView } from "@/domain/design/types";
import { validateDesignDocument } from "@/domain/design/validateDesign";

const expectSuccess = (result: ApplyDesignOperationsResult) => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join(" "));
  }
  return result;
};

const getView = (document: DesignDocument, viewId: string): DesignView => {
  const view = document.views.find((candidate) => candidate.id === viewId);
  if (!view) throw new Error(`Fixture View '${viewId}' is missing.`);
  return view;
};

describe("Commerce Platform fixture", () => {
  it("is created entirely through operations and validates without warnings", () => {
    const result = expectSuccess(
      applyDesignOperations(
        createCommercePlatformInitialDocument(),
        createCommercePlatformOperations(),
      ),
    );

    expect(result.document).toEqual(createCommercePlatformFixture());
    expect(result.warnings).toEqual([]);
    expect(validateDesignDocument(result.document)).toEqual({
      ok: true,
      warnings: [],
    });
    expect(result.changedIds).toContain("container-order-api");
    expect(result.changedIds).toContain("annotation-review-payment-timeout");
  });

  it("round-trips the fixture through JSON without losing supported fields", () => {
    const fixture = createCommercePlatformFixture();
    const serialized = JSON.stringify(fixture);
    const restored = JSON.parse(serialized) as DesignDocument;

    expect(restored).toEqual(fixture);
    expect(validateDesignDocument(restored)).toEqual({ ok: true, warnings: [] });
  });
});

describe("Design operations", () => {
  it("adds, updates, and removes every supported record category explicitly", () => {
    const initial = createEmptyDesignDocument("design-operation-test", {
      name: "Operation test",
      assumptions: [],
      decisions: [],
    });
    const added = expectSuccess(
      applyDesignOperations(initial, [
        {
          kind: "add-element",
          element: {
            id: "system-owned",
            kind: "software-system",
            name: "Owned system",
            external: false,
          },
        },
        {
          kind: "add-element",
          element: {
            id: "system-external",
            kind: "software-system",
            name: "External system",
            external: true,
          },
        },
        {
          kind: "add-element",
          element: {
            id: "container-api",
            kind: "container",
            name: "API",
            parentId: "system-owned",
            containerType: "application",
          },
        },
        {
          kind: "add-relationship",
          relationship: {
            id: "relationship-api-external",
            sourceId: "container-api",
            destinationId: "system-external",
            description: "Calls external system",
          },
        },
        {
          kind: "add-boundary",
          boundary: {
            id: "boundary-owned",
            name: "Owned system",
            ownerSystemId: "system-owned",
            elementIds: ["container-api"],
          },
        },
        {
          kind: "add-view",
          view: {
            id: "view-container",
            kind: "container",
            name: "Container view",
            systemId: "system-owned",
            elementIds: ["container-api", "system-external"],
            relationshipIds: ["relationship-api-external"],
            boundaryIds: ["boundary-owned"],
            layout: {
              elements: {
                "container-api": { x: 10, y: 20, width: 200, height: 100 },
                "system-external": { x: 320, y: 20, width: 200, height: 100 },
              },
              boundaries: {
                "boundary-owned": { x: 0, y: 0, width: 280, height: 200 },
              },
            },
          },
        },
        {
          kind: "add-annotation",
          annotation: {
            id: "annotation-legacy",
            kind: "legacy-stroke",
            viewId: "view-container",
            stroke: {
              id: "legacy-stroke-1",
              tool: "arrow",
              color: "#000000",
              lineWidth: 4,
              points: [
                { x: 210, y: 70 },
                { x: 320, y: 70 },
              ],
              bounds: { minX: 210, minY: 58, maxX: 320, maxY: 82 },
              startBindingId: "legacy-a",
              endBindingId: "legacy-b",
            },
          },
        },
      ]),
    );

    const updated = expectSuccess(
      applyDesignOperations(added.document, [
        {
          kind: "update-element",
          element: {
            id: "container-api",
            kind: "container",
            name: "Ordering API",
            parentId: "system-owned",
            containerType: "application",
          },
        },
        {
          kind: "update-relationship",
          relationship: {
            id: "relationship-api-external",
            sourceId: "container-api",
            destinationId: "system-external",
            description: "Reads external inventory",
            technology: "HTTPS/JSON",
          },
        },
        {
          kind: "update-boundary",
          boundary: {
            id: "boundary-owned",
            name: "Owned Platform",
            ownerSystemId: "system-owned",
            elementIds: ["container-api"],
          },
        },
        {
          kind: "update-view",
          view: {
            ...getView(added.document, "view-container"),
            name: "Owned Platform containers",
          },
        },
        {
          kind: "set-view-layout",
          viewId: "view-container",
          layout: {
            ...getView(added.document, "view-container").layout,
            elements: {
              ...getView(added.document, "view-container").layout.elements,
              "container-api": { x: 20, y: 20, width: 200, height: 100 },
            },
          },
        },
        {
          kind: "update-design-metadata",
          metadata: {
            name: "Operation test updated",
            assumptions: ["External inventory remains outside the design boundary."],
            decisions: [
              {
                id: "decision-inventory",
                statement: "The API reads external inventory synchronously.",
              },
            ],
          },
        },
      ]),
    );

    const beforeRemovalView = getView(updated.document, "view-container");
    const removed = expectSuccess(
      applyDesignOperations(updated.document, [
        {
          kind: "remove-annotation",
          annotationId: "annotation-legacy",
          expectedDependentIds: [],
        },
        {
          kind: "update-view",
          view: {
            ...beforeRemovalView,
            elementIds: ["system-external"],
            relationshipIds: [],
            boundaryIds: [],
            layout: {
              elements: {
                "system-external": beforeRemovalView.layout.elements["system-external"],
              },
              boundaries: {},
            },
          },
        },
        {
          kind: "remove-relationship",
          relationshipId: "relationship-api-external",
          expectedDependentIds: [],
        },
        {
          kind: "update-boundary",
          boundary: {
            id: "boundary-owned",
            name: "Owned Platform",
            ownerSystemId: "system-owned",
            elementIds: [],
          },
        },
        {
          kind: "remove-boundary",
          boundaryId: "boundary-owned",
          expectedDependentIds: [],
        },
        {
          kind: "remove-element",
          elementId: "container-api",
          expectedDependentIds: [],
        },
        {
          kind: "remove-view",
          viewId: "view-container",
          expectedDependentIds: [],
        },
      ]),
    );

    expect(removed.document.elements.map((element) => element.id)).toEqual([
      "system-owned",
      "system-external",
    ]);
    expect(removed.document.relationships).toEqual([]);
    expect(removed.document.boundaries).toEqual([]);
    expect(removed.document.views).toEqual([]);
    expect(removed.document.annotations).toEqual([]);
  });

  it("rejects duplicate IDs and dangling relationships atomically", () => {
    const initial = createEmptyDesignDocument("design-atomic-test", {
      name: "Atomic test",
      assumptions: [],
      decisions: [],
    });
    const before = JSON.stringify(initial);
    const result = applyDesignOperations(initial, [
      {
        kind: "add-element",
        element: {
          id: "system-a",
          kind: "software-system",
          name: "System A",
          external: false,
        },
      },
      {
        kind: "add-element",
        element: {
          id: "system-a",
          kind: "software-system",
          name: "System A duplicate",
          external: false,
        },
      },
      {
        kind: "add-relationship",
        relationship: {
          id: "relationship-missing",
          sourceId: "system-a",
          destinationId: "missing-system",
          description: "Cannot be applied",
        },
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toEqual(
        expect.arrayContaining(["duplicate-id", "missing-reference"]),
      );
    }
    expect(JSON.stringify(initial)).toBe(before);
  });

  it("requires the exact current dependency declaration before removal", () => {
    const fixture = createCommercePlatformFixture();
    const result = applyDesignOperations(fixture, [
      {
        kind: "remove-element",
        elementId: "container-order-api",
        expectedDependentIds: [],
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        code: "dependency-mismatch",
        targetId: "container-order-api",
      });
      expect(result.errors[0].message).toContain("relationship-web-api");
      expect(result.errors[0].message).toContain("view-commerce-containers");
    }
  });
});

describe("Validation and diffing", () => {
  it("rejects invalid abstraction levels, containment, and non-finite layout", () => {
    const fixture = createCommercePlatformFixture();
    const context = getView(fixture, "view-commerce-context");
    const invalid: DesignDocument = {
      ...fixture,
      elements: fixture.elements.map((element) =>
        element.id === "container-order-db" && element.kind === "container"
          ? { ...element, parentId: "container-web-app" }
          : element,
      ),
      views: fixture.views.map((view) =>
        view.id === context.id
          ? {
              ...context,
              elementIds: [...context.elementIds, "container-order-api"],
              layout: {
                ...context.layout,
                elements: {
                  ...context.layout.elements,
                  "container-order-api": {
                    x: Number.NaN,
                    y: 0,
                    width: 10,
                    height: 10,
                  },
                },
              },
            }
          : view,
      ),
    };

    const validation = validateDesignDocument(invalid);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.map((error) => error.code)).toEqual(
        expect.arrayContaining([
          "invalid-containment",
          "invalid-view",
          "invalid-layout",
        ]),
      );
    }
  });

  it("reports semantic updates and layout movement without relying on document array order", () => {
    const fixture = createCommercePlatformFixture();
    const containerView = getView(fixture, "view-commerce-containers");
    const changed = expectSuccess(
      applyDesignOperations(fixture, [
        {
          kind: "update-element",
          element: {
            id: "container-order-api",
            kind: "container",
            name: "Ordering API",
            description: "Validates orders and coordinates payment and persistence.",
            parentId: "system-commerce-platform",
            containerType: "application",
          },
        },
        {
          kind: "set-view-layout",
          viewId: containerView.id,
          layout: {
            ...containerView.layout,
            elements: {
              ...containerView.layout.elements,
              "container-order-db": { x: 920, y: 120, width: 210, height: 140 },
            },
          },
        },
      ]),
    );

    expect(changed.diff.semantic.elements.updatedIds).toEqual([
      "container-order-api",
    ]);
    expect(changed.diff.presentation.movedElementIds).toEqual([
      "container-order-db",
    ]);
    expect(changed.diff.semantic.relationships.updatedIds).toEqual([]);

    const reordered: DesignDocument = {
      ...fixture,
      elements: [...fixture.elements].reverse(),
      relationships: [...fixture.relationships].reverse(),
      boundaries: [...fixture.boundaries].reverse(),
      views: [...fixture.views].reverse(),
      annotations: [...fixture.annotations].reverse(),
    };
    const orderOnlyDiff = diffDesignDocuments(fixture, reordered);
    expect(orderOnlyDiff.semantic.elements).toEqual({
      addedIds: [],
      updatedIds: [],
      removedIds: [],
    });
    expect(orderOnlyDiff.presentation.views).toEqual({
      addedIds: [],
      updatedIds: [],
      removedIds: [],
    });
  });
});

describe("Identifier helpers", () => {
  it("creates deterministic test IDs and collision-resistant production IDs", () => {
    expect(createTestId("commerce", "container", "api")).toBe(
      createTestId("commerce", "container", "api"),
    );
    expect(createTestId("commerce-container", "api")).not.toBe(
      createTestId("commerce", "container-api"),
    );
    const first = createProductionId("Design Revision");
    const second = createProductionId("Design Revision");
    expect(first).toMatch(/^design-revision_/);
    expect(second).toMatch(/^design-revision_/);
    expect(first).not.toBe(second);
  });
});
