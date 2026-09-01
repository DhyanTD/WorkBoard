/** The only DesignDocument schema this release can read and write. */
export const DESIGN_DOCUMENT_SCHEMA_VERSION = 1 as const;

export const SUPPORTED_ELEMENT_KINDS = [
  "person",
  "software-system",
  "container",
] as const;

export const RESERVED_ELEMENT_KINDS = ["component"] as const;

export const SUPPORTED_VIEW_KINDS = [
  "system-context",
  "container",
] as const;

export const RESERVED_VIEW_KINDS = [
  "component",
  "deployment",
  "dynamic",
  "data-flow",
  "custom",
] as const;

export type ElementKind = (typeof SUPPORTED_ELEMENT_KINDS)[number];
export type ReservedElementKind = (typeof RESERVED_ELEMENT_KINDS)[number];
export type ViewKind = (typeof SUPPORTED_VIEW_KINDS)[number];
export type ReservedViewKind = (typeof RESERVED_VIEW_KINDS)[number];
export type ContainerType = "application" | "datastore" | "queue";

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = Point & {
  width: number;
  height: number;
};

export type ElementLayout = Rectangle;
export type BoundaryLayout = Rectangle;

export type ViewLayout = {
  elements: Record<string, ElementLayout>;
  boundaries: Record<string, BoundaryLayout>;
};

export type DesignDecision = {
  id: string;
  statement: string;
};

export type DesignMetadata = {
  name: string;
  description?: string;
  assumptions: string[];
  decisions: DesignDecision[];
};

type ElementBase = {
  id: string;
  name: string;
  description?: string;
  responsibilities?: string[];
};

export type PersonElement = ElementBase & {
  kind: "person";
};

export type SoftwareSystemElement = ElementBase & {
  kind: "software-system";
  external: boolean;
};

export type ContainerElement = ElementBase & {
  kind: "container";
  parentId: string;
  containerType: ContainerType;
};

export type DesignElement =
  | PersonElement
  | SoftwareSystemElement
  | ContainerElement;

export type Relationship = {
  id: string;
  sourceId: string;
  destinationId: string;
  description: string;
  technology?: string;
};

/** A semantic grouping of containers owned by one software system. */
export type Boundary = {
  id: string;
  name: string;
  description?: string;
  ownerSystemId: string;
  elementIds: string[];
};

type ViewBase = {
  id: string;
  name: string;
  description?: string;
  systemId: string;
  elementIds: string[];
  relationshipIds: string[];
  boundaryIds: string[];
  layout: ViewLayout;
};

export type SystemContextView = ViewBase & {
  kind: "system-context";
};

export type ContainerView = ViewBase & {
  kind: "container";
};

export type DesignView = SystemContextView | ContainerView;

/** A lossless domain-level representation of the legacy Board Stroke shape. */
export type LegacyStroke = {
  id?: string;
  tool: string;
  color: string;
  lineWidth: number;
  points: Point[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  text?: string;
  fontSize?: number;
  startBindingId?: string;
  endBindingId?: string;
};

export type TextAnnotation = {
  id: string;
  kind: "text";
  viewId: string;
  text: string;
  position: Point;
};

export type LegacyStrokeAnnotation = {
  id: string;
  kind: "legacy-stroke";
  viewId: string;
  stroke: LegacyStroke;
};

export type Annotation = TextAnnotation | LegacyStrokeAnnotation;

export type DesignDocument = {
  id: string;
  schemaVersion: number;
  metadata: DesignMetadata;
  elements: DesignElement[];
  relationships: Relationship[];
  boundaries: Boundary[];
  views: DesignView[];
  annotations: Annotation[];
};

export type DomainErrorCode =
  | "unsupported-schema-version"
  | "invalid-document"
  | "duplicate-id"
  | "missing-reference"
  | "invalid-containment"
  | "invalid-view"
  | "invalid-layout"
  | "invalid-annotation"
  | "missing-target"
  | "dependency-mismatch";

export type DomainIssue = {
  code: DomainErrorCode;
  path: string;
  message: string;
  recoveryHint: string;
  targetId?: string;
};

export type ValidationSuccess = {
  ok: true;
  warnings: DomainIssue[];
};

export type ValidationFailure = {
  ok: false;
  errors: DomainIssue[];
  warnings: DomainIssue[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;
