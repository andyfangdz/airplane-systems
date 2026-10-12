/** Reversible study sessions: engine safety, cumulative switch history and independent saved progress. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";
import "@/aircraft";
import type { FleetWalkController } from "@/lib/fleet-walk-store";
import { restoreFleetWalkLive } from "@/lib/fleet-walk-store";
import type { SimStore } from "@/lib/simStore";
import { useView } from "@/lib/view";
import { walkController as c172 } from "@/aircraft/c172s/walk-store";
import { walkController as c182 } from "@/aircraft/c182t/walk-store";
import { walkController as da40 } from "@/aircraft/da40/walk-store";
import { walkController as mooney } from "@/aircraft/m20c/walk-store";
import { initialSim as s172, live as l172, solve as solve172 } from "@/aircraft/c172s/model";
import { initialSim as s182, live as l182, solve as solve182 } from "@/aircraft/c182t/model";
import { initialSim as sDiamond, live as lDiamond, solve as solveDiamond } from "@/aircraft/da40/model";
import { initialSim as sMooney, live as lMooney, solve as solveMooney } from "@/aircraft/m20c/model";
import { useC172 } from "@/aircraft/c172s/store";
import { useC182 } from "@/aircraft/c182t/store";
import { useDA40 } from "@/aircraft/da40/store";
import { useM20C } from "@/aircraft/m20c/store";

const controllers = [c172, c182, da40, mooney];
beforeEach(() => {
  controllers.forEach((c) => c.close());
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
  useView.setState({
    ac: "sr20",
    sys: "overview",
    walking: false,
    cam: null,
    focus: null,
    hover: null,
    spot: null,
    xray: true,
    labels: true,
    spin: false,
    ctrlFocus: "all",
  });
});
afterEach(() => {
  controllers.forEach((c) => c.close());
  vi.unstubAllGlobals();
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
      restoreFleetWalkLive(live, liveInitial);
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
      expect(controller.useWalk.getState().phase).toBe("resume");
      controller.resume();
      expect(controller.useWalk.getState().at).toBe(5);
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
      expect(controller.useWalk.getState().phase).toBe("intro");
      controller.resume();
      expect(controller.useWalk.getState().marks[controller.logic.steps[0].item.id]).toBe("skip");
      expect(controller.useWalk.getState().done).toBe(true);
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
