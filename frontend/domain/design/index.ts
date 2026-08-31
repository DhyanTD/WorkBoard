export {
  applyDesignOperations,
  createEmptyDesignDocument,
} from "@/domain/design/applyOperations";
export type {
  ApplyDesignOperationsFailure,
  ApplyDesignOperationsResult,
  ApplyDesignOperationsSuccess,
} from "@/domain/design/applyOperations";
export { diffDesignDocuments } from "@/domain/design/diffDesign";
export type { DesignDiff, RecordDiff } from "@/domain/design/diffDesign";
export {
  COMMERCE_PLATFORM_DOCUMENT_ID,
  COMMERCE_PLATFORM_FIXTURE_KEY,
  createCommercePlatformFixture,
  createCommercePlatformInitialDocument,
  createCommercePlatformOperations,
} from "@/domain/design/fixtures";
export { createProductionId, createTestId, hasRequiredId } from "@/domain/design/identifiers";
export type { DesignOperation } from "@/domain/design/operations";
export {
  DESIGN_DOCUMENT_SCHEMA_VERSION,
  RESERVED_ELEMENT_KINDS,
  RESERVED_VIEW_KINDS,
  SUPPORTED_ELEMENT_KINDS,
  SUPPORTED_VIEW_KINDS,
} from "@/domain/design/types";
export type {
  Annotation,
  Boundary,
  BoundaryLayout,
  ContainerElement,
  ContainerType,
  DesignDecision,
  DesignDocument,
  DesignElement,
  DesignMetadata,
  DesignView,
  DomainErrorCode,
  DomainIssue,
  ElementKind,
  ElementLayout,
  LegacyStroke,
  LegacyStrokeAnnotation,
  PersonElement,
  Point,
  Rectangle,
  Relationship,
  ReservedElementKind,
  ReservedViewKind,
  SoftwareSystemElement,
  SystemContextView,
  TextAnnotation,
  ValidationFailure,
  ValidationResult,
  ValidationSuccess,
  ViewKind,
  ViewLayout,
} from "@/domain/design/types";
export { isContainerElement, validateDesignDocument } from "@/domain/design/validateDesign";
