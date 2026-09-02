import { z } from "zod";
import type { DesignDocument, DesignOperation } from "@/domain/design";
import { designDocumentSchema } from "@/server/design/http/schemas";
import type {
  ApplicationResult,
  DesignHead,
  DesignSnapshot,
  DesignSummary,
  OperationValidation,
} from "@/server/design/models";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

const issueSchema = z
  .object({
    code: z.enum([
      "unsupported-schema-version",
      "invalid-document",
      "duplicate-id",
      "missing-reference",
      "invalid-containment",
      "invalid-view",
      "invalid-layout",
      "invalid-annotation",
      "missing-target",
      "dependency-mismatch",
    ]),
    path: z.string(),
    message: z.string(),
    recoveryHint: z.string(),
    targetId: z.string().optional(),
  })
  .strict();

const snapshotSchema = z
  .object({
    id: z.string(),
    designId: z.string(),
    kind: z.enum(["initial", "draft"]),
    document: designDocumentSchema,
    createdAt: z.string(),
    createdByActorId: z.string(),
  })
  .strict();

const headSchema = z
  .object({
    designId: z.string(),
    workspaceId: z.string(),
    currentRevisionId: z.string(),
    snapshot: snapshotSchema,
  })
  .strict();

const summarySchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    currentRevisionId: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const operationValidationSchema = z
  .object({
    valid: z.boolean(),
    currentRevisionId: z.string(),
    candidateDocument: designDocumentSchema.optional(),
    issues: z.array(issueSchema),
  })
  .strict();

const failureSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum([
          "unauthenticated",
          "not-found",
          "forbidden",
          "conflict",
          "idempotency-conflict",
          "invalid-operation",
          "unsupported-schema-version",
          "internal-failure",
        ]),
        message: z.string(),
        recoveryHint: z.string(),
        issues: z.array(issueSchema).optional(),
      })
      .strict(),
    correlationId: z.string(),
    currentRevisionId: z.string().optional(),
  })
  .strict();

const resultSchema = <T>(dataSchema: z.ZodType<T>) =>
  z.union([
    z
      .object({
        ok: z.literal(true),
        data: dataSchema,
        correlationId: z.string(),
        currentRevisionId: z.string().optional(),
      })
      .strict(),
    failureSchema,
  ]);

const internalClientFailure = <T>(correlationId: string): ApplicationResult<T> => ({
  ok: false,
  error: {
    code: "internal-failure",
    message: "The Design API returned an unreadable response.",
    recoveryHint: "Retry the request or inspect the server logs with the correlation ID.",
  },
  correlationId,
});

const developmentHeaders = {
  "x-open-workboard-development-auth": "true",
  "x-actor-id": "actor-local-designer",
  "x-workspace-id": "workspace-acme",
  "x-actor-roles": "owner",
  "x-actor-scopes": "design:read,design:write",
};

export class DesignApiClient {
  private readonly fetchRequest: typeof fetch;

  constructor(
    private readonly baseUrl = "",
    fetchRequest?: typeof fetch,
  ) {
    this.fetchRequest =
      fetchRequest ?? ((input, init) => globalThis.fetch(input, init));
  }

  listDesigns() {
    return this.request<DesignSummary[]>("/api/designs", z.array(summarySchema));
  }

  getDesignHead(designId: string) {
    return this.request<DesignHead>(`/api/designs/${encodeURIComponent(designId)}`, headSchema);
  }

  getSnapshot(designId: string, revisionId: string) {
    return this.request<DesignSnapshot>(
      `/api/designs/${encodeURIComponent(designId)}/revisions/${encodeURIComponent(revisionId)}`,
      snapshotSchema,
    );
  }

  createDesign(document: DesignDocument, idempotencyKey?: string) {
    return this.request<DesignHead>("/api/designs", headSchema, {
      method: "POST",
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
      body: JSON.stringify({ document }),
    });
  }

  validateOperations(designId: string, operations: DesignOperation[]) {
    return this.request<OperationValidation>(
      `/api/designs/${encodeURIComponent(designId)}/validate`,
      operationValidationSchema,
      {
        method: "POST",
        body: JSON.stringify({ operations }),
      },
    );
  }

  saveDraft(
    designId: string,
    document: DesignDocument,
    expectedRevisionId: string,
    idempotencyKey?: string,
  ) {
    return this.request<DesignHead>(
      `/api/designs/${encodeURIComponent(designId)}/draft`,
      headSchema,
      {
        method: "PUT",
        headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
        body: JSON.stringify({ document, expectedRevisionId }),
      },
    );
  }

  private async request<T>(
    path: string,
    dataSchema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<ApplicationResult<T>> {
    const correlationId = `client-${Date.now().toString(36)}`;
    try {
      const response = await this.fetchRequest(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-correlation-id": correlationId,
          ...developmentHeaders,
          ...init.headers,
        },
      });
      const payload = (await response.json()) as JsonValue;
      const parsed = resultSchema(dataSchema).safeParse(payload);
      return parsed.success
        ? parsed.data
        : internalClientFailure<T>(
            response.headers.get("x-correlation-id") ?? correlationId,
          );
    } catch {
      return internalClientFailure<T>(correlationId);
    }
  }
}

export const designApiClient = new DesignApiClient();
