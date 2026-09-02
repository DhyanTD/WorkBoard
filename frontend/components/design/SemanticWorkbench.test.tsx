// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SemanticWorkbench from "@/components/design/SemanticWorkbench";
import { designApiClient } from "@/client/designApi";
import { createCommercePlatformFixture } from "@/domain/design";
import { useSemanticDesignStore } from "@/store/useSemanticDesignStore";

const document = createCommercePlatformFixture();

describe("SemanticWorkbench", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSemanticDesignStore.setState({
      document: null,
      workspaceId: null,
      currentRevisionId: null,
      activeViewId: null,
      selectedElementId: null,
      selectedRelationshipId: null,
      past: [],
      future: [],
      status: "idle",
    });
    vi.spyOn(designApiClient, "getDesignHead").mockResolvedValue({
      ok: true,
      data: {
        designId: document.id,
        workspaceId: "workspace-acme",
        currentRevisionId: "revision-component",
        snapshot: {
          id: "revision-component",
          designId: document.id,
          kind: "initial",
          document,
          createdAt: "2026-08-31T12:00:00.000Z",
          createdByActorId: "actor-component",
        },
      },
      correlationId: "request-component",
      currentRevisionId: "revision-component",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the API-backed fixture, selects by ID, and switches views", async () => {
    render(<SemanticWorkbench />);

    const customer = await screen.findByTestId("element-person-customer");
    fireEvent.keyDown(customer, { key: "Enter" });
    expect(screen.getByTestId("element-inspector").textContent).toContain(
      "person-customer",
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Commerce Platform containers/i }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("element-container-order-api")).toBeTruthy(),
    );
    expect(useSemanticDesignStore.getState().activeViewId).toBe(
      "view-commerce-containers",
    );
  });

  it("adds a semantic element through the operation-driven UI", async () => {
    render(<SemanticWorkbench />);
    await screen.findByTestId("element-person-customer");
    fireEvent.click(
      screen.getByRole("button", { name: /Commerce Platform containers/i }),
    );
    const before = useSemanticDesignStore.getState().document?.elements.length ?? 0;
    fireEvent.click(screen.getByRole("button", { name: "Datastore" }));

    expect(useSemanticDesignStore.getState().document?.elements).toHaveLength(
      before + 1,
    );
    expect(screen.getByDisplayValue("New datastore")).toBeTruthy();
  });
});
