/**
 * The TSIO-550-K's limit flags against the SR22T POH (13772-007) and Continental M-18: the POH 2-9 instrument markings
 * and their crew-alerting names, and the POH's other operating limits. States are built directly, so every boundary is
 * exact; the settled runs are in tests/tsio550k-engine.test.ts.
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { Marking } from "@/engines/types";
import {
  LEAN_DWELL_S,
  leanGaugeAbove,
  leanOverNext,
  limitFlags,
  markingBand,
  type FlagContext,
  type LimitFlag,
} from "@/engines/model/alerts";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  step,
  type Controls,
  type EngineState,
  type Environment,
} from "@/engines/model/engine";

const K = TSIO550K;

/** A running engine with every reading inside its green band (no flag), patched. */
function state(patch: Partial<EngineState> & { cht?: number } = {}) {
  const s = initialState(K, defaultEnvironment());
  Object.assign(s, { rpm: 2500, running: true, map: 30, oilP: 45, oilT: 180, pct: 75 });
  s.tit = [1400, 1400];
  s.turboRpm = [60000, 60000];
  const { cht = 350, ...rest } = patch;
  s.cyl.forEach((c, i) => (c.cht = cht - 5 * i));
  return Object.assign(s, rest);
}
const env = (patch: Partial<Environment> = {}): Environment => ({ ...defaultEnvironment(), ...patch });
const flags = (s: EngineState, e: Environment = env(), ctx?: FlagContext) => limitFlags(K, s, e, ctx);
const named = (fl: LimitFlag[], cas: string) => fl.filter((f) => f.cas === cas).map((f) => f.level);
const marking = (gauge: Marking["gauge"]) => K.markings!.find((m) => m.gauge === gauge)!;

