export type Tool =
  /** Retained so drawings created before Pencil became the only freehand tool still render. */
  | "pen"
  | "pencil"
  | "eraser"
  | "select"
  | "text"
  | "square"
  | "circle"
  | "rhombus"
  | "line"
  | "arrow"
  | "hand";

export type Point = { x: number; y: number };
export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
export type Stroke = {
  /** Stable identity used to keep connector arrows attached while shapes move. */
  id?: string;
  tool: Tool;
  color: string;
  lineWidth: number;
  points: Point[];
  bounds: Bounds;
  /** Present only for text items. */
  text?: string;
  /** World-space text size, in CSS pixels at 100% zoom. */
  fontSize?: number;
  /** The shapes an arrow is attached to, when it was dragged box-to-box. */
  startBindingId?: string;
  endBindingId?: string;
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
export const DEFAULT_TEXT_FONT_SIZE = 20;

export const isShapeTool = (tool: Tool) =>
  tool === "square" || tool === "circle" || tool === "rhombus";

/**
 * Returns the point on a shape's outline facing `toward`. This lets connector
 * arrows meet a box cleanly instead of stopping wherever the pointer happens
 * to be inside it.
 */
export const getShapeConnectionPoint = (shape: Stroke, toward: Point): Point => {
  const { minX, minY, maxX, maxY } = shape.bounds;
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
  const radiusX = (maxX - minX) / 2;
  const radiusY = (maxY - minY) / 2;
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (!isShapeTool(shape.tool) || radiusX === 0 || radiusY === 0) {
    return center;
  }
  if (dx === 0 && dy === 0) return { x: maxX, y: center.y };

  const scale =
    shape.tool === "circle"
      ? 1 / Math.hypot(dx / radiusX, dy / radiusY)
      : shape.tool === "rhombus"
        ? 1 / (Math.abs(dx) / radiusX + Math.abs(dy) / radiusY)
        : 1 / Math.max(Math.abs(dx) / radiusX, Math.abs(dy) / radiusY);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
};

export const isStraightLineTool = (tool: Tool) =>
  tool === "line" || tool === "arrow";

export const isFixedGeometryTool = (tool: Tool) =>
  isShapeTool(tool) || isStraightLineTool(tool);

export const isTextTool = (tool: Tool) => tool === "text";

export const isSelectionTool = (tool: Tool) => tool === "select";

export const isDrawingTool = (tool: Tool) =>
  tool === "pen" ||
  tool === "pencil" ||
  tool === "eraser" ||
  tool === "text" ||
  tool === "square" ||
  tool === "circle" ||
  tool === "rhombus" ||
  tool === "line" ||
  tool === "arrow";

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

const getArrowHeadPoints = (start: Point, end: Point, lineWidth: number) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [end, end];

  const headLength = Math.min(length / 2, Math.max(12, lineWidth * 3));
  const angle = Math.atan2(dy, dx);
  const headAngle = Math.PI / 6;
  return [
    {
      x: end.x - Math.cos(angle - headAngle) * headLength,
      y: end.y - Math.sin(angle - headAngle) * headLength,
    },
    {
      x: end.x - Math.cos(angle + headAngle) * headLength,
      y: end.y - Math.sin(angle + headAngle) * headLength,
    },
  ];
};

/** Includes an arrow's head so it can be culled and selected accurately. */
export const boundsFromFixedGeometry = (
  tool: Tool,
  start: Point,
  end: Point,
  lineWidth: number,
) => {
  const points =
    tool === "arrow"
      ? [start, end, ...getArrowHeadPoints(start, end, lineWidth)]
      : [start, end];
  const bounds = boundsFromPoint(points[0]);
  for (let index = 1; index < points.length; index += 1) {
    includePoint(bounds, points[index]);
  }
  return bounds;
};

/** Approximate text bounds for culling and pointer hit-testing. */
export const boundsFromText = (
  point: Point,
  text: string,
  fontSize: number,
): Bounds => ({
  minX: point.x,
  minY: point.y,
  maxX: point.x + text.length * fontSize * 0.62,
  maxY: point.y + fontSize * 1.25,
});

