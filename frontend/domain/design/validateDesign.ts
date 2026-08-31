import {
  DESIGN_DOCUMENT_SCHEMA_VERSION,
  type Annotation,
  type Boundary,
  type ContainerElement,
  type DesignDocument,
  type DesignElement,
  type DesignView,
  type DomainErrorCode,
  type DomainIssue,
  type LegacyStroke,
  type Rectangle,
  type ValidationResult,
} from "@/domain/design/types";

const createIssue = (
  code: DomainErrorCode,
  path: string,
  message: string,
  recoveryHint: string,
  targetId?: string,
): DomainIssue => ({ code, path, message, recoveryHint, targetId });

const isNonBlank = (value: string) => value.trim().length > 0;

const isFiniteNumber = (value: number) => Number.isFinite(value);

const hasUniqueValues = (values: string[]) => new Set(values).size === values.length;

const findElement = (document: DesignDocument, id: string) =>
  document.elements.find((element) => element.id === id);

const findRelationship = (document: DesignDocument, id: string) =>
  document.relationships.find((relationship) => relationship.id === id);

const findBoundary = (document: DesignDocument, id: string) =>
  document.boundaries.find((boundary) => boundary.id === id);

const findView = (document: DesignDocument, id: string) =>
  document.views.find((view) => view.id === id);

const validateRectangle = (
  rectangle: Rectangle,
  path: string,
  targetId: string,
  errors: DomainIssue[],
) => {
  if (
    !isFiniteNumber(rectangle.x) ||
    !isFiniteNumber(rectangle.y) ||
    !isFiniteNumber(rectangle.width) ||
    !isFiniteNumber(rectangle.height) ||
    rectangle.width <= 0 ||
    rectangle.height <= 0
  ) {
    errors.push(
      createIssue(
        "invalid-layout",
        path,
        "Layout rectangles require finite coordinates and positive dimensions.",
        "Provide finite x/y values and width/height greater than zero.",
        targetId,
      ),
    );
  }
};

const validateLegacyStroke = (
  stroke: LegacyStroke,
  path: string,
  annotationId: string,
  errors: DomainIssue[],
) => {
  if (!isNonBlank(stroke.tool) || !isNonBlank(stroke.color)) {
    errors.push(
      createIssue(
        "invalid-annotation",
        path,
        "A legacy stroke requires a tool and color.",
        "Preserve the legacy stroke's tool and color values.",
        annotationId,
      ),
    );
  }
  if (!isFiniteNumber(stroke.lineWidth)) {
    errors.push(
      createIssue(
        "invalid-annotation",
        path,
        "A legacy stroke requires a finite line width.",
        "Use a finite numeric line width.",
        annotationId,
      ),
    );
  }
  for (const [index, point] of stroke.points.entries()) {
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
      errors.push(
        createIssue(
          "invalid-annotation",
          `${path}.points[${index}]`,
          "A legacy stroke point must have finite coordinates.",
          "Replace the point with finite x and y values.",
          annotationId,
        ),
      );
    }
  }
  const bounds = stroke.bounds;
  if (
    !isFiniteNumber(bounds.minX) ||
    !isFiniteNumber(bounds.minY) ||
    !isFiniteNumber(bounds.maxX) ||
    !isFiniteNumber(bounds.maxY)
  ) {
    errors.push(
      createIssue(
        "invalid-annotation",
        `${path}.bounds`,
        "A legacy stroke requires finite bounds.",
        "Replace every bounds value with a finite number.",
        annotationId,
      ),
    );
  }
  if (stroke.fontSize !== undefined && !isFiniteNumber(stroke.fontSize)) {
    errors.push(
      createIssue(
        "invalid-annotation",
        `${path}.fontSize`,
        "A legacy text stroke requires a finite font size.",
        "Use a finite font size or omit the field.",
        annotationId,
      ),
    );
  }
};

