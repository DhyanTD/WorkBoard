"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { camera, useBoardStore } from "@/store/useBoardStore";
import {
  boundsFromPoint,
  boundsFromText,
  boundsFromPoints,
  DEFAULT_TEXT_FONT_SIZE,
  findTopmostStrokeAtPoint,
  includePoint,
  isShapeTool,
  isSelectionTool,
  isStrokeVisible,
  MAX_CANVAS_DPR,
  paintLastSegment,
  renderStroke,
  screenToWorld,
  shouldSamplePoint,
  translateStroke,
  type Point,
  type Stroke,
} from "@/lib/board";

const getCanvasDpr = () =>
  Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);

type TextEditor = {
  world: Point;
  screen: Point;
  value: string;
  color: string;
  fontSize: number;
};

export default function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tool = useBoardStore((s) => s.tool);
  const strokes = useBoardStore((s) => s.strokes);
  const redoStack = useBoardStore((s) => s.redoStack);
  const cameraEpoch = useBoardStore((s) => s.cameraEpoch);
  const commitStroke = useBoardStore((s) => s.commitStroke);
  const eraseWithStroke = useBoardStore((s) => s.eraseWithStroke);
  const removeStrokeAt = useBoardStore((s) => s.removeStrokeAt);
  const replaceStrokeAt = useBoardStore((s) => s.replaceStrokeAt);

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
  const movingSelectionRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const offsetStartRef = useRef<Point>({ x: 0, y: 0 });
  const selectionStartRef = useRef<Point>({ x: 0, y: 0 });
  const selectedStrokeStartRef = useRef<Stroke | null>(null);
  const movingStrokeRef = useRef<Stroke | null>(null);
  const lastEmptySelectionTapRef = useRef<{
    screen: Point;
    time: number;
  } | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const textEditorRef = useRef<TextEditor | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null);

  const commitTextEditor = useCallback((expectedEditor?: TextEditor, selectAfterCommit = false) => {
    const editor = textEditorRef.current;
    if (!editor || (expectedEditor && editor !== expectedEditor)) return;

    textEditorRef.current = null;
    setTextEditor(null);
    const text = editor.value.trim();
    if (!text) return;

    const textIndex = strokesRef.current.length;
    commitStroke({
      tool: "text",
      color: editor.color,
      lineWidth: 0,
      fontSize: DEFAULT_TEXT_FONT_SIZE,
      text,
      points: [editor.world],
      bounds: boundsFromText(editor.world, text, DEFAULT_TEXT_FONT_SIZE),
    });
    if (selectAfterCommit) {
      selectedIndexRef.current = textIndex;
      setSelectedIndex(textIndex);
    }
  }, [commitStroke]);

  const startTextEditor = useCallback(
    (world: Point, screen: Point) => {
      commitTextEditor();
      const editor: TextEditor = {
        world,
        screen,
        value: "",
        color: colorRef.current,
        fontSize: DEFAULT_TEXT_FONT_SIZE,
      };
      selectedIndexRef.current = null;
      setSelectedIndex(null);
      textEditorRef.current = editor;
      setTextEditor(editor);
    },
    [commitTextEditor],
  );

  useEffect(() => {
    if (textEditor) textInputRef.current?.focus();
  }, [textEditor]);

  useEffect(() => {
    if (!isSelectionTool(tool)) commitTextEditor();
  }, [commitTextEditor, tool]);

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
    for (let index = 0; index < strokesRef.current.length; index += 1) {
      const stroke =
        index === selectedIndexRef.current && movingStrokeRef.current
          ? movingStrokeRef.current
          : strokesRef.current[index];
      if (isStrokeVisible(stroke, viewport)) renderStroke(ctx, stroke);
    }
    const current = currentRef.current;
    if (current && isStrokeVisible(current, viewport)) {
      renderStroke(ctx, current);
    }

    const activeSelection = selectedIndexRef.current;
    if (activeSelection !== null) {
      const selectedStroke =
        movingStrokeRef.current ?? strokesRef.current[activeSelection];
      if (selectedStroke) {
        const padding = 6 / scale;
        const { minX, minY, maxX, maxY } = selectedStroke.bounds;
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([4 / scale, 3 / scale]);
        ctx.strokeRect(
          minX - padding,
          minY - padding,
          maxX - minX + padding * 2,
          maxY - minY + padding * 2,
        );
        ctx.restore();
      }
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
    if (selectedIndexRef.current !== null && selectedIndexRef.current >= strokes.length) {
      selectedIndexRef.current = null;
      setSelectedIndex(null);
    }
    scheduleRedraw();
  }, [strokes, scheduleRedraw]);
  useEffect(() => {
    scheduleRedraw();
  }, [redoStack, cameraEpoch, scheduleRedraw]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
    scheduleRedraw();
  }, [scheduleRedraw, selectedIndex]);

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

      // Ctrl/Cmd+click while erasing removes the topmost connected stroke.
      // This takes precedence over the modifier's usual canvas-pan behaviour.
      if (ctrlKey && toolRef.current === "eraser") {
        const world = screenToWorld(
          camera.offset,
          camera.scale,
          getScreenPos(e),
        );
        const hitIndex = findTopmostStrokeAtPoint(
          strokesRef.current,
          world,
          6 / camera.scale,
        );
        if (hitIndex !== -1) removeStrokeAt(hitIndex);
        return;
      }

      // Holding Ctrl or using the hand tool pans the canvas.
      if (ctrlKey || toolRef.current === "hand") {
        canvas.setPointerCapture(e.pointerId);
        panningRef.current = true;
        panStartRef.current = getScreenPos(e);
        offsetStartRef.current = { ...camera.offset };
        return;
      }

      if (isSelectionTool(toolRef.current)) {
        const screen = getScreenPos(e);
        const world = screenToWorld(camera.offset, camera.scale, screen);
        const hitIndex = findTopmostStrokeAtPoint(
          strokesRef.current,
          world,
          6 / camera.scale,
        );
        if (hitIndex === -1) {
          const previousTap = lastEmptySelectionTapRef.current;
          const dx = previousTap ? screen.x - previousTap.screen.x : 0;
          const dy = previousTap ? screen.y - previousTap.screen.y : 0;
          const doubleTap =
            e.detail >= 2 ||
            (previousTap !== null &&
              e.timeStamp - previousTap.time < 350 &&
              dx * dx + dy * dy < 256);
          lastEmptySelectionTapRef.current = doubleTap
            ? null
            : { screen, time: e.timeStamp };
          selectedIndexRef.current = null;
          setSelectedIndex(null);
          if (doubleTap) startTextEditor(world, screen);
          return;
        }

        lastEmptySelectionTapRef.current = null;
        selectedIndexRef.current = hitIndex;
        setSelectedIndex(hitIndex);

        canvas.setPointerCapture(e.pointerId);
        movingSelectionRef.current = true;
        selectionStartRef.current = world;
        selectedStrokeStartRef.current = strokesRef.current[hitIndex];
        movingStrokeRef.current = null;
        return;
      }

      canvas.setPointerCapture(e.pointerId);
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
    [getScreenPos, removeStrokeAt, scheduleRedraw, startTextEditor],
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
      if (movingSelectionRef.current && selectedStrokeStartRef.current) {
        const world = screenToWorld(camera.offset, camera.scale, getScreenPos(e));
        movingStrokeRef.current = translateStroke(selectedStrokeStartRef.current, {
          x: world.x - selectionStartRef.current.x,
          y: world.y - selectionStartRef.current.y,
        });
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
    if (movingSelectionRef.current) {
      movingSelectionRef.current = false;
      const index = selectedIndexRef.current;
      if (index !== null && movingStrokeRef.current) {
        replaceStrokeAt(index, movingStrokeRef.current);
      }
      selectedStrokeStartRef.current = null;
      movingStrokeRef.current = null;
      scheduleRedraw();
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current && currentRef.current.points.length > 0) {
      if (currentRef.current.tool === "eraser") {
        eraseWithStroke(currentRef.current);
      } else {
        commitStroke(currentRef.current);
      }
    }
    currentRef.current = null;
    scheduleRedraw();
  }, [commitStroke, eraseWithStroke, replaceStrokeAt, scheduleRedraw]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isSelectionTool(toolRef.current) || textEditorRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape") {
        selectedIndexRef.current = null;
        setSelectedIndex(null);
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const index = selectedIndexRef.current;
      if (index === null) return;
      e.preventDefault();
      removeStrokeAt(index);
      selectedIndexRef.current = null;
      setSelectedIndex(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeStrokeAt]);

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

  // Wheel pans; Shift+wheel pans horizontally; Ctrl/Cmd+wheel zooms.
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const anchor = getScreenPos(e);
        useBoardStore.getState().zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, anchor);
      } else {
        const horizontalDelta = e.shiftKey
          ? Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? e.deltaX
            : e.deltaY
          : e.deltaX;
        camera.offset = {
          x: camera.offset.x + horizontalDelta / camera.scale,
          y: camera.offset.y + (e.shiftKey ? 0 : e.deltaY) / camera.scale,
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
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none select-none"
        style={{
          cursor: tool === "hand" ? "grab" : isSelectionTool(tool) ? "default" : "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      {textEditor && (
        <input
          ref={textInputRef}
          value={textEditor.value}
          onChange={(e) => {
            const editor = textEditorRef.current;
            if (!editor) return;
            const updatedEditor = { ...editor, value: e.target.value };
            textEditorRef.current = updatedEditor;
            setTextEditor(updatedEditor);
          }}
          onBlur={() => commitTextEditor(textEditor)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTextEditor();
            } else if (e.key === "Escape") {
              e.preventDefault();
              commitTextEditor(undefined, true);
            }
          }}
          aria-label="Canvas text. Press Enter to place or Escape to select and move it."
          className="absolute z-10 border-0 bg-transparent p-0 leading-tight outline-none caret-zinc-900"
          style={{
            left: textEditor.screen.x,
            top: textEditor.screen.y,
            color: textEditor.color,
            fontSize: textEditor.fontSize,
            width: `${Math.max(1, textEditor.value.length + 1)}ch`,
          }}
        />
      )}
    </>
  );
}
