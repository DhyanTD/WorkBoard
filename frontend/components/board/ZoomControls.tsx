"use client";

import { useBoardStore } from "@/store/useBoardStore";

/** Floating zoom controls (whiteboard-style) anchored bottom-right. */
export default function ZoomControls() {
  const scale = useBoardStore((s) => s.scale);
  const zoomIn = useBoardStore((s) => s.zoomIn);
  const zoomOut = useBoardStore((s) => s.zoomOut);

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/95">
      <button
        onClick={zoomOut}
        aria-label="Zoom out"
        className="grid h-7 w-7 place-items-center rounded-md text-lg leading-none text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        −
      </button>
      <span className="min-w-12 text-center text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={zoomIn}
        aria-label="Zoom in"
        className="grid h-7 w-7 place-items-center rounded-md text-lg leading-none text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        +
      </button>
    </div>
  );
}
