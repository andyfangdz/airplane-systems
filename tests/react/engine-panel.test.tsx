// vitest: isolate
/**
 * The engine page's panel, monitor and pressure chart for the TSIO-550-K (SR22T POH 13772-007 Reissue A) against the IO-390 and
 * O-360 pages, which stay as they were. Each case renders the compiled component (vitest.react.config.mts).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshLiveSnapshot } from "@/lib/useLiveSnapshot";
import { initialState, noFailures } from "@/engines/model/engine";
import { egtOffset } from "@/engines/model/mixture";
import { labelOf, scenarioById, scenariosFor } from "@/engines/model/scenarios";
import { titFromPeak } from "@/engines/model/tit";
import { settle } from "@/engines/model/trim";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";
import { EnginePanel } from "@/components/engine/EnginePanel";
import { Monitor, bandTone } from "@/components/engine/Monitor";
import { PressureChart, chartCaption, chartInputs } from "@/components/engine/PressureChart";
import { GROUPS } from "@/components/engine/scene/parts";
import { replaceState, simFor, type EngineSim } from "@/components/engine/store";

const K = TSIO550K;
const initialUi = new Map([K, IO390, O360].map((spec) => [spec.id, simFor(spec).useUi.getState()]));

/** A fresh simulation for `spec`: the cached one, reset to a cold engine and the store's first state. */
function fresh(spec: EngineSpec): EngineSim {
  const sim = simFor(spec);
  replaceState(sim, initialState(spec));
  sim.useUi.setState(initialUi.get(spec.id)!, true);
  return sim;
}
/** Change the live state and publish it to the panels at once (the page samples it a few times a second). */
const live = (sim: EngineSim, patch: (s: EngineSim["s"]) => void) =>
  act(() => {
    patch(sim.s);
    refreshLiveSnapshot(sim.s);
  });

const sliderLabel = (c: HTMLElement, id: string) => c.querySelector(`label[for="${id}"] span`)?.textContent;
const reading = (label: string) =>
  screen.getByText(label, { selector: ".ro > span", exact: true }).parentElement?.querySelector("b")?.textContent;
const fact = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll("dt")].find((dt) => dt.textContent === label)?.nextElementSibling?.textContent ?? "";
const monCell = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll(".mon-big > div, .mon-small > div")].find(
    (d) => d.querySelector("span")?.textContent === label,
  );
