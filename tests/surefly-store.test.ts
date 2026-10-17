/**
 * The SureFly page's bench: timing the SIM to the engine (SF1001 §2.9–2.11) and running it (§3.3, tech page).
 */
import { beforeEach, describe, expect, test } from "vitest";
import { advance, bench, benchClock, syncError, useUi } from "@/components/engine/surefly/store";
import { dipFor, LED_CYCLES, cycleLength, SYNC_TOLERANCE } from "@/engines/components/surefly/model";

const initial = useUi.getState();
beforeEach(() => {
  benchClock.reset();
  useUi.setState(initial, true);
  Object.assign(bench, { t: 0, onAt: 0, crank: 0, rpm: 0, spark: [9, 9, 9, 9, 9] });
});
const set = (p: Parameters<typeof initial.set>[0]) => useUi.getState().set(p);

describe("internal timing and mounting (SF1001 §2.9–2.11)", () => {
  test("the LED goes out only within the ½° window at internal TDC", () => {
    set({ stage: "time", mounted: false, ignition: true, timingPower: true, gear: 10 });
    advance(0.016);
    expect(bench.led).toBe(true);
    set({ gear: 0.3 });
    advance(0.016);
    expect(bench.led).toBe(false);
    // not with the p-lead grounded
    set({ gear: 10, ignition: false });
    advance(0.016);
    expect(bench.led).toBe(false);
  });

  test("mounted with the LED out at #1 TDC, the SIM is in sync; clocked away, the check fails", () => {
    set({ stage: "time", mounted: false, ignition: true, gear: 0.2, hand: 0 });
    useUi.getState().set({ mounted: true, clock: 0, mesh: 0.2 });
    expect(Math.abs(syncError(useUi.getState()))).toBeLessThanOrEqual(SYNC_TOLERANCE);
    // turning the engine through #1 TDC: out right there, lit either side
    for (const [hand, lit] of [
      [355, true],
      [0, false],
      [5, true],
    ] as const) {
      set({ hand });
      advance(0.016);
      expect(bench.led).toBe(lit);
    }
    set({ clock: 5 });
    expect(Math.abs(syncError(useUi.getState()))).toBeGreaterThan(SYNC_TOLERANCE);
  });
});

describe("running", () => {
  test("switching on blinks the code for 4 cycles, then the LED goes inactive (SF1001 §3.3)", () => {
    set({ stage: "run", ignition: false, rpm: 0 });
    advance(0.01);
    set({ ignition: true });
    let lit = 0;
    const len = cycleLength(dipFor(25, "advance"));
    for (let t = 0; t < len * LED_CYCLES; t += 0.02) {
      advance(0.02);
      if (bench.led) lit++;
    }
    expect(lit).toBeGreaterThan(0);
    for (let t = 0; t < 3; t += 0.02) {
      advance(0.02);
      expect(bench.led).toBe(false);
    }
  });

  test("a wasted spark fires every plug once a revolution", () => {
    set({ stage: "run", ignition: true, rpm: 1200, map: 22 });
    bench.rpm = 1200;
    const fired = [0, 0, 0, 0, 0];
    // Inspect every integration boundary so a later step in one render frame cannot age a spark before it is counted.
    for (let i = 0; i < 120; i++) {
      advance(1 / 120);
      bench.spark.forEach((age, cyl) => cyl && age === 0 && fired[cyl]++);
    }
    // one second at 1,200 rpm is 20 revolutions
    for (const cyl of [1, 2, 3, 4]) expect(fired[cyl]).toBeGreaterThanOrEqual(19);
    for (const cyl of [1, 2, 3, 4]) expect(fired[cyl]).toBeLessThanOrEqual(21);
  });

  test("no spark with the switch off, the supply below 8.5 V or the SIM off the engine", () => {
    for (const p of [{ ignition: false }, { volts: 8 }, { mounted: false }]) {
      set({ stage: "run", ignition: true, volts: 13.8, rpm: 1200, ...p });
      bench.rpm = 1200;
      bench.spark = [9, 9, 9, 9, 9];
      for (let i = 0; i < 50; i++) advance(0.01);
      expect(Math.min(...bench.spark.slice(1))).toBeGreaterThan(0.4);
    }
  });
});
