import type { ActorContext, ApplicationFailure } from "@/server/design/models";

const failure = (actor: ActorContext, message: string): ApplicationFailure => ({
  ok: false,
  error: {
    code: "forbidden",
    message,
    recoveryHint: "Use an actor with access to this workspace and the required design scope.",
  },
  correlationId: actor.correlationId,
});

export const authorizeRead = (actor: ActorContext): ApplicationFailure | null => {
  const hasRole = actor.roles.some((role) =>
    role === "owner" || role === "editor" || role === "viewer",
  );
  return hasRole && actor.scopes.includes("design:read")
    ? null
    : failure(actor, "The actor is not permitted to read Designs.");
};

export const authorizeWrite = (actor: ActorContext): ApplicationFailure | null => {
  const hasRole = actor.roles.some((role) => role === "owner" || role === "editor");
  return hasRole && actor.scopes.includes("design:write")
    ? null
    : failure(actor, "The actor is not permitted to change Designs.");
};

export const authorizeWorkspace = (
  actor: ActorContext,
  workspaceId: string,
): ApplicationFailure | null =>
  actor.workspaceId === workspaceId
    ? null
    : failure(actor, "The Design belongs to a different Workspace.");
