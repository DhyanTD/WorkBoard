"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tool = "pen" | "pencil" | "eraser";

const COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
const LINE_WIDTHS = [2, 4, 6, 10];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(4);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tempCtx = temp.getContext("2d");
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tempCtx) {
        ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getCanvasPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDrawing(true);
      lastPos.current = getCanvasPos(e);
    },
    [getCanvasPos],
  );

  const drawPencilStroke = useCallback(
    (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.floor(dist / 2));
      const jitter = lineWidth * 0.6;

      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let s = 0; s < 4; s++) {
        ctx.globalAlpha = 0.15 + s * 0.04;
        ctx.lineWidth = lineWidth * (0.5 + s * 0.15);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * jitter;
          const y = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * jitter;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    },
    [color, lineWidth],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing || !lastPos.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const current = getCanvasPos(e);

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(current.x, current.y);
        ctx.strokeStyle = "rgba(255,255,255,0)";
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (tool === "pencil") {
        drawPencilStroke(ctx, lastPos.current, current);
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(current.x, current.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      lastPos.current = current;
    },
    [isDrawing, color, lineWidth, tool, getCanvasPos, drawPencilStroke],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
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

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              if (tool === "eraser") setTool("pen");
            }}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c && tool !== "eraser" ? "border-zinc-900 dark:border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {LINE_WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setLineWidth(w)}
            className={`flex items-center justify-center rounded-lg transition-colors ${
              lineWidth === w
                ? "bg-zinc-900 dark:bg-white"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            style={{ width: 32, height: 32 }}
            aria-label={`Line width ${w}`}
          >
            <div
              className="rounded-full"
              style={{
                width: w + 4,
                height: w + 4,
                backgroundColor: lineWidth === w ? "white" : "currentColor",
              }}
            />
          </button>
        ))}

        <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

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
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