const validateAnnotation = (
  document: DesignDocument,
  annotation: Annotation,
  index: number,
  errors: DomainIssue[],
) => {
  const path = `annotations[${index}]`;
  if (!findView(document, annotation.viewId)) {
    errors.push(
      createIssue(
        "missing-reference",
        `${path}.viewId`,
        `Annotation '${annotation.id}' references a missing View '${annotation.viewId}'.`,
        "Create the View first or attach the annotation to an existing View.",
        annotation.id,
      ),
    );
  }
  if (annotation.kind === "text") {
    if (!isNonBlank(annotation.text)) {
      errors.push(
        createIssue(
          "invalid-annotation",
          `${path}.text`,
          "A text annotation cannot be empty.",
          "Provide non-empty annotation text.",
          annotation.id,
        ),
      );
    }
    if (!isFiniteNumber(annotation.position.x) || !isFiniteNumber(annotation.position.y)) {
      errors.push(
        createIssue(
          "invalid-annotation",
          `${path}.position`,
          "A text annotation requires finite coordinates.",
          "Provide finite x and y values.",
          annotation.id,
        ),
      );
    }
    return;
  }
  validateLegacyStroke(annotation.stroke, `${path}.stroke`, annotation.id, errors);
};

const validateElement = (
  document: DesignDocument,
  element: DesignElement,
  index: number,
  errors: DomainIssue[],
) => {
  const path = `elements[${index}]`;
  if (!isNonBlank(element.name)) {
    errors.push(
      createIssue(
        "invalid-document",
        `${path}.name`,
        "Every Element requires a non-empty name.",
        "Provide a concise semantic name.",
        element.id,
      ),
    );
  }
  if (element.kind !== "container") return;

  const parent = findElement(document, element.parentId);
  if (!parent) {
    errors.push(
      createIssue(
        "missing-reference",
        `${path}.parentId`,
        `Container '${element.id}' references a missing parent '${element.parentId}'.`,
        "Set parentId to an existing owned Software system.",
        element.id,
      ),
    );
    return;
  }
  if (parent.kind !== "software-system" || parent.external) {
    errors.push(
      createIssue(
        "invalid-containment",
        `${path}.parentId`,
        "A Container must belong directly to an owned Software system.",
        "Use a non-external Software system as the parent.",
        element.id,
      ),
    );
  }
};

const validateBoundary = (
  document: DesignDocument,
  boundary: Boundary,
  index: number,
  errors: DomainIssue[],
) => {
  const path = `boundaries[${index}]`;
  if (!isNonBlank(boundary.name)) {
    errors.push(
      createIssue(
        "invalid-document",
        `${path}.name`,
        "Every Boundary requires a non-empty name.",
        "Provide a semantic ownership or scope name.",
        boundary.id,
      ),
    );
  }
  const owner = findElement(document, boundary.ownerSystemId);
  if (!owner || owner.kind !== "software-system" || owner.external) {
    errors.push(
      createIssue(
        "invalid-containment",
        `${path}.ownerSystemId`,
        `Boundary '${boundary.id}' must belong to an owned Software system.`,
        "Set ownerSystemId to an existing owned Software system.",
        boundary.id,
      ),
    );
  }
  if (!hasUniqueValues(boundary.elementIds)) {
    errors.push(
      createIssue(
        "invalid-containment",
        `${path}.elementIds`,
        "A Boundary cannot include the same Element more than once.",
        "Remove duplicate element IDs.",
        boundary.id,
      ),
    );
  }
  for (const elementId of boundary.elementIds) {
    const element = findElement(document, elementId);
    if (!element) {
      errors.push(
        createIssue(
          "missing-reference",
          `${path}.elementIds`,
          `Boundary '${boundary.id}' references missing Element '${elementId}'.`,
          "Remove the ID or add the referenced Element.",
          boundary.id,
        ),
      );
    } else if (
      element.kind !== "container" ||
      element.parentId !== boundary.ownerSystemId
    ) {
      errors.push(
        createIssue(
          "invalid-containment",
          `${path}.elementIds`,
          "A Boundary can contain only Containers owned by its Software system.",
          "Include only direct Containers of ownerSystemId.",
          boundary.id,
        ),
      );
    }
  }
};

