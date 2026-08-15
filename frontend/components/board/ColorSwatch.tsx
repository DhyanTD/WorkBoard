"use client";

type ColorSwatchProps = {
  color: string;
  active: boolean;
  onClick: () => void;
};

export default function ColorSwatch({
  color,
  active,
  onClick,
}: ColorSwatchProps) {
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
        active ? "border-zinc-900 dark:border-white" : "border-transparent"
      }`}
      style={{
        backgroundColor: color === "#000000" ? "var(--canvas-ink)" : color,
      }}
      aria-label={`Color ${color}`}
    />
  );
}
