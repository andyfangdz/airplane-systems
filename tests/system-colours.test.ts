/**
 * Selected buttons fill with their system's colour (`--c`) and set their label in `--on-c`: the label must stay readable
 * (WCAG AA, 4.5:1 for small text) on every system colour in both themes.
 */
import { describe, expect, it } from "vitest";
import { contrast, onColor, palette, sysColor, sysVars, type SysId, type Theme } from "@/lib/systems";

const SYSTEMS: SysId[] = [
  "overview",
  "airframe",
  "doors",
  "controls",
  "flaps",
  "gear",
  "engine",
  "propeller",
  "fuel",
  "electrical",
  "lighting",
  "environment",
  "pitot",
  "ice",
  "vacuum",
  "avionics",
  "autopilot",
  "cabin",
  "oxygen",
  "caps",
];

describe.each(["light", "dark"] as Theme[])("%s theme", (theme) => {
  it.each(SYSTEMS)("%s: a selected button's label reads at 4.5:1 or better", (id) => {
    const c = sysColor(id, theme);
    expect(contrast(c, onColor(c))).toBeGreaterThanOrEqual(4.5);
  });

  it("pairs the accent's text colour the way the stylesheet's --on-accent does", () => {
    expect(onColor(palette(theme).accent)).toBe(theme === "dark" ? "#0B1117" : "#FFFFFF");
  });
});

it("sets the fill and its text colour together", () => {
  expect(sysVars("electrical", "light")).toEqual({ "--c": "#D9960F", "--on-c": "#0B1117" });
  expect(sysVars("caps", "light")).toEqual({ "--c": "#D32640", "--on-c": "#FFFFFF" });
});

it("measures contrast as WCAG does", () => {
  expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  expect(contrast("#1B5E88", "#FFFFFF")).toBeCloseTo(6.99, 2);
});
