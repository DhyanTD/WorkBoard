import type {
  Annotation,
  Boundary,
  DesignElement,
  DesignMetadata,
  DesignView,
  Relationship,
  ViewLayout,
} from "@/domain/design/types";

type RemovalOperation = {
  /** Complete direct dependencies observed before this removal is applied. */
  expectedDependentIds: string[];
};

export type AddElementOperation = {
  kind: "add-element";
  element: DesignElement;
};

export type UpdateElementOperation = {
  kind: "update-element";
  element: DesignElement;
};

export type RemoveElementOperation = RemovalOperation & {
  kind: "remove-element";
  elementId: string;
};

export type AddRelationshipOperation = {
  kind: "add-relationship";
  relationship: Relationship;
};

export type UpdateRelationshipOperation = {
  kind: "update-relationship";
  relationship: Relationship;
};

export type RemoveRelationshipOperation = RemovalOperation & {
  kind: "remove-relationship";
  relationshipId: string;
};

export type AddBoundaryOperation = {
  kind: "add-boundary";
  boundary: Boundary;
};

export type UpdateBoundaryOperation = {
  kind: "update-boundary";
  boundary: Boundary;
};

export type RemoveBoundaryOperation = RemovalOperation & {
  kind: "remove-boundary";
  boundaryId: string;
};

export type AddViewOperation = {
  kind: "add-view";
  view: DesignView;
};

export type UpdateViewOperation = {
  kind: "update-view";
  view: DesignView;
};

export type SetViewLayoutOperation = {
  kind: "set-view-layout";
  viewId: string;
  layout: ViewLayout;
};

export type RemoveViewOperation = RemovalOperation & {
  kind: "remove-view";
  viewId: string;
};

export type AddAnnotationOperation = {
  kind: "add-annotation";
  annotation: Annotation;
};

export type RemoveAnnotationOperation = RemovalOperation & {
  kind: "remove-annotation";
  annotationId: string;
};

export type UpdateDesignMetadataOperation = {
  kind: "update-design-metadata";
  metadata: DesignMetadata;
};

export type DesignOperation =
  | AddElementOperation
  | UpdateElementOperation
  | RemoveElementOperation
  | AddRelationshipOperation
  | UpdateRelationshipOperation
  | RemoveRelationshipOperation
  | AddBoundaryOperation
  | UpdateBoundaryOperation
  | RemoveBoundaryOperation
  | AddViewOperation
  | UpdateViewOperation
  | SetViewLayoutOperation
  | RemoveViewOperation
  | AddAnnotationOperation
  | RemoveAnnotationOperation
  | UpdateDesignMetadataOperation;