const smallLabels = (c: HTMLElement) => [...c.querySelectorAll(".mon-small > div > span")].map((s) => s.textContent);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TSIO-550-K panel", () => {
  it("heads the panel with the spec's reference line", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect(container.querySelector(".ref")?.textContent).toBe(K.ref);
  });

  it("has no propeller control: the governor is factory set to 2,500 rpm (POH 7-32, 7-39; AMM 61-20)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect(container.querySelector("#prop")).toBeNull();
    expect(reading("Governor (factory set)")).toBe("2,500 rpm");
  });

  it("labels the power and mixture levers as the console does (POH 7-32)", () => {
    const sim = fresh(K);
    const { container } = render(<EnginePanel sim={sim} />);
    expect(sliderLabel(container, "throttle")).toBe("Power lever (MAX – IDLE)");
    expect(sliderLabel(container, "mixture")).toBe("Mixture (RICH – CUTOFF)");
    expect(container.querySelector('label[for="mixture"] output')?.textContent).toBe("cutoff");
  });

  it("switches the fuel pump OFF / BOOST / HIGH BOOST-PRIME, setting boost and highBoost (POH 7-41)", () => {
    const sim = fresh(K);
    const { container } = render(<EnginePanel sim={sim} />);
    expect(container.querySelector("#boost")).toBeNull();
    const pressed = () =>
      ["OFF", "BOOST", "HIGH"].filter(
        (v) => container.querySelector(`#pump-${v}`)?.getAttribute("aria-pressed") === "true",
      );
    const pump = () => ({
      boost: sim.useUi.getState().controls.boost,
      highBoost: !!sim.useUi.getState().controls.highBoost,
    });
    expect(pressed()).toEqual(["OFF"]);
    fireEvent.click(container.querySelector("#pump-BOOST")!);
    expect(pump()).toEqual({ boost: true, highBoost: false });
    expect(pressed()).toEqual(["BOOST"]);
    fireEvent.click(container.querySelector("#pump-HIGH")!);
    expect(pump()).toEqual({ boost: true, highBoost: true });
    expect(pressed()).toEqual(["HIGH"]);
    fireEvent.click(container.querySelector("#pump-OFF")!);
    expect(pump()).toEqual({ boost: false, highBoost: false });
  });

  it("says whether the lockout relay lets HIGH BOOST run (POH 7-41)", () => {
    const sim = fresh(K);
    const { container } = render(<EnginePanel sim={sim} />);
    fireEvent.click(container.querySelector("#pump-HIGH")!);
    live(sim, (s) => (s.highBoostOn = false));
    // the thresholds come from the spec's fuelSystem.highBoost: 24 inHg, 10,000 ft, 500 rpm (POH 7-41)
    expect(
      screen.getByText(
        "Locked out: the relay runs the pump as BOOST. HIGH BOOST/PRIME needs 24 inHg and 10,000 ft, or the engine " +
          "below 500 rpm.",
      ),
    ).toBeTruthy();
    live(sim, (s) => (s.highBoostOn = true));
    expect(screen.getByText("HIGH BOOST/PRIME running")).toBeTruthy();
  });

  it("fires both magnetos at START (POH 7-37)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect(container.querySelector(".eng-start")?.getAttribute("title")).toMatch(/both magnetos/);
  });

  it("has no alternate-air switch: the door's readout follows the model (POH 7-37)", () => {
    const sim = fresh(K);
    const { container } = render(<EnginePanel sim={sim} />);
    expect(container.querySelector("#altair")).toBeNull();
    expect(reading("Alternate air door")).toBe("closed");
    live(sim, (s) => (s.altAirOpen = true));
    expect(reading("Alternate air door")).toBe("open");
  });

  it("reaches 25,000 ft, 220 kt and 8 qt in the conditions (POH 2-19, 5-34, 1-8)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect(container.querySelector("#alt")?.getAttribute("max")).toBe("25000");
    expect(container.querySelector("#tas")?.getAttribute("max")).toBe("220");
    expect(container.querySelector("#oil")?.getAttribute("max")).toBe("8");
  });

  it("reads the turbo system: deck, wastegate, TIT, turbo speed, charge air, overboost valve", () => {
    const sim = fresh(K);
    render(<EnginePanel sim={sim} />);
    expect(reading("Wastegate")).toBe("spring open");
    live(sim, (s) => {
      s.rpm = 2500;
      s.deckInHg = 37.2;
      s.gate = 0.25;
      s.tit = [1600, 1620];
      s.turboRpm = [90000, 90000];
      s.matC = 30;
      s.reliefOpen = true;
    });
    expect(reading("Deck")).toBe("37.2 inHg");
    expect(reading("Wastegate")).toBe("25 % open");
    expect(reading("TIT L")).toBe("1,600 °F");
    expect(reading("TIT R")).toBe("1,620 °F");
    expect(reading("Turbo speed L (illustrative)")).toBe("90,000 rpm");
    expect(reading("Turbo speed R (illustrative)")).toBe("90,000 rpm");
    expect(reading("Charge air")).toBe("86 °F");
    expect(reading("Overboost valve")).toBe("relieving");
  });

  it("lists the ten TSIO-550-K Start-from setups", () => {
    render(<EnginePanel sim={fresh(K)} />);
    const labels = scenariosFor(K).map((sc) => labelOf(sc, K));
    expect(labels).toHaveLength(10);
    for (const l of labels) expect(screen.getByRole("button", { name: l })).toBeTruthy();
  });

  it("gives the cruise points lean of peak and the rated manifold pressure (POH 2-6, 5-32 to 5-34)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    for (const c of K.rating.cruise) expect(fact(container, c.label)).toContain("lean of peak");
    expect(fact(container, "Cruise 75 %")).toBe("75 %: 236 hp at 2,500 rpm, lean of peak, 16.4 gph");
    expect(fact(container, "Rated power")).toBe("315 hp at 2,500 rpm and 36.0 inHg");
  });

  it("takes the operating limits from the POH 2-9 markings and the -K's own limits (POH 2-6, 2-9, 2-19)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect(fact(container, "Manifold pressure")).toContain("yellow 36.5–37.5 (MAN PRESSURE caution)");
    expect(fact(container, "Manifold pressure")).toContain("red 37.5–40 (MAN PRESSURE warning)");
    expect(fact(container, "Oil pressure")).toContain("red > 100 (OIL PRESS warning)");
    expect(fact(container, "Takeoff oil temperature")).toContain("75 °F minimum");
    expect(fact(container, "Manifold pressure at altitude")).toContain("not below 15 inHg above 18,000 ft");
    expect(fact(container, "Maximum operating altitude")).toContain("25,000 ft");
    expect(container.querySelector(".facts")?.parentElement?.textContent).not.toContain("for maximum life");
  });
});

