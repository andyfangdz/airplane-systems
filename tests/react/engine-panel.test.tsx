// vitest: isolate
/**
 * The engine page's panel, monitor and pressure chart for the TSIO-550-K (SR22T POH 13772-007 Reissue A) against the IO-390 and
 * O-360 pages, which stay as they were. Each case renders the compiled component (vitest.react.config.mts).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshLiveSnapshot } from "@/lib/useLiveSnapshot";
import { markingBand } from "@/engines/model/alerts";
import { initialState } from "@/engines/model/engine";
import { egtOffset } from "@/engines/model/mixture";
import { labelOf, scenariosFor } from "@/engines/model/scenarios";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";
import { EnginePanel } from "@/components/engine/EnginePanel";
import { Flags, Monitor, bandTone, titFromPeak } from "@/components/engine/Monitor";
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

  it("draws a red X on the bar of a failed TIT probe (POH 7-32, 3-31)", () => {
    const sim = fresh(K);
    const { container } = render(<Monitor sim={sim} />);
    act(() => sim.useUi.getState().setFailures({ titProbe: [true, false] }));
    const [l, r] = container.querySelectorAll(".mon-tit");
    expect(l.querySelector(".x")).not.toBeNull();
    expect(l.firstElementChild?.textContent).toBe("X");
    expect(r.querySelector(".x")).toBeNull();
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

  it("puts TIT from peak where EGT from peak is for an even mixture", () => {
    for (const lam of [0.85, 1.0, 1.1]) {
      const t = titFromPeak(Array(6).fill(lam))!;
      expect(t.off).toBeCloseTo(-egtOffset(lam), 0);
      expect(t.side).toBe(lam < 0.99 ? "ROP" : lam > 1.01 ? "LOP" : "peak");
    }
    const spread = titFromPeak([0.95, 1.0, 1.05, 1.1, 1.15, 1.2])!;
    expect(Number.isFinite(spread.off) && spread.off >= 0).toBe(true);
    expect(titFromPeak([Infinity, Infinity])).toBeNull();
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
    const t = titFromPeak(Array(6).fill(0.5), rich)!;
    expect(t.off).toBeCloseTo(off, 0);
    expect(t.side).toBe("ROP");
    const r = fromPeakAt(K, 0.5);
    expect(r.cells).toEqual(Array(6).fill(`${Math.round(off)} R`));
    expect(r.peak).toBe(`${Math.round(off)} ROP`);
    expect(r.tit).toBe(`${Math.round(t.off)} ROP`);
  });

  it("keeps the IO-390's from-peak readings on the default rich edge", () => {
    expect(IO390.calibration.richMisfireLambda).toBeUndefined();
    const off = -egtOffset(0.5, 0.55);
    expect(titFromPeak(Array(4).fill(0.5))!.off).toBeCloseTo(off, 6);
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

/** The Failures section: from its heading to the cylinder table. */
const failuresOf = (c: HTMLElement) => {
  const h = [...c.querySelectorAll("h3")].find((x) => x.textContent === "Failures")!;
  const out: Element[] = [];
  for (let e = h.nextElementSibling; e && e.tagName !== "H3"; e = e.nextElementSibling) out.push(e);
  return out;
};
const failureChecks = (c: HTMLElement) => failuresOf(c).filter((e) => e.classList.contains("eng-checks"));

const TURBO_FAILURES = [
  ["f-wg-closed", "Wastegate stuck closed", K.refs.relief],
  ["f-wg-open", "Wastegate stuck open", K.refs.lossOfMap],
  ["f-wg-oil", "Actuator oil loss", K.refs.lossOfMap],
  ["f-misadjust", "Controller misadjusted", K.refs.manPressure],
  ["f-turbo-l", "Turbocharger failed L", K.refs.lossOfMap],
  ["f-turbo-r", "Turbocharger failed R", K.refs.lossOfMap],
  ["f-ic-l", "Intercooler leak L", K.refs.lossOfMap],
  ["f-ic-r", "Intercooler leak R", K.refs.lossOfMap],
  ["f-ind-leak", "Induction leak", K.refs.lossOfMap],
  ["f-exh-leak", "Exhaust leak", K.refs.lossOfMap],
  ["f-tit-l", "TIT probe failed L", K.refs.sensorFailure],
  ["f-tit-r", "TIT probe failed R", K.refs.sensorFailure],
  ["f-oil-leak", "Oil leak", K.refs.lossOfMap],
] as const;

