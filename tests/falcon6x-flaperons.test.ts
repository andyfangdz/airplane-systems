import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import { surfaceAngle, useFlaperonStudy } from "@/aircraft/falcon6x/flaperons";
import { CAT } from "@/aircraft/falcon6x/parts";

// The product overview describes the flaperon's flap and aileron functions. Check direction in
// airplane coordinates against each authored hinge, independently of the illustrative travel angle.
function trailingEdgeHeight(key: string) {
  const hinge = CAT.surfaces.find((surface) => surface.key === key)!;
  return new Vector3(-1, 0, 0).applyAxisAngle(new Vector3(...hinge.axis), surfaceAngle(key)).y;
}

afterEach(() => useFlaperonStudy.setState({ pose: "neutral" }));

it("lowers both trailing edges for lift and raises the inside edge for roll", () => {
  useFlaperonStudy.setState({ pose: "lift" });
  expect(trailingEdgeHeight("ailR")).toBeLessThan(0);
  expect(trailingEdgeHeight("ailL")).toBeLessThan(0);
  expect(trailingEdgeHeight("flapR")).toBeLessThan(0);
  expect(trailingEdgeHeight("flapL")).toBeLessThan(0);
  expect(surfaceAngle("outboardAilR")).toBe(0);

  useFlaperonStudy.setState({ pose: "left" });
  expect(trailingEdgeHeight("ailR")).toBeLessThan(0);
  expect(trailingEdgeHeight("ailL")).toBeGreaterThan(0);
  expect(trailingEdgeHeight("outboardAilL")).toBeGreaterThan(0);
  expect(trailingEdgeHeight("outboardAilR")).toBeLessThan(0);
  expect(surfaceAngle("flapL")).toBe(0);

  useFlaperonStudy.setState({ pose: "right" });
  expect(trailingEdgeHeight("ailR")).toBeGreaterThan(0);
  expect(trailingEdgeHeight("ailL")).toBeLessThan(0);
  expect(surfaceAngle("rudder")).toBe(0);

  useFlaperonStudy.setState({ pose: "neutral" });
  expect(trailingEdgeHeight("ailR")).toBe(0);
  expect(trailingEdgeHeight("ailL")).toBe(0);
});
