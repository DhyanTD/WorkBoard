"use client";

import Link from "next/link";
import { COLORS, isDrawingTool, type Tool } from "@/lib/board";
import { useBoardStore } from "@/store/useBoardStore";
import ToolButton from "@/components/board/ToolButton";
import ActionButton from "@/components/board/ActionButton";
import ColorSwatch from "@/components/board/ColorSwatch";
import WidthSlider from "@/components/board/WidthSlider";
import ThemeToggle from "@/components/board/ThemeToggle";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "select", label: "Select" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "square", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "rhombus", label: "Rhombus" },
];

function Divider() {
  return <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />;
}

export default function Toolbar() {
  const tool = useBoardStore((s) => s.tool);
  const color = useBoardStore((s) => s.color);
  const lineWidth = useBoardStore((s) => s.lineWidth);
  const canUndo = useBoardStore((s) => s.canUndo);
  const canRedo = useBoardStore((s) => s.canRedo);
  const canPaste = useBoardStore((s) => s.canPaste);
  const selectedIndices = useBoardStore((s) => s.selectedIndices);

  const setTool = useBoardStore((s) => s.setTool);
  const setColor = useBoardStore((s) => s.setColor);
  const setLineWidth = useBoardStore((s) => s.setLineWidth);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const copySelectedStrokes = useBoardStore((s) => s.copySelectedStrokes);
  const pasteStrokes = useBoardStore((s) => s.pasteStrokes);
  const deleteSelectedStrokes = useBoardStore((s) => s.deleteSelectedStrokes);
  const clear = useBoardStore((s) => s.clear);
  const resetView = useBoardStore((s) => s.resetView);

  const selectColor = (c: string) => {
    setColor(c);
    // Leaving eraser/hand via a color pick should drop into the freehand tool.
    if (!isDrawingTool(tool)) setTool("pencil");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-[var(--toolbar-background)] px-4 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl transition-colors dark:border-zinc-800 dark:shadow-black/20">
      <ToolButton
        tool="hand"
        active={tool === "hand"}
        onClick={() => setTool("hand")}
      >
        Hand
      </ToolButton>

      <Divider />

      {TOOLS.map(({ id, label }) => (
        <ToolButton
          key={id}
          tool={id}
          active={tool === id}
          onClick={() => setTool(id)}
        >
          {label}
        </ToolButton>
      ))}

      <Divider />

      {COLORS.map((c) => (
        <ColorSwatch
          key={c}
          color={c}
          active={color === c && isDrawingTool(tool)}
          onClick={() => selectColor(c)}
        />
      ))}

      <Divider />

      <WidthSlider value={lineWidth} onChange={setLineWidth} />

      <Divider />

      <ActionButton
        onClick={copySelectedStrokes}
        disabled={selectedIndices.length === 0}
      >
        Copy
      </ActionButton>
      <ActionButton onClick={pasteStrokes} disabled={!canPaste}>
        Paste
      </ActionButton>
      <ActionButton
        onClick={deleteSelectedStrokes}
        disabled={selectedIndices.length === 0}
        danger
      >
        Delete{selectedIndices.length > 1 ? ` (${selectedIndices.length})` : ""}
      </ActionButton>
      <ActionButton onClick={undo} disabled={!canUndo}>
        Undo
      </ActionButton>
      <ActionButton onClick={redo} disabled={!canRedo}>
        Redo
      </ActionButton>
      <ActionButton onClick={resetView}>Reset View</ActionButton>
      <ActionButton onClick={clear} danger>
        Clear
      </ActionButton>

      <div className="ml-auto flex items-center gap-3">
        <Divider />
        <Link
          href="/designs/workbench"
          className="rounded-md border border-[#173f5f] bg-[#173f5f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#245775]"
        >
          Design atelier
        </Link>
        <ThemeToggle />
      </div>
    </div>
  );
}
