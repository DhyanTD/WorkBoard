"use client";

import { create } from "zustand";
import type { Stroke, Tool } from "@/lib/board";

/** Camera offset in world space (negative of what translate uses). Stored as
 *  mutable module state because panning fires at pointer-move rate; the Canvas
 *  mutates it directly and the store only bumps `cameraEpoch` to signal a
 *  redraw (e.g. Reset View). */
export const camera = { offset: { x: 0, y: 0 } };

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

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setLineWidth: (width: number) => void;
  commitStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  resetView: () => void;
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
    set((s) => ({ cameraEpoch: s.cameraEpoch + 1 }));
  },
}));
