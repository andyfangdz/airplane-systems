"use client";
/** Page chrome shared by the airplane, engine and component pages: the toolbar's icons and the theme switch. */
import type { ReactNode } from "react";
import { useView } from "@/lib/view";
import { useTouchClick } from "@/lib/useTouchClick";

const SUN = (
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
  </>
);
const MOON = <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />;
/** A clipboard with a tick: the preflight walk-around. */
export const PREFLIGHT_ICON = (
  <>
    <rect x="3" y="2.5" width="10" height="12" rx="1.5" />
    <path d="M6 1.5h4v2.5H6z" />
    <path d="M5.5 9.2l1.8 1.8 3.4-3.6" />
  </>
);
/** Frame corners round a point: back to the view's starting frame. */
export const RESET_ICON = (
  <>
    <path d="M2 6V3.2C2 2.5 2.5 2 3.2 2H6M10 2h2.8c.7 0 1.2.5 1.2 1.2V6M14 10v2.8c0 .7-.5 1.2-1.2 1.2H10M6 14H3.2C2.5 14 2 13.5 2 12.8V10" />
    <circle cx="8" cy="8" r="1.6" />
  </>
);

/** A 16 × 16 stroked icon, hidden from assistive technology (the button's text or label names it). */
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
      {children}
    </svg>
  );
}

/** The light/dark switch. Its word is hidden where space is short (phones, the collapsed rail); the label names it. */
export function ThemeButton() {
  const touchClick = useTouchClick();
  const theme = useView((x) => x.theme),
    setTheme = useView((x) => x.setTheme);
  const dark = theme === "dark",
    label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      {...touchClick}
      className="tb tb-theme"
      title={label}
      aria-label={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Icon>{dark ? SUN : MOON}</Icon>
      <span className="tb-word">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

/** The toolbar's Reset view: back to the view's starting frame. Icon-only on phones, where the toolbar is one row. */
export function ResetViewButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="tb" title="Reset view" aria-label="Reset view" disabled={disabled} onClick={onClick}>
      <Icon>{RESET_ICON}</Icon>
      <span className="tb-word">Reset view</span>
    </button>
  );
}
