"use client";

export const THEME_CHANGE_EVENT = "workboard-theme-change";

type Theme = "light" | "dark";

const getCurrentTheme = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export default function ThemeToggle() {
  const toggleTheme = () => {
    const nextTheme: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    try {
      localStorage.setItem("workboard-theme", nextTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }

    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: nextTheme }),
    );
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle color theme"
      className="group relative h-8 w-[3.75rem] shrink-0 rounded-full border border-zinc-300 bg-zinc-100 p-1 shadow-inner transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <span className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-amber-500 shadow-sm transition-transform duration-300 ease-out dark:translate-x-7 dark:bg-zinc-700 dark:text-sky-300">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 dark:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="hidden h-3.5 w-3.5 dark:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.5 8.5 0 1 0 11.4 11.4Z" />
        </svg>
      </span>
    </button>
  );
}
