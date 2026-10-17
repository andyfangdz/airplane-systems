/** Reversible study sessions: engine safety, cumulative switch history and independent saved progress. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Mesh, PerspectiveCamera, Vector3 } from "three";
import type { StoreApi, UseBoundStore } from "zustand";
import "@/aircraft";
import type { FleetWalkController } from "@/lib/fleet-walk-store";
import { assignLive } from "@/lib/simulation";
import type { SimStore } from "@/lib/simStore";
import { flashFocus, useAircraftHover, useView } from "@/lib/view";
import { markAircraftSceneReady, mountAircraftSession, type AircraftSession } from "@/lib/aircraft-session";
import { aircraft, selectAircraft, selectSys } from "@/lib/fleet";
import { partObjects, registerPart, registerSceneCamera, view as scene } from "@/lib/registry";
import { walkController as c172 } from "@/aircraft/c172s/walk-store";
import { walkController as c182 } from "@/aircraft/c182t/walk-store";
import { walkController as da40 } from "@/aircraft/da40/walk-store";
import { walkController as mooney } from "@/aircraft/m20c/walk-store";
import { initialSim as s172, live as l172, solve as solve172 } from "@/aircraft/c172s/model";
import { initialSim as s182, live as l182, solve as solve182 } from "@/aircraft/c182t/model";
import { initialSim as sDiamond, live as lDiamond, solve as solveDiamond } from "@/aircraft/da40/model";
import { initialSim as sMooney, live as lMooney, solve as solveMooney } from "@/aircraft/m20c/model";
import { c172Runtime, useC172 } from "@/aircraft/c172s/store";
import { useC182 } from "@/aircraft/c182t/store";
import { useDA40 } from "@/aircraft/da40/store";
import { useM20C } from "@/aircraft/m20c/store";

const controllers = [c172, c182, da40, mooney];
let routeSession: AircraftSession | null = null;
beforeEach(() => {
  routeSession?.dispose();
  routeSession = null;
  controllers.forEach((c) => c.close());
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
  useView.setState({
    ac: "sr20",
    session: null,
    selectedSys: "overview",
    sys: "overview",
    walking: false,
    cam: null,
    focus: null,
    spot: null,
    xray: true,
    labels: true,
    spin: false,
    ctrlFocus: "all",
  });
});
afterEach(() => {
  routeSession?.dispose();
  routeSession = null;
  controllers.forEach((c) => c.close());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openRoute(id: "c172s" | "c182t", sys: "fuel" | "engine" = "fuel") {
  routeSession = mountAircraftSession(aircraft(id));
  selectAircraft(id, sys);
  return routeSession;
}

function browserLocation(pathname: string) {
  const location = { pathname, search: "" };
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", {
    state: { route: "retained" },
    replaceState: (_state: unknown, _unused: string, path: string) => {
      location.pathname = path.split("?")[0];
    },
  });
  return location;
}

describe("mounted aircraft session ownership", () => {
  it("owns scene readiness across replacement and ignores stale scene completion", () => {
    browserLocation("/c172s/fuel");
    const previous = openRoute("c172s");
    markAircraftSceneReady(previous.owner);
    expect(useView.getState().sceneReady).toBe(previous.owner);
    const current = openRoute("c172s");
    expect(useView.getState().sceneReady).toBeNull();
    markAircraftSceneReady(previous.owner);
    expect(useView.getState().sceneReady).toBeNull();
    markAircraftSceneReady(current.owner);
    expect(useView.getState().sceneReady).toBe(current.owner);
    current.dispose();
    markAircraftSceneReady(current.owner);
    expect(useView.getState().sceneReady).toBeNull();
  });
  it("runs walk steps on a fork while the original runtime and its clock remain untouched", () => {
    browserLocation("/c172s/fuel");
    const route = openRoute("c172s");
    const original = c172Runtime.current();
    const checkpoint = original.checkpoint();
    const nested = original.live.fs;
    c172.open();
    c172.begin();
    c172.goStep(6);
    const child = c172Runtime.current();
    expect(c172Runtime.current()).not.toBe(original);
    expect(c172Runtime.current().live.fs).not.toBe(nested);
    route.advance(0.5);
    expect(original.checkpoint()).toEqual(checkpoint);
    c172.close();
    expect(child.disposed).toBe(true);
    expect(c172Runtime.current()).toBe(original);
    expect(c172Runtime.current().live.fs).toBe(nested);
    expect(original.checkpoint()).toEqual(checkpoint);
    route.dispose();
    route.advance(0.5); // an already queued RAF from the disposed route cannot step the retained runtime
    expect(original.checkpoint()).toEqual(checkpoint);
  });
  it("cancels a departed session's locate flash before another scene acquires focus", () => {
    vi.useFakeTimers();
    const route = openRoute("c172s");
    flashFocus("Fuel cap");
    vi.advanceTimersByTime(1000);
    route.dispose();
    expect(vi.getTimerCount()).toBe(0);
    openRoute("c182t");
    useView.setState({ focus: "Fuel cap" });
    vi.advanceTimersByTime(2600);
    expect(useView.getState().focus).toBe("Fuel cap");
    flashFocus("Fuel tank");
    vi.advanceTimersByTime(2600);
    expect(useView.getState().focus).toBeNull();
  });
  it("ignores a delayed study frame after the walk closes or another aircraft mounts", () => {
    const route = openRoute("c172s");
    c172.open();
    c172.begin();
    const step = c172.store.getState().steps[0];
    c172.close();
    const restored = useView.getState().cam;
    c172.frame(step);
    expect(useView.getState().cam).toBe(restored);
    route.dispose();
    openRoute("c182t");
    const replacement = useView.getState().cam;
    c172.frame(step);
    expect(useView.getState().cam).toBe(replacement);
  });
  it("pointer movement does not publish scene policy updates", () => {
    const sceneChanged = vi.fn();
    const unsubscribe = useView.subscribe(sceneChanged);
    useAircraftHover.getState().setHover({ name: "Fuel cap", note: "", color: "#000", x: 10, y: 20 });
    useAircraftHover.getState().setHover({ name: "Fuel cap", note: "", color: "#000", x: 11, y: 20 });
    unsubscribe();
    expect(sceneChanged).not.toHaveBeenCalled();
    useAircraftHover.getState().setHover(null);
  });
  it.each(["/engines/o360", "/components/carburetor"])(
    "leaving for %s checkpoints and releases the walk; returning offers a timed resume",
    (destination) => {
      const location = browserLocation("/c172s/fuel");
      const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
      const route = openRoute("c172s");
      const original = useC172.getState();
      c172.open();
      c172.begin();
      c172.goStep(4);
      clock.mockReturnValue(5000);
      location.pathname = destination;
      route.dispose();
      expect(useView.getState()).toMatchObject({ session: null, walking: false });
      expect(c172.session().prior).toBeNull();
      expect(c172.store.getState().since).toBeNull();
      expect(c172.logic.loadProgress()?.ms).toBe(4000);
      expect(useC172.getState().s).toBe(original.s);
      expect(useC172.getState().E).toBe(original.E);
      expect(location.pathname).toBe(destination);

      clock.mockReturnValue(105000);
      openRoute("c172s");
      c172.boot("");
      expect(c172.store.getState()).toMatchObject({ phase: "resume", since: null });
      c172.resume();
      expect(c172.elapsed(c172.store.getState())).toBe(4000);
      clock.mockRestore();
    },
  );

  it("keeps walk highlighting out of navigation and exits study for a system choice in the same session", () => {
    const location = browserLocation("/c172s/fuel");
    const route = openRoute("c172s");
    c172.open();
    c172.begin();
    useView.setState({ sys: "controls" }); // the walk's current scene filter
    expect(useView.getState().selectedSys).toBe("fuel");
    expect(location.pathname).toBe("/c172s/fuel");
    selectSys("electrical");
    expect(useView.getState()).toMatchObject({
      session: route.owner,
      walking: false,
      selectedSys: "electrical",
      sys: "electrical",
    });
    expect(location.pathname).toBe("/c172s/electrical");
    expect(c172.session().prior).toBeNull();
  });

  it("ignores a prior aircraft's camera and stale scene cleanup when the new route boots a walk", () => {
    browserLocation("/c172s/fuel");
    const first = openRoute("c172s");
    const oldCamera = new PerspectiveCamera(38, 1, 0.05, 400);
    oldCamera.position.set(37, 18, 21);
    const removeOldCamera = registerSceneCamera(first.owner, oldCamera, new Vector3(5, 4, 3));
    const oldPart = new Mesh();
    const removeOldPart = registerPart("Session test part", oldPart, true, first.owner);
    const second = openRoute("c182t");
    expect(scene.camera).toBeNull();
    expect(partObjects.has("Session test part")).toBe(false);
    const requested = useView.getState().cam;
    c182.open();
    c182.close();
    expect(useView.getState().cam).toBe(requested);

    const newCamera = new PerspectiveCamera(38, 1, 0.05, 400);
    const removeNewCamera = registerSceneCamera(second.owner, newCamera, new Vector3());
    const newPart = new Mesh();
    const removeNewPart = registerPart("Session test part", newPart, true, second.owner);
    registerSceneCamera(first.owner, oldCamera, new Vector3()); // a stale effect cannot register
    registerPart("Session test part", oldPart, true, first.owner);
    removeOldCamera();
    removeOldPart();
    first.dispose(); // delayed route cleanup must not close the newly mounted aircraft
    expect(useView.getState().session).toBe(second.owner);
    expect(scene.camera).toBe(newCamera);
    expect(partObjects.get("Session test part")).toBe(newPart);
    removeNewCamera();
    removeNewPart();
    expect(scene.camera).toBeNull();
    expect(partObjects.has("Session test part")).toBe(false);
  });
});
function sessions<
  S extends { eng: { running: boolean }; fuel: { qL: number; qR: number } },
  E,
  L extends { rpm: number; flapAng: number; fs: object },
>(
  controller: FleetWalkController<S>,
  sim: UseBoundStore<StoreApi<SimStore<S, E>>>,
  initial: S,
  solve: (s: S) => E,
  live: L,
) {
  const liveInitial = structuredClone(live);
  const { id, short } = controller.logic.data;
  describe(`${short} reversible study session`, () => {
    beforeEach(() => {
      const s = structuredClone(initial);
      sim.setState({ s, E: solve(s) });
      assignLive(live, structuredClone(liveInitial));
      useView.setState({ ac: id });
    });
    it("restores exact model/solution references, nested live identities, values and view", () => {
      sim.getState().update((s) => {
        s.fuel.qL = 13;
        s.fuel.qR = 12;
      });
      live.rpm = 2201;
      live.flapAng = 11;
      useView.setState({
        sys: "engine",
        xray: false,
        labels: true,
        spin: true,
        ctrlFocus: "rudder",
        focus: "inspection",
        spot: { names: ["inspection"], side: -1 },
        cam: { p: [5, 2, 3], t: [0, 0, 0], id: 42 },
      });
      const { s, E } = sim.getState(),
        savedLive = structuredClone(live),
        fsIdentity = live.fs,
        savedView = useView.getState();
      controller.open();
      controller.begin();
      expect(live.rpm).toBe(0);
      expect(sim.getState().s.eng.running).toBe(false);
      controller.goStep(controller.logic.steps.length - 1);
      controller.close();
      expect(sim.getState().s).toBe(s);
      expect(sim.getState().E).toBe(E);
      expect(live).toEqual(savedLive);
      expect(live.fs).toBe(fsIdentity);
      expect(useView.getState()).toMatchObject({
        sys: savedView.sys,
        xray: savedView.xray,
        labels: savedView.labels,
        spin: savedView.spin,
        ctrlFocus: savedView.ctrlFocus,
        focus: savedView.focus,
        spot: savedView.spot,
        cam: savedView.cam,
        walking: false,
      });
    });
    it("replays every source check without starting the engine or consuming the preserved fuel", () => {
      sim.getState().update((s) => {
        s.fuel.qL = 9;
        s.fuel.qR = 8;
      });
      controller.open();
      controller.begin();
      for (let at = 0; at < controller.logic.steps.length; at++) {
        controller.goStep(at);
        expect(sim.getState().s.eng.running, controller.logic.steps[at].item.id).toBe(false);
        expect(sim.getState().s.fuel).toMatchObject({ qL: 9, qR: 8 });
        expect(live.rpm).toBe(0);
      }
    });
    it("resumes progress and cumulative switches; switching aircraft closes only this session", () => {
      controller.open();
      controller.begin();
      controller.goStep(4);
      controller.mark("skip");
      controller.close();
      const saved = controller.logic.loadProgress();
      expect(saved?.marks[controller.logic.steps[4].item.id]).toBe("skip");
      controller.boot("");
      expect(controller.store.getState().phase).toBe("resume");
      controller.resume();
      expect(controller.store.getState().at).toBe(5);
      expect(sim.getState().s).toEqual(controller.logic.simAt(initial, 5));
      useView.setState({ ac: "sr22t" });
      expect(useView.getState().walking).toBe(false);
      expect(sim.getState().s.eng.running).toBe(initial.eng.running);
      expect(controller.logic.loadProgress()?.at).toBe(controller.logic.steps[5].item.id);
    });
    it("remembers completion through review and stays usable when storage is blocked", () => {
      controller.open();
      controller.begin();
      controller.goStep(controller.logic.steps.length - 1);
      controller.mark("ok");
      expect(controller.logic.loadProgress()?.done).toBe(true);
      controller.goStep(0);
      controller.mark("skip");
      controller.close();
      controller.boot("");
      expect(useView.getState().walking).toBe(false);
      controller.open();
      expect(controller.store.getState().phase).toBe("intro");
      controller.resume();
      expect(controller.store.getState().marks[controller.logic.steps[0].item.id]).toBe("skip");
      expect(controller.store.getState().done).toBe(true);
      controller.close();
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      });
      controller.open();
      controller.begin();
      controller.mark("ok");
      controller.close();
      expect(useView.getState().walking).toBe(false);
    });
  });
}
sessions(c172, useC172, s172, solve172, l172);
sessions(c182, useC182, s182, solve182, l182);
sessions(da40, useDA40, sDiamond, solveDiamond, lDiamond);
sessions(mooney, useM20C, sMooney, solveMooney, lMooney);
it("stores each aircraft's study progress independently", () => {
  expect(new Set(controllers.map((c) => c.logic.progressKey)).size).toBe(4);
  for (const c of controllers)
    c.logic.saveProgress({ v: 1, at: c.logic.steps[4].item.id, marks: {}, ms: 1000, done: false });
  c172.logic.saveProgress(null);
  expect(c172.logic.loadProgress()).toBeNull();
  for (const c of [c182, da40, mooney]) expect(c.logic.loadProgress()?.at).toBe(c.logic.steps[4].item.id);
});
it("keeps the installed vent, alternator, fairing and pitot-heat configuration during study", () => {
  useDA40.getState().update((s) => {
    s.env.extraVents = false;
  });
  da40.open();
  da40.begin();
  da40.goStep(da40.logic.steps.length - 1);
  expect(useDA40.getState().s.env.extraVents).toBe(false);
  da40.close();
  useC182.getState().update((s) => {
    s.altAmps = 95;
    s.gear.fairings = false;
  });
  c182.open();
  c182.begin();
  expect(useC182.getState().s.altAmps).toBe(95);
  expect(useC182.getState().s.gear.fairings).toBe(false);
  c182.close();
  useM20C.getState().update((s) => {
    s.pitot.heatInstalled = false;
  });
  mooney.open();
  mooney.begin();
  expect(useM20C.getState().s.pitot.heatInstalled).toBe(false);
  mooney.close();
});
it("replays each Cessna's heat test and turns its master off; Mooney samples each selector position", () => {
  const heat172 = c172.logic.simAt(
    s172,
    c172.logic.steps.findIndex((s) => s.item.text === "Pitot heat"),
  );
  const heat182 = c182.logic.simAt(
    s182,
    c182.logic.steps.findIndex((s) => s.item.text === "Pitot heat"),
  );
  expect(solve172(heat172).pitotHeating).toBe(true);
  expect(solve182(heat182).pitotHeating).toBe(true);
  expect(c172.logic.simAt(s172, 27).elec.bat).toBe(false);
  expect(c182.logic.simAt(s182, 28).elec.bat).toBe(false);
  expect(mooney.logic.simAt(sMooney, 1).fuel.sel).toBe("R");
  expect(mooney.logic.simAt(sMooney, 2).fuel.sel).toBe("L");
  mooney.open();
  mooney.begin();
  expect(lMooney.gearFrac).toBe(0);
  expect(useM20C.getState().s.gear.lever).toBe("DOWN");
});
