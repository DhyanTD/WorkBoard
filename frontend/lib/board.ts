export type Tool =
  | "pen"
  | "pencil"
  | "eraser"
  | "square"
  | "circle"
  | "hand";

export type Point = { x: number; y: number };
export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
export type Stroke = {
  tool: Tool;
  color: string;
  lineWidth: number;
  points: Point[];
  bounds: Bounds;
};

export const COLORS = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];
export const BOARD_BG = "#ffffff";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.2;
/** Caps the canvas backing store on very high-density displays. */
export const MAX_CANVAS_DPR = 2;
/** Minimum distance between retained freehand points, in screen pixels. */
export const POINT_SAMPLE_DISTANCE = 2;

export const isShapeTool = (tool: Tool) =>
  tool === "square" || tool === "circle";

export const isDrawingTool = (tool: Tool) =>
  tool === "pen" ||
  tool === "pencil" ||
  tool === "eraser" ||
  tool === "square" ||
  tool === "circle";

export const boundsFromPoint = (point: Point): Bounds => ({
  minX: point.x,
  minY: point.y,
  maxX: point.x,
  maxY: point.y,
});

export const boundsFromPoints = (a: Point, b: Point): Bounds => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

/** Expands mutable in-progress stroke bounds without allocating per point. */
export const includePoint = (bounds: Bounds, point: Point) => {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
};

/** Keeps freehand storage proportional to visible distance, not event rate. */
export const shouldSamplePoint = (
  previous: Point,
  next: Point,
  scale: number,
) => {
  const minimumWorldDistance = POINT_SAMPLE_DISTANCE / scale;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  return dx * dx + dy * dy >= minimumWorldDistance * minimumWorldDistance;
};

/** Fast bounds test used before rebuilding a stroke's complete canvas path. */
export const isStrokeVisible = (stroke: Stroke, viewport: Bounds) => {
  const padding = stroke.lineWidth / 2;
  return !(
    stroke.bounds.maxX + padding < viewport.minX ||
    stroke.bounds.minX - padding > viewport.maxX ||
    stroke.bounds.maxY + padding < viewport.minY ||
    stroke.bounds.minY - padding > viewport.maxY
  );
};

/**
 * Maps a screen-space point to world space. `offset` is the world-space
 * coordinate at the top-left of the viewport; `scale` scales world -> screen.
 */
export const screenToWorld = (
  offset: Point,
  scale: number,
  screen: Point,
): Point => ({
  x: offset.x + screen.x / scale,
  y: offset.y + screen.y / scale,
});

/**
 * Adjusts the camera so `anchor` (a screen point) stays fixed while scale
 * changes: the world point under the anchor keeps aligning with the anchor.
 * Returns the new offset for the given new scale.
 */
export const zoomAt = (
  offset: Point,
  oldScale: number,
  newScale: number,
  anchor: Point,
): Point => {
  const world = screenToWorld(offset, oldScale, anchor);
  return {
    x: world.x - anchor.x / newScale,
    y: world.y - anchor.y / newScale,
  };
};

/** Sets up stroke/fill style for the given stroke (eraser paints board bg). */
const applyStrokeStyle = (ctx: CanvasRenderingContext2D, s: Stroke) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.lineWidth;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = s.tool === "eraser" ? BOARD_BG : s.color;
  ctx.fillStyle = s.tool === "eraser" ? BOARD_BG : s.color;
};

/** Renders a complete stroke (dot, shape, or smooth path). */
export const renderStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
  const p = s.points;
  if (p.length === 0) return;

  ctx.save();
  applyStrokeStyle(ctx, s);

  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, s.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (isShapeTool(s.tool)) {
    const a = p[0];
    const b = p[p.length - 1];
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    ctx.beginPath();
    if (s.tool === "square") {
      ctx.rect(x, y, w, h);
    } else {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const xc = (p[i].x + p[i + 1].x) / 2;
    const yc = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
  }
  ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  ctx.stroke();
  ctx.restore();
};

/** Paints only the newest segment of an in-progress stroke. */
export const paintLastSegment = (
  ctx: CanvasRenderingContext2D,
  s: Stroke,
) => {
  const p = s.points;
  ctx.save();
  applyStrokeStyle(ctx, s);

  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, s.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.length === 2) {
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.stroke();
  } else {
    const n = p.length;
    const mPrev = {
      x: (p[n - 3].x + p[n - 2].x) / 2,
      y: (p[n - 3].y + p[n - 2].y) / 2,
    };
    const mNew = {
      x: (p[n - 2].x + p[n - 1].x) / 2,
      y: (p[n - 2].y + p[n - 1].y) / 2,
    };
    ctx.beginPath();
    ctx.moveTo(mPrev.x, mPrev.y);
    ctx.quadraticCurveTo(p[n - 2].x, p[n - 2].y, mNew.x, mNew.y);
    ctx.stroke();
  }
  ctx.restore();
};
