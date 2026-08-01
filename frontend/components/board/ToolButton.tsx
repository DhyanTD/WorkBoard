"use client";

import type { ReactNode } from "react";
import type { Tool } from "@/lib/board";

export type ToolButtonProps = {
  tool: Tool;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

export default function ToolButton({
  tool,
  active,
  onClick,
  children,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Select ${tool} tool`}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
