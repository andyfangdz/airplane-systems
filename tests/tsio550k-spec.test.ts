/**
 * The TSIO-550-K spec against the pages it cites: POH 13772-007, AMM 13773-002 Rev 7 and Continental M-18
 * (engines/tsio550k/SOURCES.md). Data only: the model does not run this engine yet, so these check the numbers, their
 * agreement with each other, and how the shared helpers read Continental's charts.
 */
import { describe, expect, test } from "vitest";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { firingAngle, phaseOf, pinAngle, sideAngle } from "@/engines/model/cycle";
import { chartFuelFlow } from "@/engines/model/performance";
import type { Marking } from "@/engines/types";

const S = TSIO550K;
const L = S.limits;
const chart = () => {
  if (S.performance.kind !== "continental") throw new Error("expected Continental's performance chart");
  return S.performance;
};
const marking = (gauge: Marking["gauge"]) => {
  const m = S.markings?.find((x) => x.gauge === gauge);
  if (!m) throw new Error(`no ${gauge} marking`);
  return m;
};
const band = (gauge: Marking["gauge"], color: "red" | "yellow" | "green", i = 0) => {
  const b = marking(gauge).bands.filter((x) => x.color === color)[i];
  if (!b) throw new Error(`no ${color} band ${i} on ${gauge}`);
  return b;
};
/** Linear interpolation on increasing x; undefined outside the points. */
const interp = (pts: [number, number][], x: number) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return undefined;
};
const increasing = (v: number[]) => v.every((x, i) => i === 0 || x > v[i - 1]);

