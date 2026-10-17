/**
 * Continental TSIO-550-K cruise calibration against SR22T POH 5-32 to 5-34 and the leaning procedure in 4-22.
 * These T-n targets retain the numbering in tsio550k-engine.test.ts. The expensive cruise table runs separately
 * so Vitest can distribute it across CI workers; every table cell and tolerance is checked on every run.
 */
import { describe, expect, test } from "vitest";
import { noFailures } from "@/engines/model/engine";
import { warmStart } from "@/engines/model/scenarios";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { cruisePoint, hottestCht, lookAt } from "./tsio550k-cruise-helpers";

const K = TSIO550K;

describe("POH cruise performance, lean of peak (SR22T POH 5-32 to 5-34, 4-22)", () => {
  // POH 5-32 to 5-34, standard day: [altitude ft, % of 315 hp, GPH, KTAS]: the white cells
  const CELLS: [number, number, number, number][] = [
    [2000, 75, 16.4, 162],
    [2000, 65, 14.6, 154],
    [2000, 55, 12.7, 143],
    [10000, 85, 18.3, 184],
    [10000, 75, 16.4, 175],
    [10000, 65, 14.6, 164],
    [10000, 55, 12.7, 152],
    [18000, 85, 18.3, 198],
    [18000, 75, 16.4, 188],
    [18000, 65, 14.6, 176],
    [18000, 55, 12.7, 162],
    [25000, 85, 18.3, 213],
    [25000, 80, 17.4, 207],
    [25000, 75, 16.4, 201],
    [25000, 65, 14.6, 188],
    [25000, 55, 12.7, 171],
  ];
  /** POH table hp per GPH by % power (pct × 3.15 ÷ GPH: 14.6, 14.5, 14.4, 14.0, 13.6). */
  const HP_PER_GPH: Record<number, number> = { 85: 14.6, 80: 14.5, 75: 14.4, 65: 14.0, 55: 13.6 };
  let rows: { alt: number; pct: number; hp: number; gph: number; map: number }[] | undefined;
  const cells = () =>
    (rows ??= CELLS.map(([alt, pct, gph, tas]) => {
      const r = cruisePoint(alt, gph, tas);
      return { alt, pct, hp: r.hp, gph: r.gph, map: r.map };
    }));

  test("T-18: every white standard-day cell makes pct × 315 bhp ± 4 % at the table fuel flow (± 0.1 GPH) and MAP ≤ 30.5 in.Hg (POH 5-32 to 5-34; 4-22)", () => {
    const off = cells()
      .filter(
        (r) =>
          Math.abs(r.hp / (r.pct * 3.15) - 1) > 0.04 ||
          r.map > 30.5 ||
          Math.abs(r.gph - CELLS.find((c) => c[0] === r.alt && c[1] === r.pct)![2]) > 0.1,
      )
      .map(
        (r) => `${r.alt} ft ${r.pct} %: ${r.hp.toFixed(1)} hp at ${r.gph.toFixed(2)} GPH, ${r.map.toFixed(2)} in.Hg`,
      );
    expect(off).toEqual([]);
  }, 180_000);

  test("T-19: hp per GPH at the T-18 points is the table's ± 4 % (14.6, 14.5, 14.4, 14.0, 13.6; POH 5-32 to 5-34)", () => {
    const off = cells()
      .filter((r) => Math.abs(r.hp / r.gph / HP_PER_GPH[r.pct] - 1) > 0.04)
      .map((r) => `${r.alt} ft ${r.pct} %: ${(r.hp / r.gph).toFixed(2)} hp/GPH`);
    expect(off).toEqual([]);
  }, 180_000);

  test("T-20: at 10,000 ft and 30.5 in.Hg leaning to λ ≈ 1.25 keeps hp per fuel flow within 5 %; leaner, roughness rises before power reaches zero (POH 4-22: 'lower cruise power … the only undesirable affect … is engine misfire')", () => {
    const x = warmStart(K);
    const f = noFailures(K);
    x.env = { ...x.env, altFt: 10000, tasKt: 175 };
    Object.assign(x.c, { boost: false, throttle: 0.66, mixture: 0.7 });
    const at = (lambda: number) => {
      for (let i = 0; i < 6; i++) {
        const g = lookAt(x, f, 20, { lambda }, i < 3 ? 20 : 1);
        x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (30.5 - g.map) / 40));
      }
      const g = lookAt(x, f, 20, { lambda }, 1);
      return { perFuel: g.hp / g.fuel, hp: g.hp, rough: x.s.rough };
    };
    const target = at(K.calibration.lambdaTarget!),
      lean = at(1.25),
      leaner = at(1.45);
    expect(Math.abs(lean.perFuel / target.perFuel - 1)).toBeLessThanOrEqual(0.05);
    expect(leaner.rough).toBeGreaterThan(lean.rough);
    expect(leaner.hp).toBeGreaterThan(0);
  }, 120_000);

  test("T-21: 85 % at 18.3 GPH and 10,000 ft: standard day every CHT ≤ 420 °F and both TIT ≤ 1750 °F; at ISA +30 °C (a gray cell) a CHT above 420, a TIT above 1750 or more than 30.5 in.Hg is needed (POH 5-33 and its note)", () => {
    const isa = cruisePoint(10000, 18.3, 184);
    expect(hottestCht(isa.x.s)).toBeLessThanOrEqual(420);
    expect(Math.max(...isa.x.s.tit!)).toBeLessThanOrEqual(1750);
    const hot = cruisePoint(10000, 18.3, 190, 30);
    const short = hot.hp < 0.96 * 85 * 3.15 && hot.capped;
    expect(hottestCht(hot.x.s) > 420 || Math.max(...hot.x.s.tit!) > 1750 || short).toBe(true);
  }, 120_000);

  test("T-22: at 10,000 ft and 30.5 in.Hg the 75 % target fuel flow (16.4 GPH) sits 50–75 °F (± 15) lean of the peak TIT (POH 4-22)", () => {
    const x = warmStart(K);
    const f = noFailures(K);
    x.env = { ...x.env, altFt: 10000, tasKt: 175 };
    Object.assign(x.c, { boost: false, throttle: 0.66, mixture: 0.75 });
    const sweep: { gph: number; tit: number }[] = [];
    for (const lambda of [0.9, 0.95, 1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.22]) {
      for (let i = 0; i < 4; i++) {
        const g = lookAt(x, f, 20, { lambda }, i < 2 ? 20 : 1);
        x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (30.5 - g.map) / 40));
      }
      const g = lookAt(x, f, 20, { lambda }, 1);
      sweep.push({ gph: g.fuel / 6, tit: Math.max(...x.s.tit!) });
    }
    const peak = Math.max(...sweep.map((p) => p.tit));
    // TIT at 16.4 GPH, linear between the two sweep points that bracket it (the sweep runs rich to lean)
    const i = sweep.findIndex((p, k) => k > 0 && p.gph <= 16.4 && sweep[k - 1].gph >= 16.4);
    expect(i).toBeGreaterThan(0);
    const [a, b] = [sweep[i - 1], sweep[i]];
    const tit = a.tit + ((b.tit - a.tit) * (16.4 - a.gph)) / (b.gph - a.gph);
    expect(peak - tit).toBeGreaterThanOrEqual(35);
    expect(peak - tit).toBeLessThanOrEqual(90);
  }, 180_000);
});

