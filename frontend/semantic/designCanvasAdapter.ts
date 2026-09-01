import type {
  Annotation,
  Boundary,
  DesignDocument,
  DesignElement,
  DesignView,
  Point,
  Rectangle,
  Relationship,
} from "@/domain/design";

export type ElementTone =
  | "person"
  | "system-owned"
  | "system-external"
  | "application"
  | "datastore"
  | "queue";

export type CanvasElement = {
  id: string;
  element: DesignElement;
  rectangle: Rectangle;
  tone: ElementTone;
  eyebrow: string;
};

export type CanvasRelationship = {
  id: string;
  relationship: Relationship;
  start: Point;
  end: Point;
};

export type CanvasBoundary = {
  id: string;
  boundary: Boundary;
  rectangle: Rectangle;
};

export type SemanticCanvasModel = {
  view: DesignView;
  elements: CanvasElement[];
  relationships: CanvasRelationship[];
  boundaries: CanvasBoundary[];
  annotations: Annotation[];
  width: number;
  height: number;
};

const hashId = (id: string) => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

export const deterministicElementLayout = (
  elementId: string,
  index: number,
): Rectangle => {
  const hash = hashId(elementId);
  const column = (hash + index) % 4;
  const row = Math.floor((hash % 12) / 4) + Math.floor(index / 4);
  return {
    x: 120 + column * 280,
    y: 120 + row * 210,
    width: 210,
    height: 132,
  };
};

export const elementTone = (element: DesignElement): ElementTone => {
  if (element.kind === "person") return "person";
  if (element.kind === "software-system") {
    return element.external ? "system-external" : "system-owned";
  }
  return element.containerType;
};

export const elementEyebrow = (element: DesignElement) => {
  if (element.kind === "person") return "Person";
  if (element.kind === "software-system") {
    return element.external ? "External system" : "Software system";
  }
  if (element.containerType === "datastore") return "Datastore";
  if (element.containerType === "queue") return "Message queue";
  return "Application container";
};

const center = (rectangle: Rectangle): Point => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

const connectionPoint = (rectangle: Rectangle, toward: Point): Point => {
  const origin = center(rectangle);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return origin;
  const horizontalScale = rectangle.width / 2 / Math.max(Math.abs(dx), 0.0001);
  const verticalScale = rectangle.height / 2 / Math.max(Math.abs(dy), 0.0001);
  const scale = Math.min(horizontalScale, verticalScale);
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
};

export const createSemanticCanvasModel = (
  document: DesignDocument,
  viewId: string,
): SemanticCanvasModel | null => {
  const view = document.views.find((candidate) => candidate.id === viewId);
  if (!view) return null;
  const elementById = new Map(document.elements.map((element) => [element.id, element]));
  const elements = view.elementIds.flatMap((elementId, index) => {
    const element = elementById.get(elementId);
    if (!element) return [];
    return [
      {
        id: element.id,
        element,
        rectangle:
          view.layout.elements[element.id] ??
          deterministicElementLayout(element.id, index),
        tone: elementTone(element),
        eyebrow: elementEyebrow(element),
      },
    ];
  });
  const canvasElementById = new Map(elements.map((element) => [element.id, element]));
  const relationships = view.relationshipIds.flatMap((relationshipId) => {
    const relationship = document.relationships.find(
      (candidate) => candidate.id === relationshipId,
    );
    if (!relationship) return [];
    const source = canvasElementById.get(relationship.sourceId);
    const destination = canvasElementById.get(relationship.destinationId);
    if (!source || !destination) return [];
    const sourceCenter = center(source.rectangle);
    const destinationCenter = center(destination.rectangle);
    return [
      {
        id: relationship.id,
        relationship,
        start: connectionPoint(source.rectangle, destinationCenter),
        end: connectionPoint(destination.rectangle, sourceCenter),
      },
    ];
  });
  const boundaries = view.boundaryIds.flatMap((boundaryId) => {
    const boundary = document.boundaries.find((candidate) => candidate.id === boundaryId);
    const rectangle = view.layout.boundaries[boundaryId];
    return boundary && rectangle ? [{ id: boundaryId, boundary, rectangle }] : [];
  });
  const rectangles = [
    ...elements.map((element) => element.rectangle),
    ...boundaries.map((boundary) => boundary.rectangle),
  ];
  const width = Math.max(1200, ...rectangles.map((rectangle) => rectangle.x + rectangle.width + 120));
  const height = Math.max(720, ...rectangles.map((rectangle) => rectangle.y + rectangle.height + 120));
  return {
    view,
    elements,
    relationships,
    boundaries,
    annotations: document.annotations.filter((annotation) => annotation.viewId === view.id),
    width,
    height,
  };
};