describe("limits and markings (POH Section 2)", () => {
  test("limits agree with the POH 2-9 markings (CHT 420/460, oil 10/30/60/100, oil T 240, rpm 2550, TIT 1750, MAP 36.5/37.5)", () => {
    // CHT
    expect(band("cht", "yellow").from).toBe(420);
    expect(band("cht", "yellow").from).toBe(L.chtBestAbove75.value);
    expect(band("cht", "yellow").from).toBe(L.chtBestAt75.value);
    expect(band("cht", "red").from).toBe(460);
    expect(band("cht", "red").from).toBe(L.chtMax.value);
    // oil pressure: red 0–10, yellow 10–30, green 30–60, yellow 60–100, red > 100
    expect(band("oilP", "red", 0).to).toBe(10);
    expect(band("oilP", "red", 0).to).toBe(L.oilPressMinIdle.value);
    expect(band("oilP", "yellow", 0)).toMatchObject({ from: 10, to: 30 });
    expect(band("oilP", "green")).toMatchObject({ from: 30, to: 60 });
    expect([L.oilPressNormal.min, L.oilPressNormal.max]).toEqual([30, 60]);
    expect(band("oilP", "yellow", 1)).toMatchObject({ from: 60, to: 100 });
    expect(band("oilP", "red", 1).from).toBe(100);
    expect(band("oilP", "red", 1).from).toBe(L.oilPressMaxStart.value);
    // oil temperature
    expect(band("oilT", "red").from).toBe(240);
    expect(band("oilT", "red").from).toBe(L.oilTempMax.value);
    // rpm: the gauge's red line is above 2550; the operating maximum (POH 2-6) is 2500, below it
    expect(band("rpm", "green").to).toBe(2550);
    expect(band("rpm", "red").from).toBe(2550);
    expect(L.rpmMax.value).toBe(2500);
    expect(L.rpmMax.value).toBeLessThanOrEqual(band("rpm", "green").to);
    // TIT
    expect(band("tit", "green").to).toBe(1750);
    expect(band("tit", "red").from).toBe(1750);
    expect(L.titTransient?.value).toBeGreaterThan(band("tit", "red").from);
    // manifold pressure: caution 36.5–37.5, warning above 37.5; the installed 36.0 is green
    expect(band("map", "yellow")).toMatchObject({ from: 36.5, to: 37.5, cas: "MAN PRESSURE", level: "caution" });
    expect(band("map", "red")).toMatchObject({ from: 37.5, to: 40, cas: "MAN PRESSURE", level: "warning" });
    expect(S.rating.map).toBe(36.0);
    expect(S.rating.map!).toBeGreaterThan(band("map", "green").from);
    expect(S.rating.map!).toBeLessThan(band("map", "green").to);
    expect(band("map", "green").from).toBe(L.mapMinAbove?.map);
  });

  test("every markings entry cites POH 2-9 and uses the POH's CAS names", () => {
    const m = S.markings ?? [];
    expect(m.map((x) => x.gauge)).toEqual(["cht", "rpm", "egt", "map", "oilP", "oilT", "pct", "tit", "ff"]);
    for (const x of m) expect(x.src).toMatch(/POH 13772-007 2-9\b/);
    expect(Object.fromEntries(m.map((x) => [x.gauge, x.scale]))).toEqual({
      cht: [100, 500],
      rpm: [0, 3000],
      egt: [1000, 1800],
      map: [10, 40],
      oilP: [0, 100],
      oilT: [75, 250],
      pct: [0, 100],
      tit: [1000, 1800],
      ff: [0, 45],
    });
    const cas = new Set(m.flatMap((x) => x.bands.flatMap((b) => (b.cas ? [b.cas] : []))));
    expect([...cas].sort()).toEqual(["CHT", "MAN PRESSURE", "OIL PRESS", "OIL TEMP", "RPM", "TIT"]);
    for (const b of m.flatMap((x) => x.bands)) {
      if (!b.cas) expect(b.level).toBeUndefined();
      else expect(b.level).toBe(b.color === "red" ? "warning" : "caution");
      expect(b.color === "green" && b.cas).toBeFalsy();
    }
    // POH 2-10 note a: the fuel-flow arc is dynamic, so no fixed bands
    expect(marking("ff").bands).toEqual([]);
  });

  test("markings bands lie inside their scales, ascending, without overlap", () => {
    for (const m of S.markings ?? []) {
      let last = m.scale[0];
      for (const b of m.bands) {
        expect(b.from).toBeLessThanOrEqual(b.to);
        expect(b.from).toBeGreaterThanOrEqual(last);
        expect(b.to).toBeLessThanOrEqual(m.scale[1]);
        last = b.to;
      }
    }
  });

  test("the -K's own limits and envelope as printed (POH 2-6, 2-19, 3-49, 3A-8, 3A-10, 4-22, 4-23, 5-34; M-18 Table 2-1, Fig 2-41)", () => {
    expect(L.mapMinAbove).toMatchObject({ map: 15, altFt: 18000 });
    expect(L.titTransient).toMatchObject({ value: 1850, seconds: 30 });
    expect(L.turbineRpmMax?.points).toEqual([
      [1200, 132000],
      [1440, 132000],
      [1750, 122000],
    ]);
    expect(L.exhaustBackPressureMax?.value).toBe(2.5);
    expect(L.maxAltFt?.value).toBe(25000);
    expect(L.oilTempMinTakeoff?.value).toBe(75);
    expect(L.chtMinDescent?.value).toBe(240);
    expect(L.leanMaxMap?.value).toBe(30.5);
    expect(chart().fullRichAboveInHg).toBe(L.leanMaxMap?.value);
    expect(L.startEngaged).toMatchObject({ caution: 15, warning: 30 });
    expect(L.oilPressCautionMinRpm?.value).toBe(1000);
    // no rich-of-peak limit at maximum power: the POH limits leaning by manifold pressure instead (4-22)
    expect(L.leanMaxPowerROP).toBeUndefined();
    expect(S.envelope).toEqual({ maxAltFt: 25000, maxTasKt: 220, maxOilQt: 8 });
    expect(S.envelope?.maxAltFt).toBe(L.maxAltFt?.value);
    expect(S.envelope?.maxOilQt).toBe(L.oilSumpQt.value);
    expect([L.oilMinQt.value, L.idleRpm.min, L.idleRpm.max, L.magDropMax.value, L.magDiffMax.value]).toEqual([
      6, 600, 750, 150, 75,
    ]);
    expect(L.magCheckRpm).toMatchObject({ min: 1700, max: 1700 });
  });
});

