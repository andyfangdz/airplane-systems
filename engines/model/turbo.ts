/**
 * Turbocharging (TSIO-550-K): twin turbochargers feeding intercoolers and an upper deck ahead of the throttle, one
 * oil-actuated wastegate on the left tailpipe, and a differential ("sloped") controller that bleeds the actuator's oil
 * according to the pressure difference across the throttle plate (SR22T POH 7-38/7-39; AMM 81-20 PDF 2812, 79-00 PDF
 * 2764; M-18 2-1 p. 2-1, 12-4.2 pp. 12-10/12-11).
 *
 * No compressor or turbine map is published for the -K, so the turbocharger is a quasi-steady power balance with a
 * spool lag: exhaust gas passes the turbines and the open part of the wastegate in parallel from the turbine-inlet
 * pressure to the tailpipes; the turbines' share expands isentropically through the turbines; the compressor pressure
 * ratio is where that power equals the compressor's, and the upper-deck pressure follows it with a first-order lag.
 * With a constant compressor efficiency the gate-closed balance has no stable point between idling and running away;
 * `compressorEta` lets the efficiency fall toward the map's edge, which bounds the pressure ratio and gives the critical
 * altitude. Every constant in `spec.turbo` is fitted (engines/<id>/spec.ts says to what).
 *
 * The controller is proportional: bleed rises with how far the throttle-plate difference exceeds a set point that
 * slopes with deck pressure, and the actuator's oil pressure is the engine oil pressure split across the wastegate's
 * inlet restriction and the bleed (the two are in series, M-18 12-4.2). The spring opens the gate as that pressure
 * falls, so the gate opens with the engine stopped or the actuator oil lost (POH 3-27/3-28 cause 3), and cold, thick
 * oil holds it more closed: manifold pressure rises (POH 4-17, 3-29). Fitting the slope `c1` and the gain `kBleed`:
 * at full throttle the plate difference is the throttle loss, about `k·deck` with k = loss/deck, and the deck settles
 * where k·deck − (c0 + c1 (deck − deckRef)) = (b − b0)/kBleed. A change δb in the bleed the gate needs (climbing, or
 * the cold-oil pressure) therefore moves the deck by about δb / (kBleed (k − c1)): a negative slope with a gain of
 * order 1 holds manifold pressure through a climb while still letting cold oil raise it.
 */
import type { EngineSpec, TurboSpec } from "../types";
import { atmosphere, fToK, INHG_PA, LB_KG, R_AIR, ramPressure } from "./atmosphere";
import { continentalFuelFlow } from "./fuel";
import { engineAirFlow, inductionCal, orificeFlow, solveManifold, throttleArea } from "./induction";

/** Specific heat of air and of exhaust gas, J/(kg·K) (textbook values). */
export const CP_AIR = 1005;
export const CP_EXHAUST = 1150;
/** (γ − 1)/γ for air (γ 1.4) and exhaust gas (γ 1.33). */
const KAPPA_C = 0.4 / 1.4;
const KAPPA_E = 0.33 / 1.33;
const P0 = 29.92126;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Smallest fraction of `etaCompressor` the map edge may fall to: keeps the efficiency, and every division, finite. */
export const ETA_FLOOR_FRACTION = 0.01;

/**
 * Compressor isentropic efficiency at a pressure ratio: `etaCompressor`, times the `compressorEta` map edge where the
 * spec gives one (linear between points, flat beyond the ends, never below `ETA_FLOOR_FRACTION`).
 */
export function compressorEfficiency(turbo: TurboSpec, pr: number) {
  const P = turbo.compressorEta;
  if (!P?.length) return turbo.etaCompressor;
  let f = P[P.length - 1][1];
  if (pr <= P[0][0]) f = P[0][1];
  else
    for (let i = 1; i < P.length; i++)
      if (pr <= P[i][0]) {
        f = P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * (pr - P[i - 1][0])) / (P[i][0] - P[i - 1][0]);
        break;
      }
  return turbo.etaCompressor * Math.max(f, ETA_FLOOR_FRACTION);
}

