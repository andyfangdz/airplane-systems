/** Source-backed C182T cutaway/topology and complete-envelope consistency; coordinates remain approximate. */
import { describe, expect, it } from "vitest";
import { TubeGeometry } from "three";
import { CAT } from "@/aircraft/c182t/parts";
import { AF } from "@/aircraft/c182t/geometry";
import { CYLS } from "@/aircraft/c182t/parts/engine";
import {
  ENGINE_DEPTH_ANCHORS as A,
  ENGINE_DEPTH_PARTS,
  chtPoint,
  egtPoint,
  magnetoPoint,
  plugMag,
  plugPoint,
} from "@/aircraft/c182t/parts/engine-depth";
import {
  ENGINE_DEPTH_FLOWS as F,
  ENGINE_DEPTH_REPLACED_FLOW_KEYS,
  engineDepthFlowRates,
} from "@/aircraft/c182t/engine-depth-flow";
import { initialSim, solve } from "@/aircraft/c182t/model";
import { curveOf } from "@/lib/geometry";
import { patched } from "./helpers";
import { namedPart, points, worldGeometry } from "./placement-helpers";

const route = (key: string) => F.find((f) => f.key === "eDepth" + key)!;

describe("C182T IO-540-AB1A5 depth", () => {
  it("models six cylinders, twelve valve trains, four inter-cylinder baffles and six drains (Lycoming IPC Figs 8,10–12)", () => {
    for (const [prefix, count] of [
      ["Piston —", 6],
      ["Connecting rod —", 6],
      ["Rocker box cover —", 6],
      ["Pushrod / shroud tube —", 12],
      ["Valve rocker —", 12],
      ["Induction sleeve —", 6],
      ["Intake sleeve clamp", 12],
      ["Inter-cylinder cooling baffle", 4],
      ["Oil pump impeller", 2],
    ] as const)
      expect(
        ENGINE_DEPTH_PARTS.filter((p) => p.name?.startsWith(prefix)),
        prefix,
      ).toHaveLength(count);
    expect(F.filter((f) => f.key.startsWith("eDepthRockerDrain"))).toHaveLength(6);
  });

  it("retains both impulse-coupled magnetos and omits turbo-only separator/boost hardware (MM 74-10-00 p.201;79-20-10 p.201)", () => {
    expect(ENGINE_DEPTH_PARTS.filter((p) => p.name?.includes("magneto impulse coupling"))).toHaveLength(2);
    expect(ENGINE_DEPTH_PARTS.some((p) => /SlickSTART|separator|turbocharger|wastegate/i.test(p.name ?? ""))).toBe(
      false,
    );
    expect(route("Breather").pts[0]).toEqual(A.crankcaseBreather);
    expect(route("Breather").pts.at(-1)).toEqual(route("BreatherOutlet").pts[0]);
  });

  it("connects twelve shielded leads to the selected POH's cross-bank magneto assignments (2005 POH 7-35)", () => {
    expect(F.filter((f) => /^eDepthIgn\d[UL]$/.test(f.key))).toHaveLength(12);
    for (const c of CYLS)
      for (const level of ["U", "L"] as const) {
        const f = route(`Ign${c.n}${level}`);
        expect(f.pts[0]).toEqual(magnetoPoint(plugMag(c, level)));
        expect(f.pts.at(-1)).toEqual(plugPoint(c, level));
        expect(f.pts.at(-1)).toEqual(
          namedPart(CAT, `Spark plug — cyl ${c.n} ${level === "U" ? "upper" : "lower"}`).pos,
        );
      }
    expect(plugMag(CYLS[0], "U")).toBe("L");
    expect(plugMag(CYLS[0], "L")).toBe("R");
    expect(plugMag(CYLS[1], "U")).toBe("R");
    expect(plugMag(CYLS[1], "L")).toBe("L");
  });

  it("separates all six CHT and EGT channels and oil-temperature sensing from the oil circuit (MM 77-20-00 p.1;POH7-32–33)", () => {
    for (const c of CYLS) {
      expect(route("CHT" + c.n).pts[0]).toEqual(chtPoint(c));
      expect(route("EGT" + c.n).pts[0]).toEqual(egtPoint(c));
      for (const kind of ["CHT", "EGT"]) expect(route(kind + c.n).pts.at(-1)).toEqual(A.harness);
    }
    expect(ENGINE_DEPTH_PARTS.filter((p) => p.name?.startsWith("CHT probe —"))).toHaveLength(6);
    expect(ENGINE_DEPTH_PARTS.filter((p) => p.name?.startsWith("EGT probe —"))).toHaveLength(6);
    expect(route("OilTemperatureSignal").pts[0]).toEqual(namedPart(CAT, "Oil temperature sensor").pos);
    expect(route("EngineData").pts.at(-1)).toEqual(namedPart(CAT, "GEA 71 engine/airframe unit").pos);
  });

  it("keeps independent pump, filter bypass, relief, cooler hoses, galleries and governor supply (POH7-34; IPC Figs16,18)", () => {
    expect(route("OilPickup").pts).toEqual([A.sump, A.oilScreen, A.oilPump]);
    expect(route("OilPumpFilter").pts.at(-1)).toEqual(A.filter);
    expect(route("OilFilterRelief").pts.at(-1)).toEqual(A.relief);
    expect(route("OilFilterBypass").pts).toContainEqual(A.filterBypass);
    expect(route("OilCoolerFeed").pts.at(-1)).toEqual(A.cooler);
    expect(route("OilCoolerReturn").pts[0]).toEqual(A.cooler);
    expect(route("OilCoolerReturn").pts.at(-1)).toEqual(A.leftGallery);
    expect(route("GovernorSupply").pts[0]).toEqual(A.leftGallery);
    expect(route("PropOil").pts.at(-1)).toEqual(A.propPiston);
    expect(route("PropOil").tube).toBe(false);
    expect(ENGINE_DEPTH_REPLACED_FLOW_KEYS).toEqual(["oil", "oilRet", "oilGov", "coolL", "coolR"]);
  });

  it("provides an explicit study group for every new part and flow", () => {
    for (const item of [...ENGINE_DEPTH_PARTS, ...F]) expect(item.groups, item.name).toBeDefined();
    expect(new Set(F.map((f) => f.key)).size).toBe(F.length);
  });
});

