import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FLOWS, flowRates, flowsFor } from "@/aircraft/da40/flows";
import { scenarioRamp, useDA40 } from "@/aircraft/da40/store";
import { gfc700Init } from "@/lib/avionics/gfc700";
import { SERVO } from "@/aircraft/da40/rig";
import { START_HOLD, simTick } from "@/aircraft/da40/tick";
import { CYLS } from "@/aircraft/da40/parts/engine";
import { CAT } from "@/aircraft/da40/parts";
import { initialSim, ignitionAvailable, inductionAvailable, live, solve, type Sim } from "@/aircraft/da40/model";
import * as A from "@/aircraft/da40/depth-anchors";
import { patched, type Patch } from "./helpers";
import { toVec3 } from "@/lib/math";
const initialLive = structuredClone(live);
const sim = (patch: Patch<Sim> = {}) => patched(initialSim, patch);
const rate = (s: Sim) => flowRates(s, solve(s));
const points = (key: string) => FLOWS.find((f) => f.key === key)!.pts.map((p) => (Array.isArray(p) ? p : toVec3(p)));
beforeEach(() => Object.assign(live, structuredClone(initialLive)));
afterEach(() => {
  const s = structuredClone(initialSim);
  useDA40.setState({ s, E: solve(s) });
});

describe("DA40 XLS source-specific plumbing and interfaces", () => {
  it("uses the Lycoming AFM chain with flow measurement before the servo", () => {
    const engine = points("fuelEng");
    expect(engine[0]).toEqual(A.ENGINE_PUMP);
    expect(engine).toContainEqual(A.FLOW_SENSOR);
    expect(engine.at(-1)).toEqual(A.FUEL_SERVO);
    expect(points("fuelDist")[0]).toEqual(A.FUEL_SERVO);
    expect(points("fuelDist").at(-1)).toEqual(A.FUEL_DIVIDER);
    expect(points("fuelL").at(-1)).toEqual(A.FUEL_SELECTOR_BODY);
    expect(points("fuelR").at(-1)).toEqual(A.FUEL_SELECTOR_BODY);
    expect(CAT.parts.filter((p) => p.name?.endsWith("fuel chamber"))).toHaveLength(6);
    expect(CAT.parts.filter((p) => p.name?.includes("capacitive fuel probe"))).toHaveLength(4);
  });
  it("places water-collecting branches in parallel rather than in series with pressure feeds", () => {
    for (const [main, trap, split, sump, join] of [
      ["pitot", "pitotTrap", A.PITOT_SPLIT, A.PITOT_SUMP, A.PITOT_JOIN],
      ["static", "staticTrap", A.STATIC_SPLIT, A.STATIC_SUMP, A.STATIC_JOIN],
    ] as const) {
      expect(points(main)).toContainEqual(split);
      expect(points(main)).toContainEqual(join);
      expect(points(main)).not.toContainEqual(sump);
      expect(points(trap)).toEqual([split, sump, join]);
    }
    expect(FLOWS.some((f) => f.key === "staticAsi")).toBe(true);
  });
  it("keeps common pneumatic pressure independent of failed G1000 electrical power", () => {
    const s = sim({ avx: { adcFail: true, ahrsFail: true }, elec: { bat: false, alt: false, avMaster: false } });
    const r = rate(s);
    expect(solve(s).adc).toBe(false);
    expect(r.pitot).toBeGreaterThan(0);
    expect(r.staticAsi).toBeGreaterThan(0);
    expect(r.gdcPfd).toBe(0);
    expect(r.gdcMfd).toBe(0);
    expect(r.pitotHeatWire).toBe(0);
  });
  it("powers fuel delivery consistently along the full path while the engine cranks without boost", () => {
    live.rpm = 0;
    live.ff = 0;
    const s = sim({ air: false, eng: { running: false, key: "START", mix: 1 }, fuel: { sel: "R", pump: false } });
    expect(solve(s).starterOn).toBe(true);
    const r = rate(s);
    for (const key of ["fuelR", "fuelSel", "fuelPump", "fuelFw", "fuelEng", "fuelDist", "inj1", "inj2", "inj3", "inj4"])
      expect(r[key], key).toBeGreaterThan(0);
    expect(r.fuelL).toBe(0);
  });
  it("shows boost priming, mixture cut-off and pump failures at the correct boundary", () => {
    live.rpm = live.ff = 0;
    const s = sim({ air: false, eng: { running: false, key: "OFF", mix: 1 }, fuel: { pump: true } });
    expect(rate(s).inj1).toBeGreaterThan(0);
    s.eng.mix = 0;
    expect(rate(s).fuelEng).toBeGreaterThan(0);
    expect(rate(s).fuelDist).toBe(0);
    expect(rate(s).inj1).toBe(0);
    s.fuel.pump = false;
    expect(rate(s).fuelFw).toBe(0);
    s.eng.key = "START";
    s.eng.fail.mechPump = true;
    expect(rate(s).fuelFw).toBe(0);
    s.fuel.pump = true;
    expect(rate(s).fuelFw).toBeGreaterThan(0);
  });
  it("retains mechanical-pump supply while windmilling", () => {
    live.rpm = 1000;
    live.ff = 0;
    const s = sim({ eng: { running: false, key: "BOTH" }, fuel: { pump: false } });
    expect(rate(s).fuelEng).toBeGreaterThan(0);
  });
  it("removes independent optional panel hoses and gates only powered data paths", () => {
    expect(flowsFor(false).some((f) => f.key === "freshPanel" || f.key === "freshPanelR")).toBe(false);
    expect(flowsFor(false).some((f) => f.key === "freshCross")).toBe(true);
    const s = sim({ cb: { "ENG INST": true } });
    expect(solve(s).gea).toBe(false);
    for (const key of ["fuelProbeLIB", "fuelProbeLLR", "cht1", "egt4", "oilP", "fuelPressure"])
      expect(rate(s)[key], key).toBe(0);
    expect(rate(s).fuelL).toBeGreaterThan(0);
  });
  it("individual magneto and primary-induction failures preserve the relevant independent recovery", () => {
    const s = sim({ elec: { bat: false, alt: false }, eng: { fail: { magL: true } } });
    expect(ignitionAvailable(s)).toBe(true);
    s.eng.key = "L";
    expect(ignitionAvailable(s)).toBe(false);
    s.eng.key = "R";
    expect(ignitionAvailable(s)).toBe(true);
    s.eng.fail.magR = true;
    expect(ignitionAvailable(s)).toBe(false);
    s.eng.fail.intakeBlocked = true;
    expect(inductionAvailable(s)).toBe(false);
    s.eng.altAir = true;
    expect(inductionAvailable(s)).toBe(true);
  });
  it("SlickSTART leaves both magnetos live during START and either healthy magneto remains available", () => {
    live.rpm = 0;
    const s = sim({ air: false, eng: { running: false, key: "START", fail: { magL: true } } });
    expect(ignitionAvailable(s)).toBe(true);
    expect(rate(s).ign1U).toBeGreaterThan(0);
    expect(rate(s).ign1L).toBe(0);
    s.eng.fail.magR = true;
    expect(ignitionAvailable(s)).toBe(false);
    expect(rate(s).ign1U).toBe(0);
    s.eng.fail.magL = false;
    expect(ignitionAvailable(s)).toBe(true);
    expect(rate(s).ign1L).toBeGreaterThan(0);
  });
  it("maps AMM74-00 cross-firing and terminates each lead at its actual spark-plug center", () => {
    for (const c of CYLS)
      for (const level of ["U", "L"] as const) {
        const key = `ign${c.n}${level}`,
          f = FLOWS.find((f) => f.key === key)!;
        const expectedMag = c.s > 0 === (level === "U") ? "R" : "L";
        expect(f.name).toContain(`Magneto ${expectedMag}`);
        expect(points(key)[0]).toEqual([3 - 1.27, 0.07, expectedMag === "R" ? 0.1 : -0.1]);
        const plug = CAT.parts.find((p) => p.name === `Spark plug — cyl ${c.n} ${level === "U" ? "upper" : "lower"}`)!;
        const local = plug.pos!;
        expect(points(key).at(-1)).toEqual([c.x + local[0], -0.05 + local[1], c.s * 0.26 + local[2]]);
      }
  });
  it("uses one physical turning gate through induction and all four manifolds during cranking and windmilling", () => {
    live.rpm = 0;
    const s = sim({ air: false, eng: { running: false, key: "START" } });
    expect(solve(s).starterOn).toBe(true);
    let r = rate(s);
    expect(r.intake).toBeGreaterThan(0);
    expect(r.altAir).toBe(0);
    for (const n of [1, 2, 3, 4]) expect(r[`man${n}`]).toBe(r.intake);
    expect(r.exh1).toBe(0);
    s.eng.key = "OFF";
    s.air = true;
    live.rpm = 900;
    r = rate(s);
    expect(r.intake).toBeGreaterThan(0);
    expect(r.exh1).toBe(0);
    s.eng.fail.intakeBlocked = true;
    r = rate(s);
    expect(r.intake).toBe(0);
    expect(r.man1).toBe(0);
    s.eng.altAir = true;
    r = rate(s);
    expect(r.intake).toBe(0);
    expect(r.altAir).toBeGreaterThan(0);
    expect(r.man4).toBe(r.altAir);
    s.air = false;
    live.rpm = 0;
    r = rate(s);
    expect(r.altAir).toBe(0);
    expect(r.man1).toBe(0);
  });
  it("isolates the mast on alternate static while keeping every common instrument branch connected", () => {
    const common = points("staticGdc");
    expect(points("static").at(-1)).toEqual(common[0]);
    expect(points("altStatic").at(-1)).toEqual(common[0]);
    expect(common.at(-1)).toEqual(A.GDC);
    expect(points("static")).not.toContainEqual(A.GDC);
    const s = sim({
      air: false,
      eng: { running: false, key: "OFF" },
      avx: { adcFail: true },
      pitot: { altStatic: true },
    });
    let r = rate(s);
    expect(r.static).toBe(0);
    expect(r.altStatic).toBeGreaterThan(0);
    for (const key of ["staticGdc", "staticAsi", "static2"]) expect(r[key], key).toBeGreaterThan(0);
    expect(r.gdcPfd).toBe(0);
    s.pitot.altStatic = false;
    s.air = true;
    r = rate(s);
    expect(r.static).toBeGreaterThan(0);
    expect(r.altStatic).toBe(0);
    expect(r.staticGdc).toBeGreaterThan(0);
    s.air = false;
    r = rate(s);
    expect(r.static).toBe(0);
    expect(r.staticGdc).toBe(0);
  });
  it("places both brake reservoirs on copilot masters and preserves two serial wheel circuits", () => {
    const reservoirs = CAT.parts.filter((p) => p.name === "Brake fluid reservoir");
    expect(reservoirs).toHaveLength(2);
    expect(reservoirs.every((p) => p.pos![2] > 0)).toBe(true);
    for (const side of [-1, 1]) {
      const c = A.brakeCircuit(side);
      expect(reservoirs.some((p) => JSON.stringify(p.pos) === JSON.stringify(c.reservoir))).toBe(true);
      expect(points(`brakeReservoir${side}`)).toEqual([c.reservoir, c.copilot]);
      expect(points(`brakeInterconnect${side}`)[0]).toEqual(c.copilot);
      expect(points(`brakeInterconnect${side}`).at(-1)).toEqual(c.pilot);
      expect(points(`brakePilotValve${side}`)[0]).toEqual(c.pilot);
      expect(points(`brakePilotValve${side}`).at(-1)).toEqual(A.BRAKE_VALVE);
      expect(
        CAT.parts
          .filter((p) => p.name === "Brake master cylinder (Cleveland 10-54)")
          .some((p) => JSON.stringify(p.pos) === JSON.stringify(c.copilot)),
      ).toBe(true);
      expect(
        CAT.parts
          .filter((p) => p.name === "Brake master cylinder (Cleveland 10-54)")
          .some((p) => JSON.stringify(p.pos) === JSON.stringify(c.pilot)),
      ).toBe(true);
    }
  });
  it("cannot cold-start with both fuel-delivery paths unavailable and recovers with powered boost", () => {
    scenarioRamp();
    useDA40.getState().update((s) => {
      s.elec.bat = true;
      s.eng.key = "START";
      s.eng.mix = 1;
      s.eng.throttle = 0.12;
      s.eng.fail.mechPump = true;
      s.fuel.pump = true;
      s.cb["FUEL PUMP"] = true;
    });
    live.startTimer = START_HOLD;
    expect(useDA40.getState().E.starterOn).toBe(true);
    for (let i = 0; i < 20; i++) {
      simTick(0.25);
      expect(useDA40.getState().s.eng.running).toBe(false);
    }
    expect(live.fuelP).toBe(0);
    expect(live.prime).toBe(0);
    useDA40.getState().update((s) => {
      s.eng.key = "OFF";
      s.cb["FUEL PUMP"] = false;
    });
    simTick(0.25);
    useDA40.getState().update((s) => {
      s.eng.key = "START";
    });
    live.startTimer = START_HOLD;
    for (let i = 0; i < 12; i++) simTick(0.25);
    expect(useDA40.getState().s.eng.running).toBe(true);
    expect(live.fuelP).toBeGreaterThan(8);
  });
  it("shows no trim cable motion for a scenario's trim reset, only for a trim wheel movement", () => {
    simTick(0.25);
    scenarioRamp(); // resets the trim from cruise to take-off
    simTick(0.25);
    expect(live.trimRate).toBe(0);
    live.afcs = { ...live.afcs, trim: live.afcs.trim + 0.1 };
    simTick(0.25);
    expect(live.trimRate).toBeCloseTo(0.4);
  });
  it("keeps the GFC 700 protected servo feed and each normal GIA data link independent (SMM 2-7, AFMS 7-5)", () => {
    const s = sim(),
      E = solve(s),
      r = flowRates(s, E);
    expect(E.afcsPwr && E.gia1 && E.gia2).toBe(true);
    for (const name of Object.keys(SERVO)) {
      expect(r[`servoPower${name}`]).toBeGreaterThan(0);
      expect(r[`servoEnable${name}`]).toBeGreaterThan(0);
      expect(r[`servoData${name}`]).toBeGreaterThan(0);
      expect(r[`servoData2${name}`]).toBeGreaterThan(0);
    }
  });
  it.each([
    ["GPS/NAV 1", 1],
    ["GPS/NAV 2", 2],
  ] as const)(
    "pulling %s stops only that GIA data link while AP disconnects with live servo power",
    (breaker, failed) => {
      const s = sim({ cb: { [breaker]: true } }),
        E = solve(s),
        r = flowRates(s, E);
      expect(E.afcsPwr).toBe(true);
      expect(failed === 1 ? E.gia1 : E.gia2).toBe(false);
      expect(failed === 1 ? E.gia2 : E.gia1).toBe(true);
      for (const name of Object.keys(SERVO)) {
        expect(r[`servoData${failed === 1 ? "" : "2"}${name}`]).toBe(0);
        expect(r[`servoData${failed === 1 ? "2" : ""}${name}`]).toBeGreaterThan(0);
        expect(r[`servoPower${name}`]).toBeGreaterThan(0);
        expect(r[`servoEnable${name}`]).toBeGreaterThan(0);
      }
      useDA40.setState({ s, E });
      live.afcs = { ...gfc700Init(), powered: true, pft: "pass", ap: true, fd: true };
      live.afcsDerived = "";
      simTick(0.25);
      expect(live.afcs.ap).toBe(false);
      expect(useDA40.getState().E.afcsPwr).toBe(true);
      if (failed === 2) {
        expect(live.afcs.fail.sys).toBe(true);
        expect(live.afcs.fd).toBe(true);
      } else expect(live.afcs.powered).toBe(false);
    },
  );
  it("pulling AFCS removes servo receiver power and both GIA data paths while the GIAs stay powered", () => {
    const s = sim({ cb: { AFCS: true } }),
      E = solve(s),
      r = flowRates(s, E);
    expect(E.gia1 && E.gia2).toBe(true);
    expect(E.afcsPwr).toBe(false);
    for (const name of Object.keys(SERVO))
      for (const prefix of ["servoData", "servoData2", "servoPower", "servoEnable"])
        expect(r[`${prefix}${name}`]).toBe(0);
    useDA40.setState({ s, E });
    live.afcs = { ...gfc700Init(), powered: true, pft: "pass", ap: true, fd: true };
    simTick(0.25);
    expect(live.afcs.ap).toBe(false);
  });
  it("evaluates all rate helpers without undefined state access or nonfinite values", () => {
    for (const s of [
      sim(),
      sim({ air: false, eng: { running: false, key: "OFF" } }),
      sim({ eng: { running: false, key: "START" } }),
      sim({ elec: { bat: false, alt: false, avMaster: false } }),
    ]) {
      const r = rate(s);
      expect(Object.values(r).every((v) => Number.isFinite(v))).toBe(true);
      for (const f of FLOWS) expect(r[f.key] ?? 0, f.key).toBeGreaterThanOrEqual(-3);
    }
  });
});
