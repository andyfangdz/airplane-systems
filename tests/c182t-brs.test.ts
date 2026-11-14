/**
 * The optional BRS-182 parachute on the C182T (STC SA01999CH): BRS-182 Installation Manual 9005-IM Rev C (12/2/2004)
 * pp. 1-1 – 1-5, and FAA AD 2008-02-18 for applicability. The AFM supplement was not available; times other than the
 * line cutter's eight-second fuse, and the nose-low angle before its release, are illustrative.
 */
import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import {
  BRS_END,
  BRS_PROFILE,
  RELEASE_T,
  ROCKET_T,
  TAUT_T,
  TOUCHDOWN_PITCH,
  brsPhase,
  strapOut,
} from "@/aircraft/c182t/brs";
import { initialSim, live } from "@/aircraft/c182t/model";
import { CAT } from "@/aircraft/c182t/parts";
import { BRS_HARNESS, frontStrap, strapPeel } from "@/aircraft/c182t/parts/brs";
import { createC182Simulation } from "@/aircraft/c182t/simulation";
import { useC182 } from "@/aircraft/c182t/store";
import { SYS } from "@/aircraft/c182t/systems";
import { rampState } from "@/aircraft/c182t/walk";
import { patched } from "./helpers";

const brsParts = () => CAT.parts.filter((p) => p.sys.includes("brs"));
const meshes: THREE.Mesh[] = [];
afterEach(() => {
  live.brsT = -1;
  for (const m of meshes) m.geometry.dispose();
  meshes.length = 0;
});

/** A fresh runtime with the parachute installed (or not), handle pulled, run for `t` seconds. */
function pulled(t: number, installed = true) {
  const sim = createC182Simulation();
  sim.store.getState().update((s) => {
    s.brs.installed = installed;
  });
  sim.dispatch({ type: "brs", deployed: true });
  for (let k = 0; k < Math.round(t * 120); k++) sim.step(1 / 120);
  return sim;
}

describe("option off (the default): the C182T is unchanged", () => {
  it("starts without the BRS parachute installed or deployed", () => {
    expect(initialSim.brs).toEqual({ installed: false, deployed: false });
    expect(createC182Simulation().live.brsT).toBe(-1);
  });
  it("fits no BRS part, and lists none to locate", () => {
    expect(brsParts().length).toBeGreaterThan(0);
    for (const p of brsParts()) expect(p.fitted?.(), p.id).toBe(false);
    const visible = CAT.visibleSnapshot();
    expect(brsParts().filter((p) => visible.has(p))).toEqual([]);
  });
  it("has nothing to pull: the handle does nothing without the installation", () => {
    const sim = pulled(3, false);
    expect(sim.store.getState().s.brs.deployed).toBe(false);
    expect(sim.live.brsT).toBe(-1);
  });
  it("adds the BRS view last in the rail, citing the BRS document rather than the POH", () => {
    expect(SYS.at(-1)).toMatchObject({ id: "brs" });
    expect(SYS.at(-1)!.ref).toContain("9005-IM");
  });
});