/** Moves a complete canvas item without altering its shape or style. */
export const translateStroke = (stroke: Stroke, delta: Point): Stroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  })),
  bounds: {
    minX: stroke.bounds.minX + delta.x,
    minY: stroke.bounds.minY + delta.y,
    maxX: stroke.bounds.maxX + delta.x,
    maxY: stroke.bounds.maxY + delta.y,
  },
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

const distanceToSegmentSquared = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    const pointDx = point.x - start.x;
    const pointDy = point.y - start.y;
    return pointDx * pointDx + pointDy * pointDy;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  const pointDx = point.x - closestX;
  const pointDy = point.y - closestY;
  return pointDx * pointDx + pointDy * pointDy;
};

/**
 * Returns whether a world-space point targets a stroke for whole-object erase.
 * Closed shapes use their full enclosed area so a click does not need to land on
 * a thin outline; freehand strokes retain a line-width-aware hit area.
 */
export const doesStrokeContainPoint = (
  stroke: Stroke,
  point: Point,
  hitPadding = 0,
) => {
  const hitRadius = stroke.lineWidth / 2 + hitPadding;
  const { minX, minY, maxX, maxY } = stroke.bounds;

  if (
    point.x < minX - hitRadius ||
    point.x > maxX + hitRadius ||
    point.y < minY - hitRadius ||
    point.y > maxY + hitRadius
  ) {
    return false;
  }

  if (isShapeTool(stroke.tool) && stroke.points.length > 1) {
    if (stroke.tool === "square") return true;

    if (stroke.tool === "rhombus") {
      const radiusX = Math.max((maxX - minX) / 2 + hitRadius, hitRadius);
      const radiusY = Math.max((maxY - minY) / 2 + hitRadius, hitRadius);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return (
        Math.abs(point.x - centerX) / radiusX +
          Math.abs(point.y - centerY) / radiusY <=
        1
      );
    }

    const radiusX = Math.max((maxX - minX) / 2 + hitRadius, hitRadius);
    const radiusY = Math.max((maxY - minY) / 2 + hitRadius, hitRadius);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const normalizedX = (point.x - centerX) / radiusX;
    const normalizedY = (point.y - centerY) / radiusY;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  if (isTextTool(stroke.tool)) return true;

  const points = stroke.points;
  if (stroke.tool === "arrow" && points.length > 1) {
    const [headLeft, headRight] = getArrowHeadPoints(
      points[0],
      points[points.length - 1],
      stroke.lineWidth,
    );
    const end = points[points.length - 1];
    const maxDistanceSquared = hitRadius * hitRadius;
    return (
      distanceToSegmentSquared(point, points[0], end) <= maxDistanceSquared ||
      distanceToSegmentSquared(point, end, headLeft) <= maxDistanceSquared ||
      distanceToSegmentSquared(point, end, headRight) <= maxDistanceSquared
    );
  }

  if (points.length === 1) {
    const dx = point.x - points[0].x;
    const dy = point.y - points[0].y;
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  const maxDistanceSquared = hitRadius * hitRadius;
  for (let index = 1; index < points.length; index += 1) {
    if (
      distanceToSegmentSquared(point, points[index - 1], points[index]) <=
      maxDistanceSquared
    ) {
      return true;
    }
  }
  return false;
};

/** Finds the visible topmost stroke targeted by a world-space point. */
export const findTopmostStrokeAtPoint = (
  strokes: Stroke[],
  point: Point,
  hitPadding = 0,
) => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    // Eraser marks are visual masks, not independently selectable objects.
    if (
      stroke.tool !== "eraser" &&
      doesStrokeContainPoint(stroke, point, hitPadding)
    ) {
      return index;
    }
  }
  return -1;
};

/** Finds the uppermost closed shape whose interior contains a point. */
export const findTopmostShapeAtPoint = (
  strokes: Stroke[],
  point: Point,
  hitPadding = 0,
) => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (
      isShapeTool(stroke.tool) &&
      stroke.points.length > 1 &&
      doesStrokeContainPoint(stroke, point, hitPadding)
    ) {
      return index;
    }
  }
  return -1;
};

/**
 * Returns whether a point lands on the visible outline of a shape. Selection
 * uses this instead of the filled hit area so the empty interior stays
 * available for actions such as placing text.
 */