describe("failures table (each cylinder's plugs, nozzle and intake)", () => {
  it.each([
    { spec: K, headers: ["Cyl", "Top plug", "Bottom plug", "Nozzle blocked", "Intake leak"], nozzles: 6 },
    { spec: IO390, headers: ["Cyl", "Top plug", "Bottom plug", "Nozzle blocked", "Intake leak"], nozzles: 4 },
    { spec: O360, headers: ["Cyl", "Top plug", "Bottom plug", "Intake leak"], nozzles: 0 },
  ])("offers $spec.name's nozzle blockage where it has injection nozzles", ({ spec, headers, nozzles }) => {
    const sim = fresh(spec);
    const { container } = render(<EnginePanel sim={sim} />);
    expect([...container.querySelectorAll(".eng-fail th")].map((th) => th.textContent)).toEqual(headers);
    const sliders = container.querySelectorAll('input[aria-label$="nozzle blockage"]');
    expect(sliders).toHaveLength(nozzles);
    if (nozzles) {
      fireEvent.change(sliders[0], { target: { value: "0.5" } });
      expect(sim.useUi.getState().failures.nozzle[0]).toBe(0.5);
    }
  });
});

describe("panel parts and the pages that stay as they were", () => {
  it.each([K, IO390, O360])("lists $name's part groups", (spec) => {
    const { container } = render(<EnginePanel sim={fresh(spec)} />);
    const labels = [...container.querySelectorAll(".eng-parts label")].map((l) => l.textContent);
    expect(labels).toEqual(
      GROUPS.map((g) =>
        g.id === "fuel" && spec.fuelSystem.kind === "carburetor" ? "Carburetor and fuel pump" : g.name,
      ),
    );
  });

  it("keeps the IO-390's controls, conditions and limits", () => {
    const sim = fresh(IO390);
    const { container } = render(<EnginePanel sim={sim} />);
    expect(container.querySelector(".ref")?.textContent).toBe("Engine simulation · Lycoming IOM");
    // two text runs, as before, so the line lays out to the pixel as it did
    expect([...container.querySelector(".ref")!.childNodes].map((n) => n.textContent)).toEqual([
      "Engine simulation · Lycoming ",
      "IOM",
    ]);
    expect(sliderLabel(container, "throttle")).toBe("Throttle");
    expect(sliderLabel(container, "mixture")).toBe("Mixture");
    expect(container.querySelector('label[for="mixture"] output')?.textContent).toBe("idle cut-off");
    expect(container.querySelector('label[for="prop"] output')?.textContent).toBe("governs 2,700 rpm");
    expect(container.querySelector("#boost")).not.toBeNull();
    expect(container.querySelector("#altair")).not.toBeNull();
    expect(container.querySelector("#pump-OFF")).toBeNull();
    expect(container.querySelector("#alt")?.getAttribute("max")).toBe("17500");
    expect(container.querySelector("#tas")?.getAttribute("max")).toBe("180");
    expect(container.querySelector("#oil")?.getAttribute("max")).toBe("7");
    expect(container.querySelector(".eng-start")?.getAttribute("title")).toBe(
      "Hold to crank: the starter turns the engine and only the left (retard-breaker) magneto fires",
    );
    expect(fact(container, "CHT")).toContain("for maximum life");
    expect(fact(container, "Rated power")).toBe("215 hp at 2,700 rpm");
    expect(screen.queryByText("Deck", { selector: ".ro > span" })).toBeNull();
  });

  it("keeps the O-360's controls", () => {
    const { container } = render(<EnginePanel sim={fresh(O360)} />);
    expect(container.querySelector(".ref")?.textContent).toBe("Engine simulation · Lycoming OM");
    expect(container.querySelector("#carbheat")).not.toBeNull();
    expect(container.querySelector(".eng-prime")).not.toBeNull();
    expect(container.querySelector("#boost")).not.toBeNull();
    expect(container.querySelector("#prop")).not.toBeNull();
    expect(container.querySelector("#oil")?.getAttribute("max")).toBe("8");
  });
});

