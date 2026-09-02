import { describe, expect, it } from "vitest";
import { InMemoryActorDirectory } from "@/server/auth/InMemoryActorDirectory";
import { resolveRequestActor } from "@/server/auth/resolveRequestActor";

const directory = new InMemoryActorDirectory([
  {
    actorId: "principal-owner",
    workspaceId: "workspace-acme",
    role: "owner",
    workosUserId: "user_workos",
    workosOrganizationId: "org_workos",
  },
  {
    actorId: "principal-viewer",
    workspaceId: "workspace-acme",
    role: "viewer",
  },
]);

describe("resolveRequestActor", () => {
  it("maps a verified WorkOS identity through application-owned membership", async () => {
    const result = await resolveRequestActor(
      new Request("http://workboard.test/api/designs", {
        headers: { "x-correlation-id": "request-workos" },
      }),
      directory,
      async () => ({
        userId: "user_workos",
        organizationId: "org_workos",
        sessionId: "session-workos",
        scopes: ["design:read", "design:write"],
      }),
    );

    expect(result).toEqual({
      ok: true,
      actor: {
        actorId: "principal-owner",
        workspaceId: "workspace-acme",
        roles: ["owner"],
        scopes: ["design:read", "design:write"],
        correlationId: "request-workos",
        authenticationMethod: "workos-session",
        sessionId: "session-workos",
      },
    });
  });

  it("uses membership as the role source and token permissions as an upper bound", async () => {
    const result = await resolveRequestActor(
      new Request("http://workboard.test/api/designs", {
        headers: {
          "x-open-workboard-development-auth": "true",
          "x-actor-id": "principal-viewer",
          "x-workspace-id": "workspace-acme",
          "x-actor-roles": "owner",
          "x-actor-scopes": "design:read,design:write",
        },
      }),
      directory,
    );

    expect(result.ok && result.actor.roles).toEqual(["viewer"]);
    expect(result.ok && result.actor.scopes).toEqual(["design:read"]);
  });

  it("fails closed when the WorkOS identity lacks an application membership", async () => {
    const result = await resolveRequestActor(
      new Request("http://workboard.test/api/designs"),
      directory,
      async () => ({
        userId: "user_without_membership",
        organizationId: "org_workos",
        sessionId: "session-workos",
        scopes: ["design:read"],
      }),
    );

    expect(result).toMatchObject({ ok: false, failure: { error: { code: "forbidden" } } });
  });
});
