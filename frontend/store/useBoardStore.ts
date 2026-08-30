"use client";

import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  splitFreehandStrokeByEraser,
  translateStroke,
  zoomAt,
  type Point,
  type Stroke,
  type Tool,
} from "@/lib/board";
import {
  BOARD_STORAGE_KEY,
  boardIndexedDbStorage,
} from "@/storage/board/boardStorage";

/**
 * Camera state. `offset` is the world-space coordinate at the top-left of the
 * viewport; `scale` converts world -> screen. Stored as mutable module state
 * because panning fires at pointer-move rate; the Canvas mutates it directly
 * and the store only bumps `cameraEpoch` to signal a redraw (e.g. Reset View).
 * `scale` is also mirrored as reactive state so the toolbar can render it.
 */
export const camera = {
  offset: { x: 0, y: 0 },
  scale: 1,
  /** Viewport size in CSS pixels, maintained by the Canvas on resize. */
  viewport: { w: 0, h: 0 },
};

const clampScale = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

type EraseChange = {
  index: number;
  before: Stroke;
  after: Stroke[];
};

type ReplaceChange = {
  index: number;
  before: Stroke;
  after: Stroke;
};

type RemoveChange = {
  index: number;
  stroke: Stroke;
};

type HistoryEntry = {
  kind: "add" | "remove";
  index: number;
  stroke: Stroke;
} | {
  kind: "erase";
  eraser: Stroke;
  changes: EraseChange[];
} | {
  kind: "replace";
  changes: [ReplaceChange];
} | {
  kind: "replace-many";
  changes: ReplaceChange[];
} | {
  kind: "remove-many";
  changes: RemoveChange[];
} | {
  kind: "add-many";
  index: number;
  strokes: Stroke[];
};

const applyReplacements = (
  strokes: Stroke[],
  changes: ReplaceChange[],
  version: "before" | "after",
) => {
  const next = [...strokes];
  for (const change of changes) next[change.index] = change[version];
  return next;
};

const restoreRemovedStrokes = (strokes: Stroke[], changes: RemoveChange[]) => {
  const next = [...strokes];
  for (const change of [...changes].sort((a, b) => a.index - b.index)) {
    next.splice(change.index, 0, change.stroke);
  }
  return next;
};

const applyRemovals = (strokes: Stroke[], changes: RemoveChange[]) => {
  const next = [...strokes];
  for (const change of [...changes].sort((a, b) => b.index - a.index)) {
    next.splice(change.index, 1);
  }
  return next;
};

let fallbackStrokeId = 0;

const createStrokeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `stroke-${Date.now()}-${fallbackStrokeId++}`;

const withStrokeId = (stroke: Stroke): Stroke =>
  stroke.id
    ? stroke
    : {
        ...stroke,
        id: createStrokeId(),
      };

const undoErase = (strokes: Stroke[], changes: EraseChange[]) => {
  // The visual eraser mark is always appended after the changed fragments.
  const restored = strokes.slice(0, -1);
  for (let index = changes.length - 1; index >= 0; index -= 1) {
    const change = changes[index];
    const fragmentIndex = changes
      .slice(0, index)
      .reduce(
        (offset, previous) => offset + previous.after.length - 1,
        change.index,
      );
    restored.splice(fragmentIndex, change.after.length, change.before);
  }
  return restored;
};

const redoErase = (strokes: Stroke[], entry: Extract<HistoryEntry, { kind: "erase" }>) => {
  const erased = [...strokes];
  let offset = 0;
  for (const change of entry.changes) {
    const index = change.index + offset;
    erased.splice(index, 1, ...change.after);
    offset += change.after.length - 1;
  }
  erased.push(entry.eraser);
  return erased;
};

