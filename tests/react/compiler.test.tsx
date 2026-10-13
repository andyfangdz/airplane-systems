import { act, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshLiveSnapshot, useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { beginParts, endParts, publishParts } from "@/lib/build";
import { BuiltPartNames } from "./fixtures";
import { Catalogue } from "@/lib/catalogue";
import { box } from "@/lib/geometry";
import { SR20 } from "@/aircraft/sr20";
import { SR22T } from "@/aircraft/sr22t";
import { C172S } from "@/aircraft/c172s";
import { C182T } from "@/aircraft/c182t";
import { DA40 } from "@/aircraft/da40";
import { M20C } from "@/aircraft/m20c";
import { live as sr20 } from "@/aircraft/sr20/model";
import { live as sr22t } from "@/aircraft/sr22t/model";
import { live as c172 } from "@/aircraft/c172s/model";
import { live as c182 } from "@/aircraft/c182t/model";
import { live as da40, TO_TRIM } from "@/aircraft/da40/model";
import { live as m20c } from "@/aircraft/m20c/model";
import { useC172 } from "@/aircraft/c172s/store";
import { useC182 } from "@/aircraft/c182t/store";
import { useDA40 } from "@/aircraft/da40/store";
import { useM20C } from "@/aircraft/m20c/store";
import type { StoreApi } from "zustand";
import { useView } from "@/lib/view";
import { PartsList } from "@/components/ui/controls";
import { useSR20 } from "@/aircraft/sr20/store";
import { useSR22T } from "@/aircraft/sr22t/store";
import { CAT as sr20Parts } from "@/aircraft/sr20/parts";
import { CAT as da40Parts } from "@/aircraft/da40/parts";

let host: HTMLDivElement;
let root: Root;
const sources = [sr20, sr22t, c172, c182, da40, m20c];
const initial = sources.map((source) => structuredClone(source));
function resetter<T>(store: StoreApi<T>) {
  const initial = store.getState();
  return () => store.setState(initial, true);
}
const resetStores = [
  resetter(useSR20),
  resetter(useSR22T),
  resetter(useC172),
  resetter(useC182),
  resetter(useDA40),
  resetter(useM20C),
  resetter(useView),
];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.useFakeTimers();
  // jsdom has no canvas renderer; browser checks cover the instrument displays.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  sources.forEach((source, i) => Object.assign(source, structuredClone(initial[i])));
  resetStores.forEach((reset) => reset());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = (node: ReactNode) => act(() => root.render(node));
const sample = (ms = 500) => act(() => vi.advanceTimersByTime(ms));
const reading = (label: string) =>
  [...host.querySelectorAll(".ro")].find((row) => row.querySelector("span")?.textContent === label)?.querySelector("b")
    ?.textContent;

describe("compiled fleet panels", () => {
  for (const [aircraft, live, store] of [
    [SR20, sr20, useSR20],
    [SR22T, sr22t, useSR22T],
  ] as const) {
    it(`${aircraft.id} publishes CAPS timeline, playback and reset actions before the next sample`, () => {
      live.capsT = -1;
      live.capsPlaying = false;
      store.getState().update((s) => {
        s.capsOn = false;
      });
      useView.setState({ sys: "caps" });
      const Panel = aircraft.panels.caps!;
      const Hud = aircraft.Hud!;
      function Playback() {
        const snapshot = useLiveSnapshot(live, 100);
        return <span data-playback>{snapshot.capsPlaying ? "playing" : "paused"}</span>;
      }
      render(
        <>
          <Panel />
          <Hud />
          <Playback />
        </>,
      );
      const timeline = host.querySelector<HTMLInputElement>("#capsT")!;
      const output = () => host.querySelector('label[for="capsT"] output')?.textContent;
      const click = (name: string) =>
        act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === name)!.click());
      const scrub = (value: number) =>
        act(() => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(timeline, String(value));
          timeline.dispatchEvent(new Event("input", { bubbles: true }));
        });
      scrub(6);
      expect(live.capsT).toBe(6);
      expect(Number(timeline.value)).toBe(6);
      expect(output()).toBe("T+6.0 s");
      scrub(9);
      expect(output()).toBe("T+9.0 s");
      click("Pull the handle");
      expect(output()).toBe("T+0.0 s");
      expect(host.querySelector("[data-playback]")?.textContent).toBe("playing");
      click("Pause / play");
      expect(host.querySelector("[data-playback]")?.textContent).toBe("paused");
      scrub(4);
      click("Reset");
      expect(output()).toBe("T+0.0 s");
      expect(host.querySelector(".caps-hud b")?.textContent).toBe("Ready");
      click("Pause / play");
      expect(host.querySelector(".caps-hud b")?.textContent).not.toBe("Ready");
      expect(host.querySelector("[data-playback]")?.textContent).toBe("playing");
    });
  }

  it("publishes DA40 takeoff trim before the next polling interval", () => {
    da40.afcs.trim = 0.8;
    const Panel = DA40.panels.controls!;
    render(<Panel />);
    const trim = host.querySelector<HTMLInputElement>("#trimW")!;
    expect(Number(trim.value)).toBe(0.8);
    const takeoff = [...host.querySelectorAll("button")].find((button) => button.textContent === "Trim to takeoff")!;
    act(() => takeoff.click());
    expect(da40.afcs.trim).toBe(TO_TRIM);
    expect(Number(trim.value)).toBe(TO_TRIM);
  });

  for (const [aircraft, live] of [
    [C172S, c172],
    [C182T, c182],
    [DA40, da40],
  ] as const) {
    it(`${aircraft.id} publishes repeated heading-knob edits before the next polling interval`, () => {
      live.fs.hdgBug = 180;
      const Panel = aircraft.panels.autopilot!;
      render(<Panel />);
      const knob = [...host.querySelectorAll(".avx-knob")].find((node) => node.textContent?.startsWith("HDG knob"))!;
      const increment = [...knob.querySelectorAll("button")].find((button) => button.textContent === "+1")!;
      act(() => increment.click());
      act(() => increment.click());
      expect(live.fs.hdgBug).toBe(182);
      expect(knob.querySelector("b")?.textContent).toBe("182°");
    });
  }

  for (const [aircraft, live] of [
    [SR20, sr20],
    [SR22T, sr22t],
    [C172S, c172],
    [C182T, c182],
    [DA40, da40],
    [M20C, m20c],
  ] as const) {
    it(`${aircraft.id} keeps RPM current without a discrete store update`, () => {
      live.rpm = 900;
      const Panel = aircraft.panels.propeller!;
      render(<Panel />);
      expect(reading("RPM")).toBe("900");
      live.rpm = 2400;
      sample();
      expect(reading("RPM")).toBe("2400");
    });
  }

  for (const [aircraft, live, store, powerUp] of [
    [C172S, c172, useC172, () => useC172.setState({ E: { ...useC172.getState().E, pfd: true } })],
    [C182T, c182, useC182, () => useC182.setState({ E: { ...useC182.getState().E, pfd: true } })],
  ] as const) {
    it(`${aircraft.id} refreshes CO annunciations with stable switches and electrical state (POH 7-51)`, () => {
      live.coPpm = 0;
      powerUp();
      const state = store.getState();
      render(<aircraft.Alerts />);
      expect(host.textContent).not.toContain("CO LVL HIGH");
      live.coPpm = 100;
      sample();
      expect(store.getState()).toBe(state);
      expect(host.textContent).toContain("CO LVL HIGH");
    });
  }

  it("DA40 refreshes oil pressure alerts without an electrical update (G1000 AFMS §2.6)", () => {
    da40.oilP = 60;
    useDA40.setState({ E: { ...useDA40.getState().E, pfd: true, gea: true, gia1: true } });
    render(<DA40.Alerts />);
    expect(host.textContent).not.toContain("OIL PRES LO");
    da40.oilP = 10;
    sample();
    expect(host.textContent).toContain("OIL PRES LO");
  });

  it("M20C refreshes gear lamps as the mechanism moves (OM p. 6)", () => {
    m20c.gearFrac = 0;
    useM20C.getState().update((s) => {
      s.gear.lever = "DOWN";
    });
    useM20C.setState({ E: { ...useM20C.getState().E, bus: 12, gearWarn: true } });
    render(<M20C.Alerts />);
    expect(host.textContent).toContain("GEAR DOWN (green)");
    m20c.gearFrac = 0.5;
    sample();
    expect(host.textContent).toContain("GEAR UNSAFE (red)");
    expect(host.textContent).not.toContain("GEAR DOWN (green)");
  });

  it("updates the CAPS timeline HUD while the view state stays fixed", () => {
    const previous = useView.getState();
    useView.setState({ sys: "caps" });
    sr20.capsT = 1;
    const Hud = SR20.Hud!;
    render(<Hud />);
    expect(host.textContent).toContain("1.0 s");
    sr20.capsT = 8;
    sample(100);
    expect(host.textContent).toContain("8.0 s");
    act(() => useView.setState(previous));
  });
});