const validateViewReferenceList = (
  ids: string[],
  path: string,
  targetId: string,
  label: string,
  errors: DomainIssue[],
) => {
  if (!hasUniqueValues(ids)) {
    errors.push(
      createIssue(
        "invalid-view",
        path,
        `A View cannot include the same ${label} more than once.`,
        `Remove duplicate ${label} IDs.`,
        targetId,
      ),
    );
  }
};

const validateViewLayout = (
  view: DesignView,
  index: number,
  errors: DomainIssue[],
) => {
  const path = `views[${index}].layout`;
  for (const [elementId, rectangle] of Object.entries(view.layout.elements)) {
    if (!view.elementIds.includes(elementId)) {
      errors.push(
        createIssue(
          "invalid-layout",
          `${path}.elements.${elementId}`,
          "An Element layout must belong to an Element included by the View.",
          "Add the Element to elementIds or remove its layout entry.",
          view.id,
        ),
      );
    }
    validateRectangle(rectangle, `${path}.elements.${elementId}`, view.id, errors);
  }
  for (const [boundaryId, rectangle] of Object.entries(view.layout.boundaries)) {
    if (!view.boundaryIds.includes(boundaryId)) {
      errors.push(
        createIssue(
          "invalid-layout",
          `${path}.boundaries.${boundaryId}`,
          "A Boundary layout must belong to a Boundary included by the View.",
          "Add the Boundary to boundaryIds or remove its layout entry.",
          view.id,
        ),
      );
    }
    validateRectangle(rectangle, `${path}.boundaries.${boundaryId}`, view.id, errors);
  }
};