describe("TSIO-550-K flags at the POH 2-9 band edges", () => {
  test("a running engine inside every green band raises no flag", () => {
    expect(flags(state())).toEqual([]);
  });

  test("MAN PRESSURE none at 36.0 and 36.5, caution at 36.6 and 37.5, warning at 37.6 (POH 2-9 band edges; 3-29, 3A-9)", () => {
    const at = (map: number) => named(flags(state({ map })), "MAN PRESSURE");
    expect([36.0, 36.5].map(at)).toEqual([[], []]);
    expect([36.6, 37.5].map(at)).toEqual([["caut"], ["caut"]]);
    expect([37.6, 39.9].map(at)).toEqual([["warn"], ["warn"]]);
    const f = flags(state({ map: 36.8 })).find((x) => x.cas === "MAN PRESSURE")!;
    expect(f.text).toBe("MAN PRESSURE: 36.8 in.Hg, above the 36.5 in.Hg band edge (POH 13772-007 2-9)");
  });

  test("CHT caution above 420 °F and warning above 460 °F, naming the hottest cylinder (POH 2-9, 3-26)", () => {
    const at = (cht: number) => named(flags(state({ cht })), "CHT");
    expect([420, 420.5, 460, 460.5].map(at)).toEqual([[], ["caut"], ["caut"], ["warn"]]);
    expect(flags(state({ cht: 445 })).find((x) => x.cas === "CHT")!.text).toBe(
      "CHT: cylinder 1 at 445 °F, above the 420 °F band edge (POH 13772-007 2-9)",
    );
  });

  test("RPM warning above 2550 rpm (POH 2-9, 3-32)", () => {
    expect([2550, 2551].map((rpm) => named(flags(state({ rpm })), "RPM"))).toEqual([[], ["warn"]]);
  });

  test("OIL TEMP warning above 240 °F (POH 2-9, 3-25)", () => {
    expect([240, 240.5].map((oilT) => named(flags(state({ oilT })), "OIL TEMP"))).toEqual([[], ["warn"]]);
  });

  test("TIT warning above 1750 °F, naming the turbocharger(s) (POH 2-9, 3-30 'one or both')", () => {
    const at = (tit: [number, number]) => flags(state({ tit })).filter((f) => f.cas === "TIT");
    expect(at([1750, 1750])).toEqual([]);
    const r = at([1740, 1760.4]);
    expect(r.map((f) => f.level)).toEqual(["warn"]);
    expect(r[0].text).toBe("TIT: R 1,760 °F, above the 1,750 °F band edge (POH 13772-007 2-9)");
    expect(at([1780, 1760])[0].text).toMatch(/^TIT: L 1,780 °F and R 1,760 °F, above/);
  });

  test("OIL PRESS caution 10–30 psi only at or above 1000 rpm; warning below 10 or above 100 (POH 3A-8, 2-9, 3-25)", () => {
    const at = (oilP: number, rpm: number) => named(flags(state({ oilP, rpm })), "OIL PRESS");
    expect(at(20, 999)).toEqual([]);
    expect(at(20, 1000)).toEqual(["caut"]);
    expect(at(10.1, 1500)).toEqual(["caut"]);
    expect(at(30.1, 1500)).toEqual([]);
    expect(at(9.9, 700)).toEqual(["warn"]);
    expect(at(100, 2500)).toEqual([]); // 60–100 is yellow without an annunciation
    expect(at(100.1, 2500)).toEqual(["warn"]);
    expect(at(0, 50)).toEqual([]); // not turning
  });

  test("a flag fires exactly where the gauge turns its colour: a boundary belongs to the lower band, the top red band is open", () => {
    const band = (g: Marking["gauge"], v: number) => markingBand(marking(g), v)?.color;
    expect([36.5, 36.55, 37.5, 37.55, 45].map((v) => band("map", v))).toEqual([
      "green",
      "yellow",
      "yellow",
      "red",
      "red",
    ]);
    expect([0, 10, 10.05, 30, 30.05, 100, 100.05].map((v) => band("oilP", v))).toEqual([
      "red",
      "red",
      "yellow",
      "yellow",
      "green",
      "yellow",
      "red",
    ]);
    // below the green arc's 240 °F the POH 2-9 row prints nothing: no colour, no flag
    expect([100, 240, 240.05, 420, 420.05, 460.05, 600].map((v) => band("cht", v))).toEqual([
      undefined,
      undefined,
      "green",
      "green",
      "yellow",
      "red",
      "red",
    ]);
  });
});

