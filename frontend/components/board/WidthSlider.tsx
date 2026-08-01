"use client";

type WidthSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export default function WidthSlider({ value, onChange }: WidthSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={1}
        max={40}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700 dark:accent-white"
        aria-label="Line width"
      />
      <span className="w-6 text-center text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {value}
      </span>
    </div>
  );
}