describe("engine monitor", () => {
  it("colours the TSIO-550-K gauges at the POH 2-9 band edges", () => {
    const tones = (gauge: Parameters<typeof bandTone>[1], vs: number[]) => vs.map((v) => bandTone(K, gauge, v));
    expect(tones("map", [36.5, 36.6, 37.5, 37.6, 41])).toEqual(["", "warnc", "warnc", "bad", "bad"]);
    expect(tones("cht", [420, 421, 460, 461, 510])).toEqual(["", "warnc", "warnc", "bad", "bad"]);
    expect(tones("oilP", [0, 5, 10, 20, 30, 45, 80, 100, 101])).toEqual([
      "bad",
      "bad",
      "bad",
      "warnc",
      "warnc",
      "",
      "warnc",
      "warnc",
      "bad",
    ]);
    expect(tones("oilT", [240, 241])).toEqual(["", "bad"]);
    expect(tones("rpm", [2550, 2551])).toEqual(["", "bad"]);
    expect(tones("tit", [1750, 1751])).toEqual(["", "bad"]);
    expect(bandTone(IO390, "map", 40)).toBeUndefined();
  });

  it("shows six EGT/CHT pairs and TIT bars for the LH and RH turbochargers (POH 7-35)", () => {
    const { container } = render(<Monitor sim={fresh(K)} />);
    expect(container.querySelectorAll(".mon-cyl:not(.mon-tit)")).toHaveLength(6);
    expect([...container.querySelectorAll(".mon-tit > span")].map((s) => s.textContent)).toEqual(["L", "R"]);
  });

  it("shows manifold pressure yellow above 36.5 and red above 37.5 inHg (POH 2-9)", () => {
    const sim = fresh(K);
    const { container } = render(<Monitor sim={sim} />);
    const cls = (map: number) => {
      live(sim, (s) => (s.map = map));
      return monCell(container, "MAP")?.querySelector("b")?.className;
    };
    expect([cls(36.5), cls(37.0), cls(37.6)]).toEqual(["", "warnc", "bad"]);
  });

  it("puts each TIT value above its bar (POH 7-35)", () => {
    const sim = fresh(K);
    const { container } = render(<Monitor sim={sim} />);
    live(sim, (s) => (s.tit = [1600, 1620]));
    const cols = [...container.querySelectorAll(".mon-tit")];
    expect(
      cols.map((c) =>
        [...c.children].map((e) => e.tagName.toLowerCase() + (e.classList.contains("bar") ? ".bar" : "")),
      ),
    ).toEqual([
      ["small", "div.bar", "span", "small", "small"],
      ["small", "div.bar", "span", "small", "small"],
    ]);
    expect(cols.map((c) => c.firstElementChild?.textContent)).toEqual(["1600", "1620"]);
  });

  it("says the airplane's display computes percent power its own way (POH 7-36)", () => {
    const { container } = render(<Monitor sim={fresh(K)} />);
    expect(monCell(container, "Power")?.querySelector("b")?.getAttribute("title")).toContain("POH 7-36");
  });

  it("adds the deck pressure and TIT from peak to the small row", () => {
    const sim = fresh(K);
    const { container } = render(<Monitor sim={sim} />);
    live(sim, (s) => (s.deckInHg = 36.4));
    expect(smallLabels(container)).toEqual(["Oil °F", "Oil psi", "Fuel psi", "Peak", "Deck", "TIT pk"]);
    expect(monCell(container, "Deck")?.querySelector("b")?.textContent).toBe("36.4");
  });

  /** The -K's cylinders burning at the λ given, each at a cruise-like load (30 hp) and 1,400 °F. */
  const cylsAt = (spec: EngineSpec, lambdas: number[]) =>
    initialState(spec).cyl.map((c, i) => ({ ...c, lambda: lambdas[i], work: 0.5, hp: 30, egt: 1400 }));

  it("puts TIT from peak on the side of the peak an even mixture is on, and at peak reads none", () => {
    for (const lam of [0.85, 1.0, 1.1]) {
      const t = titFromPeak(K, cylsAt(K, Array(6).fill(lam)))!;
      expect(t.side, `λ ${lam}`).toBe(lam < 0.99 ? "ROP" : lam > 1.01 ? "LOP" : "peak");
      if (lam === 1.0) expect(t.off).toBeLessThan(1);
      else expect(t.off, `λ ${lam}`).toBeGreaterThan(20);
    }
    const spread = titFromPeak(K, cylsAt(K, [0.95, 1.0, 1.05, 1.1, 1.15, 1.2]))!;
    expect(Number.isFinite(spread.off) && spread.off >= 0).toBe(true);
    expect(titFromPeak(K, cylsAt(K, Array(6).fill(Infinity)))).toBeNull();
    // no turbocharger, no TIT
    expect(titFromPeak(IO390, cylsAt(IO390, Array(4).fill(1.1)))).toBeNull();
  });

  it("finds the TIT peak from a mixture as rich as the -K's misfire edge, beyond twice its λ", () => {
    const rich = titFromPeak(K, cylsAt(K, Array(6).fill(0.46)))!;
    expect(rich.side).toBe("ROP");
    expect(rich.k).toBeGreaterThan(2);
    expect(Math.abs(0.46 * rich.k - 1)).toBeLessThan(0.03);
  });

  /** Every cylinder burning at λ `lam` with the engine running; the panel's "from peak" cells and the monitor's. */
  const fromPeakAt = (spec: EngineSpec, lam: number) => {
    const sim = fresh(spec);
    const panel = render(<EnginePanel sim={sim} />).container;
    const mon = render(<Monitor sim={sim} />).container;
    live(sim, (s) => {
      s.running = true;
      s.cyl.forEach((c) => ((c.lambda = lam), (c.work = 0.5)));
    });
    const text = (label: string) => monCell(mon, label)?.querySelector("b")?.textContent;
    const table = [...panel.querySelectorAll(".eng-table")].find((x) =>
      [...x.querySelectorAll("th")].some((th) => th.textContent === "from peak"),
    )!;
    const col = [...table.querySelectorAll("th")].findIndex((th) => th.textContent === "from peak");
    return {
      cells: [...table.querySelectorAll("tbody tr")].map((r) => r.children[col].textContent),
      peak: text("Peak"),
      tit: text("TIT pk"),
    };
  };

  it("reads EGT and TIT from peak on the -K's own rich misfire edge (calibration.richMisfireLambda)", () => {
    const rich = K.calibration.richMisfireLambda;
    expect(rich).toBe(0.45);
    // at λ 0.50 the -K burns every cycle; the 0.55 default would add about 170 °F of misfire cooling it no longer has
    const off = -egtOffset(0.5, rich);
    expect(Math.abs(off + egtOffset(0.5))).toBeGreaterThan(100);
    // with no load the TIT follows the EGT offset alone, scaled by the probes' gain (turbo.ts titTargets)
    const cold = initialState(K).cyl.map((c) => ({ ...c, lambda: 0.5, work: 0.5 }));
    const t = titFromPeak(K, cold)!;
    expect(t.off).toBeCloseTo(K.calibration.titGain! * off, 0);
    expect(t.side).toBe("ROP");
    const r = fromPeakAt(K, 0.5);
    expect(r.cells).toEqual(Array(6).fill(`${Math.round(off)} R`));
    expect(r.peak).toBe(`${Math.round(off)} ROP`);
    expect(r.tit).toBe(`${Math.round(t.off)} ROP`);
  });

  it("keeps the IO-390's from-peak readings on the default rich edge", () => {
    expect(IO390.calibration.richMisfireLambda).toBeUndefined();
    const off = -egtOffset(0.5, 0.55);
    const r = fromPeakAt(IO390, 0.5);
    expect(r.cells).toEqual(Array(4).fill(`${Math.round(off)} R`));
    expect(r.peak).toBe(`${Math.round(off)} ROP`);
    expect(r.tit).toBeUndefined();
  });

  it("keeps the IO-390's four pairs, its small row and its rpm colour", () => {
    const sim = fresh(IO390);
    const { container } = render(<Monitor sim={sim} />);
    expect(container.querySelectorAll(".mon-cyl")).toHaveLength(4);
    expect(container.querySelectorAll(".mon-tit")).toHaveLength(0);
    expect(smallLabels(container)).toEqual(["Oil °F", "Oil psi", "Fuel psi", "hp", "Peak"]);
    live(sim, (s) => (s.rpm = 2726));
    expect(monCell(container, "RPM")?.querySelector("b")?.className).toBe("bad");
    expect(monCell(container, "Power")?.querySelector("b")?.getAttribute("title")).toBeNull();
  });
});