describe("BRS-182 deployment (IM pp. 1-3 – 1-5)", () => {
  it("fits every BRS part, with its label pins, when installed", () => {
    useC182.getState().update((s) => {
      s.brs.installed = true;
    });
    try {
      for (const p of brsParts()) expect(p.fitted?.(), p.id).toBe(true);
      const visible = CAT.visibleSnapshot();
      expect(brsParts().every((p) => visible.has(p))).toBe(true);
      expect(CAT.pinned("brs").length).toBeGreaterThan(0);
    } finally {
      useC182.getState().update((s) => {
        s.brs.installed = false;
      });
    }
    expect(brsParts().filter((p) => CAT.visibleSnapshot().has(p))).toEqual([]);
  });

  it("pulling the handle starts the timeline at T+0 and runs it to the end", () => {
    const sim = pulled(0.5);
    expect(sim.store.getState().s.brs.deployed).toBe(true);
    expect(sim.live.brsT).toBeCloseTo(0.5, 6);
    expect(sim.live.brsPlaying).toBe(true);
    const done = pulled(BRS_END + 1);
    expect(done.live.brsT).toBe(BRS_END);
    expect(done.live.brsPlaying).toBe(false);
  });

  it("resetting repacks the parachute", () => {
    const sim = pulled(4);
    sim.dispatch({ type: "brs", deployed: false });
    expect(sim.store.getState().s.brs).toEqual({ installed: true, deployed: false });
    expect(sim.live.brsT).toBe(-1);
  });

  it("the rocket fires after the handle's slack take-up, then extracts the parachute (IM pp. 1-3, 1-5)", () => {
    expect(brsPhase(0)[1]).toBe("Handle pulled");
    expect(brsPhase(ROCKET_T)[1]).toBe("Rocket extraction");
    expect(ROCKET_T).toBeGreaterThan(0);
    expect(TAUT_T).toBeGreaterThan(ROCKET_T);
  });

  it("peels the two front straps off the top skin from the rear-window end to the front wing attachment points (IM p. 1-3)", () => {
    for (const side of [-1, 1]) {
      const path = frontStrap(side);
      expect(strapPeel(side, 0).distanceTo(new THREE.Vector3(...path[0]))).toBeLessThan(1e-6);
      let previousX = -Infinity;
      for (const t of [ROCKET_T, 0.6, 1.0, 1.3, TAUT_T]) {
        const p = strapPeel(side, strapOut(t));
        expect(p.x).toBeGreaterThanOrEqual(previousX - 1e-9);
        previousX = p.x;
      }
      expect(
        strapPeel(side, 1).distanceTo(new THREE.Vector3(...(side < 0 ? BRS_HARNESS.fwdL : BRS_HARNESS.fwdR))),
      ).toBeLessThan(1e-6);
    }
    for (const t of [-1, 0, ROCKET_T - 0.01]) expect(strapOut(t)).toBe(0);
    expect(strapOut(TAUT_T)).toBe(1);
    const strap = CAT.parts.find((p) => p.name === "Front harness strap")!;
    live.brsT = TAUT_T;
    const m = new THREE.Mesh(strap.geo());
    meshes.push(m);
    strap.anim!(m, 0);
    expect(m.visible).toBe(false);
  });

  it("extracts the rear straps from inside the airplane at line stretch (IM p. 1-3)", () => {
    const rear = CAT.parts.filter((p) => p.name?.startsWith("Rear harness"));
    expect(rear.map((p) => p.name).sort()).toEqual([
      "Rear harness leg",
      "Rear harness leg",
      "Rear harness — long section",
      "Rear harness — short section",
    ]);
    for (const [t, shown] of [
      [-1, true],
      [TAUT_T - 0.01, true],
      [TAUT_T, false],
    ] as const) {
      live.brsT = t;
      for (const p of rear) {
        const m = new THREE.Mesh(p.geo());
        meshes.push(m);
        p.anim!(m, 0);
        expect(m.visible).toBe(shown);
      }
    }
  });

  it("releases the short rear harness section eight seconds after extraction (IM p. 1-4)", () => {
    expect(RELEASE_T - TAUT_T).toBe(8);
    expect(brsPhase(RELEASE_T - 0.01)[1]).not.toBe("Rear harness release");
    expect(brsPhase(RELEASE_T)[1]).toBe("Rear harness release");
  });

  it("then hangs at its touchdown attitude of approximately ten degrees nose down (IM p. 1-4)", () => {
    expect(TOUCHDOWN_PITCH).toBe(-10);
    for (const t of [RELEASE_T + 2, RELEASE_T + 4, BRS_END])
      expect(Math.abs(BRS_PROFILE.pitch(t) - -10)).toBeLessThanOrEqual(2);
    // more nose-down while the short section limits the rear strap length
    expect(BRS_PROFILE.pitch(RELEASE_T - 1)).toBeLessThan(TOUCHDOWN_PITCH - 5);
    expect(BRS_PROFILE.pitch(0)).toBe(0);
  });
});

describe("the installation is configuration, kept like the alternator and fairings", () => {
  it.each(["coldDark", "runUp", "cruise"] as const)(
    "%s keeps BRS installed and repacks a deployed parachute",
    (name) => {
      const sim = pulled(5);
      sim.dispatch({ type: "scenario", name });
      expect(sim.store.getState().s.brs).toEqual({ installed: true, deployed: false });
      expect(sim.live.brsT).toBe(-1);
      expect(sim.live.brsPlaying).toBe(false);
    },
  );
  it("the preflight walk's ramp state keeps it installed, not deployed", () => {
    const prior = patched(initialSim, { brs: { installed: true, deployed: true } });
    expect(rampState(prior).brs).toEqual({ installed: true, deployed: false });
    expect(rampState(initialSim).brs).toEqual({ installed: false, deployed: false });
  });
});
