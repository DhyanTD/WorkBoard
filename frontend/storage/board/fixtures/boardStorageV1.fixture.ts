import type { StorageValue } from "zustand/middleware";
import type { Stroke } from "@/lib/board";
import type { PersistedBoardState } from "@/storage/board/types";

export const BOARD_STORAGE_V1_STROKES: Stroke[] = [
  {
    id: "shape-orders",
    tool: "square",
    color: "#3b82f6",
    lineWidth: 3,
    points: [
      { x: 40, y: 60 },
      { x: 220, y: 160 },
    ],
    bounds: { minX: 40, minY: 60, maxX: 220, maxY: 160 },
  },
  {
    id: "label-orders",
    tool: "text",
    color: "#000000",
    lineWidth: 2,
    points: [{ x: 80, y: 100 }],
    bounds: { minX: 80, minY: 100, maxX: 164, maxY: 125 },
    text: "Orders API",
    fontSize: 20,
  },
  {
    id: "arrow-orders-payments",
    tool: "arrow",
    color: "#8b5cf6",
    lineWidth: 4,
    points: [
      { x: 220, y: 110 },
      { x: 360, y: 110 },
    ],
    bounds: { minX: 220, minY: 96, maxX: 360, maxY: 124 },
    startBindingId: "shape-orders",
    endBindingId: "shape-payments",
  },
];

export const BOARD_STORAGE_V1_STATE: PersistedBoardState = {
  tool: "select",
  color: "#8b5cf6",
  lineWidth: 4,
  strokes: BOARD_STORAGE_V1_STROKES,
};

export const BOARD_STORAGE_V1_VALUE: StorageValue<PersistedBoardState> = {
  state: BOARD_STORAGE_V1_STATE,
  version: 1,
};

export const BOARD_STORAGE_V1_LEGACY_JSON = JSON.stringify(
  BOARD_STORAGE_V1_VALUE,
);