describe("TIT from peak against the TIT bars (POH 4-22, 7-35)", () => {
  it("at the 10,000 ft cruise setup the monitor's TIT pk gives the side and the °F the bars rise to their peak when the mixture is swept, within 5 °F", () => {
    const x = scenarioById(K, "cruise")!.run(K);
    const f = noFailures(K);
    settle(K, x.s, x.c, x.env, f, 20);
    // what the monitor shows for this state
    const sim = fresh(K);
    replaceState(sim, structuredClone(x.s));
    const { container } = render(<Monitor sim={sim} />);
    const shown = monCell(container, "TIT pk")?.querySelector("b")?.textContent ?? "";
    // the bars: the mean of the two probes (turbo.ts titTargets), read over 10 s (the controller hunts at part throttle)
    const bars = () => {
      let sum = 0;
      for (let i = 0; i < 40; i++) {
        settle(K, x.s, x.c, x.env, f, 0.25);
        sum += (x.s.tit![0] + x.s.tit![1]) / 2;
      }
      return sum / 40;
    };
    const meanLambda = () => x.s.cyl.reduce((a, c) => a + c.lambda, 0) / x.s.cyl.length;
    const m0 = x.c.mixture,
      lambda0 = meanLambda(),
      tit0 = bars();
    // sweep the mixture lever from the setting through the peak, settling at each step
    let peak = { tit: tit0, lambda: lambda0 };
    for (let r = 0.9; r <= 1.3001; r += 0.01) {
      x.c.mixture = m0 * r;
      settle(K, x.s, x.c, x.env, f, 15);
      const t = bars();
      if (t > peak.tit) peak = { tit: t, lambda: meanLambda() };
    }
    const below = peak.tit - tit0;
    const side = lambda0 > peak.lambda + 0.01 ? "LOP" : lambda0 < peak.lambda - 0.01 ? "ROP" : "peak";
    const [deg, word] = shown.split(" ");
    expect(word, `TIT pk "${shown}"; swept: ${below.toFixed(1)} °F ${side}`).toBe(side);
    expect(
      Math.abs(Number(deg) - below),
      `TIT pk "${shown}"; swept: ${below.toFixed(1)} °F ${side}`,
    ).toBeLessThanOrEqual(5);
  }, 120_000);
});

