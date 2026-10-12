import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAT, CYLS, SPARK_PLUGS, MAGNETOS } from "@/aircraft/c172s/parts";
import { fires } from "@/aircraft/c172s/parts/catalogue";
import { enginePower, initialLive, initialSim, live, solve, type Sim } from "@/aircraft/c172s/model";
import { flowRates, FLOWS } from "@/aircraft/c172s/flows";
import { eisGauges } from "@/aircraft/c172s/displays";
import { DEPTH } from "@/aircraft/c172s/depth-anchors";
import { useC172 } from "@/aircraft/c172s/store";
import { simTick } from "@/aircraft/c172s/tick";
import { engineGroupsOf, engineHidden, allGroups } from "@/aircraft/c172s/engine-groups";
const fresh = () => structuredClone(initialSim);
const feedKeys = [
  "fuelL",
  "fuelR",
  "fuelSel",
  "fuelPump",
  "fuelEdp",
  "fuelServo",
  "fuelMetered",
  "inj1",
  "inj2",
  "inj3",
  "inj4",
];
const checkFeed = (s: Sim) => {
  const e = solve(s),
    r = flowRates(s, e);
  for (const k of feedKeys) expect(r[k], k).toBeGreaterThan(0);
  return { e, r };
};
beforeEach(() => {
  Object.assign(live, initialLive());
  useC172.getState().update((d) => Object.assign(d, fresh()));
});
afterEach(() => {
  Object.assign(live, initialLive());
  useC172.getState().update((d) => Object.assign(d, fresh()));
});
describe("C172S source-bounded systems depth", () => {
  it("continues the complete supply path during powered cold cranking without boost", () => {
    const s = fresh();
    s.eng.running = false;
    s.eng.rpm = 0;
    s.eng.mags = "START";
    s.eng.mix = 1;
    s.fuel.pump = false;
    const { e } = checkFeed(s);
    expect(e.starterPwr).toBe(true);
    expect(e.fuelPress).toBe(true);
  });
  it("shows boost priming through all upstream and injector branches", () => {
    const s = fresh();
    s.eng.running = false;
    s.eng.rpm = 0;
    s.eng.mags = "OFF";
    s.eng.mix = 1;
    s.fuel.pump = true;
    checkFeed(s);
  });
  it("keeps pressure supply separate from metered fuel at idle cutoff", () => {
    const s = fresh();
    s.eng.running = false;
    s.eng.mags = "START";
    s.eng.mix = 0;
    const r = flowRates(s, solve(s));
    expect(r.fuelL).toBeGreaterThan(0);
    expect(r.fuelServo).toBeGreaterThan(0);
    expect(r.fuelMetered).toBe(0);
    expect(r.inj1).toBe(0);
  });
  it("does not turn the mechanical pump with an unpowered START key", () => {
    const s = fresh();
    s.eng.running = false;
    s.eng.mags = "START";
    s.eng.rpm = 0;
    s.elec.bat = false;
    s.elec.stby = "OFF";
    s.elec.alt = false;
    const e = solve(s);
    expect(e.starterPwr).toBe(false);
    expect(e.fuelPress).toBe(false);
    expect(flowRates(s, e).fuelServo).toBe(0);
  });
  it("isolates engine-data failure from mechanical engine/oil operation", () => {
    const s = fresh(),
      normal = enginePower(s, 4500);
    s.avx.geaFail = true;
    const e = solve(s),
      r = flowRates(s, e);
    expect(e.pfd).toBe(true);
    expect(e.engineData).toBe(false);
    expect(enginePower(s, 4500)).toBe(normal);
    expect(eisGauges(s, e).every((g) => g.value === null)).toBe(true);
    expect(r.geaGia1).toBe(0);
    expect(r.oilPumpFilter).toBeGreaterThan(0);
  });
  it("keeps cooling fan failures independent of powered displays", () => {
    const s = fresh();
    s.avx.fwdFanFail = s.avx.aftFanFail = true;
    const e = solve(s),
      r = flowRates(s, e);
    expect(e.fwdFan || e.aftFan).toBe(false);
    expect(e.pfd && e.mfd).toBe(true);
    expect(r.fwdFanAir + r.aftFanAir).toBe(0);
  });
  it("holds a jammed flap and stops linkage particles while power remains available", () => {
    useC172.getState().update((d) => {
      d.flaps.cmd = 30;
      d.flaps.jammed = true;
    });
    simTick(0.1);
    const { s, E } = useC172.getState();
    expect(E.flapsPwr).toBe(true);
    expect(live.flapAng).toBe(0);
    expect(s.flaps.moving).toBe(true);
    expect(flowRates(s, E).flapX).toBe(0);
    useC172.getState().update((d) => {
      d.flaps.jammed = false;
    });
    simTick(0.1);
    expect(live.flapAng).toBeGreaterThan(0);
  });
  it("separates a restricted vacuum inlet from electrical AHRS attitude", () => {
    useC172.getState().update((d) => {
      d.vac.filterBlocked = true;
    });
    simTick(0.1);
    expect(live.vac).toBe(0);
    expect(useC172.getState().E.ahrs).toBe(true);
    expect(live.gyro).toBeLessThan(1);
  });
  it("connects actual pressure branches to matching distribution hardware", () => {
    expect(FLOWS.find((f) => f.key === "pitot")!.pts.at(-1)).toEqual(DEPTH.pressureTee);
    expect(FLOWS.find((f) => f.key === "pitotAsi")!.pts.at(-1)).toEqual(DEPTH.standbyAsi);
    expect(FLOWS.find((f) => f.key === "staticAltimeter")!.pts.at(-1)).toEqual(DEPTH.standbyAlt);
  });
  it("keeps engine subsystem filters local to engine presentation", () => {
    const f = FLOWS.find((f) => f.key === "oilPumpFilter")!,
      shown = allGroups();
    expect(engineGroupsOf(f)).toEqual(["oil"]);
    shown.oil = false;
    expect(engineHidden(f, "engine", shown)).toBe(true);
    expect(engineHidden(f, "overview", shown)).toBe(false);
  });
  it.each(["BOTH", "L", "R", "START"] as const)("cross-fires the four cylinders consistently in %s", (key) => {
    const s = fresh();
    s.eng.mags = key;
    s.eng.running = key !== "START";
    s.eng.rpm = key === "START" ? 0 : 2400;
    useC172.getState().update((d) => Object.assign(d, s));
    live.rpm = s.eng.rpm;
    const E = solve(s),
      R = flowRates(s, E);
    for (const c of CYLS)
      for (const mag of ["L", "R"] as const) {
        const upper = c.s < 0 === (mag === "L"),
          level = upper ? "upper" : "lower",
          route = FLOWS.find((f) => f.key === `ign${mag}${c.n}`)!;
        const actual = CAT.parts.find((p) => p.name === `Spark plug — cyl ${c.n} ${level}`)!;
        expect(route.pts[0]).toEqual(MAGNETOS[mag]);
        expect(route.pts.at(-1)).toEqual(actual.pos);
        expect(actual.pos).toEqual(SPARK_PLUGS[c.n][upper ? "U" : "L"]);
        const active = key === "BOTH" || key === "START" || key === mag;
        expect(R[route.key] > 0).toBe(active);
        expect(fires(mag)()).toBe(active);
      }
  });
  it("runs oil and independent magnetos during powered crank/windmilling, not an unpowered stopped START", () => {
    const s = fresh();
    s.eng.running = false;
    s.eng.mags = "START";
    s.eng.rpm = 0;
    let E = solve(s),
      R = flowRates(s, E);
    expect(E.starterPwr).toBe(true);
    for (const k of ["oil", "oilPumpFilter", "oilHead1", "oilDrain4", "ignL1", "ignR4"])
      expect(R[k], k).toBeGreaterThan(0);
    s.elec.bat = false;
    s.elec.alt = false;
    s.elec.stby = "OFF";
    E = solve(s);
    R = flowRates(s, E);
    for (const k of ["oil", "oilPumpFilter", "ignL1", "ignR4"]) expect(R[k], k).toBe(0);
    s.eng.mags = "BOTH";
    s.eng.rpm = 800;
    E = solve(s);
    R = flowRates(s, E);
    expect(R.oilPumpFilter).toBeGreaterThan(0);
    expect(R.ignL1).toBeGreaterThan(0);
    expect(R.ignR4).toBeGreaterThan(0);
    s.eng.fail.magL = true;
    s.eng.fail.oil = true;
    R = flowRates(s, solve(s));
    expect(R.ignL1).toBe(0);
    expect(R.ignR1).toBeGreaterThan(0);
    expect(R.oilPumpFilter).toBe(0);
  });
  it.each([false, true])(
    "admits induction air during shaft motion with filter blockage=%s without hot exhaust",
    (blocked) => {
      const s = fresh();
      s.eng.running = false;
      s.eng.rpm = 0;
      s.eng.mags = "START";
      s.eng.filter = blocked;
      let E = solve(s),
        R = flowRates(s, E);
      expect(E.starterPwr).toBe(true);
      expect(R.intake).toBe(blocked ? 0 : 1);
      expect(R.altAir).toBe(blocked ? 1 : 0);
      for (const c of CYLS) {
        expect(R["man" + c.n]).toBeGreaterThan(0);
        expect(R["exh" + c.n]).toBe(0);
      }
      expect(R.tailpipe).toBe(0);
      s.elec.bat = false;
      s.elec.alt = false;
      s.elec.stby = "OFF";
      E = solve(s);
      R = flowRates(s, E);
      expect(R.intake + R.altAir).toBe(0);
      for (const c of CYLS) expect(R["man" + c.n]).toBe(0);
      s.eng.mags = "BOTH";
      s.eng.rpm = 800;
      R = flowRates(s, solve(s));
      expect(R.intake + R.altAir).toBeGreaterThan(0);
      expect(R.man1).toBeGreaterThan(0);
      expect(R.exh1).toBe(0);
    },
  );
});
