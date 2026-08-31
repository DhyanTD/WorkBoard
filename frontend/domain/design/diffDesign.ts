import type {
  Annotation,
  Boundary,
  DesignDocument,
  DesignElement,
  DesignMetadata,
  DesignView,
  ElementLayout,
  Relationship,
  ViewLayout,
} from "@/domain/design/types";

export type RecordDiff = {
  addedIds: string[];
  updatedIds: string[];
  removedIds: string[];
};

export type DesignDiff = {
  semantic: {
    elements: RecordDiff;
    relationships: RecordDiff;
    boundaries: RecordDiff;
    metadataChanged: boolean;
  };
  presentation: {
    views: RecordDiff;
    annotations: RecordDiff;
    movedElementIds: string[];
    movedBoundaryIds: string[];
  };
};

const sortIds = (ids: Iterable<string>) => [...ids].sort((left, right) =>
  left.localeCompare(right),
);

const areEqual = (left: string, right: string) => left === right;

const layoutEntries = (entries: Record<string, ElementLayout>) =>
  Object.entries(entries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, rectangle]) => [id, rectangle.x, rectangle.y, rectangle.width, rectangle.height]);

const serializeView = (view: DesignView) =>
  JSON.stringify({
    ...view,
    elementIds: [...view.elementIds].sort(),
    relationshipIds: [...view.relationshipIds].sort(),
    boundaryIds: [...view.boundaryIds].sort(),
    layout: {
      elements: layoutEntries(view.layout.elements),
      boundaries: layoutEntries(view.layout.boundaries),
    },
  });

const serializeBoundary = (boundary: Boundary) =>
  JSON.stringify({ ...boundary, elementIds: [...boundary.elementIds].sort() });

const serializeMetadata = (metadata: DesignMetadata) =>
  JSON.stringify({
    ...metadata,
    assumptions: [...metadata.assumptions].sort(),
    decisions: [...metadata.decisions].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  });

const diffRecords = <T extends { id: string }>(
  before: T[],
  after: T[],
  serialize: (record: T) => string,
): RecordDiff => {
  const beforeById = new Map(before.map((record) => [record.id, record]));
  const afterById = new Map(after.map((record) => [record.id, record]));
  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  const removedIds: string[] = [];

  for (const [id, afterRecord] of afterById) {
    const beforeRecord = beforeById.get(id);
    if (!beforeRecord) {
      addedIds.push(id);
    } else if (!areEqual(serialize(beforeRecord), serialize(afterRecord))) {
      updatedIds.push(id);
    }
  }
  for (const id of beforeById.keys()) {
    if (!afterById.has(id)) removedIds.push(id);
  }
  return {
    addedIds: sortIds(addedIds),
    updatedIds: sortIds(updatedIds),
    removedIds: sortIds(removedIds),
  };
};

const movedLayoutIds = (
  before: DesignView[],
  after: DesignView[],
  selectLayout: (layout: ViewLayout) => Record<string, ElementLayout>,
) => {
  const beforeById = new Map(before.map((view) => [view.id, view]));
  const movedIds = new Set<string>();
  for (const afterView of after) {
    const beforeView = beforeById.get(afterView.id);
    if (!beforeView) continue;
    const beforeLayout = selectLayout(beforeView.layout);
    const afterLayout = selectLayout(afterView.layout);
    const layoutIds = new Set([
      ...Object.keys(beforeLayout),
      ...Object.keys(afterLayout),
    ]);
    for (const layoutId of layoutIds) {
      const beforeRectangle = beforeLayout[layoutId];
      const afterRectangle = afterLayout[layoutId];
      if (
        beforeRectangle &&
        afterRectangle &&
        JSON.stringify(beforeRectangle) !== JSON.stringify(afterRectangle)
      ) {
        movedIds.add(layoutId);
      }
    }
  }
  return sortIds(movedIds);
};

export const diffDesignDocuments = (
  before: DesignDocument,
  after: DesignDocument,
): DesignDiff => ({
  semantic: {
    elements: diffRecords<DesignElement>(before.elements, after.elements, JSON.stringify),
    relationships: diffRecords<Relationship>(
      before.relationships,
      after.relationships,
      JSON.stringify,
    ),
    boundaries: diffRecords<Boundary>(before.boundaries, after.boundaries, serializeBoundary),
    metadataChanged: serializeMetadata(before.metadata) !== serializeMetadata(after.metadata),
  },
  presentation: {
    views: diffRecords<DesignView>(before.views, after.views, serializeView),
    annotations: diffRecords<Annotation>(before.annotations, after.annotations, JSON.stringify),
    movedElementIds: movedLayoutIds(before.views, after.views, (layout) => layout.elements),
    movedBoundaryIds: movedLayoutIds(before.views, after.views, (layout) => layout.boundaries),
  },
});