describe("TSIO-550-K failures (POH 3-27 to 3-31, 3-49, 3A-8 to 3A-11, 4-17, 7-37)", () => {
  it("groups the turbo-system failures under a Turbo system sub-heading, after the general ones", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    const section = failuresOf(container);
    const sub = section.find((e) => e.tagName === "H4");
    expect(sub?.textContent).toBe("Turbo system");
    const grids = failureChecks(container);
    expect(grids).toHaveLength(2);
    expect(section.indexOf(grids[0])).toBeLessThan(section.indexOf(sub!));
    expect(section.indexOf(sub!)).toBeLessThan(section.indexOf(grids[1]));
    expect([...grids[1].querySelectorAll("label.chk")].map((l) => l.textContent)).toEqual(
      TURBO_FAILURES.map(([, label]) => label),
    );
  });

  it("titles each turbo-system failure with its POH page (POH 3-27, 3-28 causes 1-4; 3-29, 3-30; 3A-9; 3-31)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    for (const [id, , ref] of TURBO_FAILURES) {
      const title = container.querySelector(`#${id}`)?.closest("label")?.getAttribute("title") ?? "";
      expect(ref, id).toBeTruthy();
      expect(title.endsWith(` · ${ref}`), `${id}: ${title}`).toBe(true);
    }
    const cause = (id: string) => container.querySelector(`#${id}`)?.closest("label")?.getAttribute("title");
    expect(cause("f-ind-leak")).toContain("cause 1");
    expect(cause("f-exh-leak")).toContain("cause 2");
    expect(cause("f-oil-leak")).toContain("cause 3");
    expect(cause("f-turbo-l")).toContain("cause 4");
  });

  it("sets each failure from its box; the seized gate is either open or closed", () => {
    const sim = fresh(K);
    const { container } = render(<EnginePanel sim={sim} />);
    const f = () => sim.useUi.getState().failures;
    const tick = (id: string) => fireEvent.click(container.querySelector(`#${id}`)!);
    const checked = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement).checked;
    tick("f-wg-closed");
    expect(f().wastegateSeized).toBe("closed");
    tick("f-wg-open");
    expect(f().wastegateSeized).toBe("open");
    expect([checked("f-wg-closed"), checked("f-wg-open")]).toEqual([false, true]);
    tick("f-wg-open");
    expect(f().wastegateSeized).toBeNull();
    for (const id of ["f-wg-oil", "f-misadjust", "f-ind-leak", "f-exh-leak", "f-oil-leak"]) tick(id);
    expect([f().wastegateOil, f().controllerMisadjust, f().inductionLeak, f().exhaustLeak, f().oilLeak]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    tick("f-turbo-r");
    tick("f-ic-l");
    tick("f-tit-r");
    expect([f().turboInternal, f().intercoolerLeak, f().titProbe]).toEqual([
      [false, true],
      [true, false],
      [false, true],
    ]);
    tick("f-turbo-l");
    expect(f().turboInternal).toEqual([true, true]);
  });

  it("names the filter for the automatic door: Induction filter blocked (ice or debris) (POH 3A-11, 7-37)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    const label = container.querySelector("#f-filter")?.closest("label");
    expect(label?.textContent).toBe("Induction filter blocked (ice or debris)");
    expect(label?.getAttribute("title")).toBe(`The alternate-air door opens by itself · ${K.refs.altAirOpen}`);
    expect(container.querySelector("#f-starter-stuck")?.closest("label")?.getAttribute("title")).toContain(
      K.limits.startEngaged!.src,
    );
  });

  it("offers nozzle blockage for the continuous-flow injection, one per cylinder (M-18 2-1)", () => {
    const { container } = render(<EnginePanel sim={fresh(K)} />);
    expect([...container.querySelectorAll(".eng-fail th")].map((th) => th.textContent)).toContain("Nozzle blocked");
    expect(container.querySelectorAll('input[aria-label$="nozzle blockage"]')).toHaveLength(6);
  });

  it("shows the oil lost overboard and what is left, yellow below six quarts (POH 3-28 cause 3; 4-8)", () => {
    const sim = fresh(K);
    render(<EnginePanel sim={sim} />);
    act(() => sim.useUi.getState().setEnv({ oilQt: 7 }));
    expect(reading("Oil lost overboard")).toBe("0.0 qt (7.0 qt left)");
    live(sim, (s) => (s.oilLossQt = 1.25));
    expect(reading("Oil lost overboard")).toBe("1.3 qt (5.8 qt left)");
    const b = screen.getByText("Oil lost overboard", { selector: ".ro > span" }).parentElement?.querySelector("b");
    expect(b?.className).toBe("warnc");
  });

  // the IO-390 and O-360 failures lists stay as they were
  it.each([
    { spec: IO390, headers: ["Cyl", "Top plug", "Bottom plug", "Nozzle blocked", "Intake leak"] },
    { spec: O360, headers: ["Cyl", "Top plug", "Bottom plug", "Intake leak"] },
  ])("keeps the $spec.name failures list", ({ spec, headers }) => {
    const { container } = render(<EnginePanel sim={fresh(spec)} />);
    const grids = failureChecks(container);
    expect(grids).toHaveLength(1);
    expect([...grids[0].querySelectorAll("label.chk")].map((l) => l.textContent)).toEqual([
      "Left magneto",
      "Right magneto",
      "Engine-driven fuel pump",
      "Air filter blocked",
      "Starter",
      "Starter stuck engaged",
    ]);
    expect([...grids[0].querySelectorAll("label")].filter((l) => l.hasAttribute("title"))).toEqual([]);
    expect(failuresOf(container).some((e) => e.tagName === "H4")).toBe(false);
    expect([...container.querySelectorAll(".eng-fail th")].map((th) => th.textContent)).toEqual(headers);
    expect(screen.queryByText("Oil lost overboard", { selector: ".ro > span" })).toBeNull();
  });
});

