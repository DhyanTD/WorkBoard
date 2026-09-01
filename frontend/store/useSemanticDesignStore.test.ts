import { beforeEach, describe, expect, it } from "vitest";
import { createCommercePlatformFixture } from "@/domain/design";
import { useSemanticDesignStore } from "@/store/useSemanticDesignStore";

const resetSemanticStore = () => {
  const document = createCommercePlatformFixture();
  useSemanticDesignStore.setState({
    document,
    currentRevisionId: "revision-test",
    activeViewId: "view-commerce-containers",
    selectedElementId: null,
    selectedRelationshipId: null,
    connectionSourceId: null,
    clipboardElement: null,
    past: [],
    future: [],
    mode: "select",
    status: "ready",
    message: null,
    issues: [],
    scale: 1,
    offset: { x: 0, y: 0 },
  });
};

describe("semantic design store", () => {
  beforeEach(resetSemanticStore);

  it("keeps transient editing state outside the DesignDocument", () => {
    const original = structuredClone(useSemanticDesignStore.getState().document);
    const store = useSemanticDesignStore.getState();

    store.setMode("pan");
    store.panBy({ x: 42, y: -12 });
    store.zoomBy(1.15);
    store.selectElement("container-order-api");

    const state = useSemanticDesignStore.getState();
    expect(state.document).toEqual(original);
    expect(state.offset).toEqual({ x: 42, y: -12 });
    expect(state.scale).toBeCloseTo(1.15);
    expect(state.selectedElementId).toBe("container-order-api");
  });

  it("applies semantic editing actions with undo and redo", () => {
    const initialCount = useSemanticDesignStore.getState().document?.elements.length ?? 0;
    useSemanticDesignStore.getState().addElement("datastore");
    const addedState = useSemanticDesignStore.getState();
    const addedId = addedState.selectedElementId;
    expect(addedState.document?.elements).toHaveLength(initialCount + 1);
    expect(addedId).toBeTruthy();
    if (!addedId) throw new Error("Added element ID is missing.");

    addedState.updateSelectedElement({
      name: "Product index",
      responsibilities: ["Indexes searchable products"],
    });
    useSemanticDesignStore.getState().moveElement(addedId, {
      x: 150,
      y: 640,
      width: 260,
      height: 150,
    });
    useSemanticDesignStore.getState().copySelectedElement();
    useSemanticDesignStore.getState().pasteElement();
    expect(useSemanticDesignStore.getState().document?.elements).toHaveLength(
      initialCount + 2,
    );

    useSemanticDesignStore.getState().undo();
    expect(useSemanticDesignStore.getState().document?.elements).toHaveLength(
      initialCount + 1,
    );
    useSemanticDesignStore.getState().redo();
    expect(useSemanticDesignStore.getState().document?.elements).toHaveLength(
      initialCount + 2,
    );
  });

  it("creates stable-ID relationships and non-semantic annotations", () => {
    const store = useSemanticDesignStore.getState();
    const relationshipCount = store.document?.relationships.length ?? 0;
    const elementCount = store.document?.elements.length ?? 0;
    store.setMode("connect");
    store.chooseConnectionEndpoint("container-web-app");
    useSemanticDesignStore.getState().chooseConnectionEndpoint("container-order-db");
    const connected = useSemanticDesignStore.getState();
    expect(connected.document?.relationships).toHaveLength(relationshipCount + 1);
    expect(connected.document?.elements).toHaveLength(elementCount);

    const annotationCount = connected.document?.annotations.length ?? 0;
    connected.addFreehandAnnotation([
      { x: 20, y: 30 },
      { x: 32, y: 45 },
      { x: 48, y: 51 },
    ]);
    const annotated = useSemanticDesignStore.getState();
    expect(annotated.document?.annotations).toHaveLength(annotationCount + 1);
    expect(annotated.document?.elements).toHaveLength(elementCount);
  });
});
