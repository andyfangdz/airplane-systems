/**
 * The TSIO-550-K turbocharger's pure functions (engines/model/turbo.ts) against what the SR22T POH, the AMM and
 * Continental's M-18 say the system does: an oil-actuated wastegate the spring holds open, a differential controller
 * that bleeds the actuator's oil, intercoolers, and a compressor whose pressure ratio follows the turbines' power.
 * The running engine's calibration targets (T-n) are in tsio550k-engine.test.ts.
 */
import { describe, expect, test } from "vitest";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { TurboSpec } from "@/engines/types";
import { atmosphere, INHG_PA } from "@/engines/model/atmosphere";
import { orificeFlow } from "@/engines/model/induction";
import {
  actuatorPressure,
  compressorEfficiency,
  compressorOut,
  compressorPowerW,
  controllerBleed,
  equilibriumPR,
  ETA_FLOOR_FRACTION,
  exhaustArea,
  fullThrottleMapTurbo,
  gateTarget,
  intercool,
  turbineInletPressure,
  turbinePowerW,
  turbineRpm,
} from "@/engines/model/turbo";

const T = TSIO550K.turbo!;

describe("wastegate and controller (POH 7-38/7-39, 3-27/3-28; AMM 81-20 PDF 2812, 79-00 PDF 2764; M-18 12-4.2)", () => {
  test("the wastegate spring opens the gate with no actuator oil (POH 3-27/3-28 cause 3)", () => {
    for (const bleed of [0, 0.5, 1])
      expect(gateTarget(T, actuatorPressure(0, bleed, T.controller.ratio), 2500)).toBe(1);
  });

  test("an engine that has stopped leaves the gate open (spring-open fail-safe)", () => {
    expect(gateTarget(T, T.wastegate.pFullPsi + 5, 0)).toBe(1);
  });

  test("the gate closes as actuator oil pressure rises: open below the crack pressure, shut above the full pressure", () => {
    let last = 2;
    for (let p = 0; p <= 80; p += 0.5) {
      const g = gateTarget(T, p, 2500);
      expect(g).toBeLessThanOrEqual(last);
      if (p <= T.wastegate.pCrackPsi) expect(g).toBe(1);
      if (p >= T.wastegate.pFullPsi) expect(g).toBe(0);
      last = g;
    }
  });

  test("controller bleed rises with the throttle-plate difference over its set point (POH 7-39: senses the differential across the throttle plate)", () => {
    for (const deck of [30, 36.7, 40]) {
      let last = -1;
      for (let map = deck; map >= deck - 6; map -= 0.05) {
        const b = controllerBleed(T, deck, map);
        expect(b).toBeGreaterThanOrEqual(last);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
        last = b;
      }
    }
    // a misadjusted controller's set point is `misadjustInHg` higher: the same bleed needs that much more difference
    const k = T.controller;
    const deck = 36.7;
    const diff = k.c0 + k.c1 * (deck - k.deckRef) + 0.1;
    expect(controllerBleed(T, deck, deck - diff - k.misadjustInHg, true)).toBeCloseTo(
      controllerBleed(T, deck, deck - diff),
      9,
    );
  });

  test("actuator pressure is the oil pressure split across the wastegate's inlet restriction and the controller bleed (M-18 12-4.2)", () => {
    const oil = 45;
    expect(actuatorPressure(oil, 0, T.controller.ratio)).toBe(oil);
    let last = oil + 1;
    for (let b = 0; b <= 1; b += 0.05) {
      const p = actuatorPressure(oil, b, T.controller.ratio);
      expect(p).toBeLessThan(last);
      expect(p).toBeCloseTo(oil / (1 + (b * T.controller.ratio) ** 2), 12);
      last = p;
    }
  });
});

