import { describe, expect, it } from "vitest";
import { liveryLabels } from "@/aircraft/liveries";
import { layoutLettering } from "@/lib/lettering";

describe("photo-referenced exterior lettering (aircraft/LIVERIES.md)", () => {
  it("covers every fleet marking without browser font fallback", () => {
    for (const id of ["sr20", "c172s", "c182t", "da40"] as const) {
      for (const section of ["fuselage", "tail"] as const) {
        for (const label of liveryLabels(id, section)) {
          const layout = layoutLettering(label.text, label.style, label.tracking);
          expect(layout.width).toBeGreaterThan(0);
          expect(layout.height).toBeGreaterThan(0);
          expect(layout.glyphs).toHaveLength(label.text.replaceAll(" ", "").length);
          expect(layout.glyphs.every((g) => g.bounds.every(Number.isFinite))).toBe(true);
        }
      }
    }
  });

  it("includes rounded overshoots and the Cessna Q tail in the fitted rectangle", () => {
    const cirrus = layoutLettering("N800KP", "rounded-oblique");
    expect(cirrus.y0).toBeLessThan(0);
    expect(cirrus.y0 + cirrus.height).toBeGreaterThan(100);
    const cessna = layoutLettering("N6189Q", "block-oblique");
    expect(cessna.y0 + cessna.height).toBe(108);
    // All visible ink, including slant overhang, must fit the specified paint box.
    for (const layout of [cirrus, cessna]) {
      const normalized = layout.glyphs.flatMap((g) => [
        (g.x + g.bounds[0] - layout.x0) / layout.width,
        (g.x + g.bounds[2] - layout.x0) / layout.width,
      ]);
      expect(Math.min(...normalized)).toBe(0);
      expect(Math.max(...normalized)).toBe(1);
    }
  });

  it("keeps spacing proportional and excludes trailing side bearings from ink bounds", () => {
    const tight = layoutLettering("N800KP", "rounded-oblique");
    const spaced = layoutLettering("N800KP", "rounded-oblique", 5);
    expect(spaced.width - tight.width).toBeCloseTo(25);
    expect(layoutLettering("111", "block-upright").width).toBeLessThan(layoutLettering("888", "block-upright").width);
    expect(() => layoutLettering("?", "block-upright")).toThrow("Missing");
  });
});