describe("simulation snapshots", () => {
  it("updates optional equipment lists without a parent rerender", () => {
    const previous = useSR20.getState();
    useSR20.getState().update((s) => {
      s.avx.dualAdahrs = true;
    });
    render(<PartsList cat={sr20Parts} sys="avionics" />);
    expect(host.textContent).toContain("GSU 75 ADAHRS 2 (optional)");
    act(() =>
      useSR20.getState().update((s) => {
        s.avx.dualAdahrs = false;
      }),
    );
    expect(host.textContent).not.toContain("GSU 75 ADAHRS 2 (optional)");
    act(() => useSR20.setState(previous, true));
    expect(host.textContent).toContain("GSU 75 ADAHRS 2 (optional)");
  });

  it("updates DA40 optional ventilation lists when equipment changes", () => {
    useDA40.getState().update((s) => {
      s.env.extraVents = false;
    });
    render(<PartsList cat={da40Parts} sys="environment" />);
    expect(host.textContent).not.toContain("Panel air nozzle");
    act(() =>
      useDA40.getState().update((s) => {
        s.env.extraVents = true;
      }),
    );
    expect(host.textContent).toContain("Panel air nozzle");
  });

  it("detaches nested state, shares a timer, publishes edits, and stops after the last subscriber", () => {
    const source = { fs: { altitude: 1000 }, lamps: [false] };
    let first: typeof source;
    function Probe() {
      const snapshot = useLiveSnapshot(source, 100);
      first ??= snapshot;
      return <span>{snapshot.fs.altitude}</span>;
    }
    render(
      <StrictMode>
        <Probe />
        <Probe />
      </StrictMode>,
    );
    expect(vi.getTimerCount()).toBe(1);
    source.fs.altitude = 2000;
    sample(100);
    expect(host.textContent).toBe("20002000");
    expect(first!.fs.altitude).toBe(1000);
    source.fs.altitude = 3000;
    act(() => refreshLiveSnapshot(source));
    expect(host.textContent).toBe("30003000");
    render(null);
    expect(vi.getTimerCount()).toBe(0);
    source.fs.altitude = 4000;
    render(<Probe />);
    expect(host.textContent).toBe("4000");
  });

  it("publishes successive part batches and restores all parts after a progressive build", () => {
    const cat = new Catalogue("compiler-probe");
    const a = cat.part(() => box(1, 1, 1), ["fuel"], { name: "A" });
    const b = cat.part(() => box(1, 1, 1), ["fuel"], { name: "B" });
    const building = beginParts(cat);
    render(<BuiltPartNames cat={cat} />);
    expect(host.textContent).toBe("");
    building.add(a);
    act(() => publishParts(cat, building));
    expect(host.textContent).toBe("A");
    building.add(b);
    act(() => publishParts(cat, building));
    expect(host.textContent).toBe("A,B");
    act(() => endParts(cat));
    expect(host.textContent).toBe("A,B");
  });
});
