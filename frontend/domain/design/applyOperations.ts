import { diffDesignDocuments, type DesignDiff } from "@/domain/design/diffDesign";
import type { DesignOperation } from "@/domain/design/operations";
import {
  DESIGN_DOCUMENT_SCHEMA_VERSION,
  type Annotation,
  type Boundary,
  type DesignDocument,
  type DesignElement,
  type DesignMetadata,
  type DesignView,
  type DomainIssue,
  type ElementLayout,
  type Relationship,
  type ValidationFailure,
  type ViewLayout,
} from "@/domain/design/types";
import { validateDesignDocument } from "@/domain/design/validateDesign";

export type ApplyDesignOperationsSuccess = {
  ok: true;
  document: DesignDocument;
  changedIds: string[];
  warnings: DomainIssue[];
  diff: DesignDiff;
};

export type ApplyDesignOperationsFailure = {
  ok: false;
  errors: DomainIssue[];
  warnings: DomainIssue[];
};

export type ApplyDesignOperationsResult =
  | ApplyDesignOperationsSuccess
  | ApplyDesignOperationsFailure;

const cloneMetadata = (metadata: DesignMetadata): DesignMetadata => ({
  ...metadata,
  assumptions: [...metadata.assumptions],
  decisions: metadata.decisions.map((decision) => ({ ...decision })),
});

const cloneElement = (element: DesignElement): DesignElement => ({ ...element });

const cloneRelationship = (relationship: Relationship): Relationship => ({
  ...relationship,
});

const cloneBoundary = (boundary: Boundary): Boundary => ({
  ...boundary,
  elementIds: [...boundary.elementIds],
});

const cloneLayoutEntries = (
  entries: Record<string, ElementLayout>,
): Record<string, ElementLayout> => {
  const clonedEntries: Record<string, ElementLayout> = {};
  for (const [id, layout] of Object.entries(entries)) {
    clonedEntries[id] = { ...layout };
  }
  return clonedEntries;
};

const cloneViewLayout = (layout: ViewLayout): ViewLayout => ({
  elements: cloneLayoutEntries(layout.elements),
  boundaries: cloneLayoutEntries(layout.boundaries),
});

const cloneView = (view: DesignView): DesignView => ({
  ...view,
  elementIds: [...view.elementIds],
  relationshipIds: [...view.relationshipIds],
  boundaryIds: [...view.boundaryIds],
  layout: cloneViewLayout(view.layout),
});

const cloneAnnotation = (annotation: Annotation): Annotation =>
  annotation.kind === "text"
    ? { ...annotation, position: { ...annotation.position } }
    : {
        ...annotation,
        stroke: {
          ...annotation.stroke,
          points: annotation.stroke.points.map((point) => ({ ...point })),
          bounds: { ...annotation.stroke.bounds },
        },
      };

const cloneDesignDocument = (document: DesignDocument): DesignDocument => ({
  ...document,
  metadata: cloneMetadata(document.metadata),
  elements: document.elements.map(cloneElement),
  relationships: document.relationships.map(cloneRelationship),
  boundaries: document.boundaries.map(cloneBoundary),
  views: document.views.map(cloneView),
  annotations: document.annotations.map(cloneAnnotation),
});

export const createEmptyDesignDocument = (
  id: string,
  metadata: DesignMetadata,
): DesignDocument => ({
  id,
  schemaVersion: DESIGN_DOCUMENT_SCHEMA_VERSION,
  metadata: cloneMetadata(metadata),
  elements: [],
  relationships: [],
  boundaries: [],
  views: [],
  annotations: [],
});

const operationIssue = (
  code: "missing-target" | "dependency-mismatch",
  path: string,
  message: string,
  recoveryHint: string,
  targetId: string,
): ApplyDesignOperationsFailure => ({
  ok: false,
  errors: [{ code, path, message, recoveryHint, targetId }],
  warnings: [],
});

const hasRecord = <T extends { id: string }>(records: T[], id: string) =>
  records.some((record) => record.id === id);

const replaceRecord = <T extends { id: string }>(records: T[], record: T) => {
  const index = records.findIndex((candidate) => candidate.id === record.id);
  if (index < 0) return null;
  return [...records.slice(0, index), record, ...records.slice(index + 1)];
};