/** Full throttle at a cruise point's state, the mixture leaned each look to `gph`: the look means, look by look. */
function fullThrottleLeaned(r: ReturnType<typeof cruisePoint>, gph: number, looks = 10) {
  r.x.c.throttle = 1;
  const seen: { map: number; gph: number; mixture: number }[] = [];
  for (let i = 0; i < looks; i++) {
    const g = lookAt(r.x, r.f, 20, {}, 1);
    seen.push({ map: g.map, gph: g.fuel / 6, mixture: r.x.c.mixture });
    r.x.c.mixture = Math.max(0.03, Math.min(1, (r.x.c.mixture * gph * 6) / g.fuel));
  }
  return seen;
}

describe("TR-3 and leaning at full throttle on a hot day (SR22T POH 5-34)", () => {
  test("TR-3: 85 % at 18.3 GPH at 25,000 ft ISA +30 °C (a gray cell) is not reached at 30.5 in.Hg or less, and full throttle at 18.3 GPH gives more than 30.5 in.Hg (POH 5-34: the turbochargers can supply it)", () => {
    const r = cruisePoint(25000, 18.3, 220, 30);
    expect(r.capped).toBe(true);
    expect(r.hp).toBeLessThan(0.96 * 85 * 3.15);
    const seen = fullThrottleLeaned(r, 18.3);
    const last = seen[seen.length - 1];
    expect(Math.abs(last.gph - 18.3)).toBeLessThan(0.3);
    expect(last.map).toBeGreaterThan(30.5);
  }, 120_000);

  // the model's power leaned above 30.5 in.Hg is not read (SOURCES.md, "Leaning above 30.5 in.Hg"); only that the engine
  // keeps running there: before the -K's rich misfire edge it rose to over 1,000 hp, then MAP fell to 13.6 in.Hg.
  // Looks 1-5 are the look-by-look trim converging on the flow; from the sixth the point is settled, held to the
  // 0.2 in.Hg the settled 10,000 ft cruise point is held to
  test("leaning at full throttle on an ISA +30 °C day at 25,000 and 18,000 ft stays stable: over 10 looks to 18.3 GPH, MAP stays above 30.5 in.Hg, settles to within 0.2 in.Hg over looks 6–10 (no hunting, no collapse), and the mixture never returns to full rich", () => {
    for (const [altFt, tasKt] of [
      [25000, 220],
      [18000, 205],
    ]) {
      const seen = fullThrottleLeaned(cruisePoint(altFt, 18.3, tasKt, 30), 18.3);
      const settled = seen.slice(5).map((p) => p.map);
      expect(settled).toHaveLength(5);
      expect(Math.min(...seen.slice(1).map((p) => p.map)), `${altFt} ft`).toBeGreaterThan(30.5);
      expect(Math.max(...settled) - Math.min(...settled), `${altFt} ft band`).toBeLessThan(0.2);
      expect(Math.max(...seen.map((p) => p.mixture)), `${altFt} ft mixture`).toBeLessThan(1);
    }
  }, 180_000);
});
