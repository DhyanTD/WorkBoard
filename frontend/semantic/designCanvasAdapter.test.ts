import { describe, expect, it } from "vitest";
import { applyDesignOperations, createCommercePlatformFixture } from "@/domain/design";
import {
  createSemanticCanvasModel,
  deterministicElementLayout,
} from "@/semantic/designCanvasAdapter";
import { setElementRectangleOperation } from "@/semantic/editOperations";

describe("semantic canvas adapter", () => {
  it("renders both fixture views from the same semantic model", () => {
    const document = createCommercePlatformFixture();
    const context = createSemanticCanvasModel(document, "view-commerce-context");
    const containers = createSemanticCanvasModel(
      document,
      "view-commerce-containers",
    );

    expect(context?.elements).toHaveLength(3);
    expect(context?.relationships).toHaveLength(2);
    expect(containers?.elements).toHaveLength(6);
    expect(containers?.relationships).toHaveLength(5);
    expect(containers?.boundaries).toHaveLength(1);
    expect(containers?.annotations).toHaveLength(1);
  });

  it("provides deterministic placement without changing the document", () => {
    const document = createCommercePlatformFixture();
    const view = document.views.find(
      (candidate) => candidate.id === "view-commerce-context",
    );
    if (!view) throw new Error("Fixture context view is missing.");
    const layout = { ...view.layout, elements: { ...view.layout.elements } };
    delete layout.elements["person-customer"];
    const withoutLayout = {
      ...document,
      views: document.views.map((candidate) =>
        candidate.id === view.id ? { ...candidate, layout } : candidate,
      ),
    };

    const first = createSemanticCanvasModel(withoutLayout, view.id);
    const second = createSemanticCanvasModel(withoutLayout, view.id);

    expect(first?.elements[0]?.rectangle).toEqual(second?.elements[0]?.rectangle);
    expect(first?.elements[0]?.rectangle).toEqual(
      deterministicElementLayout("person-customer", 0),
    );
    expect(view.layout.elements["person-customer"]).toBeDefined();
  });

  it("derives connector endpoints again after an element moves", () => {
    const document = createCommercePlatformFixture();
    const before = createSemanticCanvasModel(document, "view-commerce-context");
    const operations = setElementRectangleOperation(
      document,
      "view-commerce-context",
      "system-payment-provider",
      { x: 980, y: 420, width: 220, height: 120 },
    );
    const result = applyDesignOperations(document, operations);
    if (!result.ok) throw new Error(result.errors[0]?.message);
    const after = createSemanticCanvasModel(
      result.document,
      "view-commerce-context",
    );

    const beforeRelationship = before?.relationships.find(
      (item) => item.id === "relationship-commerce-payment",
    );
    const afterRelationship = after?.relationships.find(
      (item) => item.id === "relationship-commerce-payment",
    );
    expect(afterRelationship?.relationship.destinationId).toBe(
      "system-payment-provider",
    );
    expect(afterRelationship?.end).not.toEqual(beforeRelationship?.end);
  });
});
