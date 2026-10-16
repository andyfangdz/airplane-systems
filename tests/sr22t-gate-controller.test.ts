/**
 * SR22T wastegate controller at the AMM position: the upper firewall at the left rear, outboard of the oil cooler (AMM
 * 13773-002 Rev 7 Fig 71-00-2 sheet 3 item 30, PDF p. 2489; AMM 81-20 PDF p. 2812), with its sensing and oil hoses
 * re-routed to it. The figure is undimensioned, so the seat is checked against the airplane's own neighbours: the
 * firewall, the oil cooler, the Master Control Unit and the upper-left engine mount firewall attach fitting.
 */
import { describe, expect, it } from "vitest";
import { CRANK_Y, IN } from "@/aircraft/sr22t/engine-datum";
import { FW } from "@/aircraft/sr22t/geometry";
import { CAT } from "@/aircraft/sr22t/parts";
import { GATE_CONTROLLER, GATE_CONTROLLER_SIZE, OIL_COOLER, OIL_COOLER_SIZE } from "@/aircraft/sr22t/parts/engine";
import { MANIFOLD_PRESSURE_LINE, UPPER_DECK_LINE } from "@/aircraft/sr22t/parts/engine-air";
import { toV } from "@/lib/math";
import { gap, solid, type Shape } from "./sr22t-engine-gap";

/** Fig 71-00-2 sheet 3's item 30 read against the crankshaft centre line, inches: 14–18 left, 3–6 up (approximate;
 * engine.ts `GATE_CONTROLLER`). */
const LEFT_IN = [14, 18];
const UP_IN = [3, 6];
const MARGIN = 0.005;

const part = (name: string) => {
  const found = CAT.parts.filter((p) => p.name === name);
  expect(found, name).toHaveLength(1);
  return found[0];
};
/** The manifold's aft end cap, an unnamed part (engine-air.ts): the one whose bounds hold the manifold pressure
 * line's fitting station. */
const manifoldCap = () => {
  const fitting = toV(MANIFOLD_PRESSURE_LINE[MANIFOLD_PRESSURE_LINE.length - 1]);
  const found = CAT.parts
    .filter((p) => !p.name)
    .filter((p) => solid(p).box.expandByScalar(0.001).containsPoint(fitting));
  expect(found, "manifold end cap").toHaveLength(1);
  return found[0];
};

