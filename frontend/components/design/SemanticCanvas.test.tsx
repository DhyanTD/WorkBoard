// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SemanticCanvas from "@/components/design/SemanticCanvas";
import { convertLegacyBoardToDesign } from "@/semantic/legacyBoardToDesign";
import { useSemanticDesignStore } from "@/store/useSemanticDesignStore";

describe("SemanticCanvas legacy annotation rendering", () => {
  afterEach(cleanup);

  it("keeps converted geometry and text visibly distinct", () => {
    const converted = convertLegacyBoardToDesign({
      tool: "select",
      color: "#000000",
      lineWidth: 4,
      strokes: [
        {
          id: "box",
          tool: "square",
          color: "#3b82f6",
          lineWidth: 3,
          points: [
            { x: 300, y: 160 },
            { x: 440, y: 260 },
          ],
          bounds: { minX: 300, minY: 160, maxX: 440, maxY: 260 },
        },
        {
          id: "note",
          tool: "text",
          color: "#202124",
          lineWidth: 2,
          points: [{ x: 330, y: 310 }],
          bounds: { minX: 330, minY: 310, maxX: 480, maxY: 340 },
          text: "Preserved note",
          fontSize: 20,
        },
      ],
    });
    if (!converted.ok) throw new Error(converted.errors[0]?.message);
    useSemanticDesignStore.setState({
      document: converted.document,
      activeViewId: converted.document.views[0]?.id ?? null,
      status: "ready",
      scale: 1,
      offset: { x: 0, y: 0 },
    });

    render(<SemanticCanvas />);

    expect(screen.getByTestId("annotation-annotation-legacy-0-box").tagName).toBe(
      "rect",
    );
    expect(screen.getByTestId("annotation-annotation-legacy-1-note").tagName).toBe(
      "text",
    );
    expect(screen.getByText("Preserved note")).toBeTruthy();
  });
});
