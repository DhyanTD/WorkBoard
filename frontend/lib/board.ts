export type Tool =
  | "pen"
  | "pencil"
  | "eraser"
  | "square"
  | "circle"
  | "hand";

export type Point = { x: number; y: number };
export type Stroke = {
  tool: Tool;
  color: string;
  lineWidth: number;
  points: Point[];
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
export const GRID_SIZE = 40;
export const BOARD_BG = "#ffffff";

/** World-space width a single screen-space grid cell represents at zoom 1. */
export const GRID_WORLD_SIZE = GRID_SIZE;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.2;

export const isShapeTool = (tool: Tool) =>
  tool === "square" || tool === "circle";

export const isDrawingTool = (tool: Tool) =>
  tool === "pen" ||
  tool === "pencil" ||
  tool === "eraser" ||
  tool === "square" ||
  tool === "circle";

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

/**
 * Draws the dot grid. Grid dots live in world space at GRID_SIZE intervals;
 * `offset` is the world-space top-left of the viewport and `scale` converts
 * world -> screen, so dots sit on the world grid regardless of zoom/pan.
 */
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  offset: Point,
  scale: number,
) => {
  const cell = GRID_SIZE * scale;
  if (cell < 8) return; // Too dense below ~8px spacing.
  const worldX0 = offset.x;
  const worldY0 = offset.y;
  const worldX1 = offset.x + w / scale;
  const worldY1 = offset.y + h / scale;
  const x0 = Math.floor(worldX0 / GRID_SIZE) * GRID_SIZE;
  const y0 = Math.floor(worldY0 / GRID_SIZE) * GRID_SIZE;
  ctx.fillStyle = "#e5e7eb";
  for (let wx = x0; wx <= worldX1; wx += GRID_SIZE) {
    for (let wy = y0; wy <= worldY1; wy += GRID_SIZE) {
      ctx.beginPath();
      ctx.arc((wx - worldX0) * scale, (wy - worldY0) * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
