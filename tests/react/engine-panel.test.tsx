// vitest: isolate
/**
 * The engine page's panel and pressure chart for the TSIO-550-K (SR22T POH 13772-007 Reissue A) against the IO-390 and
 * O-360 pages, which stay as they were. Each case renders the compiled component (vitest.react.config.mts).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshLiveSnapshot } from "@/lib/useLiveSnapshot";
import { initialState } from "@/engines/model/engine";
import { labelOf, scenariosFor } from "@/engines/model/scenarios";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";
import { EnginePanel } from "@/components/engine/EnginePanel";
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