const doesShapeOutlineContainPoint = (
  stroke: Stroke,
  point: Point,
  hitPadding: number,
) => {
  const hitRadius = stroke.lineWidth / 2 + hitPadding;
  const { minX, minY, maxX, maxY } = stroke.bounds;

  if (
    point.x < minX - hitRadius ||
    point.x > maxX + hitRadius ||
    point.y < minY - hitRadius ||
    point.y > maxY + hitRadius
  ) {
    return false;
  }

  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  const maxDistanceSquared = hitRadius * hitRadius;

  if (stroke.tool === "square") {
    const topLeft = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
    const bottomRight = { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) };
    const topRight = { x: bottomRight.x, y: topLeft.y };
    const bottomLeft = { x: topLeft.x, y: bottomRight.y };
    return [
      [topLeft, topRight],
      [topRight, bottomRight],
      [bottomRight, bottomLeft],
      [bottomLeft, topLeft],
    ].some(
      ([a, b]) => distanceToSegmentSquared(point, a, b) <= maxDistanceSquared,
    );
  }

  if (stroke.tool === "rhombus") {
    const top = { x: (minX + maxX) / 2, y: minY };
    const right = { x: maxX, y: (minY + maxY) / 2 };
    const bottom = { x: (minX + maxX) / 2, y: maxY };
    const left = { x: minX, y: (minY + maxY) / 2 };
    return [
      [top, right],
      [right, bottom],
      [bottom, left],
      [left, top],
    ].some(
      ([a, b]) => distanceToSegmentSquared(point, a, b) <= maxDistanceSquared,
    );
  }

  const radiusX = (maxX - minX) / 2;
  const radiusY = (maxY - minY) / 2;
  if (radiusX === 0 || radiusY === 0) {
    return distanceToSegmentSquared(point, start, end) <= maxDistanceSquared;
  }

  // Approximate the ellipse with short segments. This provides a consistent
  // screen-space target around the actual stroked line, including elongated
  // ellipses, without treating the enclosed area as a hit.
  const perimeter = Math.PI * (3 * (radiusX + radiusY) - Math.sqrt(
    (3 * radiusX + radiusY) * (radiusX + 3 * radiusY),
  ));
  const segmentCount = Math.min(96, Math.max(24, Math.ceil(perimeter / 4)));
  const centerX = minX + radiusX;
  const centerY = minY + radiusY;
  let previous = { x: centerX + radiusX, y: centerY };
  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const current = {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
    if (distanceToSegmentSquared(point, previous, current) <= maxDistanceSquared) {
      return true;
    }
    previous = current;
  }
  return false;
};

/**
 * Finds the topmost canvas item selectable at a point. Closed shapes are only
 * selectable from their stroked outline; text and freehand marks retain their
 * normal hit areas.
 */
export const findTopmostSelectableStrokeAtPoint = (
  strokes: Stroke[],
  point: Point,
  hitPadding = 0,
) => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (stroke.tool === "eraser") continue;

    const isHit =
      isShapeTool(stroke.tool) && stroke.points.length > 1
        ? doesShapeOutlineContainPoint(stroke, point, hitPadding)
        : doesStrokeContainPoint(stroke, point, hitPadding);
    if (isHit) return index;
  }
  return -1;
};

const boundsOverlap = (a: Bounds, b: Bounds, padding: number) =>
  !(
    a.maxX + padding < b.minX ||
    a.minX - padding > b.maxX ||
    a.maxY + padding < b.minY ||
    a.minY - padding > b.maxY
  );

const arePointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const getStrokeBounds = (points: Point[]): Bounds => {
  const bounds = boundsFromPoint(points[0]);
  for (let index = 1; index < points.length; index += 1) {
    includePoint(bounds, points[index]);
  }
  return bounds;
};

const makeStrokeFragment = (source: Stroke, points: Point[]): Stroke => ({
  ...source,
  points,
  bounds: getStrokeBounds(points),
});

/**
 * Splits a freehand stroke wherever the eraser passes over it. This turns the
 * remaining visible pieces into independent strokes, so whole-object erase can
 * later remove only the connected piece under the pointer.
 */
