/** Exact control-surface selection survives presentation labels and uses the renderer's surface namespace. */
import { expect, it } from "vitest";
import { walk } from "@/aircraft/sr20/walk";
import { spotsAt } from "@/lib/spot";

it.each(["ailR", "surface:ailR"])("resolves authored surface reference %s for spotlight and framing", (reference) => {
  const base = walk.steps[0];
  const step = { ...base, item: { ...base.item, parts: [reference], side: "any" as const } };
  const spot = walk.stepSpot(step);
  expect(walk.inCatalogue(reference)).toBe(true);
  expect(spot).toEqual({ names: [], ids: ["surface:ailR"], side: 0 });
  expect(spotsAt(spot, "Renamed aileron label", 3, "surface:ailR")).toBe(true);
  expect(spotsAt(spot, "Renamed aileron label", -3, "surface:ailL")).toBe(false);
  const centres = walk.nameCentres(reference);
  expect(centres).toHaveLength(1);
  expect(centres[0].toArray()).toEqual(walk.nameCentres("ailR")[0].toArray());
});