describe("chart data as printed (M-18 Figures 2-36, 2-37)", () => {
  test("Fig 2-37 lines are monotone in MAP; 2500 > 2400 > 2300 at every MAP; 2500 rpm passes 265.7 at 30.5 and 311.7 at 36.0", () => {
    const lines = chart().lines;
    expect(lines.map((l) => l.rpm)).toEqual([2300, 2400, 2500]);
    for (const l of lines) {
      expect(increasing(l.points.map((p) => p[0]))).toBe(true);
      expect(increasing(l.points.map((p) => p[1]))).toBe(true);
      expect(l.points[0][0]).toBe(20);
      expect(l.points[l.points.length - 1][0]).toBe(36.5);
    }
    const maps = [...new Set(lines.flatMap((l) => l.points.map((p) => p[0])))];
    for (const map of maps) {
      const [lo, mid, hi] = lines.map((l) => interp(l.points, map)!);
      expect(hi).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(lo);
    }
    const r2500 = lines[2].points;
    expect(r2500).toContainEqual([30.5, 265.7]);
    expect(r2500).toContainEqual([36, 311.7]);
    // M-18 Table 2-2: maximum recommended cruise 262 bhp at 2500 rpm and 30.5 in.Hg
    expect(interp(r2500, 30.5)! / 262).toBeGreaterThan(1);
    expect(interp(r2500, 30.5)! / 262).toBeLessThan(1.02);
  });

  test("Fig 2-36 Lean Full Rich = Rich Full Rich − 10 lb/h at every point", () => {
    const f = S.fuelFlow;
    if (f.kind !== "continental") throw new Error("expected Continental's fuel-flow chart");
    expect(f.leanFullRich.map((p) => p[0])).toEqual(f.richFullRich.map((p) => p[0]));
    // read ±0.5 lb/h (SOURCES.md)
    f.leanFullRich.forEach(([, lean], i) =>
      expect(Math.abs(lean - (f.richFullRich[i][1] - 10))).toBeLessThanOrEqual(0.5),
    );
    for (const c of [f.richFullRich, f.leanFullRich, f.bestPower, f.bestEconomy]) {
      expect(increasing(c.map((p) => p[0]))).toBe(true);
      expect(increasing(c.map((p) => p[1]))).toBe(true);
    }
    // Best Power and Best Economy are drawn from 173 to 262 bhp only
    for (const c of [f.bestPower, f.bestEconomy]) expect([c[0][0], c[c.length - 1][0]]).toEqual([173, 262]);
    for (const [hp, bp] of f.bestPower) {
      const be = interp(f.bestEconomy, hp)!;
      expect(interp(f.richFullRich, hp)!).toBeGreaterThan(interp(f.leanFullRich, hp)!);
      expect(interp(f.leanFullRich, hp)!).toBeGreaterThan(bp);
      expect(bp).toBeGreaterThan(be);
    }
    // Rich Full Rich is Continental's certification maximum, M-18 Table 2-5
    for (const [hp, lbh] of [
      [315, 220],
      [262, 143],
      [236, 128],
      [205, 110],
    ])
      expect(interp(f.richFullRich, hp)).toBe(lbh);
  });

  test("chartFuelFlow refuses the Fig 2-36 chart until the model reads it", () => {
    for (const mixture of ["bestPower", "bestEconomy"] as const)
      expect(() => chartFuelFlow(S, 2500, 236, mixture)).toThrow(
        "tsio550k: the model does not read a continental fuel-flow chart yet",
      );
  });
});

describe("rating and fuel (POH, AMM)", () => {
  test("cruise points are POH 5-32 to 5-34: five points, gph 18.3/17.4/16.4/14.6/12.7, hp = pct × 315", () => {
    expect([S.rating.hp, S.rating.rpm]).toEqual([315, 2500]);
    const c = S.rating.cruise;
    expect(c.map((x) => x.pct)).toEqual([85, 80, 75, 65, 55]);
    expect(c.map((x) => x.gph)).toEqual([18.3, 17.4, 16.4, 14.6, 12.7]);
    for (const x of c) {
      expect(x.hp).toBeCloseTo((x.pct * 315) / 100, 9);
      expect(x.rpm).toBe(2500);
      expect(x.mixture).toBe("lean of peak");
    }
  });

  test("fuel system as the AMM and POH print it: pump 7–9 / 21–24.5 psi, BOOST 4–6, HIGH BOOST lockout, nozzle 14.2–14.8 psid", () => {
    const fs = S.fuelSystem;
    if (fs.kind !== "continental") throw new Error("expected a Continental fuel system");
    expect(fs.pumpPsi).toEqual({ idle: [7, 9], rated: [21, 24.5] });
    expect(fs.boostPsi).toEqual([4, 6]);
    expect(fs.highBoost).toEqual({ mapInHg: 24, altFt: 10000, belowRpm: 500 });
    expect(fs.nozzleRatedPsid).toBeGreaterThanOrEqual(14.2);
    expect(fs.nozzleRatedPsid).toBeLessThanOrEqual(14.8);
    // the fitted nozzle curve passes the AMM band's mid flow (38.2 GPH × 6.0 lb/gal) at the rated nozzle pressure
    expect(interp(fs.nozzle.points, fs.nozzleRatedPsid)!).toBeCloseTo(38.2 * 6, 0);
    expect(increasing(fs.nozzle.points.map((p) => p[1]))).toBe(true);
    // full-rich λ: richest at rated air, and the rated end is the one `calibration.lambdaFullRich` records
    const lam = fs.fullRichLambda;
    expect(lam[lam.length - 1]).toEqual([1, 0.58]);
    expect(lam[lam.length - 1][1]).toBe(S.calibration.lambdaFullRich);
    expect(increasing(lam.map((p) => p[0]))).toBe(true);
    for (const [, l] of lam) expect(l).toBeGreaterThanOrEqual(0.58);
  });
});