const validateView = (
  document: DesignDocument,
  view: DesignView,
  index: number,
  errors: DomainIssue[],
) => {
  const path = `views[${index}]`;
  if (!isNonBlank(view.name)) {
    errors.push(
      createIssue(
        "invalid-view",
        `${path}.name`,
        "Every View requires a non-empty name.",
        "Provide a concise view name.",
        view.id,
      ),
    );
  }
  const targetSystem = findElement(document, view.systemId);
  if (!targetSystem || targetSystem.kind !== "software-system") {
    errors.push(
      createIssue(
        "invalid-view",
        `${path}.systemId`,
        `View '${view.id}' must be centered on an existing Software system.`,
        "Set systemId to an existing Software system.",
        view.id,
      ),
    );
  }

  validateViewReferenceList(view.elementIds, `${path}.elementIds`, view.id, "Element", errors);
  validateViewReferenceList(
    view.relationshipIds,
    `${path}.relationshipIds`,
    view.id,
    "Relationship",
    errors,
  );
  validateViewReferenceList(view.boundaryIds, `${path}.boundaryIds`, view.id, "Boundary", errors);

  const includedElements = view.elementIds.flatMap((elementId) => {
    const element = findElement(document, elementId);
    if (element) return [element];
    errors.push(
      createIssue(
        "missing-reference",
        `${path}.elementIds`,
        `View '${view.id}' references missing Element '${elementId}'.`,
        "Remove the ID or add the referenced Element.",
        view.id,
      ),
    );
    return [];
  });

  for (const relationshipId of view.relationshipIds) {
    const relationship = findRelationship(document, relationshipId);
    if (!relationship) {
      errors.push(
        createIssue(
          "missing-reference",
          `${path}.relationshipIds`,
          `View '${view.id}' references missing Relationship '${relationshipId}'.`,
          "Remove the ID or add the referenced Relationship.",
          view.id,
        ),
      );
    } else if (
      !view.elementIds.includes(relationship.sourceId) ||
      !view.elementIds.includes(relationship.destinationId)
    ) {
      errors.push(
        createIssue(
          "invalid-view",
          `${path}.relationshipIds`,
          "A View must include both endpoints of each included Relationship.",
          "Include the relationship endpoints or remove the relationship from the View.",
          view.id,
        ),
      );
    }
  }

  for (const boundaryId of view.boundaryIds) {
    const boundary = findBoundary(document, boundaryId);
    if (!boundary) {
      errors.push(
        createIssue(
          "missing-reference",
          `${path}.boundaryIds`,
          `View '${view.id}' references missing Boundary '${boundaryId}'.`,
          "Remove the ID or add the referenced Boundary.",
          view.id,
        ),
      );
    } else if (!boundary.elementIds.every((elementId) => view.elementIds.includes(elementId))) {
      errors.push(
        createIssue(
          "invalid-view",
          `${path}.boundaryIds`,
          "A View that includes a Boundary must include all of that Boundary's Elements.",
          "Include every Boundary Element or remove the Boundary from the View.",
          view.id,
        ),
      );
    }
  }

  if (view.kind === "system-context") {
    if (!view.elementIds.includes(view.systemId)) {
      errors.push(
        createIssue(
          "invalid-view",
          `${path}.elementIds`,
          "A System-context View must include its target Software system.",
          "Add systemId to elementIds.",
          view.id,
        ),
      );
    }
    if (view.boundaryIds.length > 0) {
      errors.push(
        createIssue(
          "invalid-view",
          `${path}.boundaryIds`,
          "A System-context View cannot expose container Boundaries.",
          "Remove Boundary IDs from the System-context View.",
          view.id,
        ),
      );
    }
    for (const element of includedElements) {
      if (element.kind === "container") {
        errors.push(
          createIssue(
            "invalid-view",
            `${path}.elementIds`,
            "A System-context View cannot include Containers.",
            "Remove Container IDs from the System-context View.",
            view.id,
          ),
        );
      } else if (
        element.kind === "software-system" &&
        element.id !== view.systemId &&
        !element.external
      ) {
        errors.push(
          createIssue(
            "invalid-view",
            `${path}.elementIds`,
            "A System-context View may show the target system and external Software systems only.",
            "Mark the contextual system external or model it in a separate view.",
            view.id,
          ),
        );
      }
    }
  } else {
    if (targetSystem?.kind === "software-system" && targetSystem.external) {
      errors.push(
        createIssue(
          "invalid-view",
          `${path}.systemId`,
          "A Container View must be centered on an owned Software system.",
          "Set systemId to a non-external Software system.",
          view.id,
        ),
      );
    }
    for (const element of includedElements) {
      const isAllowedContainer =
        element.kind === "container" && element.parentId === view.systemId;
      const isAllowedContext =
        element.kind === "person" ||
        (element.kind === "software-system" && element.external);
      if (!isAllowedContainer && !isAllowedContext) {
        errors.push(
          createIssue(
            "invalid-view",
            `${path}.elementIds`,
            "A Container View may include its Containers, People, and external Software systems only.",
            "Remove the Element or model it in a suitable View.",
            view.id,
          ),
        );
      }
    }
    for (const boundaryId of view.boundaryIds) {
      const boundary = findBoundary(document, boundaryId);
      if (boundary && boundary.ownerSystemId !== view.systemId) {
        errors.push(
          createIssue(
            "invalid-view",
            `${path}.boundaryIds`,
            "A Container View can include Boundaries owned by its target Software system only.",
            "Remove the Boundary or use a View centered on its owner system.",
            view.id,
          ),
        );
      }
    }
  }
  validateViewLayout(view, index, errors);
};

