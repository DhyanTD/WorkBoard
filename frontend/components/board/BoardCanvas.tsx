"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { camera, useBoardStore } from "@/store/useBoardStore";
import {
  boundsFromPoint,
  boundsFromPoints,
  drawGrid,
  includePoint,
  isShapeTool,
  isStrokeVisible,
  MAX_CANVAS_DPR,
  paintLastSegment,
  renderStroke,
  screenToWorld,
  shouldSamplePoint,
  type Point,
  type Stroke,
} from "@/lib/board";

const getCanvasDpr = () =>
  Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);

export default function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tool = useBoardStore((s) => s.tool);
  const strokes = useBoardStore((s) => s.strokes);
  const redoStack = useBoardStore((s) => s.redoStack);
  const cameraEpoch = useBoardStore((s) => s.cameraEpoch);
  const commitStroke = useBoardStore((s) => s.commitStroke);

  // Latest UI values for pointer handlers (avoids re-creating handlers).
  const toolRef = useRef(tool);
  const colorRef = useRef("#000000");
  const lineWidthRef = useRef(4);

  const color = useBoardStore((s) => s.color);
  const lineWidth = useBoardStore((s) => s.lineWidth);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    lineWidthRef.current = lineWidth;
  }, [lineWidth]);

  // Imperative draw/pan state.
  const strokesRef = useRef(strokes);
  const currentRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);
  const panningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const offsetStartRef = useRef<Point>({ x: 0, y: 0 });

  const getScreenPos = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = getCanvasDpr();
    const w = rect.width;
    const h = rect.height;
    const { offset, scale } = camera;
    const viewport = {
      minX: offset.x,
      minY: offset.y,
      maxX: offset.x + w / scale,
      maxY: offset.y + h / scale,
    };

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Grid in screen space (shifted by camera offset, scaled by zoom).
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(ctx, w, h, offset, scale);
    ctx.restore();

    // Strokes in world space.
    ctx.save();
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      -offset.x * dpr * scale,
      -offset.y * dpr * scale,
    );
    for (const stroke of strokesRef.current) {
      if (isStrokeVisible(stroke, viewport)) renderStroke(ctx, stroke);
    }
    const current = currentRef.current;
    if (current && isStrokeVisible(current, viewport)) {
      renderStroke(ctx, current);
    }
    ctx.restore();
  }, []);

  const redrawFrameRef = useRef<number | null>(null);
  const scheduleRedraw = useCallback(() => {
    if (redrawFrameRef.current !== null) return;
    redrawFrameRef.current = window.requestAnimationFrame(() => {
      redrawFrameRef.current = null;
      redraw();
    });
  }, [redraw]);

  useEffect(
    () => () => {
      if (redrawFrameRef.current !== null) {
        window.cancelAnimationFrame(redrawFrameRef.current);
        redrawFrameRef.current = null;
      }
    },
    [],
  );

  // Redraw when committed strokes / undo / redo / clear / camera reset change.
  useEffect(() => {
    strokesRef.current = strokes;
    scheduleRedraw();
  }, [strokes, scheduleRedraw]);
  useEffect(() => {
    scheduleRedraw();
  }, [redoStack, cameraEpoch, scheduleRedraw]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = getCanvasDpr();
    camera.viewport.w = rect.width;
    camera.viewport.h = rect.height;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    scheduleRedraw();
  }, [scheduleRedraw]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctrlKey = e.ctrlKey || e.metaKey;

      canvas.setPointerCapture(e.pointerId);

      // Holding Ctrl or using the hand tool pans the canvas.
      if (ctrlKey || toolRef.current === "hand") {
        panningRef.current = true;
        panStartRef.current = getScreenPos(e);
        offsetStartRef.current = { ...camera.offset };
        return;
      }

      drawingRef.current = true;
      const world = screenToWorld(camera.offset, camera.scale, getScreenPos(e));
      currentRef.current = {
        tool: toolRef.current,
        color: colorRef.current,
        lineWidth: lineWidthRef.current,
        points: [world],
        bounds: boundsFromPoint(world),
      };
      scheduleRedraw();
    },
    [getScreenPos, scheduleRedraw],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (panningRef.current) {
        const current = getScreenPos(e);
        camera.offset = {
          x:
            offsetStartRef.current.x -
            (current.x - panStartRef.current.x) / camera.scale,
          y:
            offsetStartRef.current.y -
            (current.y - panStartRef.current.y) / camera.scale,
        };
        scheduleRedraw();
        return;
      }
      if (!drawingRef.current || !currentRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !currentRef.current) return;

      const t = currentRef.current.tool;
      const world = screenToWorld(camera.offset, camera.scale, getScreenPos(e));

      if (isShapeTool(t)) {
        const first = currentRef.current.points[0];
        currentRef.current.points = [first, world];
        currentRef.current.bounds = boundsFromPoints(first, world);
        scheduleRedraw();
      } else {
        const points = currentRef.current.points;
        if (!shouldSamplePoint(points[points.length - 1], world, camera.scale)) {
          return;
        }
        currentRef.current.points.push(world);
        includePoint(currentRef.current.bounds, world);
        // Paint in world space (scaled by zoom).
        ctx.save();
        const dpr = getCanvasDpr();
        const { scale } = camera;
        ctx.setTransform(
          dpr * scale,
          0,
          0,
          dpr * scale,
          -camera.offset.x * dpr * scale,
          -camera.offset.y * dpr * scale,
        );
        paintLastSegment(ctx, currentRef.current);
        ctx.restore();
      }
    },
    [getScreenPos, scheduleRedraw],
  );

  const endStroke = useCallback(() => {
    if (panningRef.current) {
      panningRef.current = false;
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current && currentRef.current.points.length > 0) {
      commitStroke(currentRef.current);
    }
    currentRef.current = null;
    scheduleRedraw();
  }, [commitStroke, scheduleRedraw]);

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      endStroke();
    },
    [endStroke],
  );

  const onPointerCancel = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      endStroke();
    },
    [endStroke],
  );

  // Wheel pans (trackpad or mouse wheel); Ctrl/Cmd+wheel zooms at the cursor.
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const anchor = getScreenPos(e);
        useBoardStore.getState().zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, anchor);
      } else {
        camera.offset = {
          x: camera.offset.x + e.deltaX / camera.scale,
          y: camera.offset.y + e.deltaY / camera.scale,
        };
        scheduleRedraw();
      }
    },
    [getScreenPos, scheduleRedraw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      style={{ cursor: tool === "hand" ? "grab" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