export const splitFreehandStrokeByEraser = (
  stroke: Stroke,
  eraser: Stroke,
) => {
  if (
    stroke.tool === "eraser" ||
    isTextTool(stroke.tool) ||
    isShapeTool(stroke.tool) ||
    eraser.points.length === 0 ||
    stroke.points.length === 0 ||
    !boundsOverlap(
      stroke.bounds,
      eraser.bounds,
      (stroke.lineWidth + eraser.lineWidth) / 2,
    )
  ) {
    return [stroke];
  }

  const fragments: Stroke[] = [];
  let fragment: Point[] = [];
  let changed = false;
  let previous = stroke.points[0];
  let previousErased = doesStrokeContainPoint(
    eraser,
    previous,
    stroke.lineWidth / 2,
  );
  if (!previousErased) fragment.push(previous);
  else changed = true;

  const finishFragment = () => {
    if (fragment.length > 0) {
      fragments.push(makeStrokeFragment(stroke, fragment));
      fragment = [];
    }
  };

  for (let index = 1; index < stroke.points.length; index += 1) {
    const next = stroke.points[index];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const distance = Math.hypot(dx, dy);
    // Subdivide long segments so an eraser can cut a straight two-point line.
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, eraser.lineWidth / 2)));

    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const point =
        step === steps
          ? next
          : { x: previous.x + dx * ratio, y: previous.y + dy * ratio };
      const erased = doesStrokeContainPoint(eraser, point, stroke.lineWidth / 2);

      if (erased) {
        if (!previousErased) finishFragment();
        changed = true;
      } else if (previousErased) {
        fragment = [point];
      } else if (!arePointsEqual(fragment[fragment.length - 1], point)) {
        fragment.push(point);
      }

      previousErased = erased;
    }
    previous = next;
  }

  if (!previousErased) finishFragment();
  return changed ? fragments : [stroke];
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

const drawRoundedPolygon = (
  ctx: CanvasRenderingContext2D,
  vertices: Point[],
  cornerRadius: number,
) => {
  const pointBefore = (current: Point, previous: Point, distance: number) => {
    const length = Math.hypot(previous.x - current.x, previous.y - current.y);
    return {
      x: current.x + ((previous.x - current.x) / length) * distance,
      y: current.y + ((previous.y - current.y) / length) * distance,
    };
  };
  const pointAfter = (current: Point, next: Point, distance: number) => {
    const length = Math.hypot(next.x - current.x, next.y - current.y);
    return {
      x: current.x + ((next.x - current.x) / length) * distance,
      y: current.y + ((next.y - current.y) / length) * distance,
    };
  };
  const offsetAt = (index: number) => {
    const current = vertices[index];
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    return Math.min(
      cornerRadius,
      Math.hypot(previous.x - current.x, previous.y - current.y) / 2,
      Math.hypot(next.x - current.x, next.y - current.y) / 2,
    );
  };

  const firstOffset = offsetAt(0);
  const first = vertices[0];
  const firstPrevious = vertices[vertices.length - 1];
  const firstBefore = pointBefore(first, firstPrevious, firstOffset);
  ctx.moveTo(firstBefore.x, firstBefore.y);
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const offset = offsetAt(index);
    const before = pointBefore(current, previous, offset);
    const after = pointAfter(current, next, offset);
    if (index > 0) ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(current.x, current.y, after.x, after.y);
  }
  ctx.closePath();
};

/** Renders a complete stroke (dot, shape, or smooth path). */
export const renderStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
  const p = s.points;
  if (p.length === 0) return;

  ctx.save();
  applyStrokeStyle(ctx, s);

  if (isTextTool(s.tool)) {
    const fontSize = s.fontSize ?? 20;
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(s.text ?? "", p[0].x, p[0].y);
    ctx.restore();
    return;
  }

  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, s.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (isStraightLineTool(s.tool)) {
    const start = p[0];
    const end = p[p.length - 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    if (s.tool === "arrow") {
      const [headLeft, headRight] = getArrowHeadPoints(start, end, s.lineWidth);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(headLeft.x, headLeft.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(headRight.x, headRight.y);
    }
    ctx.stroke();
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
    if (w === 0 || h === 0) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (s.tool === "square") {
      drawRoundedPolygon(
        ctx,
        [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
        Math.min(16, w / 4, h / 4),
      );
    } else if (s.tool === "rhombus") {
      drawRoundedPolygon(
        ctx,
        [
          { x: x + w / 2, y },
          { x: x + w, y: y + h / 2 },
          { x: x + w / 2, y: y + h },
          { x, y: y + h / 2 },
        ],
        Math.min(16, Math.hypot(w / 2, h / 2) / 4),
      );
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
