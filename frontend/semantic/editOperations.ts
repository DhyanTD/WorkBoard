import {
  createProductionId,
  type DesignDocument,
  type DesignElement,
  type DesignOperation,
  type DesignView,
  type Rectangle,
  type Relationship,
} from "@/domain/design";
import { deterministicElementLayout } from "@/semantic/designCanvasAdapter";

const activeView = (document: DesignDocument, viewId: string) =>
  document.views.find((view) => view.id === viewId);

export const addElementOperations = (
  document: DesignDocument,
  viewId: string,
  element: DesignElement,
  rectangle?: Rectangle,
): DesignOperation[] => {
  const view = activeView(document, viewId);
  if (!view) return [];
  const layout =
    rectangle ?? deterministicElementLayout(element.id, view.elementIds.length);
  return [
    { kind: "add-element", element },
    {
      kind: "update-view",
      view: {
        ...view,
        elementIds: [...view.elementIds, element.id],
        layout: {
          ...view.layout,
          elements: { ...view.layout.elements, [element.id]: layout },
        },
      },
    },
  ];
};

export const addRelationshipOperations = (
  document: DesignDocument,
  viewId: string,
  relationship: Relationship,
): DesignOperation[] => {
  const view = activeView(document, viewId);
  if (!view) return [];
  return [
    { kind: "add-relationship", relationship },
    {
      kind: "update-view",
      view: {
        ...view,
        relationshipIds: [...view.relationshipIds, relationship.id],
      },
    },
  ];
};

export const setElementRectangleOperation = (
  document: DesignDocument,
  viewId: string,
  elementId: string,
  rectangle: Rectangle,
): DesignOperation[] => {
  const view = activeView(document, viewId);
  if (!view || !view.elementIds.includes(elementId)) return [];
  return [
    {
      kind: "set-view-layout",
      viewId,
      layout: {
        ...view.layout,
        elements: { ...view.layout.elements, [elementId]: rectangle },
      },
    },
  ];
};

export const copyElementOperations = (
  document: DesignDocument,
  viewId: string,
  element: DesignElement,
): { elementId: string; operations: DesignOperation[] } => {
  const view = activeView(document, viewId);
  const elementId = createProductionId(element.kind);
  const sourceLayout = view?.layout.elements[element.id];
  const copiedElement: DesignElement = {
    ...element,
    id: elementId,
    name: `${element.name} copy`,
  };
  return {
    elementId,
    operations: addElementOperations(
      document,
      viewId,
      copiedElement,
      sourceLayout
        ? { ...sourceLayout, x: sourceLayout.x + 36, y: sourceLayout.y + 36 }
        : undefined,
    ),
  };
};

export const deleteElementOperations = (
  document: DesignDocument,
  elementId: string,
): DesignOperation[] | null => {
  const element = document.elements.find((candidate) => candidate.id === elementId);
  if (!element) return [];
  const childIds = document.elements.flatMap((candidate) =>
    candidate.kind === "container" && candidate.parentId === elementId
      ? [candidate.id]
      : [],
  );
  const ownedBoundaryIds = document.boundaries.flatMap((boundary) =>
    boundary.ownerSystemId === elementId ? [boundary.id] : [],
  );
  const centeredViewIds = document.views.flatMap((view) =>
    view.systemId === elementId ? [view.id] : [],
  );
  if (childIds.length || ownedBoundaryIds.length || centeredViewIds.length) return null;

  const relationships = document.relationships.filter(
    (relationship) =>
      relationship.sourceId === elementId || relationship.destinationId === elementId,
  );
  const boundaryIds = document.boundaries.flatMap((boundary) =>
    boundary.elementIds.includes(elementId) ? [boundary.id] : [],
  );
  const viewIds = document.views.flatMap((view) =>
    view.elementIds.includes(elementId) ? [view.id] : [],
  );
  const expectedDependentIds = [
    ...relationships.map((relationship) => relationship.id),
    ...boundaryIds,
    ...viewIds,
  ];
  const operations: DesignOperation[] = [
    { kind: "remove-element", elementId, expectedDependentIds },
  ];
  for (const relationship of relationships) {
    operations.push({
      kind: "remove-relationship",
      relationshipId: relationship.id,
      expectedDependentIds: document.views.flatMap((view) =>
        view.relationshipIds.includes(relationship.id) ? [view.id] : [],
      ),
    });
  }
  for (const boundary of document.boundaries) {
    if (!boundary.elementIds.includes(elementId)) continue;
    operations.push({
      kind: "update-boundary",
      boundary: {
        ...boundary,
        elementIds: boundary.elementIds.filter((id) => id !== elementId),
      },
    });
  }
  for (const view of document.views) {
    const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
    if (
      !view.elementIds.includes(elementId) &&
      !view.relationshipIds.some((id) => relationshipIds.has(id))
    ) {
      continue;
    }
    const elements = { ...view.layout.elements };
    delete elements[elementId];
    operations.push({
      kind: "update-view",
      view: {
        ...view,
        elementIds: view.elementIds.filter((id) => id !== elementId),
        relationshipIds: view.relationshipIds.filter((id) => !relationshipIds.has(id)),
        layout: { ...view.layout, elements },
      },
    });
  }
  return operations;
};

export const isElementAllowedInView = (
  element: DesignElement,
  view: DesignView,
) =>
  view.kind === "system-context"
    ? element.kind === "person" ||
      (element.kind === "software-system" && element.external)
    : element.kind === "container" && element.parentId === view.systemId;
