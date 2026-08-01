"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

type Tool = "pen" | "pencil" | "eraser" | "square" | "circle" | "hand";
type Point = { x: number; y: number };
type Stroke = { tool: Tool; color: string; lineWidth: number; points: Point[] };

const COLORS = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];
const GRID_SIZE = 40;
const BOARD_BG = "#ffffff";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(4);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const strokesRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);
  const panningRef = useRef(false);

  // Camera offset in world space (negative of what translate uses).
  // (0,0) in world maps to (-offset.x, -offset.y) on screen.
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const offsetStartRef = useRef<Point>({ x: 0, y: 0 });

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    lineWidthRef.current = lineWidth;
  }, [lineWidth]);

  // Convert screen coords to world coords.
  const screenToWorld = useCallback(
    (screen: Point): Point => ({
      x: screen.x - offsetRef.current.x,
      y: screen.y - offsetRef.current.y,
    }),
    [],
  );

  const getScreenPos = useCallback(
    (e: PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const renderStroke = useCallback(
    (ctx: CanvasRenderingContext2D, s: Stroke) => {
      const p = s.points;
      if (p.length === 0) return;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.lineWidth;
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = BOARD_BG;
        ctx.fillStyle = BOARD_BG;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
      }

      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, s.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (s.tool === "square" || s.tool === "circle") {
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
    },
    [],
  );

  const paintLastSegment = useCallback(
    (ctx: CanvasRenderingContext2D, s: Stroke) => {
      const p = s.points;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.lineWidth;
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = BOARD_BG;
        ctx.fillStyle = BOARD_BG;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
      }

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
    },
    [],
  );

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const ox = ((offsetRef.current.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
      const oy = ((offsetRef.current.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
      ctx.fillStyle = "#e5e7eb";
      for (let x = ox; x < w; x += GRID_SIZE) {
        for (let y = oy; y < h; y += GRID_SIZE) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw grid in screen space (shifted by camera offset)
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(ctx, w, h);
    ctx.restore();

    // Draw strokes in world space
    ctx.save();
    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      offsetRef.current.x * dpr,
      offsetRef.current.y * dpr,
    );
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    for (const s of all) renderStroke(ctx, s);
    ctx.restore();
  }, [renderStroke, drawGrid]);

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

      // If holding Ctrl or using hand tool, start panning
      if (ctrlKey || toolRef.current === "hand") {
        panningRef.current = true;
        panStartRef.current = getScreenPos(e);
        offsetStartRef.current = { ...offsetRef.current };
        return;
      }

      drawingRef.current = true;
      redoRef.current = [];
      const world = screenToWorld(getScreenPos(e));
      currentRef.current = {
        tool: toolRef.current,
        color: colorRef.current,
        lineWidth: lineWidthRef.current,
        points: [world],
      };
      redraw();
    },
    [getScreenPos, screenToWorld, redraw],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (panningRef.current) {
        const current = getScreenPos(e);
        offsetRef.current = {
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
      const world = screenToWorld(getScreenPos(e));

      if (t === "square" || t === "circle") {
        currentRef.current.points = [currentRef.current.points[0], world];
        redraw();
      } else {
        currentRef.current.points.push(world);
        // Paint in world space
        ctx.save();
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          offsetRef.current.x * dpr,
          offsetRef.current.y * dpr,
        );
        paintLastSegment(ctx, currentRef.current);
        ctx.restore();
      }
    },
    [getScreenPos, screenToWorld, paintLastSegment, redraw],
  );

  const syncFlags = useCallback(() => {
    setCanUndo(strokesRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const endStroke = useCallback(() => {
    if (!drawingRef.current && !panningRef.current) return;
    if (panningRef.current) {
      panningRef.current = false;
      return;
    }
    drawingRef.current = false;
    if (currentRef.current && currentRef.current.points.length > 0) {
      strokesRef.current = [...strokesRef.current, currentRef.current];
    }
    currentRef.current = null;
    redraw();
    setCanUndo(true);
    setCanRedo(false);
  }, [redraw]);

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

  // Wheel to pan (trackpad or mouse wheel)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      offsetRef.current = {
        x: offsetRef.current.x - e.deltaX,
        y: offsetRef.current.y - e.deltaY,
      };
      redraw();
    },
    [redraw],
  );

  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const last = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current = strokesRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, last];
    redraw();
    syncFlags();
  }, [redraw, syncFlags]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const s = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    strokesRef.current = [...strokesRef.current, s];
    redraw();
    syncFlags();
  }, [redraw, syncFlags]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    redoRef.current = [];
    currentRef.current = null;
    drawingRef.current = false;
    panningRef.current = false;
    offsetRef.current = { x: 0, y: 0 };
    redraw();
    syncFlags();
  }, [redraw, syncFlags]);

  const resetView = useCallback(() => {
    offsetRef.current = { x: 0, y: 0 };
    redraw();
  }, [redraw]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <button
          onClick={() => setTool("hand")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "hand"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Hand
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        <button
          onClick={() => setTool("pen")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "pen"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Pen
        </button>
        <button
          onClick={() => setTool("pencil")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "pencil"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Pencil
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "eraser"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Eraser
        </button>
        <button
          onClick={() => setTool("square")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "square"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Square
        </button>
        <button
          onClick={() => setTool("circle")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "circle"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Circle
        </button>

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              if (tool === "eraser" || tool === "hand") setTool("pen");
            }}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c && tool !== "eraser" && tool !== "hand"
                ? "border-zinc-900 dark:border-white"
                : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={40}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700 dark:accent-white"
            aria-label="Line width"
          />
          <span className="w-6 text-center text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
            {lineWidth}
          </span>
        </div>

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Redo
        </button>
        <button
          onClick={resetView}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Reset View
        </button>
        <button
          onClick={clearCanvas}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
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
      </div>
    </div>
  );
}