const compareIdSets = (expected: string[], actual: string[]) => {
  if (new Set(expected).size !== expected.length) return false;
  if (expected.length !== actual.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((id) => expectedSet.has(id));
};

const elementDependents = (document: DesignDocument, elementId: string) => [
  ...document.elements.flatMap((element) =>
    element.kind === "container" && element.parentId === elementId
      ? [element.id]
      : [],
  ),
  ...document.relationships.flatMap((relationship) =>
    relationship.sourceId === elementId || relationship.destinationId === elementId
      ? [relationship.id]
      : [],
  ),
  ...document.boundaries.flatMap((boundary) =>
    boundary.ownerSystemId === elementId || boundary.elementIds.includes(elementId)
      ? [boundary.id]
      : [],
  ),
  ...document.views.flatMap((view) =>
    view.elementIds.includes(elementId) ? [view.id] : [],
  ),
];

const relationshipDependents = (document: DesignDocument, relationshipId: string) =>
  document.views.flatMap((view) =>
    view.relationshipIds.includes(relationshipId) ? [view.id] : [],
  );

const boundaryDependents = (document: DesignDocument, boundaryId: string) =>
  document.views.flatMap((view) =>
    view.boundaryIds.includes(boundaryId) ? [view.id] : [],
  );

const viewDependents = (document: DesignDocument, viewId: string) =>
  document.annotations.flatMap((annotation) =>
    annotation.viewId === viewId ? [annotation.id] : [],
  );

const assertExpectedDependencies = (
  expectedDependentIds: string[],
  actualDependentIds: string[],
  path: string,
  targetId: string,
): ApplyDesignOperationsFailure | null => {
  if (compareIdSets(expectedDependentIds, actualDependentIds)) return null;
  return operationIssue(
    "dependency-mismatch",
    path,
    `Removal of '${targetId}' expected dependencies [${expectedDependentIds.join(", ")}], but found [${actualDependentIds.join(", ")}].`,
    "Declare every current direct dependency, then remove or update each dependency explicitly in the same operation batch.",
    targetId,
  );
};

const getOperationChangedIds = (operations: DesignOperation[]) => {
  const changedIds = new Set<string>();
  for (const operation of operations) {
    switch (operation.kind) {
      case "add-element":
      case "update-element":
        changedIds.add(operation.element.id);
        break;
      case "remove-element":
        changedIds.add(operation.elementId);
        break;
      case "add-relationship":
      case "update-relationship":
        changedIds.add(operation.relationship.id);
        break;
      case "remove-relationship":
        changedIds.add(operation.relationshipId);
        break;
      case "add-boundary":
      case "update-boundary":
        changedIds.add(operation.boundary.id);
        break;
      case "remove-boundary":
        changedIds.add(operation.boundaryId);
        break;
      case "add-view":
      case "update-view":
        changedIds.add(operation.view.id);
        break;
      case "set-view-layout":
      case "remove-view":
        changedIds.add(operation.viewId);
        break;
      case "add-annotation":
        changedIds.add(operation.annotation.id);
        break;
      case "remove-annotation":
        changedIds.add(operation.annotationId);
        break;
      case "update-design-metadata":
        changedIds.add("metadata");
        break;
    }
  }
  return [...changedIds].sort((left, right) => left.localeCompare(right));
};

const asFailure = (validation: ValidationFailure): ApplyDesignOperationsFailure => ({
  ok: false,
  errors: validation.errors,
  warnings: validation.warnings,
});

/**
 * Applies a batch to a cloned document. Expected validation failures are
 * returned as stable issues and never expose a partially changed document.
 */
export const applyDesignOperations = (
  document: DesignDocument,
  operations: DesignOperation[],
): ApplyDesignOperationsResult => {
  const initialValidation = validateDesignDocument(document);
  if (!initialValidation.ok) return asFailure(initialValidation);

  let next = cloneDesignDocument(document);
  for (const [index, operation] of operations.entries()) {
    const path = `operations[${index}]`;
    switch (operation.kind) {
      case "add-element":
        next = { ...next, elements: [...next.elements, cloneElement(operation.element)] };
        break;
      case "update-element": {
        const elements = replaceRecord(next.elements, cloneElement(operation.element));
        if (!elements) {
          return operationIssue(
            "missing-target",
            `${path}.element.id`,
            `Element '${operation.element.id}' does not exist.`,
            "Use add-element for a new Element or provide an existing ID.",
            operation.element.id,
          );
        }
        next = { ...next, elements };
        break;
      }
      case "remove-element": {
        if (!hasRecord(next.elements, operation.elementId)) {
          return operationIssue(
            "missing-target",
            `${path}.elementId`,
            `Element '${operation.elementId}' does not exist.`,
            "Provide an existing Element ID.",
            operation.elementId,
          );
        }
        const dependencyFailure = assertExpectedDependencies(
          operation.expectedDependentIds,
          elementDependents(next, operation.elementId),
          `${path}.expectedDependentIds`,
          operation.elementId,
        );
        if (dependencyFailure) return dependencyFailure;
        next = {
          ...next,
          elements: next.elements.filter((element) => element.id !== operation.elementId),
        };
        break;
      }
      case "add-relationship":
        next = {
          ...next,
          relationships: [...next.relationships, cloneRelationship(operation.relationship)],
        };
        break;
      case "update-relationship": {
        const relationships = replaceRecord(
          next.relationships,
          cloneRelationship(operation.relationship),
        );
        if (!relationships) {
          return operationIssue(
            "missing-target",
            `${path}.relationship.id`,
            `Relationship '${operation.relationship.id}' does not exist.`,
            "Use add-relationship for a new Relationship or provide an existing ID.",
            operation.relationship.id,
          );
        }
        next = { ...next, relationships };
        break;
      }
      case "remove-relationship": {
        if (!hasRecord(next.relationships, operation.relationshipId)) {
          return operationIssue(
            "missing-target",
            `${path}.relationshipId`,
            `Relationship '${operation.relationshipId}' does not exist.`,
            "Provide an existing Relationship ID.",
            operation.relationshipId,
          );
        }
        const dependencyFailure = assertExpectedDependencies(
          operation.expectedDependentIds,
          relationshipDependents(next, operation.relationshipId),
          `${path}.expectedDependentIds`,
          operation.relationshipId,
        );
        if (dependencyFailure) return dependencyFailure;
        next = {
          ...next,
          relationships: next.relationships.filter(
            (relationship) => relationship.id !== operation.relationshipId,
          ),
        };
        break;
      }
      case "add-boundary":
        next = { ...next, boundaries: [...next.boundaries, cloneBoundary(operation.boundary)] };
        break;
      case "update-boundary": {
        const boundaries = replaceRecord(next.boundaries, cloneBoundary(operation.boundary));
        if (!boundaries) {
          return operationIssue(
            "missing-target",
            `${path}.boundary.id`,
            `Boundary '${operation.boundary.id}' does not exist.`,
            "Use add-boundary for a new Boundary or provide an existing ID.",
            operation.boundary.id,
          );
        }
        next = { ...next, boundaries };
        break;
      }
      case "remove-boundary": {
        if (!hasRecord(next.boundaries, operation.boundaryId)) {
          return operationIssue(
            "missing-target",
            `${path}.boundaryId`,
            `Boundary '${operation.boundaryId}' does not exist.`,
            "Provide an existing Boundary ID.",
            operation.boundaryId,
          );
        }
        const dependencyFailure = assertExpectedDependencies(
          operation.expectedDependentIds,
          boundaryDependents(next, operation.boundaryId),
          `${path}.expectedDependentIds`,
          operation.boundaryId,
        );
        if (dependencyFailure) return dependencyFailure;
        next = {
          ...next,
          boundaries: next.boundaries.filter((boundary) => boundary.id !== operation.boundaryId),
        };
        break;
      }
      case "add-view":
        next = { ...next, views: [...next.views, cloneView(operation.view)] };
        break;
      case "update-view": {
        const views = replaceRecord(next.views, cloneView(operation.view));
        if (!views) {
          return operationIssue(
            "missing-target",
            `${path}.view.id`,
            `View '${operation.view.id}' does not exist.`,
            "Use add-view for a new View or provide an existing ID.",
            operation.view.id,
          );
        }
        next = { ...next, views };
        break;
      }
      case "set-view-layout": {
        const view = next.views.find((candidate) => candidate.id === operation.viewId);
        if (!view) {
          return operationIssue(
            "missing-target",
            `${path}.viewId`,
            `View '${operation.viewId}' does not exist.`,
            "Provide an existing View ID.",
            operation.viewId,
          );
        }
        const views = replaceRecord(next.views, {
          ...view,
          layout: cloneViewLayout(operation.layout),
        });
        if (!views) {
          return operationIssue(
            "missing-target",
            `${path}.viewId`,
            `View '${operation.viewId}' does not exist.`,
            "Provide an existing View ID.",
            operation.viewId,
          );
        }
        next = { ...next, views };
        break;
      }
      case "remove-view": {
        if (!hasRecord(next.views, operation.viewId)) {
          return operationIssue(
            "missing-target",
            `${path}.viewId`,
            `View '${operation.viewId}' does not exist.`,
            "Provide an existing View ID.",
            operation.viewId,
          );
        }
        const dependencyFailure = assertExpectedDependencies(
          operation.expectedDependentIds,
          viewDependents(next, operation.viewId),
          `${path}.expectedDependentIds`,
          operation.viewId,
        );
        if (dependencyFailure) return dependencyFailure;
        next = { ...next, views: next.views.filter((view) => view.id !== operation.viewId) };
        break;
      }
      case "add-annotation":
        next = {
          ...next,
          annotations: [...next.annotations, cloneAnnotation(operation.annotation)],
        };
        break;
      case "remove-annotation": {
        if (!hasRecord(next.annotations, operation.annotationId)) {
          return operationIssue(
            "missing-target",
            `${path}.annotationId`,
            `Annotation '${operation.annotationId}' does not exist.`,
            "Provide an existing Annotation ID.",
            operation.annotationId,
          );
        }
        const dependencyFailure = assertExpectedDependencies(
          operation.expectedDependentIds,
          [],
          `${path}.expectedDependentIds`,
          operation.annotationId,
        );
        if (dependencyFailure) return dependencyFailure;
        next = {
          ...next,
          annotations: next.annotations.filter(
            (annotation) => annotation.id !== operation.annotationId,
          ),
        };
        break;
      }
      case "update-design-metadata":
        next = { ...next, metadata: cloneMetadata(operation.metadata) };
        break;
    }
  }

  const finalValidation = validateDesignDocument(next);
  if (!finalValidation.ok) return asFailure(finalValidation);

  return {
    ok: true,
    document: next,
    changedIds: getOperationChangedIds(operations),
    warnings: finalValidation.warnings,
    diff: diffDesignDocuments(document, next),
  };
};
