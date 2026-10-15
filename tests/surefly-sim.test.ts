/**
 * The SureFly SIM4P model against SureFly's SIM4P Installation Instructions SF1001 Rev B and its tech page
 * (engines/components/surefly/SOURCES.md). The advance between the documented limits is an illustrative shape, so only its limits
 * are tested.
 */
import { describe, expect, test } from "vitest";
import { ENGINES as ENGINE_SPECS } from "@/engines";
import { COMPONENT_IDS, componentById } from "@/engines/components";
import {
  codeLight,
  cycleLength,
  dipFor,
  ENGINES,
  firing,
  LED_CYCLES,
  ledCodeText,
  MAX_ADVANCE,
  readDip,
  sensedMap,
  sparkAngle,
  sparksBetween,
  START_RPM,
  syncLight,
  TIMINGS,
  type Dip,
  type Inputs,
} from "@/engines/components/surefly/model";

const run = (p: Partial<Inputs> = {}): Inputs => ({
  dip: dipFor(25, "advance"),
  volts: 13.8,
  ignition: true,
  rpm: 2400,
  map: 22,
  ambient: 29.92,
  hose: true,
  ...p,
});

describe("dip switch table (SF1001 §2.7 p. 8)", () => {
  // the table as printed: timing, switches 1–4 for advance, LED code for advance and for fixed
  const table: [number, string, string, string][] = [
    [30, "OFF ON ON ON", "—---", "----"],
    [28, "OFF ON ON OFF", "—--—", "---—"],
    [26, "OFF ON OFF ON", "—-—-", "--—-"],
    [25, "OFF ON OFF OFF", "—-——", "--——"],
    [24, "OFF OFF ON ON", "——--", "-—--"],
    [22, "OFF OFF ON OFF", "——-—", "-—-—"],
    [20, "OFF OFF OFF ON", "———-", "-——-"],
    [18, "OFF OFF OFF OFF", "————", "-———"],
  ];
  test.each(table)("%i°: advance %s, codes %s / %s", (timing, switches, adv, fixed) => {
    const t = timing as (typeof TIMINGS)[number];
    const a = dipFor(t, "advance"),
      f = dipFor(t, "fixed");
    expect(a.map((on) => (on ? "ON" : "OFF")).join(" ")).toBe(switches);
    // fixed differs only in switch 1, ON
    expect(f).toEqual([true, ...a.slice(1)]);
    expect(ledCodeText(a)).toBe(adv);
    expect(ledCodeText(f)).toBe(fixed);
    expect(readDip(a)).toEqual({ mode: "advance", timing });
    expect(readDip(f)).toEqual({ mode: "fixed", timing });
  });

  test("covers every combination of the four switches once", () => {
    const seen = new Set(TIMINGS.flatMap((t) => [dipFor(t, "advance"), dipFor(t, "fixed")]).map((d) => d.join()));
    expect(seen.size).toBe(16);
  });
});

describe("operation (SF1001 §1.1–1.2, tech page)", () => {
  test("fixed mode keeps data-plate timing throughout the operating range", () => {
    for (const rpm of [800, 1500, 2000, 2400, 2700])
      for (const map of [12, 18, 24, 29]) expect(firing(run({ dip: dipFor(25, "fixed"), rpm, map })).btdc).toBe(25);
  });

  test("advance mode never goes beyond 38° and never below data-plate timing once started", () => {
    for (const t of TIMINGS)
      for (let rpm = START_RPM; rpm <= 3500; rpm += 100)
        for (let map = 5; map <= 45; map += 1) {
          const f = firing(run({ dip: dipFor(t, "advance"), rpm, map }));
          expect(f.btdc).toBeGreaterThanOrEqual(t);
          expect(f.btdc).toBeLessThanOrEqual(MAX_ADVANCE);
        }
    expect(firing(run({ rpm: 2500, map: 15 })).btdc).toBeCloseTo(MAX_ADVANCE, 6);
  });

  test("advance only under some rpm and MAP conditions: full throttle stays at data-plate timing", () => {
    expect(firing(run({ rpm: 2700, map: 29 })).btdc).toBe(25);
    expect(firing(run({ rpm: 2400, map: 20 })).btdc).toBeGreaterThan(25);
  });

  test("starting: spark retarded to TDC in either mode", () => {
    for (const mode of ["advance", "fixed"] as const) {
      const f = firing(run({ dip: dipFor(25, mode), rpm: 150, map: 29.92 }));
      expect(f).toMatchObject({ fires: true, btdc: 0 });
    }
  });

  test("needs 8.5–30 VDC; the switch grounding the p-lead stops it like a magneto", () => {
    expect(firing(run({ volts: 8.4 })).fires).toBe(false);
    expect(firing(run({ volts: 8.5 })).fires).toBe(true);
    expect(firing(run({ volts: 30 })).fires).toBe(true);
    expect(firing(run({ ignition: false })).fires).toBe(false);
  });

  test("the MAP sensor reads 5–45 inHg, and an open port reads ambient", () => {
    expect(sensedMap({ map: 2, ambient: 29.92, hose: true })).toBe(5);
    expect(sensedMap({ map: 50, ambient: 29.92, hose: true })).toBe(45);
    expect(sensedMap({ map: 18, ambient: 29.92, hose: false })).toBe(29.92);
    // so advance mode without its hose sits at data-plate timing (an inference from the illustrative map)
    expect(firing(run({ map: 18, hose: false })).btdc).toBe(25);
  });
});