describe("SR22T wastegate controller at the AMM position", () => {
  it("sits inside the figure's left-rear read: 14–18 in. left of the crankshaft centre line and 3–6 in. above it (AMM Fig 71-00-2 sheet 3 item 30 PDF p. 2489)", () => {
    const [left, up] = [-GATE_CONTROLLER[2] / IN, (GATE_CONTROLLER[1] - CRANK_Y) / IN];
    expect(left).toBeGreaterThanOrEqual(LEFT_IN[0]);
    expect(left).toBeLessThanOrEqual(LEFT_IN[1]);
    expect(up).toBeGreaterThanOrEqual(UP_IN[0]);
    expect(up).toBeLessThanOrEqual(UP_IN[1]);
    // the chosen seat: 17.3 in. left and 5.7 in. up
    expect(left).toBeCloseTo(17.3, 6);
    expect(up).toBeCloseTo(5.7, 6);
  });

  it("sits on the upper firewall at the left rear, outboard of the oil cooler and the Master Control Unit, above the upper-left mount attach fitting (AMM Fig 71-00-2 sheet 3 PDF p. 2489; AMM 81-20 PDF p. 2812)", () => {
    const box = solid(part("Wastegate controller")).box;
    // seated on the firewall, its aft face 3 mm off it
    expect(box.min.x).toBeGreaterThan(FW);
    expect(box.min.x - FW).toBeLessThanOrEqual(0.005);
    // outboard of the oil cooler and above the crankshaft centre line
    expect(box.max.z).toBeLessThan(OIL_COOLER[2] - OIL_COOLER_SIZE[2] / 2);
    expect(box.min.y).toBeGreaterThan(CRANK_Y);
    expect(box.max.y - box.min.y).toBeCloseTo(GATE_CONTROLLER_SIZE[1], 6);
    // outboard of the MCU and above the upper-left attach fitting, each by the 5 mm clearance
    const mcu = solid(part("Master Control Unit")).box;
    expect(box.max.z).toBeLessThan(mcu.min.z - MARGIN);
    const fittings = CAT.parts
      .filter((p) => p.name === "Firewall attach fitting")
      .map(solid)
      .filter((s) => s.box.max.z < 0);
    expect(fittings).toHaveLength(2);
    const upperLeft = fittings.reduce((a, b) => (a.box.max.y > b.box.max.y ? a : b)).box;
    expect(box.min.y).toBeGreaterThan(upperLeft.max.y + MARGIN);
  });

  it("the controller and its four hoses keep 10 mm from the spark plugs, ignition leads and induction ducts, besides each sensing hose's own fitting (Fig 78-10-3 PDF p. 2742)", () => {
    const cap = solid(manifoldCap());
    // each sensing hose starts on a fitting on the induction it senses: the throttle body's, and the manifold's aft end
    // cap
    const own: Record<string, (s: Shape) => boolean> = {
      "Wastegate controller": () => false,
      "Upper-deck pressure line": (s) =>
        ["Upper-deck pressure fitting", "Throttle body / fuel-metering valve"].includes(s.name),
      "Manifold pressure line": (s) => s.name === "Intake manifold" || s.name === cap.name,
      "Wastegate oil line": () => false,
      "Controller oil return": () => false,
    };
    const tight =
      /^(Spark plug|Ignition lead|Plug lead terminal|Harness cap|NACA induction duct|Air box|Compressor inlet neck|Induction Y junction|Intake manifold|Intake pipe|Intake port flange|Intercooler|LH intercooler|RH intercooler|Induction inlet duct|Induction clamp|Alternate air duct|Compressor outlet coupler|Hose connector|Hose clamp|Throttle body)/;
    const others = [
      ...CAT.parts
        .filter((p) => (!p.parent || p.parent.startsWith("cyl:")) && !(p.name! in own))
        .map(solid)
        .filter((s) => tight.test(s.name)),
      cap,
    ];
    const hits: string[] = [];
    for (const [name, host] of Object.entries(own)) {
      const a = solid(part(name));
      for (const b of others) {
        if (host(b)) continue;
        const g = gap(a, b, 0.01);
        if (g < 0.01 - 1e-7) hits.push(`${name} / ${b.name}: ${(g * 1000).toFixed(2)} mm`);
      }
    }
    expect(hits).toEqual([]);
  }, 120000);

  it("its four hoses clear each other by 5 mm, the two sensing hoses landing apart on its top face (Fig 78-10-3 PDF p. 2742)", () => {
    const hoses = [
      "Upper-deck pressure line",
      "Manifold pressure line",
      "Wastegate oil line",
      "Controller oil return",
    ].map((n) => solid(part(n)));
    const hits: string[] = [];
    for (let i = 0; i < hoses.length; i++)
      for (let j = i + 1; j < hoses.length; j++) {
        const g = gap(hoses[i], hoses[j], MARGIN);
        if (g < MARGIN - 1e-7) hits.push(`${hoses[i].name} / ${hoses[j].name}: ${(g * 1000).toFixed(2)} mm`);
      }
    expect(hits).toEqual([]);
    // both sensing hoses land on the box's top face, 16 mm or more apart centre to centre
    const deck = UPPER_DECK_LINE[UPPER_DECK_LINE.length - 1],
      manifold = MANIFOLD_PRESSURE_LINE[0];
    for (const [x, y, z] of [deck, manifold]) {
      expect(y).toBeCloseTo(GATE_CONTROLLER[1] + GATE_CONTROLLER_SIZE[1] / 2, 9);
      expect(Math.abs(x - GATE_CONTROLLER[0])).toBeLessThan(GATE_CONTROLLER_SIZE[0] / 2);
      expect(Math.abs(z - GATE_CONTROLLER[2])).toBeLessThan(GATE_CONTROLLER_SIZE[2] / 2);
    }
    expect(toV(deck).distanceTo(toV(manifold))).toBeGreaterThanOrEqual(0.016);
  }, 120000);
});