describe("TSIO-550-K flags for the POH's other limits", () => {
  test("TIT above 1850 °F, or above 1750 °F for more than 30 s, raises the transient flag (M-18 Table 2-1 'NTE 30 seconds')", () => {
    const transient = (patch: Partial<EngineState>) =>
      flags(state(patch)).filter((f) => f.src === K.limits.titTransient!.src);
    expect(transient({ tit: [1760, 1700], titOverS: 30 })).toEqual([]);
    expect(transient({ tit: [1760, 1700], titOverS: 30.1 }).map((f) => f.level)).toEqual(["warn"]);
    expect(transient({ tit: [1851, 1700], titOverS: 0 })[0].text).toBe(
      "TIT L 1,851 °F: above the 1,850 °F maximum allowable",
    );
    expect(transient({ tit: [1700, 1700], titOverS: 40 })).toEqual([]); // back under 1750: the timer is history
  });

  test("a failed TIT probe reads nothing: no TIT flag from its side, the other side still flags (POH 3-31 red X)", () => {
    const failures = { ...noFailures(K), titProbe: [false, true] as [boolean, boolean] };
    const s = state({ tit: [1700, 1900], titOverS: 40 });
    expect(flags(s, env(), { failures }).filter((f) => /TIT/.test(f.text))).toEqual([]);
    s.tit = [1760, 1900];
    expect(named(flags(s, env(), { failures }), "TIT")).toEqual(["warn"]);
    expect(flags(s, env(), { failures }).find((f) => f.cas === "TIT")!.text).toMatch(/^TIT: L 1,760 °F,/);
  });

  test("manifold pressure below 15 in.Hg above 18,000 ft is a caution; at or below 18,000 ft none (POH 2-6)", () => {
    const floor = (map: number, altFt: number, running = true) =>
      flags(state({ map, running }), env({ altFt })).filter((f) => f.src === K.limits.mapMinAbove!.src);
    expect(floor(14, 18000)).toEqual([]);
    expect(floor(14.9, 18500).map((f) => f.level)).toEqual(["caut"]);
    expect(floor(15, 18500)).toEqual([]);
    expect(floor(12, 20000, false)).toEqual([]);
  });

  test("turbine speed above the M-18 Figure 2-41 limit for its TIT", () => {
    const speed = (rpm: number) =>
      flags(state({ turboRpm: [rpm, 60000], tit: [1750, 1400] })).filter((f) => f.src === K.limits.turbineRpmMax!.src);
    expect(speed(121000)).toEqual([]);
    const f = speed(122500);
    expect(f.map((x) => x.level)).toEqual(["warn"]);
    expect(f[0].text).toBe("Turbine speed L 122,500 rpm: above the 122,000 rpm limit at 1,750 °F TIT");
  });

  test("START ENGAGED caution after 15 s and warning after 30 s of starter engagement; the 10 s cranking caution beside it (POH 3A-10, 3-48/3-49, 4-12)", () => {
    const at = (starterS: number) => {
      const fl = flags(state({ starterS }));
      return { se: named(fl, "START ENGAGED"), crank: fl.some((f) => f.src === K.limits.starterMaxS!.src) };
    };
    expect(at(10)).toEqual({ se: [], crank: false });
    expect(at(10.1)).toEqual({ se: [], crank: true });
    expect(at(15)).toEqual({ se: [], crank: true });
    expect(at(15.1)).toEqual({ se: ["caut"], crank: true });
    expect(at(30)).toEqual({ se: ["caut"], crank: true });
    expect(at(30.1)).toEqual({ se: ["warn"], crank: true });
  });

  test("oil below six quarts, counting what leaks have lost, is a caution (POH 4-8)", () => {
    const qty = (oilLossQt: number) =>
      flags(state({ oilLossQt }), env({ oilQt: 7 })).filter((f) => f.src === K.limits.oilMinQt.src);
    expect(qty(1)).toEqual([]);
    expect(qty(1.1).map((f) => [f.level, f.text])).toEqual([["caut", "Oil quantity 5.9 qt: below the 6 qt minimum"]]);
  });

  test("takeoff power with the oil below 75 °F is a caution (POH 2-6 minimum oil temperature for takeoff)", () => {
    const cold = (oilT: number, pct: number) =>
      flags(state({ oilT, pct })).filter((f) => f.src === K.limits.oilTempMinTakeoff!.src);
    expect(cold(74, 95).map((f) => f.level)).toEqual(["caut"]);
    expect(cold(74, 80)).toEqual([]);
    expect(cold(75, 95)).toEqual([]);
  });

  test("leaning above 30.5 in.Hg, as the gauge reads it, for the dwell is a caution (POH 4-22 'only … 30.5 in.Hg or less')", () => {
    const leaned = { controls: { ...defaultControls(), mixture: 0.8 } };
    const lean = (patch: Partial<EngineState>, ctx: FlagContext | undefined = leaned) =>
      flags(state(patch), env(), ctx).filter((f) => f.src === K.limits.leanMaxMap!.src);
    // the engine's timer has latched (engine.ts, LEAN_DWELL_S): the flag names the gauge reading
    expect(lean({ map: 31, leanOver: true }).map((f) => [f.level, f.text])).toEqual([
      ["caut", "Leaned at 31.0 in.Hg: cruise leaning only at 30.5 in.Hg or less"],
    ]);
    // still latched with the gauge back at the limit, the timer counting down: the text names the limit
    expect(lean({ map: 30.54, leanOver: true }).map((f) => f.text)).toEqual([
      "Leaned above 30.5 in.Hg: cruise leaning only at 30.5 in.Hg or less",
    ]);
    // a reading above the limit not yet held for the dwell raises nothing
    expect(lean({ map: 31, leanOverS: 1, leanOver: false })).toEqual([]);
    expect(lean({ map: 36, leanOver: true }, { controls: { ...defaultControls(), mixture: 1 } })).toEqual([]);
    expect(flags(state({ map: 31, leanOver: true }))).toEqual([]); // no controls given: the page has not said it is leaned
  });

  test("the leaning timer: the gauge (0.1 in.Hg) above 30.5 for a net LEAN_DWELL_S seconds latches the flag, back to zero releases it, full rich resets it (POH 4-22; engines/tsio550k/SOURCES.md)", () => {
    expect(LEAN_DWELL_S).toBe(3);
    expect([30.5, 30.54, 30.56, 31].map((m) => leanGaugeAbove(m, 30.5))).toEqual([false, false, true, true]);
    const zero = { s: 0, on: false };
    // short excursions: 0.47 s above, then 1 s below, over and over, never latch
    let p = zero;
    for (let i = 0; i < 200; i++) {
      p = leanOverNext(p, true, true, 0.47);
      expect(p.on).toBe(false);
      p = leanOverNext(p, true, false, 1);
    }
    expect(p).toEqual(zero);
    // held above: latches at 3 s, not before
    p = leanOverNext(zero, true, true, 2.99);
    expect(p.on).toBe(false);
    p = leanOverNext(p, true, true, 0.01);
    expect(p).toEqual({ s: 3, on: true });
    expect(leanOverNext(p, true, true, 10)).toEqual({ s: 3, on: true }); // capped at the dwell
    // once latched, a 2 s dip does not release it; the net time back at zero does
    p = leanOverNext(p, true, false, 2);
    expect(p).toEqual({ s: 1, on: true });
    expect(leanOverNext(p, true, true, 0.5)).toEqual({ s: 1.5, on: true });
    expect(leanOverNext(p, true, false, 1)).toEqual(zero);
    // full rich, or the engine stopped: no leaning limit, the timer resets at once
    expect(leanOverNext({ s: 3, on: true }, false, true, 0.01)).toEqual(zero);
  });

  test("ALT AIR OPEN when the automatic door opens, and a flag while the relief valve relieves (POH 3A-11; 3-29, 3-30)", () => {
    const door = flags(state({ altAirOpen: true }));
    expect(door.map((f) => [f.level, f.cas, f.src])).toEqual([["caut", "ALT AIR OPEN", K.refs.altAirOpen]]);
    const relief = flags(state({ reliefOpen: true }));
    expect(relief.map((f) => [f.level, f.cas, f.src])).toEqual([["caut", undefined, K.refs.relief]]);
    expect(relief[0].text).toContain("reduce manifold pressure to 30.5 in.Hg or less");
  });
});

