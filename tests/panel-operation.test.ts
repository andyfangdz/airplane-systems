import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { cancelPropCycle, startPropCycle } from "@/aircraft/c182t/propCycle";
import { scenarioCruise } from "@/aircraft/c182t/store";
import { fuelPressureState } from "@/aircraft/da40/limits";
import { cabinOperation } from "@/aircraft/sr20/environment";
import { cabinAirColor, flowRates } from "@/aircraft/sr20/flows";
import { initialSim, solve } from "@/aircraft/sr20/model";
import { engineOperation } from "@/aircraft/sr20/operation";
import { patched } from "./helpers";

describe("SR20 operating indications follow their power and ignition (POH 7-31–7-34, 7-59; Fig. 7-10)", () => {
  const cooling = () => patched(initialSim, { env: { fan: 3, ac: true, recirc: true } });

  it("stops blower flow and cooling after all power and the engine are lost", () => {
    const powered = cooling();
    const stopped = patched(powered, {
      eng: { running: false },
      elec: { bat1: false, bat2: false, alt1: false, alt2: false },
    });
    const E = solve(stopped);
    expect(cabinOperation(powered, solve(powered))).toMatchObject({ blower: true, ac: true, recirc: true });
    expect(cabinOperation(stopped, E)).toMatchObject({ blower: false, ac: false, recirc: false, air: 0 });
    expect(flowRates(stopped, E)).toMatchObject({ fresh: 0, hot: 0, toMan: 0, panelL: 0, floorF: 0 });
    const color = new THREE.Color();
    cabinAirColor(stopped, E, color);
    expect(color.getHexString()).toBe("5fc8f0");
  });

  it.each(["CABIN AIR CONTROL", "CABIN FAN", "A/C COND", "A/C COMPR"])(
    "removes refrigeration when %s is pulled",
    (breaker) => {
      const s = patched(cooling(), { cb: { [breaker]: true } });
      const E = solve(s);
      expect(cabinOperation(s, E).ac).toBe(false);
      const color = new THREE.Color();
      cabinAirColor(s, E, color);
      expect(color.getHexString()).not.toBe("6ec9e6");
    },
  );

  it.each(["A/C COND", "A/C COMPR"])(
    "keeps selected recirculation and closed heat/fresh valves after %s fails",
    (breaker) => {
      const s = patched(cooling(), { cb: { [breaker]: true } });
      expect(cabinOperation(s, solve(s))).toMatchObject({
        blower: true,
        ac: false,
        recirc: true,
        hotValve: 0,
        freshValve: 0,
      });
    },
  );

  it("retains only assumed ram air when a running engine loses the cabin blower", () => {
    const s = patched(initialSim, { env: { fan: 3, ac: false, recirc: false }, cb: { "CABIN FAN": true } });
    const operation = cabinOperation(s, solve(s));
    expect(operation.blower).toBe(false);
    expect(operation.air).toBe(0.45);
    expect(operation.hot).toBeGreaterThan(0);
  });

  it("does not introduce ram air through the selected closed fresh-air valve after blower loss", () => {
    const s = patched(cooling(), { cb: { "CABIN FAN": true } });
    expect(cabinOperation(s, solve(s))).toMatchObject({
      blower: false,
      ac: false,
      recirc: false,
      air: 0,
      hotValve: 0,
      freshValve: 0,
    });
  });

  it("does not show cranking without starter power or sparks with the key OFF", () => {
    const deadStarter = patched(initialSim, { eng: { running: false, key: "START" }, cb: { STARTER: true } });
    expect(engineOperation(deadStarter, solve(deadStarter), 0)).toEqual({
      cranking: false,
      leftMag: false,
      rightMag: false,
    });
    const coasting = patched(initialSim, { eng: { running: false, key: "OFF" } });
    expect(engineOperation(coasting, solve(coasting), 1500)).toEqual({
      cranking: false,
      leftMag: false,
      rightMag: false,
    });
    const cranking = patched(initialSim, { eng: { running: false, key: "START" } });
    expect(engineOperation(cranking, solve(cranking), 260)).toEqual({ cranking: true, leftMag: true, rightMag: true });
  });

  it.each([{ cb: { "BAT 2": true } }, { elec: { alt1: false, alt2: false, tBat: 60 } }])(
    "does not animate BAT 2 current when the solved battery cannot supply power",
    (patch) => {
      const s = patched(initialSim, patch);
      const E = solve(s);
      expect(E.bat2ok).toBe(false);
      expect(flowRates(s, E).bat2).toBe(0);
    },
  );
});

describe("DA40 fuel-pressure limits (AFMS §2.5)", () => {
  it.each([
    [13.9, "low"],
    [14, "normal"],
    [35, "normal"],
    [35.1, "high"],
  ] as const)("classifies %s psi as %s", (pressure, expected) => {
    expect(fuelPressureState(pressure)).toBe(expected);
  });
});

describe("C182 run-up propeller-cycle cancellation", () => {
  afterEach(() => {
    cancelPropCycle();
    vi.useRealTimers();
  });

  it("manual override or leaving the panel cancels the pending return to high RPM", () => {
    vi.useFakeTimers();
    const returnToHigh = vi.fn();
    startPropCycle(returnToHigh);
    vi.advanceTimersByTime(1000);
    cancelPropCycle();
    vi.advanceTimersByTime(2500);
    expect(returnToHigh).not.toHaveBeenCalled();
  });

  it("only the newest cycle can complete", () => {
    vi.useFakeTimers();
    const oldCycle = vi.fn(),
      newCycle = vi.fn();
    startPropCycle(oldCycle);
    vi.advanceTimersByTime(1000);
    startPropCycle(newCycle);
    vi.advanceTimersByTime(1500);
    expect(oldCycle).not.toHaveBeenCalled();
    expect(newCycle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(newCycle).toHaveBeenCalledOnce();
  });

  it("changing scenario cancels the old scenario's pending cycle", () => {
    vi.useFakeTimers();
    const returnToHigh = vi.fn();
    startPropCycle(returnToHigh);
    scenarioCruise();
    vi.advanceTimersByTime(2500);
    expect(returnToHigh).not.toHaveBeenCalled();
  });
});
