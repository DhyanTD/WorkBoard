"use client";

import { create } from "zustand";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  zoomAt,
  type Point,
  type Stroke,
  type Tool,
} from "@/lib/board";

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

type BoardState = {
  tool: Tool;
  color: string;
  lineWidth: number;
  strokes: Stroke[];
  redoStack: Stroke[];
  canUndo: boolean;
  canRedo: boolean;
  /** Incremented whenever the camera must be re-rendered (Reset View). */
  cameraEpoch: number;
  /** Reactive mirror of `camera.scale` so the toolbar can display it. */
  scale: number;

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setLineWidth: (width: number) => void;
  commitStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  resetView: () => void;
  /** Multiply current scale by `factor`, anchored at the given screen point. */
  zoomBy: (factor: number, anchor: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export const useBoardStore = create<BoardState>()((set) => ({
  tool: "pen",
  color: "#000000",
  lineWidth: 4,
  strokes: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  cameraEpoch: 0,
  scale: 1,

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),

  commitStroke: (stroke) =>
    set((s) => ({
      strokes: [...s.strokes, stroke],
      redoStack: [],
      canUndo: true,
      canRedo: false,
    })),

  undo: () =>
    set((s) => {
      if (s.strokes.length === 0) return s;
      const last = s.strokes[s.strokes.length - 1];
      return {
        strokes: s.strokes.slice(0, -1),
        redoStack: [...s.redoStack, last],
        canUndo: s.strokes.length - 1 > 0,
        canRedo: true,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const last = s.redoStack[s.redoStack.length - 1];
      return {
        strokes: [...s.strokes, last],
        redoStack: s.redoStack.slice(0, -1),
        canUndo: true,
        canRedo: s.redoStack.length - 1 > 0,
      };
    }),

  clear: () =>
    set({
      strokes: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
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
}));
