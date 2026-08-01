"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import {
  camera,
  useBoardStore,
} from "@/store/useBoardStore";
import {
  drawGrid,
  isShapeTool,
  paintLastSegment,
  renderStroke,
  screenToWorld,
  type Point,
  type Stroke,
} from "@/lib/board";

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
    (e: PointerEvent<HTMLCanvasElement>): Point => {
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
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    const { offset } = camera;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Grid in screen space (shifted by camera offset).
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(ctx, w, h, offset);
    ctx.restore();

    // Strokes in world space.
    ctx.save();
    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      offset.x * dpr,
      offset.y * dpr,
    );
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    for (const s of all) renderStroke(ctx, s);
    ctx.restore();
  }, []);

  // Redraw when committed strokes / undo / redo / clear / camera reset change.
  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);
  useEffect(() => {
    redraw();
  }, [redoStack, cameraEpoch, redraw]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    redraw();
  }, [redraw]);

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
      const world = screenToWorld(camera.offset, getScreenPos(e));
      currentRef.current = {
        tool: toolRef.current,
        color: colorRef.current,
        lineWidth: lineWidthRef.current,
        points: [world],
      };
      redraw();
    },
    [getScreenPos, redraw],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (panningRef.current) {
        const current = getScreenPos(e);
        camera.offset = {
          x: offsetStartRef.current.x + (current.x - panStartRef.current.x),
          y: offsetStartRef.current.y + (current.y - panStartRef.current.y),
        };
        redraw();
        return;
      }
      if (!drawingRef.current || !currentRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !currentRef.current) return;

      const t = currentRef.current.tool;
      const world = screenToWorld(camera.offset, getScreenPos(e));

      if (isShapeTool(t)) {
        currentRef.current.points = [currentRef.current.points[0], world];
        redraw();
      } else {
        currentRef.current.points.push(world);
        // Paint in world space.
        ctx.save();
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          camera.offset.x * dpr,
          camera.offset.y * dpr,
        );
        paintLastSegment(ctx, currentRef.current);
        ctx.restore();
      }
    },
    [getScreenPos, redraw],
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
    redraw();
  }, [commitStroke, redraw]);

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

  // Wheel pans (trackpad or mouse wheel).
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      camera.offset = {
        x: camera.offset.x - e.deltaX,
        y: camera.offset.y - e.deltaY,
      };
      redraw();
    },
    [redraw],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      style={{ cursor: tool === "hand" ? "grab" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    />
  );
}
