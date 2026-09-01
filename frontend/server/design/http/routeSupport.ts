import { z } from "zod";
import { createProductionId, type DomainIssue } from "@/domain/design";
import type {
  ActorContext,
  ActorRole,
  ActorScope,
  ApplicationFailure,
  ApplicationResult,
} from "@/server/design/models";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; failure: ApplicationFailure };

const isRole = (value: string): value is ActorRole =>
  value === "owner" || value === "editor" || value === "viewer";

const isScope = (value: string): value is ActorScope =>
  value === "design:read" || value === "design:write";

const csv = (value: string | null) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

export const actorFromRequest = (request: Request): ActorContext => ({
  actorId: request.headers.get("x-actor-id") ?? "actor-local-designer",
  workspaceId: request.headers.get("x-workspace-id") ?? "workspace-acme",
  roles: csv(request.headers.get("x-actor-roles")).filter(isRole).length
    ? csv(request.headers.get("x-actor-roles")).filter(isRole)
    : ["owner"],
  scopes: csv(request.headers.get("x-actor-scopes")).filter(isScope).length
    ? csv(request.headers.get("x-actor-scopes")).filter(isScope)
    : ["design:read", "design:write"],
  correlationId:
    request.headers.get("x-correlation-id") ?? createProductionId("request"),
});

const bodyFailure = (
  actor: ActorContext,
  issues: DomainIssue[],
): ApplicationFailure => ({
  ok: false,
  error: {
    code: "invalid-operation",
    message: "The HTTP request body is invalid.",
    recoveryHint: "Correct the reported request paths and retry.",
    issues,
  },
  correlationId: actor.correlationId,
});

export const parseJsonBody = async <T>(
  request: Request,
  actor: ActorContext,
  schema: z.ZodType<T>,
): Promise<ParsedBody<T>> => {
  let payload: JsonValue;
  try {
    payload = (await request.json()) as JsonValue;
  } catch {
    return {
      ok: false,
      failure: bodyFailure(actor, [
        {
          code: "invalid-document",
          path: "body",
          message: "The request body is not valid JSON.",
          recoveryHint: "Send a JSON request body with Content-Type application/json.",
        },
      ]),
    };
  }
  const parsed = schema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    failure: bodyFailure(
      actor,
      parsed.error.issues.map((issue) => ({
        code: "invalid-document",
        path: issue.path.map(String).join("."),
        message: issue.message,
        recoveryHint: "Provide a value matching the documented HTTP schema.",
      })),
    ),
  };
};

const statusForResult = <T>(result: ApplicationResult<T>) => {
  if (result.ok) return 200;
  switch (result.error.code) {
    case "not-found":
      return 404;
    case "forbidden":
      return 403;
    case "conflict":
      return 409;
    case "invalid-operation":
    case "unsupported-schema-version":
      return 422;
    case "internal-failure":
      return 500;
  }
};

export const applicationResponse = <T>(
  result: ApplicationResult<T>,
  successStatus = 200,
) => {
  const headers = new Headers({
    "content-type": "application/json",
    "x-correlation-id": result.correlationId,
  });
  if (result.currentRevisionId) {
    headers.set("x-current-revision-id", result.currentRevisionId);
  }
  return Response.json(result, {
    status: result.ok ? successStatus : statusForResult(result),
    headers,
  });
};