describe("turbines and compressors (a quasi-steady power balance)", () => {
  const t1 = 288.15;

  test("the equilibrium pressure ratio rises with turbine power and inverts the compressor's power", () => {
    expect(equilibriumPR(T, 0, 0.25, t1)).toBe(1);
    let last = 1;
    for (let p = 1000; p <= 40000; p += 1000) {
      const pr = equilibriumPR(T, p, 0.25, t1);
      expect(pr).toBeGreaterThan(last);
      expect(compressorPowerW(T, 0.25, t1, pr) / p).toBeCloseTo(1, 9);
      last = pr;
    }
  });

  test("without a map edge the compressor efficiency is constant and the pressure ratio is closed form", () => {
    const flat: TurboSpec = { ...T, compressorEta: undefined };
    expect(compressorEfficiency(flat, 1.5)).toBe(T.etaCompressor);
    expect(compressorEfficiency(flat, 4)).toBe(T.etaCompressor);
    const pr = equilibriumPR(flat, 20000, 0.25, t1);
    expect(compressorPowerW(flat, 0.25, t1, pr) / 20000).toBeCloseTo(1, 12);
  });

  test("the map edge: efficiency falls toward the edge, flat beyond the ends, never below the floor", () => {
    const P = T.compressorEta!;
    expect(compressorEfficiency(T, 1)).toBe(T.etaCompressor * P[0][1]);
    expect(compressorEfficiency(T, 50)).toBe(T.etaCompressor * Math.max(P[P.length - 1][1], ETA_FLOOR_FRACTION));
    for (let pr = 1; pr < 6; pr += 0.05)
      expect(compressorEfficiency(T, pr + 0.05)).toBeLessThanOrEqual(compressorEfficiency(T, pr));
    const zero: TurboSpec = {
      ...T,
      compressorEta: [
        [2, 1],
        [3, 0],
      ],
    };
    expect(compressorEfficiency(zero, 3.5)).toBe(T.etaCompressor * ETA_FLOOR_FRACTION);
    expect(Number.isFinite(compressorOut(zero, t1, 4))).toBe(true);
  });

  test("compressor discharge temperature follows the isentropic law: inlet temperature at no boost, 1.2 ratio about 18 K", () => {
    expect(compressorOut(T, t1, 1)).toBe(t1);
    const rise = compressorOut(T, t1, 1.2) - t1;
    expect(rise).toBeCloseTo((t1 * (1.2 ** (0.4 / 1.4) - 1)) / T.etaCompressor, 9);
  });

  test("turbine-inlet pressure passes the exhaust flow through the turbines and the open wastegate", () => {
    const tK = 1100,
      pTail = 30.52;
    expect(turbineInletPressure(T, 0, tK, pTail, 0)).toBe(pTail);
    for (const gate of [0, 0.5, 1]) {
      let last = pTail;
      for (const m of [0.05, 0.1, 0.2, 0.3]) {
        const p = turbineInletPressure(T, m, tK, pTail, gate);
        expect(orificeFlow(exhaustArea(T, gate), p * INHG_PA, tK, pTail * INHG_PA) / m).toBeCloseTo(1, 6);
        expect(p).toBeGreaterThan(last);
        last = p;
      }
    }
    expect(turbineInletPressure(T, 0.25, tK, pTail, 1)).toBeLessThan(turbineInletPressure(T, 0.25, tK, pTail, 0));
    // the turbines' share of the flow falls as the gate opens
    const pClosed = turbineInletPressure(T, 0.25, tK, pTail, 0);
    expect(turbinePowerW(T, 0.25, tK, pClosed, pTail, 0)).toBeGreaterThan(
      turbinePowerW(T, 0.25, tK, turbineInletPressure(T, 0.25, tK, pTail, 1), pTail, 1),
    );
  });

  test("intercooler effectiveness is the fraction of the temperature difference it removes (M-18 Figure 2-39 p. 2-47)", () => {
    const t2 = 360,
      out = 288;
    const mat = intercool(T, t2, out);
    const cool = out + T.intercooler.coolRiseC;
    expect((t2 - mat) / (t2 - cool)).toBeCloseTo(T.intercooler.effectiveness, 12);
    expect(mat).toBeGreaterThanOrEqual(cool);
    expect(mat).toBeLessThanOrEqual(t2);
  });

  test("turbine speed reads rpmRef at prRef, nothing without boost, and rises with the pressure ratio", () => {
    expect(turbineRpm(T, 1)).toBe(0);
    expect(turbineRpm(T, T.prRef)).toBeCloseTo(T.rpmRef, 6);
    expect(turbineRpm(T, 3)).toBeGreaterThan(turbineRpm(T, 2));
  });
});

describe("the gate-closed balance at altitude", () => {
  test("at 25,000 ft with the gate shut the pressure ratio converges inside the map: bracketed, finite, below the search limit", () => {
    // a gate-closed turbine at 25,000 ft (POH 2-19 maximum altitude), rated-order exhaust flow and TIT
    const a = atmosphere(25000);
    const pTail = a.p * 1.02,
      tK = 1100,
      mE = 0.24,
      mA = 0.22;
    const pTI = turbineInletPressure(T, mE, tK, pTail, 0);
    const power = turbinePowerW(T, mE, tK, pTI, pTail, 0);
    const pr = equilibriumPR(T, power, mA, a.t + 273.15);
    expect(pr).toBeGreaterThan(1.5);
    expect(pr).toBeLessThan(T.compressorEta![T.compressorEta!.length - 1][0]);
    expect(compressorPowerW(T, mA, a.t + 273.15, pr) / power).toBeCloseTo(1, 9);
  });

  test("the steady full-throttle point at 25,000 ft converges with the gate shut and MAP inside T-7's 30.5–35.0", () => {
    const tas = 120 / Math.sqrt(atmosphere(25000).sigma);
    const pt = fullThrottleMapTurbo(TSIO550K, 2500, 25000, { tasKt: tas, titF: 1030, oilPsi: 45 });
    expect(pt.gate).toBe(0);
    expect(pt.map).toBeGreaterThanOrEqual(30.5);
    expect(pt.map).toBeLessThanOrEqual(35.0);
    expect(Number.isFinite(pt.turbineInletInHg)).toBe(true);
  });
});