describe("wasted spark (tech page) with the 1-3-2-4 firing order", () => {
  test("one revolution fires two events, each a cylinder on compression with its partner on exhaust", () => {
    const events = sparksBetween(0.5, 360, 0);
    expect(events).toEqual([
      [3, 4],
      [2, 1],
    ]);
    // a full cycle fires every cylinder on compression once, and every plug twice
    const all = [...sparksBetween(0.5, 360, 0), ...sparksBetween(360.5, 360, 0)];
    expect(all.map((e) => e[0]).sort()).toEqual([1, 2, 3, 4]);
  });

  test("timing moves the spark before top centre", () => {
    // 25° BTDC: #1 fires at 695° (25° before its compression top centre at 0/720)
    expect(sparksBetween(694, 2, 25)).toEqual([[1, 2]]);
    expect(sparksBetween(696, 23, 25)).toEqual([]);
    // clocked 5° late, a SIM set for 25° fires #1 at 20° before top centre
    expect(720 - sparkAngle(1, 25, 5)).toBe(20);
  });

  test("events come in firing order across the wrap, and a frame of a whole cycle or more misses none", () => {
    // from 600°: #4 (TDC 540) has passed, so #1 at 720 fires first, then #3, #2, #4
    expect(sparksBetween(600, 720, 0).map((e) => e[0])).toEqual([1, 3, 2, 4]);
    // 2,400 rpm over a 50 ms frame turns exactly 720°
    expect(sparksBetween(10, 2400 * 6 * 0.05, 25)).toHaveLength(4);
    expect(sparksBetween(10, 1440, 25).map((e) => e[0])).toEqual([3, 2, 4, 1, 3, 2, 4, 1]);
  });
});

describe("LED (SF1001 §2.9, §3.3)", () => {
  test("internal timing: green, out over a ½° window at internal TDC, never with the p-lead grounded", () => {
    expect(syncLight(0, false)).toBe(false);
    expect(syncLight(0.4, false)).toBe(false);
    expect(syncLight(0.6, false)).toBe(true);
    expect(syncLight(359.9, false)).toBe(true);
    expect(syncLight(360.2, false)).toBe(false);
    expect(syncLight(90, true)).toBe(false);
  });

  test("blinks the code for 4 cycles then goes inactive; short for ON, long for OFF", () => {
    const dip: Dip = dipFor(25, "advance"); // OFF ON OFF OFF
    const len = cycleLength(dip);
    const lit = (t0: number, t1: number) => {
      let on = 0;
      for (let t = t0; t < t1; t += 0.005) on += codeLight(dip, t) ? 0.005 : 0;
      return on;
    };
    const one = lit(0, len);
    expect(lit(len * (LED_CYCLES - 1), len * LED_CYCLES)).toBeCloseTo(one, 1);
    expect(lit(len * LED_CYCLES, len * (LED_CYCLES + 2))).toBe(0);
    // four long blinks (18° advance, all OFF) light longer than four short ones (30° fixed, all ON)
    const lit18 = (t: number) => codeLight(dipFor(18, "advance"), t),
      lit30 = (t: number) => codeLight(dipFor(30, "fixed"), t);
    const sum = (f: (t: number) => boolean) => {
      let on = 0;
      for (let t = 0; t < 3; t += 0.005) on += f(t) ? 0.005 : 0;
      return on;
    };
    expect(sum(lit18)).toBeGreaterThan(2 * sum(lit30));
  });

  test("a fault blinks at 12 per second, without stopping", () => {
    let edges = 0,
      prev = false;
    for (let t = 100; t < 101; t += 0.001) {
      const on = codeLight(dipFor(25, "advance"), t, true);
      if (on && !prev) edges++;
      prev = on;
    }
    expect(edges).toBe(12);
  });
});

describe("page", () => {
  test("is listed at /components/surefly, with example data-plate timings from the engines' own specs", () => {
    expect(COMPONENT_IDS).toContain("surefly");
    expect(componentById("surefly")?.name).toBe("SureFly SIM");
    for (const e of ENGINES) expect(ENGINE_SPECS.find((s) => s.id === e.id)?.ignition.advanceBTC).toBe(e.timing);
  });
});
