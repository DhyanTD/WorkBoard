import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { camera, useBoardStore } from "@/store/useBoardStore";
import type { Stroke } from "@/lib/board";

const stroke: Stroke = {
  id: "shape-one",
  tool: "square",
  color: "#000000",
  lineWidth: 3,
  points: [
    { x: 10, y: 10 },
    { x: 110, y: 90 },
  ],
  bounds: { minX: 10, minY: 10, maxX: 110, maxY: 90 },
};

describe("legacy Board behavior", () => {
  beforeEach(() => {
    camera.offset = { x: 0, y: 0 };
    camera.scale = 1;
    camera.viewport = { w: 800, h: 600 };
    useBoardStore.setState({
      tool: "select",
      strokes: [],
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      selectedIndices: [],
      clipboardStrokes: [],
      pasteCount: 0,
      canPaste: false,
      scale: 1,
    });
  });

  it("retains select, copy/paste, delete, undo, and redo behavior", () => {
    const store = useBoardStore.getState();
    store.commitStroke(stroke);
    useBoardStore.getState().setSelectedIndices([0]);
    useBoardStore.getState().copySelectedStrokes();
    useBoardStore.getState().pasteStrokes();
    expect(useBoardStore.getState().strokes).toHaveLength(2);
    expect(useBoardStore.getState().strokes[1]?.id).not.toBe(stroke.id);

    useBoardStore.getState().deleteSelectedStrokes();
    expect(useBoardStore.getState().strokes).toHaveLength(1);
    useBoardStore.getState().undo();
    expect(useBoardStore.getState().strokes).toHaveLength(2);
    useBoardStore.getState().redo();
    expect(useBoardStore.getState().strokes).toHaveLength(1);
  });

  it("retains zoom, pan-state reset, and clear behavior", () => {
    useBoardStore.getState().commitStroke(stroke);
    useBoardStore.getState().zoomIn();
    expect(camera.scale).toBeGreaterThan(1);
    camera.offset = { x: 90, y: 45 };
    useBoardStore.getState().resetView();
    expect(camera).toMatchObject({ offset: { x: 0, y: 0 }, scale: 1 });
    useBoardStore.getState().clear();
    expect(useBoardStore.getState().strokes).toEqual([]);
  });
});