describe("C182T engine circuit animation", () => {
  it("electrical loss stops GEA data while mechanically driven oil and ignition continue (POH7-28,7-34–35)", () => {
    const s = patched(initialSim);
    const E = solve(s);
    const R = engineDepthFlowRates(s, { ...E, gea: false }, 2300);
    expect(R.eDepthEngineData).toBe(0);
    expect(R.eDepthCHT1).toBe(0);
    expect(R.eDepthOilPickup).toBeGreaterThan(0);
    expect(R.eDepthIgn1U).toBeGreaterThan(0);
    expect(R.eDepthPleadL).toBe(0);
  });

  it("each selected magneto fires only its six leads and a failed magneto remains dark (POH7-35)", () => {
    const s = patched(initialSim, { eng: { mags: "L" } });
    let R = engineDepthFlowRates(s, solve(s), 1800);
    for (const c of CYLS)
      for (const level of ["U", "L"] as const)
        expect(R[`eDepthIgn${c.n}${level}`]).toBe(plugMag(c, level) === "L" ? 1 : 0);
    s.eng.fail.magL = true;
    R = engineDepthFlowRates(s, solve(s), 1800);
    expect(
      Object.entries(R)
        .filter(([key]) => /^eDepthIgn\d[UL]$/.test(key))
        .every(([, n]) => n === 0),
    ).toBe(true);
  });

  it("oil loss stops lubrication/governor particles without stopping crankcase ventilation or data (POH7-34,7-37)", () => {
    const s = patched(initialSim, { eng: { fail: { oil: true } } });
    const R = engineDepthFlowRates(s, solve(s), 2300);
    expect(R.eDepthOilPickup).toBe(0);
    expect(R.eDepthOilCoolerFeed).toBe(0);
    expect(R.eDepthPropOil).toBe(0);
    expect(R.eDepthBreather).toBeGreaterThan(0);
    expect(R.eDepthEngineData).toBeGreaterThan(0);
  });

  it("stops engine circuits on the ramp and retains ram cooling in flight", () => {
    const s = patched(initialSim, { ground: true, eng: { running: false } });
    let R = engineDepthFlowRates(s, solve(s), 0);
    expect(R.eDepthOilPickup).toBe(0);
    expect(R.eDepthIgn1U).toBe(0);
    expect(R.eDepthBreather).toBe(0);
    expect(R.eDepthCoolingR).toBe(0);
    s.ground = false;
    R = engineDepthFlowRates(s, solve(s), 0, 90);
    expect(R.eDepthCoolingR).toBeGreaterThan(0);
    expect(R.eDepthOilPickup).toBe(0);
  });
});

describe("C182T detailed engine cowling containment", () => {
  it.each(ENGINE_DEPTH_PARTS.filter((p) => !p.ext).map((p) => [p.name ?? p.id, p] as const))(
    "contains full %s mesh",
    (_name, part) => {
      const g = worldGeometry(part);
      try {
        const outside = points(g).filter((p) => !AF.inFus(p, 0.002));
        expect(outside.slice(0, 5).map((p) => p.toArray())).toEqual([]);
      } finally {
        g.dispose();
      }
    },
  );

  it.each(F.filter((f) => !f.ext).map((f) => [f.key, f] as const))(
    "contains full curved %s route and its tube/particle radius",
    (_key, f) => {
      const radius = f.tube === false ? (f.size ?? 0.025) / 2 : (f.r ?? 0.012);
      const g = new TubeGeometry(curveOf(f.pts, f.tension ?? 0.3), 300, radius, 16, false);
      try {
        const outside = points(g).filter((p) => !AF.inFus(p, 0.002));
        expect(outside.slice(0, 5).map((p) => p.toArray())).toEqual([]);
      } finally {
        g.dispose();
      }
    },
  );
});
