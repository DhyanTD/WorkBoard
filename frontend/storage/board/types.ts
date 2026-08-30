import type { Stroke, Tool } from "@/lib/board";

export type PersistedBoardState = {
  tool: Tool;
  color: string;
  lineWidth: number;
  strokes: Stroke[];
};

export type BoardStorageRecord = {
  id: string;
  state: PersistedBoardState;
  version?: number;
  updatedAt: number;
};
