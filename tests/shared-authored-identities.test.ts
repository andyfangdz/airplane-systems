import { expect, it } from "vitest";
import { Catalogue } from "@/lib/catalogue";
import { addControlCable } from "@/lib/hardware";

it("a control-cable declaration keeps its identity when its routing, system or display wording changes", () => {
  const original = addControlCable(
    new Catalogue("test"),
    "controls.throttle-cable",
    "Throttle cable",
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
    "Source note",
  );
  const revised = addControlCable(
    new Catalogue("test"),
    "controls.throttle-cable",
    "Revised control wording",
    [
      [0, 0.2, 0],
      [1.5, 0.4, 0.1],
    ],
    "Revised source note",
    ["fuel"],
  );
  expect(original.spec.id).toBe("test/controls.throttle-cable");
  expect(revised.spec.id).toBe(original.spec.id);
  expect(revised.points).not.toEqual(original.points);
});