type BoardState = {
  tool: Tool;
  color: string;
  lineWidth: number;
  strokes: Stroke[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  selectedIndices: number[];
  clipboardStrokes: Stroke[];
  pasteCount: number;
  canPaste: boolean;
  /** Incremented whenever the camera must be re-rendered (Reset View). */
  cameraEpoch: number;
  /** Reactive mirror of `camera.scale` so the toolbar can display it. */
  scale: number;

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setLineWidth: (width: number) => void;
  setSelectedIndices: (indices: number[]) => void;
  commitStroke: (stroke: Stroke) => void;
  eraseWithStroke: (eraser: Stroke) => void;
  removeStrokeAt: (index: number) => void;
  deleteSelectedStrokes: () => void;
  copySelectedStrokes: () => void;
  pasteStrokes: () => void;
  replaceStrokeAt: (index: number, stroke: Stroke) => void;
  replaceStrokes: (changes: ReplaceChange[]) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  resetView: () => void;
  /** Multiply current scale by `factor`, anchored at the given screen point. */
  zoomBy: (factor: number, anchor: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export { BOARD_STORAGE_KEY };
const BOARD_STORAGE_VERSION = 1;

const createBoardState: StateCreator<BoardState> = (set) => ({
  tool: "pencil",
  color: "#000000",
  lineWidth: 4,
  strokes: [],
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  selectedIndices: [],
  clipboardStrokes: [],
  pasteCount: 0,
  canPaste: false,
  cameraEpoch: 0,
  scale: 1,

  setTool: (tool) =>
    set((s) => ({
      tool,
      selectedIndices: tool === "select" ? s.selectedIndices : [],
    })),
  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setSelectedIndices: (selectedIndices) =>
    set({ selectedIndices: [...new Set(selectedIndices)].sort((a, b) => a - b) }),

  commitStroke: (stroke) =>
    set((s) => {
      const identifiedStroke = withStrokeId(stroke);
      return {
        strokes: [...s.strokes, identifiedStroke],
        undoStack: [
          ...s.undoStack,
          { kind: "add", index: s.strokes.length, stroke: identifiedStroke },
        ],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  eraseWithStroke: (eraser) =>
    set((s) => {
      const changes: EraseChange[] = [];
      const after = s.strokes.flatMap((stroke, index) => {
        if (stroke.tool === "eraser") return [stroke];
        const fragments = splitFreehandStrokeByEraser(stroke, eraser);
        if (fragments.length !== 1 || fragments[0] !== stroke) {
          changes.push({ index, before: stroke, after: fragments });
        }
        return fragments;
      });
      // Keep a white mask for existing shapes and for exact canvas rendering.
      after.push(eraser);
      return {
        strokes: after,
        undoStack: [...s.undoStack, { kind: "erase", eraser, changes }],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  removeStrokeAt: (index) =>
    set((s) => {
      const stroke = s.strokes[index];
      if (!stroke) return s;
      return {
        strokes: [...s.strokes.slice(0, index), ...s.strokes.slice(index + 1)],
        selectedIndices: s.selectedIndices.flatMap((selectedIndex) =>
          selectedIndex === index
            ? []
            : [selectedIndex > index ? selectedIndex - 1 : selectedIndex],
        ),
        undoStack: [...s.undoStack, { kind: "remove", index, stroke }],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  deleteSelectedStrokes: () =>
    set((s) => {
      const changes = s.selectedIndices.flatMap((index) => {
        const stroke = s.strokes[index];
        return stroke ? [{ index, stroke }] : [];
      });
      if (changes.length === 0) return { selectedIndices: [] };
      return {
        strokes: applyRemovals(s.strokes, changes),
        selectedIndices: [],
        undoStack: [...s.undoStack, { kind: "remove-many", changes }],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  copySelectedStrokes: () =>
    set((s) => {
      const clipboardStrokes = s.selectedIndices.flatMap((index) => {
        const stroke = s.strokes[index];
        return stroke
          ? [
              {
                ...stroke,
                points: stroke.points.map((point) => ({ ...point })),
                bounds: { ...stroke.bounds },
              },
            ]
          : [];
      });
      return {
        clipboardStrokes,
        pasteCount: 0,
        canPaste: clipboardStrokes.length > 0,
      };
    }),

  pasteStrokes: () =>
    set((s) => {
      if (s.clipboardStrokes.length === 0) return s;

      const newIds = s.clipboardStrokes.map(() => createStrokeId());
      const idMap = new Map<string, string>();
      s.clipboardStrokes.forEach((stroke, index) => {
        if (stroke.id) idMap.set(stroke.id, newIds[index]);
      });
      const pasteOffset = 24 * (s.pasteCount + 1);
      const pasted = s.clipboardStrokes.map((stroke, index) =>
        translateStroke(
          {
            ...stroke,
            id: newIds[index],
            startBindingId: stroke.startBindingId
              ? idMap.get(stroke.startBindingId)
              : undefined,
            endBindingId: stroke.endBindingId
              ? idMap.get(stroke.endBindingId)
              : undefined,
          },
          { x: pasteOffset, y: pasteOffset },
        ),
      );
      const startIndex = s.strokes.length;
      return {
        tool: "select",
        strokes: [...s.strokes, ...pasted],
        selectedIndices: pasted.map((_, index) => startIndex + index),
        pasteCount: s.pasteCount + 1,
        undoStack: [
          ...s.undoStack,
          { kind: "add-many", index: startIndex, strokes: pasted },
        ],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  replaceStrokeAt: (index, after) =>
    set((s) => {
      const before = s.strokes[index];
      if (!before) return s;
      return {
        strokes: [
          ...s.strokes.slice(0, index),
          after,
          ...s.strokes.slice(index + 1),
        ],
        undoStack: [
          ...s.undoStack,
          { kind: "replace", changes: [{ index, before, after }] },
        ],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  replaceStrokes: (changes) =>
    set((s) => {
      const validChanges = changes.filter((change) => s.strokes[change.index]);
      if (validChanges.length === 0) return s;
      return {
        strokes: applyReplacements(s.strokes, validChanges, "after"),
        undoStack: [
          ...s.undoStack,
          { kind: "replace-many", changes: validChanges },
        ],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  undo: () =>
    set((s) => {
      const entry = s.undoStack[s.undoStack.length - 1];
      if (!entry) return s;
      const strokes =
        entry.kind === "erase"
          ? undoErase(s.strokes, entry.changes)
          : entry.kind === "add-many"
          ? [
              ...s.strokes.slice(0, entry.index),
              ...s.strokes.slice(entry.index + entry.strokes.length),
            ]
          : entry.kind === "remove-many"
          ? restoreRemovedStrokes(s.strokes, entry.changes)
          : entry.kind === "replace" || entry.kind === "replace-many"
          ? applyReplacements(s.strokes, entry.changes, "before")
          : entry.kind === "add"
          ? [...s.strokes.slice(0, entry.index), ...s.strokes.slice(entry.index + 1)]
          : [
              ...s.strokes.slice(0, entry.index),
              entry.stroke,
              ...s.strokes.slice(entry.index),
            ];
      return {
        strokes,
        selectedIndices: [],
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, entry],
        canUndo: s.undoStack.length - 1 > 0,
        canRedo: true,
      };
    }),

  redo: () =>
    set((s) => {
      const entry = s.redoStack[s.redoStack.length - 1];
      if (!entry) return s;
      const strokes =
        entry.kind === "erase"
          ? redoErase(s.strokes, entry)
          : entry.kind === "add-many"
          ? [
              ...s.strokes.slice(0, entry.index),
              ...entry.strokes,
              ...s.strokes.slice(entry.index),
            ]
          : entry.kind === "remove-many"
          ? applyRemovals(s.strokes, entry.changes)
          : entry.kind === "replace" || entry.kind === "replace-many"
          ? applyReplacements(s.strokes, entry.changes, "after")
          : entry.kind === "add"
          ? [
              ...s.strokes.slice(0, entry.index),
              entry.stroke,
              ...s.strokes.slice(entry.index),
            ]
          : [...s.strokes.slice(0, entry.index), ...s.strokes.slice(entry.index + 1)];
      return {
        strokes,
        selectedIndices: [],
        undoStack: [...s.undoStack, entry],
        redoStack: s.redoStack.slice(0, -1),
        canUndo: true,
        canRedo: s.redoStack.length > 1,
      };
    }),

  clear: () =>
    set({
      strokes: [],
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      selectedIndices: [],
    }),

  resetView: () => {
    camera.offset = { x: 0, y: 0 };
    camera.scale = 1;
    set((s) => ({ cameraEpoch: s.cameraEpoch + 1, scale: 1 }));
  },

  zoomBy: (factor, anchor) => {
    const next = clampScale(camera.scale * factor);
    if (next === camera.scale) return;
    camera.offset = zoomAt(camera.offset, camera.scale, next, anchor);
    camera.scale = next;
    set((s) => ({ cameraEpoch: s.cameraEpoch + 1, scale: next }));
  },

  zoomIn: () => {
    const anchor: Point = {
      x: camera.viewport.w / 2,
      y: camera.viewport.h / 2,
    };
    useBoardStore.getState().zoomBy(1.2, anchor);
  },

  zoomOut: () => {
    const anchor: Point = {
      x: camera.viewport.w / 2,
      y: camera.viewport.h / 2,
    };
    useBoardStore.getState().zoomBy(1 / 1.2, anchor);
  },
});

export const useBoardStore = create<BoardState>()(
  persist(createBoardState, {
    name: BOARD_STORAGE_KEY,
    version: BOARD_STORAGE_VERSION,
    storage: boardIndexedDbStorage,
    partialize: ({ tool, color, lineWidth, strokes }) => ({
      tool,
      color,
      lineWidth,
      strokes,
    }),
    // Client Components are prerendered. Hydrate after mount so the first
    // client render matches the server render and avoids a hydration mismatch.
    skipHydration: true,
  }),
);

let hydrationPromise: Promise<void> | null = null;

export const hydrateBoardStore = () => {
  if (useBoardStore.persist.hasHydrated()) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;

  const currentHydration = Promise.resolve(useBoardStore.persist.rehydrate());
  hydrationPromise = currentHydration;
  const releaseHydration = () => {
    if (hydrationPromise === currentHydration) hydrationPromise = null;
  };
  void currentHydration.then(releaseHydration, releaseHydration);
  return currentHydration;
};
