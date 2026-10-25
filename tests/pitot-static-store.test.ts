/**
 * The pitot-static page's store: starting a set-up, pausing, the ramp test set and draining the static sump (AMT
 * FAA-H-8083-31B p. 10-81: drains are worked on the ground).
 */
import { beforeEach, describe, expect, test } from "vitest";
import { advance, clock, s, usePs, usePsView } from "@/components/engine/pitot-static/store";

const initial = usePs.getState();
beforeEach(() => {
  clock.reset();
  usePs.setState(initial, true);
  usePsView.getState().set({ paused: false });
  usePs.getState().start("cruise");
});

describe("the pitot-static store", () => {
  test("starting a set-up settles the system and applies its failures and profile", () => {
    usePs.getState().start("tape");
    const u = usePs.getState();
    expect(u.scenario).toBe("tape");
    expect(u.failures.portL).toBe(true);
    expect(u.controls.kcas).toBe(75);
    expect(s.h).toBe(0);
    expect(s.kcas).toBe(0);
    advance(1);
    expect(s.kcas).toBeGreaterThan(3);
  });

  test("pause holds the simulation", () => {
    usePs.getState().start("static-climb");
    usePsView.getState().set({ paused: true });
    const h = s.h;
    advance(1);
    expect(s.h).toBe(h);
    usePsView.getState().set({ paused: false });
    advance(1);
    expect(s.h).toBeGreaterThan(h);
  });

  test("the ramp: on the ground with the test set, and back to steady flight", () => {
    usePs.getState().setMode("test");
    expect(usePs.getState().scenario).toBeNull();
    expect(s.h).toBe(0);
    expect(s.kcas).toBe(0);
    usePs.getState().setTest({ alt: 1000 });
    advance(1);
    expect(s.testAlt).toBeGreaterThan(20);
    usePs.getState().setMode("flight");
    expect(s.h).toBe(usePs.getState().controls.alt);
    expect(s.ias).toBeGreaterThan(100);
  });

  test("avionics: switching keeps the flight; set-ups keep the panel unless they need another", () => {
    usePs.getState().setAvionics("g1000");
    advance(0.5);
    expect(s.pfd.valid).toBe(true);
    expect(s.pfd.ias).toBeCloseTo(110, 0);
    usePs.getState().start("static-climb");
    expect(usePs.getState().avionics).toBe("g1000");
    usePs.getState().start("glass");
    expect(usePs.getState().avionics).toBe("six-pack");
    usePs.getState().start("adc");
    expect(usePs.getState().avionics).toBe("g1000");
    advance(0.5);
    expect(s.pfd.valid).toBe(false);
  });

  test("the static sump drains on the ground only", () => {
    usePs.getState().start("water");
    usePs.getState().drainSump();
    expect(usePs.getState().failures.water).toBe(true);
    usePs.getState().setMode("test");
    usePs.getState().drainSump();
    expect(usePs.getState().failures.water).toBe(false);
  });
});
