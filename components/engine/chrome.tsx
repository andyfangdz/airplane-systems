"use client";
/** Page chrome shared by the engine and component pages: the theme button and the saved-theme hook. */
import { useEffect } from "react";
import { useView } from "@/lib/view";

const SUN = (
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
  </>
);
const MOON = <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />;

/** The toolbar's light/dark switch. */
export function ThemeButton() {
  const theme = useView((x) => x.theme),
    setTheme = useView((x) => x.setTheme);
  const dark = theme === "dark";
  return (
    <button
      className="tb tb-theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
        {dark ? SUN : MOON}
      </svg>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

/** A toolbar toggle button. */
export function Toggle({
  on,
  title,
  onClick,
  children,
}: {
  on: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="tb" title={title} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/** Follow the saved theme, else the system setting (the same key the airplane pages use). */
export function useTheme() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("sr20theme");
    } catch {}
    const os = window.matchMedia("(prefers-color-scheme: dark)");
    useView.getState().setTheme(saved === "light" || saved === "dark" ? saved : os.matches ? "dark" : "light", false);
  }, []);
}