export const validateDesignDocument = (document: DesignDocument): ValidationResult => {
  const errors: DomainIssue[] = [];
  const warnings: DomainIssue[] = [];

  if (document.schemaVersion !== DESIGN_DOCUMENT_SCHEMA_VERSION) {
    errors.push(
      createIssue(
        "unsupported-schema-version",
        "schemaVersion",
        `Schema version '${document.schemaVersion}' is not supported.`,
        `Use schema version ${DESIGN_DOCUMENT_SCHEMA_VERSION} or migrate the document before use.`,
      ),
    );
  }
  if (!isNonBlank(document.id)) {
    errors.push(
      createIssue(
        "invalid-document",
        "id",
        "A Design document requires a non-empty ID.",
        "Provide a stable document ID.",
      ),
    );
  }
  if (!isNonBlank(document.metadata.name)) {
    errors.push(
      createIssue(
        "invalid-document",
        "metadata.name",
        "A Design document requires a non-empty name.",
        "Provide a human-readable Design name.",
      ),
    );
  }
  if (!hasUniqueValues(document.metadata.decisions.map((decision) => decision.id))) {
    errors.push(
      createIssue(
        "duplicate-id",
        "metadata.decisions",
        "Design decision IDs must be unique.",
        "Assign each decision a distinct ID.",
      ),
    );
  }
  for (const [index, decision] of document.metadata.decisions.entries()) {
    if (!isNonBlank(decision.id) || !isNonBlank(decision.statement)) {
      errors.push(
        createIssue(
          "invalid-document",
          `metadata.decisions[${index}]`,
          "Each Design decision requires a non-empty ID and statement.",
          "Provide both a stable ID and a concise decision statement.",
          decision.id,
        ),
      );
    }
  }
  for (const [index, assumption] of document.metadata.assumptions.entries()) {
    if (!isNonBlank(assumption)) {
      errors.push(
        createIssue(
          "invalid-document",
          `metadata.assumptions[${index}]`,
          "A Design assumption cannot be empty.",
          "Remove the value or provide a concise assumption.",
        ),
      );
    }
  }

  const records = [
    ...document.elements.map((record, index) => ({
      id: record.id,
      path: `elements[${index}].id`,
    })),
    ...document.relationships.map((record, index) => ({
      id: record.id,
      path: `relationships[${index}].id`,
    })),
    ...document.boundaries.map((record, index) => ({
      id: record.id,
      path: `boundaries[${index}].id`,
    })),
    ...document.views.map((record, index) => ({
      id: record.id,
      path: `views[${index}].id`,
    })),
    ...document.annotations.map((record, index) => ({
      id: record.id,
      path: `annotations[${index}].id`,
    })),
  ];
  const seenIds = new Set<string>();
  for (const record of records) {
    if (!isNonBlank(record.id)) {
      errors.push(
        createIssue(
          "invalid-document",
          record.path,
          "Every semantic and annotation record requires a non-empty ID.",
          "Provide a stable non-empty ID.",
        ),
      );
    } else if (seenIds.has(record.id)) {
      errors.push(
        createIssue(
          "duplicate-id",
          record.path,
          `ID '${record.id}' is already used by another document record.`,
          "Assign a globally unique record ID.",
          record.id,
        ),
      );
    } else {
      seenIds.add(record.id);
    }
  }

  for (const [index, element] of document.elements.entries()) {
    validateElement(document, element, index, errors);
  }

  for (const [index, relationship] of document.relationships.entries()) {
    const path = `relationships[${index}]`;
    if (!isNonBlank(relationship.description)) {
      errors.push(
        createIssue(
          "invalid-document",
          `${path}.description`,
          "Every Relationship requires a non-empty semantic description.",
          "Describe the interaction or purpose.",
          relationship.id,
        ),
      );
    }
    if (!findElement(document, relationship.sourceId) || !findElement(document, relationship.destinationId)) {
      errors.push(
        createIssue(
          "missing-reference",
          path,
          `Relationship '${relationship.id}' has a missing endpoint.`,
          "Create both endpoints or update the Relationship IDs.",
          relationship.id,
        ),
      );
    } else if (relationship.sourceId === relationship.destinationId) {
      errors.push(
        createIssue(
          "invalid-document",
          path,
          "A Relationship cannot use the same Element as both endpoints.",
          "Use two distinct Elements or remove the Relationship.",
          relationship.id,
        ),
      );
    }
  }

  for (const [index, boundary] of document.boundaries.entries()) {
    validateBoundary(document, boundary, index, errors);
  }
  for (const [index, view] of document.views.entries()) {
    validateView(document, view, index, errors);
  }
  for (const [index, annotation] of document.annotations.entries()) {
    validateAnnotation(document, annotation, index, errors);
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return { ok: true, warnings };
};

export const isContainerElement = (
  element: DesignElement,
): element is ContainerElement => element.kind === "container";
