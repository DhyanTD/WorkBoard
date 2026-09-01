import { z } from "zod";

const idSchema = z.string().trim().min(1);
const finiteNumberSchema = z.number().finite();
const pointSchema = z
  .object({ x: finiteNumberSchema, y: finiteNumberSchema })
  .strict();
const rectangleSchema = pointSchema
  .extend({
    width: finiteNumberSchema.positive(),
    height: finiteNumberSchema.positive(),
  })
  .strict();
const descriptionSchema = z.string().trim().min(1);
const responsibilitiesSchema = z.array(descriptionSchema).optional();

const personSchema = z
  .object({
    id: idSchema,
    kind: z.literal("person"),
    name: descriptionSchema,
    description: z.string().optional(),
    responsibilities: responsibilitiesSchema,
  })
  .strict();
const softwareSystemSchema = z
  .object({
    id: idSchema,
    kind: z.literal("software-system"),
    name: descriptionSchema,
    description: z.string().optional(),
    responsibilities: responsibilitiesSchema,
    external: z.boolean(),
  })
  .strict();
const containerSchema = z
  .object({
    id: idSchema,
    kind: z.literal("container"),
    name: descriptionSchema,
    description: z.string().optional(),
    responsibilities: responsibilitiesSchema,
    parentId: idSchema,
    containerType: z.enum(["application", "datastore", "queue"]),
  })
  .strict();
const elementSchema = z.discriminatedUnion("kind", [
  personSchema,
  softwareSystemSchema,
  containerSchema,
]);

const relationshipSchema = z
  .object({
    id: idSchema,
    sourceId: idSchema,
    destinationId: idSchema,
    description: descriptionSchema,
    technology: z.string().optional(),
  })
  .strict();

const boundarySchema = z
  .object({
    id: idSchema,
    name: descriptionSchema,
    description: z.string().optional(),
    ownerSystemId: idSchema,
    elementIds: z.array(idSchema),
  })
  .strict();

const viewBaseSchema = z.object({
  id: idSchema,
  name: descriptionSchema,
  description: z.string().optional(),
  systemId: idSchema,
  elementIds: z.array(idSchema),
  relationshipIds: z.array(idSchema),
  boundaryIds: z.array(idSchema),
  layout: z
    .object({
      elements: z.record(z.string(), rectangleSchema),
      boundaries: z.record(z.string(), rectangleSchema),
    })
    .strict(),
});
const systemContextViewSchema = viewBaseSchema
  .extend({ kind: z.literal("system-context") })
  .strict();
const containerViewSchema = viewBaseSchema
  .extend({ kind: z.literal("container") })
  .strict();
const viewSchema = z.discriminatedUnion("kind", [
  systemContextViewSchema,
  containerViewSchema,
]);

const legacyStrokeSchema = z
  .object({
    id: z.string().optional(),
    tool: descriptionSchema,
    color: descriptionSchema,
    lineWidth: finiteNumberSchema,
    points: z.array(pointSchema),
    bounds: z
      .object({
        minX: finiteNumberSchema,
        minY: finiteNumberSchema,
        maxX: finiteNumberSchema,
        maxY: finiteNumberSchema,
      })
      .strict(),
    text: z.string().optional(),
    fontSize: finiteNumberSchema.optional(),
    startBindingId: z.string().optional(),
    endBindingId: z.string().optional(),
  })
  .strict();
const textAnnotationSchema = z
  .object({
    id: idSchema,
    kind: z.literal("text"),
    viewId: idSchema,
    text: descriptionSchema,
    position: pointSchema,
  })
  .strict();
const legacyStrokeAnnotationSchema = z
  .object({
    id: idSchema,
    kind: z.literal("legacy-stroke"),
    viewId: idSchema,
    stroke: legacyStrokeSchema,
  })
  .strict();
const annotationSchema = z.discriminatedUnion("kind", [
  textAnnotationSchema,
  legacyStrokeAnnotationSchema,
]);

const metadataSchema = z
  .object({
    name: descriptionSchema,
    description: z.string().optional(),
    assumptions: z.array(descriptionSchema),
    decisions: z.array(
      z
        .object({ id: idSchema, statement: descriptionSchema })
        .strict(),
    ),
  })
  .strict();

export const designDocumentSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.number().int(),
    metadata: metadataSchema,
    elements: z.array(elementSchema),
    relationships: z.array(relationshipSchema),
    boundaries: z.array(boundarySchema),
    views: z.array(viewSchema),
    annotations: z.array(annotationSchema),
  })
  .strict();

const expectedDependenciesSchema = z.object({
  expectedDependentIds: z.array(idSchema),
});

export const designOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add-element"), element: elementSchema }).strict(),
  z.object({ kind: z.literal("update-element"), element: elementSchema }).strict(),
  expectedDependenciesSchema
    .extend({ kind: z.literal("remove-element"), elementId: idSchema })
    .strict(),
  z
    .object({ kind: z.literal("add-relationship"), relationship: relationshipSchema })
    .strict(),
  z
    .object({ kind: z.literal("update-relationship"), relationship: relationshipSchema })
    .strict(),
  expectedDependenciesSchema
    .extend({ kind: z.literal("remove-relationship"), relationshipId: idSchema })
    .strict(),
  z.object({ kind: z.literal("add-boundary"), boundary: boundarySchema }).strict(),
  z.object({ kind: z.literal("update-boundary"), boundary: boundarySchema }).strict(),
  expectedDependenciesSchema
    .extend({ kind: z.literal("remove-boundary"), boundaryId: idSchema })
    .strict(),
  z.object({ kind: z.literal("add-view"), view: viewSchema }).strict(),
  z.object({ kind: z.literal("update-view"), view: viewSchema }).strict(),
  z
    .object({
      kind: z.literal("set-view-layout"),
      viewId: idSchema,
      layout: viewBaseSchema.shape.layout,
    })
    .strict(),
  expectedDependenciesSchema
    .extend({ kind: z.literal("remove-view"), viewId: idSchema })
    .strict(),
  z.object({ kind: z.literal("add-annotation"), annotation: annotationSchema }).strict(),
  expectedDependenciesSchema
    .extend({ kind: z.literal("remove-annotation"), annotationId: idSchema })
    .strict(),
  z
    .object({ kind: z.literal("update-design-metadata"), metadata: metadataSchema })
    .strict(),
]);

export const createDesignRequestSchema = z
  .object({ document: designDocumentSchema })
  .strict();

export const validateOperationsRequestSchema = z
  .object({ operations: z.array(designOperationSchema) })
  .strict();

export const saveDraftRequestSchema = z
  .object({
    document: designDocumentSchema,
    expectedRevisionId: idSchema,
  })
  .strict();