describe("TSIO-550-K flag text", () => {
  /** Every flag at once: past every band and limit. */
  const everything = () =>
    flags(
      state({
        cht: 470,
        rpm: 2600,
        map: 38,
        oilP: 5,
        oilT: 245,
        tit: [1860, 1800],
        titOverS: 40,
        turboRpm: [130000, 130000],
        starterS: 31,
        altAirOpen: true,
        reliefOpen: true,
        leanOver: true,
      }),
      env({ oilQt: 5 }),
      { controls: { ...defaultControls(), mixture: 0.5 } },
    );

  test("annunciations carry the POH's CAS text exactly, and the flag's text starts with it (POH 2-9, 3-25 to 3-32, 3-48, 3A-8 to 3A-11)", () => {
    const POH_CAS = ["CHT", "RPM", "MAN PRESSURE", "OIL PRESS", "OIL TEMP", "TIT", "START ENGAGED", "ALT AIR OPEN"];
    const fl = everything();
    const cas = fl.flatMap((f) => (f.cas ? [f.cas] : []));
    expect(new Set(cas)).toEqual(new Set(POH_CAS));
    for (const f of fl) if (f.cas) expect(f.text.startsWith(`${f.cas}: `)).toBe(true);
    // the band names are the markings' own, which the spec test checks against POH 2-9
    for (const m of K.markings!) for (const b of m.bands) if (b.cas) expect(POH_CAS).toContain(b.cas);
  });

  test("no two flags in one list share a source, so the monitor's list keys stay unique", () => {
    const fl = everything();
    expect(fl.length).toBeGreaterThan(10);
    expect(new Set(fl.map((f) => f.src)).size).toBe(fl.length);
  });
});

