import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { ThemeButton } from "@/components/ui/chrome";
import { THEME_COLORS } from "@/lib/theme";
import { useView } from "@/lib/view";

afterEach(() => {
  cleanup();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  document.documentElement.removeAttribute("data-theme");
  localStorage.removeItem("sr20theme");
  useView.setState({ theme: "light" });
});

function addMetadata() {
  for (const theme of ["light", "dark"] as const) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = `(prefers-color-scheme: ${theme})`;
    meta.content = THEME_COLORS[theme];
    document.head.append(meta);
  }
}

const colors = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => ({
    content: meta.content,
    media: meta.media,
  }));

test("a chosen theme updates native app chrome regardless of the OS-media variant", () => {
  addMetadata();
  useView.getState().setTheme("light", false);
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("sr20theme")).toBe("dark");
  expect(colors()).toEqual([
    { content: THEME_COLORS.light, media: "not all" },
    { content: THEME_COLORS.dark, media: "all" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(colors()).toEqual([
    { content: THEME_COLORS.light, media: "all" },
    { content: THEME_COLORS.dark, media: "not all" },
  ]);
});

test("prepaint theme selection preserves Next metadata through hydration", async () => {
  addMetadata();
  useView.getState().setTheme("dark", false);
  const errors: unknown[] = [];
  const metadata = (
    <>
      <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.light} />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
    </>
  );
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(document.head, metadata, { onRecoverableError: (error) => errors.push(error) });
  });
  try {
    expect(colors()).toEqual([
      { content: THEME_COLORS.light, media: "not all" },
      { content: THEME_COLORS.dark, media: "all" },
    ]);
    expect(errors).toEqual([]);
  } finally {
    await act(async () => root.unmount());
  }
});
