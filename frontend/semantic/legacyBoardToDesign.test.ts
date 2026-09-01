import { describe, expect, it } from "vitest";
import { convertLegacyBoardToDesign } from "@/semantic/legacyBoardToDesign";
import type { PersistedBoardState } from "@/storage/board/types";

const boardFixture = (): PersistedBoardState => ({
  tool: "select",
  color: "#000000",
  lineWidth: 4,
  strokes: [
    {
      id: "stroke-box",
      tool: "square",
      color: "#3b82f6",
      lineWidth: 3,
      points: [
        { x: 10, y: 20 },
        { x: 130, y: 100 },
      ],
      bounds: { minX: 10, minY: 20, maxX: 130, maxY: 100 },
    },
    {
      id: "stroke-note",
      tool: "text",
      color: "#000000",
      lineWidth: 2,
      points: [{ x: 180, y: 90 }],
      bounds: { minX: 180, minY: 90, maxX: 280, maxY: 120 },
      text: "Keep this note",
      fontSize: 20,
    },
  ],
});

describe("legacy Board conversion", () => {
  it("preserves every v1 stroke as an annotation without mutating the source", () => {
    const board = boardFixture();
    const source = structuredClone(board);
    const result = convertLegacyBoardToDesign(board);
    if (!result.ok) throw new Error(result.errors[0]?.message);

    expect(result.document.annotations).toHaveLength(board.strokes.length);
    expect(result.document.annotations[1]).toMatchObject({
      kind: "legacy-stroke",
      stroke: { text: "Keep this note", fontSize: 20 },
    });
    expect(result.document.views[0]?.elementIds).toEqual(["system-legacy-board"]);
    expect(board).toEqual(source);
  });
});
