import { createProductionId } from "@/domain/design";
import { roleScopes, type ActorDirectory } from "@/server/auth/ActorDirectory";
import type {
  ActorContext,
  ActorScope,
  ApplicationFailure,
} from "@/server/design/models";

export type WorkOsPrincipal = {
  userId: string;
  organizationId: string;
  sessionId: string;
  scopes: ActorScope[];
};

export type WorkOsSessionReader = () => Promise<WorkOsPrincipal | null>;

export type ActorResolution =
  | { ok: true; actor: ActorContext }
  | { ok: false; failure: ApplicationFailure };

const isActorScope = (value: string): value is ActorScope =>
  value === "design:read" || value === "design:write";

const csvScopes = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(isActorScope);

const readWorkOsSession: WorkOsSessionReader = async () => {
  try {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    const session = await withAuth();
    if (!session.user || !session.organizationId || !session.sessionId) return null;
    return {
      userId: session.user.id,
      organizationId: session.organizationId,
      sessionId: session.sessionId,
      scopes: (session.permissions ?? []).filter(isActorScope),
    };
  } catch {
    return null;
  }
};

const failure = (correlationId: string, code: "unauthenticated" | "forbidden", message: string): ActorResolution => ({
  ok: false,
  failure: {
    ok: false,
    error: {
      code,
      message,
      recoveryHint:
        code === "unauthenticated"
          ? "Sign in through WorkOS and retry the request."
          : "Ask a Workspace owner to create or reactivate the application membership mapping.",
    },
    correlationId,
  },
});

const developmentAuthEnabled = () =>
  process.env.OPEN_WORKBOARD_DEV_AUTH === "true" ||
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test";

export const resolveRequestActor = async (
  request: Request,
  directory: ActorDirectory,
  sessionReader: WorkOsSessionReader = readWorkOsSession,
): Promise<ActorResolution> => {
  const correlationId =
    request.headers.get("x-correlation-id") ?? createProductionId("request");
  if (
    developmentAuthEnabled() &&
    request.headers.get("x-open-workboard-development-auth") === "true"
  ) {
    const actorId = request.headers.get("x-actor-id") ?? "";
    const workspaceId = request.headers.get("x-workspace-id") ?? "";
    const member = await directory.resolveDevelopment(actorId, workspaceId);
    if (!member) {
      return failure(
        correlationId,
        "forbidden",
        "The development actor has no active Workspace membership.",
      );
    }
    const allowed = roleScopes(member.role);
    const requested = csvScopes(request.headers.get("x-actor-scopes"));
    return {
      ok: true,
      actor: {
        actorId: member.actorId,
        workspaceId: member.workspaceId,
        roles: [member.role],
        scopes: (requested.length ? requested : allowed).filter((scope) =>
          allowed.includes(scope),
        ),
        correlationId,
        authenticationMethod: "development",
      },
    };
  }

  const principal = await sessionReader();
  if (!principal) {
    return failure(correlationId, "unauthenticated", "A verified WorkOS session is required.");
  }
  const member = await directory.resolveWorkOs(
    principal.userId,
    principal.organizationId,
  );
  if (!member) {
    return failure(
      correlationId,
      "forbidden",
      "The authenticated WorkOS identity has no active application Workspace membership.",
    );
  }
  const roleAllowed = roleScopes(member.role);
  return {
    ok: true,
    actor: {
      actorId: member.actorId,
      workspaceId: member.workspaceId,
      roles: [member.role],
      scopes: principal.scopes.filter((scope) => roleAllowed.includes(scope)),
      correlationId,
      authenticationMethod: "workos-session",
      sessionId: principal.sessionId,
    },
  };
};
