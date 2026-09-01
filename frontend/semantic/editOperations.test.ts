import { describe, expect, it } from "vitest";
import {
  applyDesignOperations,
  createCommercePlatformFixture,
  type DesignElement,
} from "@/domain/design";
import {
  addElementOperations,
  addRelationshipOperations,
  copyElementOperations,
  deleteElementOperations,
} from "@/semantic/editOperations";

describe("semantic edit operation translation", () => {
  it("adds, connects, copies, and deletes by stable ID", () => {
    const document = createCommercePlatformFixture();
    const element: DesignElement = {
      id: "container-search-index",
      kind: "container",
      name: "Search Index",
      parentId: "system-commerce-platform",
      containerType: "datastore",
    };
    const added = applyDesignOperations(
      document,
      addElementOperations(document, "view-commerce-containers", element),
    );
    if (!added.ok) throw new Error(added.errors[0]?.message);

    const connected = applyDesignOperations(
      added.document,
      addRelationshipOperations(added.document, "view-commerce-containers", {
        id: "relationship-api-search",
        sourceId: "container-order-api",
        destinationId: element.id,
        description: "Indexes orders",
      }),
    );
    if (!connected.ok) throw new Error(connected.errors[0]?.message);

    const copy = copyElementOperations(
      connected.document,
      "view-commerce-containers",
      element,
    );
    const copied = applyDesignOperations(connected.document, copy.operations);
    if (!copied.ok) throw new Error(copied.errors[0]?.message);
    expect(copy.elementId).not.toBe(element.id);
    expect(copied.document.elements.some((item) => item.id === copy.elementId)).toBe(
      true,
    );

    const deletion = deleteElementOperations(copied.document, element.id);
    expect(deletion).not.toBeNull();
    const deleted = applyDesignOperations(copied.document, deletion ?? []);
    if (!deleted.ok) throw new Error(deleted.errors[0]?.message);
    expect(deleted.document.elements.some((item) => item.id === element.id)).toBe(
      false,
    );
    expect(
      deleted.document.relationships.some(
        (item) => item.id === "relationship-api-search",
      ),
    ).toBe(false);
  });

  it("protects an element that still owns architectural content", () => {
    const document = createCommercePlatformFixture();
    expect(deleteElementOperations(document, "system-commerce-platform")).toBeNull();
  });
});