/** Compressor discharge temperature (K) for an inlet temperature (K) and pressure ratio. */
export const compressorOut = (turbo: TurboSpec, t1K: number, pr: number) =>
  t1K * (1 + (Math.pow(Math.max(pr, 1), KAPPA_C) - 1) / compressorEfficiency(turbo, Math.max(pr, 1)));

/** Power (W) the compressors take to raise `mA` kg/s by a pressure ratio. */
export const compressorPowerW = (turbo: TurboSpec, mA: number, t1K: number, pr: number) =>
  mA * CP_AIR * (compressorOut(turbo, t1K, pr) - t1K);

/** Highest pressure ratio `equilibriumPR` searches: far beyond any compressor's (a map edge stops it well before). */
const PR_MAX = 20;

/**
 * Pressure ratio at which the compressors take exactly `powerW` (the inverse of `compressorPowerW`); 1 with no flow.
 * With a constant efficiency it is closed form; with a map edge, a bisection (the power rises monotonically with the
 * pressure ratio wherever the efficiency falls or holds).
 */
export function equilibriumPR(turbo: TurboSpec, powerW: number, mA: number, t1K: number) {
  if (mA <= 1e-4 || powerW <= 0) return 1;
  if (!turbo.compressorEta?.length)
    return Math.pow(1 + (powerW * turbo.etaCompressor) / (mA * CP_AIR * t1K), 1 / KAPPA_C);
  if (compressorPowerW(turbo, mA, t1K, PR_MAX) <= powerW) return PR_MAX;
  let lo = 1,
    hi = PR_MAX;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (compressorPowerW(turbo, mA, t1K, m) < powerW) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Effective exhaust area (m²): both turbines plus the open part of the wastegate. */
export const exhaustArea = (turbo: TurboSpec, gate: number) =>
  turbo.count * turbo.turbineArea + clamp(gate, 0, 1) * turbo.wastegate.area;

/**
 * Turbine-inlet pressure (inHg) that passes `mE` kg/s of exhaust at `tK` through the turbines and the open wastegate
 * to the tailpipe pressure `pTailInHg` (the same orifice law as the throttle, induction.ts).
 */
export function turbineInletPressure(turbo: TurboSpec, mE: number, tK: number, pTailInHg: number, gate: number) {
  if (mE <= 0) return pTailInHg;
  const area = exhaustArea(turbo, gate);
  const flow = (p: number) => orificeFlow(area, p * INHG_PA, tK, pTailInHg * INHG_PA);
  let lo = pTailInHg,
    hi = pTailInHg * 1.5;
  for (let i = 0; i < 40 && flow(hi) < mE; i++) hi *= 1.5;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (flow(m) < mE) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Power (W) the turbines extract: their share of the exhaust expanding from the turbine inlet to the tailpipe. */
export function turbinePowerW(turbo: TurboSpec, mE: number, tK: number, pTI: number, pTailInHg: number, gate: number) {
  if (mE <= 0 || pTI <= pTailInHg) return 0;
  const share = (turbo.count * turbo.turbineArea) / exhaustArea(turbo, gate);
  return mE * share * CP_EXHAUST * tK * turbo.etaTurbine * (1 - Math.pow(pTailInHg / pTI, KAPPA_E));
}

/**
 * Controller bleed, 0 … 1: rises with the difference across the throttle plate (deck − manifold) above the set point
 * `c0 + c1 (deck − deckRef)`; a misadjusted controller has its set point `misadjustInHg` higher.
 */
export function controllerBleed(turbo: TurboSpec, deckInHg: number, mapInHg: number, misadjust = false) {
  const k = turbo.controller;
  const set = k.c0 + k.c1 * (deckInHg - k.deckRef) + (misadjust ? k.misadjustInHg : 0);
  return clamp(k.b0 + k.kBleed * (deckInHg - mapInHg - set), 0, 1);
}

/** Actuator oil pressure (psi): the oil pressure split across the wastegate inlet restriction and the bleed. */
export const actuatorPressure = (oilPsi: number, bleed: number, ratio: number) =>
  Math.max(oilPsi, 0) / (1 + (bleed * ratio) ** 2);

/** Wastegate position the actuator asks for, 0 closed … 1 open: the spring holds it open stopped or without oil. */
export function gateTarget(turbo: TurboSpec, pActPsi: number, rpm: number) {
  if (rpm <= 1) return 1;
  const w = turbo.wastegate;
  return clamp((w.pFullPsi - pActPsi) / (w.pFullPsi - w.pCrackPsi), 0, 1);
}

/** Shaft speed (rpm) at a compressor pressure ratio: `rpmRef` at `prRef` (ideal head ∝ speed²); 0 at no boost. */
export function turbineRpm(turbo: TurboSpec, pr: number) {
  if (pr <= 1) return 0;
  return turbo.rpmRef * Math.sqrt((Math.pow(pr, KAPPA_C) - 1) / (Math.pow(turbo.prRef, KAPPA_C) - 1));
}

/** Manifold air temperature (K) after the intercoolers: effectiveness × the difference to their cooling air. */
export function intercool(turbo: TurboSpec, t2K: number, outsideK: number) {
  const ic = turbo.intercooler;
  return t2K - ic.effectiveness * (t2K - (outsideK + ic.coolRiseC));
}

/** Pressure drop (inHg) across the intercoolers: `dpInHgRated` at the reference flow and density, ∝ ṁ²/ρ. */
export const intercoolerDrop = (turbo: TurboSpec, mA: number, mRef: number, rho: number, rhoRef: number) =>
  turbo.intercooler.dpInHgRated * (mA / mRef) ** 2 * (rhoRef / Math.max(rho, 1e-3));

/** Upper-deck pressure (inHg) at rated power: the installed full-throttle MAP plus the throttle body's loss. */
export const deckRefInHg = (spec: EngineSpec) => {
  if (spec.rating.map === undefined)
    throw new Error(`${spec.id}: a turbocharged spec needs rating.map (the installed full-throttle MAP, spec.ts)`);
  return spec.rating.map + (spec.induction?.throttleLossInHg ?? 0);
};

/**
 * What the -K's fuel metering is set for. It meters on rpm, throttle angle and compressor-discharge (deck) pressure
 * (SR22T POH 7-38; M-18 2-1), not on the charge's density, so a hotter or cooler charge or a different exhaust
 * pressure changes the mixture, not the fuel flow. The pressure ratio across the throttle stands in for its angle:
 * `airLbH` is the air a standard-day sea-level engine takes (15 °C charge, exhaust 1.02 × standard pressure) at the
 * manifold pressure this throttle would give from the rated deck, `MAP × deckRef / deck`; the full-rich flow for it
 * is then scaled by `deck / deckRef`, the pressure the pump references. At full throttle the first stays at about
 * rated at any altitude, so above the critical altitude the fuel flow follows the deck.
 *
 * `scheduleLbH` is that air at rated rpm: the throttle-angle stand-in on its own, which the full-rich λ schedule reads.
 * The flow is "in proportion to engine RPM, mixture setting, and throttle angle" (POH 7-38): rpm moves the flow through
 * `airLbH`, not the schedule. Read at the actual rpm, the schedule's steep end near rated air would lean the engine as
 * rpm dipped, and the fixed governor and the lean-of-peak power would limit-cycle. Equal at rated rpm.
 */
export function turboMetering(
  spec: EngineSpec,
  ve: (rpm: number) => number,
  rpm: number,
  mapInHg: number,
  deck: number,
) {
  const ref = deckRefInHg(spec);
  const d = Math.max(deck, 1e-3);
  const map = (mapInHg * ref) / d;
  const lbH = (r: number) => (engineAirFlow(spec, ve, r, map, 15, P0 * 1.02) / LB_KG) * 3600;
  return { airLbH: lbH(rpm), scale: d / ref, scheduleLbH: lbH(spec.rating.rpm) };
}

export interface TurboRef {
  /** Rated air (kg/s) and deck density (kg/m³) at the sea-level standard reference: the intercooler drop's reference. */
  mRef: number;
  rhoRef: number;
}

const refCache = new WeakMap<EngineSpec, TurboRef>();
/** Reference flow and density for the intercooler drop: rated rpm at the installed manifold pressure, 15 °C. */
export function turboRef(spec: EngineSpec, ve: (rpm: number) => number): TurboRef {
  let v = refCache.get(spec);
  if (!v) {
    const deck = deckRefInHg(spec);
    v = {
      mRef: engineAirFlow(spec, ve, spec.rating.rpm, spec.rating.map!, 15, P0 * 1.02),
      rhoRef: (deck * INHG_PA) / (R_AIR * 288.15),
    };
    refCache.set(spec, v);
  }
  return v;
}

export interface TurboPoint {
  map: number;
  deck: number;
  gate: number;
  matC: number;
  turbineInletInHg: number;
  pr: number;
}

/**
 * Settled full-throttle, full-rich operating point at an altitude (ISA unless `isaDevC`), for a turbine-inlet
 * temperature and oil pressure the caller gives (the engine's own come from its thermal model). It is the steady state
 * of the substep in engine.ts, lags removed: with the gate where the controller holds it for a deck pressure, the
 * turbines' power gives a deck pressure of its own, and the operating point is the deck where the two agree. Solved
 * as a root in deck pressure rather than by iterating, so a point the closed gate alone could not hold (below the
 * critical altitude the gate holds it) is found too: the root nearest the rated deck from above.
 */
export function fullThrottleMapTurbo(
  spec: EngineSpec,
  rpm: number,
  altFt: number,
  opts: { tasKt: number; titF: number; oilPsi: number; isaDevC?: number },
): TurboPoint {
  const turbo = spec.turbo;
  if (!turbo) throw new Error(`${spec.id}: fullThrottleMapTurbo needs a turbocharged spec (spec.turbo)`);
  const ind = inductionCal(spec);
  const air = atmosphere(altFt, opts.isaDevC ?? 0);
  const p1 = ramPressure(air.p, air.t, opts.tasKt, spec.induction?.ramEta ?? 0.7);
  const t1 = air.t + 273.15,
    pTail = air.p * 1.02,
    tTI = fToK(opts.titF);
  const cdA = ind.cdAFull * throttleArea(1, spec.calibration.idleArea);
  const ref = turboRef(spec, ind.ve);
  const at = (deck: number): TurboPoint & { next: number } => {
    let pTI = pTail,
      t2 = t1,
      drop = 0,
      map = deck,
      mA = 0;
    // the exhaust pressure and the intercooler drop depend on the flow they set: a few passes settle them
    for (let i = 0; i < 6; i++) {
      t2 = compressorOut(turbo, t1, Math.max(1, (deck + drop) / p1));
      const mat = intercool(turbo, t2, t1) - 273.15;
      ({ map, air: mA } = solveManifold(spec, ind, cdA, deck, mat, rpm, pTI));
      drop = intercoolerDrop(turbo, mA, ref.mRef, (deck * INHG_PA) / (R_AIR * t2), ref.rhoRef);
      const m = turboMetering(spec, ind.ve, rpm, map, deck);
      const mE = mA + (continentalFuelFlow(spec, m.airLbH, 1, 1, m.scheduleLbH) * m.scale * LB_KG) / 3600;
      const gate = gateTarget(
        turbo,
        actuatorPressure(opts.oilPsi, controllerBleed(turbo, deck, map), turbo.controller.ratio),
        rpm,
      );
      pTI = turbineInletPressure(turbo, mE, tTI, pTail, gate);
      if (i === 5) {
        const pr = equilibriumPR(turbo, turbinePowerW(turbo, mE, tTI, pTI, pTail, gate), mA, t1);
        return { map, deck, gate, matC: mat, turbineInletInHg: pTI, pr, next: pr * p1 - drop };
      }
    }
    throw new Error("unreachable");
  };
  // scan down from above the rated deck for the first deck the turbines can hold, then bisect
  let hi = deckRefInHg(spec) * 1.15,
    hiPoint = at(hi);
  for (let deck = hi - 0.25; deck > p1; deck -= 0.25) {
    const pt = at(deck);
    if (pt.next >= deck) {
      let lo = deck;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (at(m).next >= m) lo = m;
        else hi = m;
      }
      const { next: _, ...point } = at((lo + hi) / 2);
      return point;
    }
    hi = deck;
    hiPoint = pt;
  }
  const { next: _, ...point } = hiPoint;
  return point;
}
