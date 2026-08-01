"use client";

import type { ReactNode } from "react";

type ActionButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
};

export default function ActionButton({
  onClick,
  disabled,
  danger,
  children,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
