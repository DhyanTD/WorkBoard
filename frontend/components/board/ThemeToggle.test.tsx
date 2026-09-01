// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ThemeToggle from "@/components/board/ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(cleanup);

  it("retains light and dark theme switching", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle light and dark mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("workboard-theme")).toBe("dark");
  });
});
