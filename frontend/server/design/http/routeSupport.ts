import { z } from "zod";
import type { DomainIssue } from "@/domain/design";
import { resolveRequestActor } from "@/server/auth/resolveRequestActor";
import type { ActorDirectory } from "@/server/auth/ActorDirectory";
import type {
  ActorContext,
  ApplicationFailure,
  ApplicationResult,
} from "@/server/design/models";
import type { WriteOptions } from "@/server/design/DesignService";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; failure: ApplicationFailure };

export const actorFromRequest = (request: Request, directory: ActorDirectory) =>
  resolveRequestActor(request, directory);

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

export const writeOptionsFromRequest = (
  request: Request,
  actor: ActorContext,
): { ok: true; options: WriteOptions } | { ok: false; failure: ApplicationFailure } => {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (
    idempotencyKey &&
    (idempotencyKey.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey))
  ) {
    return {
      ok: false,
      failure: bodyFailure(actor, [
        {
          code: "invalid-document",
          path: "headers.idempotency-key",
          message: "Idempotency-Key must be at most 200 URL-safe characters.",
          recoveryHint: "Use letters, numbers, dot, underscore, colon, or hyphen.",
        },
      ]),
    };
  }
  return {
    ok: true,
    options: idempotencyKey ? { idempotencyKey } : {},
  };
};

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
    case "unauthenticated":
      return 401;
    case "not-found":
      return 404;
    case "forbidden":
      return 403;
    case "conflict":
    case "idempotency-conflict":
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