describe("cylinder pressure chart", () => {
  it("takes the exhaust pressure from the turbine inlet on the TSIO-550-K only", () => {
    const s = { ...initialState(K), rpm: 2500, map: 36, inletInHg: 29.9, turbineInletInHg: 42 };
    expect(chartInputs(K, s).exhaust).toBe(42);
    expect(chartInputs(IO390, s).exhaust).toBeCloseTo(29.9 * 1.02, 10);
  });

  it("cites M-18 Table 2-1 for the spark and both magnetos at START (POH 7-37; AMM 74-00)", () => {
    const at = { firing: true, peakPsi: 900, peakAtdc: 15 };
    expect(chartCaption(K, { ...at, mags: "BOTH", advance: 24 })).toContain(
      "spark at 24° before (Continental M-18 Table 2-1 p. 2-24: 24° BTC ± 1°)",
    );
    expect(chartCaption(K, { ...at, mags: "START", advance: 0 })).toContain("both magnetos fire at top centre");
    expect(chartCaption(K, { ...at, firing: false, mags: "OFF", advance: 24 })).toContain(
      "it is not measured Continental data.",
    );
  });

  it.each([
    { spec: IO390, name: "IO-390", advance: 20 },
    { spec: O360, name: "O-360", advance: 25 },
  ])("keeps the caption on the $name page, running and stopped", ({ spec, advance }) => {
    const at = { firing: true, peakPsi: 900, peakAtdc: 15 };
    const tail =
      "The trace is the model's work per cycle drawn as pressure, with an assumed burn duration; it is not measured " +
      "Lycoming data.";
    expect(chartCaption(spec, { ...at, mags: "BOTH", advance })).toBe(
      `Peak 900 psia at 15° after top centre, spark at ${advance}° before (IOM Table A-1). ${tail}`,
    );
    expect(chartCaption(spec, { ...at, mags: "START", advance: -0 })).toBe(
      "Peak 900 psia at 15° after top centre, spark retarded to 0° after top centre for the start (an assumed angle: " +
        `the IOM does not give one). ${tail}`,
    );
    expect(chartCaption(spec, { ...at, firing: false, mags: "OFF", advance })).toBe(
      `Not firing: the trace is compression and expansion of the charge alone. ${tail}`,
    );
  });
});

