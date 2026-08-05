"use client";

import { COLORS, isDrawingTool, type Tool } from "@/lib/board";
import { useBoardStore } from "@/store/useBoardStore";
import ToolButton from "@/components/board/ToolButton";
import ActionButton from "@/components/board/ActionButton";
import ColorSwatch from "@/components/board/ColorSwatch";
import WidthSlider from "@/components/board/WidthSlider";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "select", label: "Select" },
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
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

  const setTool = useBoardStore((s) => s.setTool);
  const setColor = useBoardStore((s) => s.setColor);
  const setLineWidth = useBoardStore((s) => s.setLineWidth);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clear = useBoardStore((s) => s.clear);
  const resetView = useBoardStore((s) => s.resetView);

  const selectColor = (c: string) => {
    setColor(c);
    // Leaving eraser/hand via a color pick should drop into the pen.
    if (!isDrawingTool(tool)) setTool("pen");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
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
    </div>
  );
}