describe("geometry, ignition and drives (M-18, POH 7-37)", () => {
  test("firing order 1-6-3-2-5-4 at 120° from the pins (M-18 Table 2-1)", () => {
    const fired: number[] = [];
    for (let crank = 0; crank < 720; crank += 1)
      for (const c of S.geometry.cylinders) if (Math.round(phaseOf(S, c.n, crank)) === 0) fired.push(c.n);
    expect(fired).toEqual([1, 6, 3, 2, 5, 4]);
    const angles = S.geometry.firingOrder.map((n) => firingAngle(S, n));
    angles.slice(1).forEach((a, i) => expect(a - angles[i]).toBe(120));
    for (const c of S.geometry.cylinders) expect(pinAngle(c, firingAngle(S, c.n)) % 360).toBe(sideAngle(c));
    const pin = (n: number) => S.geometry.cylinders.find((c) => c.n === n)!.pin;
    for (const [a, b] of [
      [1, 2],
      [3, 4],
      [5, 6],
    ])
      expect(Math.abs(pin(a) - pin(b))).toBe(180);
  });

  test("cylinders as M-18 numbers them: right 1-3-5, left 2-4-6, No. 1 and No. 2 rearmost, 7.31-in pitch, left bank 2.47 in forward", () => {
    const cyl = (n: number) => S.geometry.cylinders.find((c) => c.n === n)!;
    for (const n of [1, 3, 5]) expect(cyl(n).side).toBe("R");
    for (const n of [2, 4, 6]) expect(cyl(n).side).toBe("L");
    const IN = 0.0254;
    for (const [a, b] of [
      [1, 3],
      [3, 5],
      [2, 4],
      [4, 6],
    ])
      expect(Math.abs(cyl(b).x - cyl(a).x - 7.31 * IN)).toBeLessThan(1e-4);
    expect(Math.abs(cyl(2).x - cyl(1).x - 2.47 * IN)).toBeLessThan(1e-4);
    expect(Math.min(...S.geometry.cylinders.map((c) => c.x))).toBe(cyl(1).x);
  });

  test("M-18 Table 2-1 geometry and timing: 5.25 × 4.25 in, 552 in³, 7.5:1, 24° BTC; Table 2-8 envelope", () => {
    const g = S.geometry;
    expect([g.boreIn, g.strokeIn, g.displacementIn3, g.compressionRatio]).toEqual([5.25, 4.25, 552, 7.5]);
    expect(Math.abs((Math.PI / 4) * g.boreIn ** 2 * g.strokeIn * g.cylinders.length - g.displacementIn3)).toBeLessThan(
      0.5,
    );
    expect(g.envelopeIn).toEqual({ length: 39.2, width: 42.4, height: 34.0 });
    expect(S.ignition.advanceBTC).toBe(24);
  });

  test("POH 7-37 ignition: START fires both magnetos at TDC; the right magneto fires the lower right and upper left plugs", () => {
    expect(S.ignition.startMags).toBe("both");
    expect(S.ignition.startRetardATC).toBe(0);
    for (const c of S.geometry.cylinders) expect(S.ignition.topPlugMag[c.n]).toBe(c.side === "R" ? "L" : "R");
  });

  test("propeller and drives: governor fixed at 2,500 (POH 7-32), inertia above M-18 Table 2-7's minimum, Table 2-9 ratios", () => {
    expect(S.propeller.control).toBe("fixed");
    expect(S.propeller.governorMinRpm).toBe(S.rating.rpm);
    expect([S.propeller.diameterIn, S.propeller.blades]).toEqual([78, 3]);
    expect(S.propeller.inertia).toBeGreaterThanOrEqual(16 * 0.112985); // 16 in·lb·s² at a 700 rpm idle
    const a = S.accessories;
    expect([a.starterRatio, a.alternatorRatio, a.magnetoRatio, a.tachRatio, a.governorRatio]).toEqual([
      48, 3, 1.5, 0.5, 1,
    ]);
    expect(a.weightLb).toBe(522.8);
  });
});

describe("text and numbers", () => {
  test("no Lycoming manual names in the -K spec's text (the shared page prints the spec's own)", () => {
    expect(JSON.stringify(S)).not.toMatch(/\bIOM\b|lycoming/i);
  });

  test("every number in the spec is finite", () => {
    const walk = (v: unknown, path: string): void => {
      if (typeof v === "number") expect(Number.isFinite(v), path).toBe(true);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(S, "TSIO550K");
  });
});