describe("engines without POH markings keep their flags", () => {
  test("IO-390 and O-360 limitFlags over a grid of states are as before, with or without the page context", () => {
    const rows: unknown[] = [];
    let tripped = 0;
    for (const spec of [IO390, O360]) {
      const base = initialState(spec, defaultEnvironment());
      for (const rpm of [0, 90, 700, 1500, 2700, 2730])
        for (const cht of [300, 440, 480])
          for (const oilT of [150, 250])
            for (const oilP of [5, 25, 70, 120])
              for (const pct of [60, 80])
                for (const oilQt of [1, 7])
                  for (const starterS of [0, 12])
                    for (const ice of [0, 0.2]) {
                      const s = structuredClone(base);
                      Object.assign(s, { rpm, oilT, oilP, pct, starterS, ice, running: rpm > 500 });
                      s.cyl.forEach((c, i) => (c.cht = cht - 10 * i));
                      const e = { ...defaultEnvironment(), oilQt };
                      const f = limitFlags(spec, s, e);
                      expect(
                        limitFlags(spec, s, e, { failures: noFailures(spec), controls: defaultControls() }),
                      ).toEqual(f);
                      if (f.length) tripped++;
                      rows.push([spec.id, rpm, cht, oilT, oilP, pct, oilQt, starterS, ice, f]);
                    }
    }
    // computed by the same grid with limitFlags before the markings path was added
    expect([rows.length, tripped]).toEqual([4608, 4312]);
    expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex")).toBe(
      "49dfc716ac5ee60ee0a9f6c2948c0a4b39d422e601252f0d3d9f110314b3b398",
    );
  });

  // the leaning timer exists only on a spec with limits.leanMaxMap (the -K)
  test("IO-390 and O-360 carry no leaning timer and raise no leaning flag, leaned at full throttle (no limits.leanMaxMap)", () => {
    for (const spec of [IO390, O360]) {
      expect(spec.limits.leanMaxMap, spec.id).toBeUndefined();
      const e = defaultEnvironment(),
        f = noFailures(spec),
        c: Controls = { ...defaultControls(), mags: "START", boost: true, throttle: 0.15, mixture: 1 };
      const s = initialState(spec, e);
      const keys = (x: EngineState) => ["leanOverS", "leanOver"].filter((k) => k in x);
      expect(keys(s), spec.id).toEqual([]);
      const legs: [number, Partial<Controls>][] = [
        [3, {}],
        [5, { mags: "BOTH", boost: false, throttle: 0.25 }],
        [20, { throttle: 1, mixture: 0.8 }],
      ];
      for (const [secs, set] of legs) {
        Object.assign(c, set);
        for (let t = 0; t < secs; t += 0.5) {
          step(spec, s, c, e, f, 0.5);
          const fl = limitFlags(spec, s, e, { failures: f, controls: c });
          expect(fl).toEqual(limitFlags(spec, s, e));
          expect(fl.filter((x) => x.text.startsWith("Leaned"))).toEqual([]);
        }
      }
      expect(s.running, spec.id).toBe(true);
      expect(keys(s), spec.id).toEqual([]);
    }
  });
});