describe("limit flags on the page (POH 2-9, 3-29 to 3-31, 4-22)", () => {
  const items = (c: HTMLElement) => [...c.querySelectorAll(".eng-flags li")];

  it("leaves out a failed TIT probe's side: it reads nothing (POH 3-31)", () => {
    const sim = fresh(K);
    const { container } = render(<Flags sim={sim} />);
    live(sim, (s) => (s.tit = [1760, 1760]));
    expect(items(container).find((li) => li.textContent?.startsWith("TIT:"))?.textContent).toContain(
      "L 1,760 °F and R 1,760 °F",
    );
    act(() => sim.useUi.getState().setFailures({ titProbe: [false, true] }));
    const tit = items(container).filter((li) => li.textContent?.startsWith("TIT:"));
    expect(tit).toHaveLength(1);
    expect(tit[0].textContent).toContain("L 1,760 °F");
    expect(tit[0].textContent).not.toContain("R 1,760");
  });

  it("flags leaning above 30.5 in.Hg, held for the dwell, as a study advisory (POH 4-22)", () => {
    const sim = fresh(K);
    const { container } = render(<Flags sim={sim} />);
    act(() => sim.useUi.getState().setControls({ mixture: 0.8 }));
    // the engine's leaning timer has latched (engines/model/alerts.ts LEAN_DWELL_S)
    live(sim, (s) =>
      Object.assign(s, { running: true, rpm: 2500, oilP: 45, oilT: 180, map: 31.0, leanOverS: 3, leanOver: true }),
    );
    const lean = items(container).find((li) => li.textContent?.startsWith("Leaned at"));
    expect(lean?.textContent).toBe("Leaned at 31.0 in.Hg: cruise leaning only at 30.5 in.Hg or less");
    expect(lean?.className).toBe("adv");
  });

  it("puts the CAS name first in a POH annunciation, and shows the study limits as advisories (POH 2-9, 3-29, 3-30)", () => {
    const sim = fresh(K);
    const { container } = render(<Flags sim={sim} />);
    live(sim, (s) => Object.assign(s, { map: 37.8, reliefOpen: true }));
    const man = items(container).find((li) => li.textContent?.startsWith("MAN PRESSURE"))!;
    expect(man.className).toBe("warn");
    expect(man.firstElementChild?.tagName).toBe("B");
    expect(man.firstElementChild?.textContent).toBe("MAN PRESSURE");
    expect(man.textContent).toBe("MAN PRESSURE: 37.8 in.Hg, above the 37.5 in.Hg band edge (POH 13772-007 2-9)");
    const relief = items(container).find((li) => li.textContent?.startsWith("Overboost relief valve open"))!;
    expect(relief.className).toBe("adv");
    expect(relief.querySelector("b")).toBeNull();
    live(sim, (s) => Object.assign(s, { map: 37.0, reliefOpen: false }));
    expect(items(container).map((li) => li.className)).toEqual(["caut"]);
  });

  it("captions the -K's flags as study flags, not the airplane's CAS; the IO-390's list is as it was", () => {
    const sim = fresh(K);
    const { container } = render(<Flags sim={sim} />);
    const box = () => container.querySelector(".eng-flags") as HTMLElement;
    expect(box().hidden).toBe(true);
    live(sim, (s) => (s.map = 37.0));
    expect(box().hidden).toBe(false);
    expect(box().getAttribute("aria-label")).toBe("Limits exceeded");
    expect(box().querySelector(".hd")?.textContent).toBe("Study flags, not the airplane's CAS");
    cleanup();
    const io = fresh(IO390);
    const r = render(<Flags sim={io} />);
    live(io, (s) => (s.rpm = 2800));
    const ul = r.container.querySelector("ul.eng-flags")!;
    expect(ul.querySelector(".hd")).toBeNull();
    const rows = [...ul.children];
    expect(rows.find((li) => li.textContent?.startsWith("Overspeed"))?.className).toBe("warn");
    for (const li of rows) {
      expect(li.tagName).toBe("LI");
      expect(["warn", "caut"]).toContain(li.className);
      expect([...li.childNodes].map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
    }
  });

  it("renders every flag at once without a duplicate React key", () => {
    const sim = fresh(K);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Flags sim={sim} />);
    act(() => {
      sim.useUi.getState().setEnv({ oilQt: 5 });
      sim.useUi.getState().setControls({ mixture: 0.5 });
    });
    live(sim, (s) => {
      Object.assign(s, {
        running: true,
        rpm: 2600,
        map: 38,
        oilP: 5,
        oilT: 245,
        pct: 75,
        tit: [1860, 1800],
        titOverS: 40,
        turboRpm: [130000, 130000],
        starterS: 31,
        altAirOpen: true,
        reliefOpen: true,
      });
      s.cyl.forEach((c) => (c.cht = 470));
    });
    expect(document.querySelectorAll(".eng-flags li").length).toBeGreaterThan(10);
    expect(errors.mock.calls.filter((c) => /same key/.test(String(c[0])))).toEqual([]);
    errors.mockRestore();
  });

  it("colours each -K gauge by the band its flag reads, at every band edge (one predicate)", () => {
    const tone = { green: "", yellow: "warnc", red: "bad" } as const;
    for (const m of K.markings!)
      for (const b of m.bands)
        for (const v of [b.from - 0.05, b.from, b.from + 0.05, b.to - 0.05, b.to, b.to + 0.05]) {
          const band = markingBand(m, v);
          expect(bandTone(K, m.gauge, v), `${m.gauge} ${v}`).toBe(band ? tone[band.color] : "");
        }
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
