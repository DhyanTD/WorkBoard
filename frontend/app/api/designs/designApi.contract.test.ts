import { describe, expect, it } from "vitest";
import { DesignApiClient } from "@/client/designApi";
import {
  COMMERCE_PLATFORM_DOCUMENT_ID,
  type DesignOperation,
} from "@/domain/design";
import { GET as listDesigns } from "@/app/api/designs/route";
import { GET as getDesign } from "@/app/api/designs/[designId]/route";
import { POST as validateDesign } from "@/app/api/designs/[designId]/validate/route";
import { actorFromRequest } from "@/server/design/http/routeSupport";
import type {
  ApplicationResult,
  DesignHead,
  OperationValidation,
} from "@/server/design/models";
import { getDesignRuntime } from "@/server/design/runtime";

const actorHeaders = {
  "x-actor-id": "actor-contract",
  "x-workspace-id": "workspace-acme",
  "x-actor-roles": "owner",
  "x-actor-scopes": "design:read,design:write",
  "x-correlation-id": "request-contract",
};

const routeFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === "/api/designs" && request.method === "GET") {
    return listDesigns(request);
  }
  if (
    url.pathname === `/api/designs/${COMMERCE_PLATFORM_DOCUMENT_ID}` &&
    request.method === "GET"
  ) {
    return getDesign(request, {
      params: Promise.resolve({ designId: COMMERCE_PLATFORM_DOCUMENT_ID }),
    });
  }
  if (
    url.pathname === `/api/designs/${COMMERCE_PLATFORM_DOCUMENT_ID}/validate` &&
    request.method === "POST"
  ) {
    return validateDesign(request, {
      params: Promise.resolve({ designId: COMMERCE_PLATFORM_DOCUMENT_ID }),
    });
  }
  return Response.json({ message: "Route test adapter did not match." }, { status: 404 });
};

describe("Design HTTP contract", () => {
  it("returns the same head through HTTP and the direct service", async () => {
    const request = new Request(
      `http://workboard.test/api/designs/${COMMERCE_PLATFORM_DOCUMENT_ID}`,
      { headers: actorHeaders },
    );
    const direct = await getDesignRuntime().service.getDesignHead(
      actorFromRequest(request),
      COMMERCE_PLATFORM_DOCUMENT_ID,
    );
    const response = await getDesign(request, {
      params: Promise.resolve({ designId: COMMERCE_PLATFORM_DOCUMENT_ID }),
    });
    const http = (await response.json()) as ApplicationResult<DesignHead>;

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("request-contract");
    expect(response.headers.get("x-current-revision-id")).toBe(
      "revision-commerce-v1",
    );
    expect(http).toEqual(direct);
  });

  it("validates operation batches equivalently and rejects malformed input", async () => {
    const operations: DesignOperation[] = [
      {
        kind: "update-design-metadata",
        metadata: {
          name: "Contract review",
          assumptions: [],
          decisions: [],
        },
      },
    ];
    const request = new Request(
      `http://workboard.test/api/designs/${COMMERCE_PLATFORM_DOCUMENT_ID}/validate`,
      {
        method: "POST",
        headers: { ...actorHeaders, "content-type": "application/json" },
        body: JSON.stringify({ operations }),
      },
    );
    const direct = await getDesignRuntime().service.validateOperations(
      actorFromRequest(request),
      COMMERCE_PLATFORM_DOCUMENT_ID,
      operations,
    );
    const response = await validateDesign(request, {
      params: Promise.resolve({ designId: COMMERCE_PLATFORM_DOCUMENT_ID }),
    });
    const http = (await response.json()) as ApplicationResult<OperationValidation>;
    expect(http).toEqual(direct);

    const malformed = await validateDesign(
      new Request(
        `http://workboard.test/api/designs/${COMMERCE_PLATFORM_DOCUMENT_ID}/validate`,
        {
          method: "POST",
          headers: { ...actorHeaders, "content-type": "application/json" },
          body: JSON.stringify({ operations: [{ kind: "add-element" }] }),
        },
      ),
      { params: Promise.resolve({ designId: COMMERCE_PLATFORM_DOCUMENT_ID }) },
    );
    expect(malformed.status).toBe(422);
  });

  it("lets the typed client consume the in-memory-backed routes", async () => {
    const client = new DesignApiClient("http://workboard.test", routeFetch);
    const head = await client.getDesignHead(COMMERCE_PLATFORM_DOCUMENT_ID);
    const validation = await client.validateOperations(
      COMMERCE_PLATFORM_DOCUMENT_ID,
      [],
    );

    expect(head.ok && head.data.designId).toBe(COMMERCE_PLATFORM_DOCUMENT_ID);
    expect(validation.ok && validation.data.valid).toBe(true);
  });
});