describe.each([
  { spec: IO390, name: "IO-390", advance: 20 },
  { spec: O360, name: "O-360", advance: 25 },
])("the $name pressure chart caption", ({ spec, advance }) => {
  const tail =
    "The trace is the model's work per cycle drawn as pressure, with an assumed burn duration; it is not measured " +
    "Lycoming data.";
  const caption = (c: HTMLElement) => [...c.querySelectorAll("p.small")].at(-1)?.textContent;

  it("reads as before with the engine stopped", () => {
    const { container } = render(<PressureChart sim={fresh(spec)} />);
    expect(caption(container)).toBe(`Not firing: the trace is compression and expansion of the charge alone. ${tail}`);
    // two text runs, as before
    const p = [...container.querySelectorAll("p.small")].at(-1)!;
    expect([...p.childNodes].map((n) => n.textContent)).toEqual([
      "Not firing: the trace is compression and expansion of the charge alone. ",
      tail,
    ]);
  });

  it("reads as before with cylinder 1 firing on both magnetos", () => {
    const sim = fresh(spec);
    act(() => sim.useUi.getState().setControls({ mags: "BOTH" }));
    sim.s.rpm = 2400;
    Object.assign(sim.s.cyl[0], { work: 0.9, hp: 40, plugs: 2 });
    const { container } = render(<PressureChart sim={sim} />);
    expect(caption(container)).toMatch(
      new RegExp(
        `^Peak \\d+ psia at \\d+° after top centre, spark at ${advance}° before \\(IOM Table A-1\\)\\. ` +
          tail.replace(/[.;()]/g, "\\$&") +
          "$",
      ),
    );
  });
});

describe("text in the shared engine components", () => {
  const sources = import.meta.glob(
    [
      "../../components/engine/EnginePanel.tsx",
      "../../components/engine/Monitor.tsx",
      "../../components/engine/PressureChart.tsx",
      "../../components/engine/EngineApp.tsx",
    ],
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;

  it.each(Object.entries(sources))("%s names no manufacturer, manual or cylinder count", (_, text) => {
    // the caption's own words stay for the engines whose spec cites no timing source
    text = text.replace(/const DEFAULT_CAPTION = \{[^}]*\};/, "");
    expect(text).not.toMatch(/Lycoming|Continental|\bIOM\b/);
    expect(text.replace(/\bfour[- ]strokes?\b/gi, "")).not.toMatch(/\b(four|six|eight)\b/i);
  });
});
