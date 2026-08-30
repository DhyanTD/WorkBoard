import type { StorageValue } from "zustand/middleware";
import type { Bounds, Point, Stroke, Tool } from "@/lib/board";
import type { PersistedBoardState } from "@/storage/board/types";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonArray = (value: JsonValue): value is JsonValue[] =>
  Array.isArray(value);

const parseTool = (value: JsonValue): Tool | null => {
  switch (value) {
    case "pen":
    case "pencil":
    case "eraser":
    case "select":
    case "text":
    case "square":
    case "circle":
    case "rhombus":
    case "line":
    case "arrow":
    case "hand":
      return value;
    default:
      return null;
  }
};

const parsePoint = (value: JsonValue): Point | null => {
  if (!isJsonObject(value)) return null;
  const { x, y } = value;
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  return { x, y };
};

const parseBounds = (value: JsonValue): Bounds | null => {
  if (!isJsonObject(value)) return null;
  const { minX, minY, maxX, maxY } = value;
  if (
    typeof minX !== "number" ||
    !Number.isFinite(minX) ||
    typeof minY !== "number" ||
    !Number.isFinite(minY) ||
    typeof maxX !== "number" ||
    !Number.isFinite(maxX) ||
    typeof maxY !== "number" ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }
  return { minX, minY, maxX, maxY };
};

const parseStroke = (value: JsonValue): Stroke | null => {
  if (!isJsonObject(value)) return null;

  const tool = parseTool(value.tool);
  const bounds = parseBounds(value.bounds);
  if (
    !tool ||
    typeof value.color !== "string" ||
    typeof value.lineWidth !== "number" ||
    !Number.isFinite(value.lineWidth) ||
    !isJsonArray(value.points) ||
    !bounds
  ) {
    return null;
  }

  const points: Point[] = [];
  for (const pointValue of value.points) {
    const point = parsePoint(pointValue);
    if (!point) return null;
    points.push(point);
  }

  let id: string | undefined;
  if ("id" in value) {
    if (typeof value.id !== "string") return null;
    id = value.id;
  }

  let text: string | undefined;
  if ("text" in value) {
    if (typeof value.text !== "string") return null;
    text = value.text;
  }

  let fontSize: number | undefined;
  if ("fontSize" in value) {
    if (
      typeof value.fontSize !== "number" ||
      !Number.isFinite(value.fontSize)
    ) {
      return null;
    }
    fontSize = value.fontSize;
  }

  let startBindingId: string | undefined;
  if ("startBindingId" in value) {
    if (typeof value.startBindingId !== "string") return null;
    startBindingId = value.startBindingId;
  }

  let endBindingId: string | undefined;
  if ("endBindingId" in value) {
    if (typeof value.endBindingId !== "string") return null;
    endBindingId = value.endBindingId;
  }

  const stroke: Stroke = {
    tool,
    color: value.color,
    lineWidth: value.lineWidth,
    points,
    bounds,
  };
  if (id !== undefined) stroke.id = id;
  if (text !== undefined) stroke.text = text;
  if (fontSize !== undefined) stroke.fontSize = fontSize;
  if (startBindingId !== undefined) stroke.startBindingId = startBindingId;
  if (endBindingId !== undefined) stroke.endBindingId = endBindingId;
  return stroke;
};

const parsePersistedBoardState = (
  value: JsonValue,
): PersistedBoardState | null => {
  if (!isJsonObject(value)) return null;

  const tool = parseTool(value.tool);
  if (
    !tool ||
    typeof value.color !== "string" ||
    typeof value.lineWidth !== "number" ||
    !Number.isFinite(value.lineWidth) ||
    !isJsonArray(value.strokes)
  ) {
    return null;
  }

  const strokes: Stroke[] = [];
  for (const strokeValue of value.strokes) {
    const stroke = parseStroke(strokeValue);
    if (!stroke) return null;
    strokes.push(stroke);
  }

  return {
    tool,
    color: value.color,
    lineWidth: value.lineWidth,
    strokes,
  };
};

export const readLegacyBoardStorage = (
  name: string,
): StorageValue<PersistedBoardState> | null => {
  try {
    const rawValue = localStorage.getItem(name);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue) as JsonValue;
    if (!isJsonObject(parsedValue)) return null;
    const state = parsePersistedBoardState(parsedValue.state);
    if (!state) return null;

    if (!("version" in parsedValue)) return { state };
    if (
      typeof parsedValue.version !== "number" ||
      !Number.isInteger(parsedValue.version)
    ) {
      return null;
    }
    return { state, version: parsedValue.version };
  } catch {
    return null;
  }
};

export const removeLegacyBoardStorage = (name: string) => {
  try {
    localStorage.removeItem(name);
  } catch {
    // IndexedDB already contains the imported record, so cleanup is optional.
  }
};
