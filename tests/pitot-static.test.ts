/** FAA PHAK ch. 8, pp. 8-3 and 8-10–8-12: alternate source and blocked pressure systems. */
import { describe, expect, test } from "vitest";
import {
  defaults,
  initialState,
  step,
  indications,
  type Controls,
  type State,
} from "@/engines/components/pitot-static/model";
function run(s: State, patch: Partial<Controls>, seconds = 60) {
  const c = { ...defaults, ...patch };
  for (let i = 0; i < seconds * 20; i++) s = step(s, c, 0.05);
  return { s, r: indications(s, c) };
}
describe("pitot-static pressure behavior", () => {
  test("normal altitude and density-sensitive airspeed; VSI follows climb then decays", () => {
    const s = initialState();
    const r = indications(s, defaults);
    expect(r.altitude).toBeCloseTo(5000, 4);
    expect(r.ias).toBeLessThan(120);
    expect(r.vsi).toBe(0);
    const climb = run(s, { climb: 600 });
    expect(climb.s.altitude).toBeCloseTo(5600, 4);
    expect(climb.r.vsi).toBeCloseTo(600, -1);
    expect(run(climb.s, {}).r.vsi).toBeCloseTo(0, 0);
  });
  test("blocked inlet with open drain loses IAS without losing altitude", () => {
    const { r } = run(initialState(), { inletBlocked: true });
    expect(r.ias).toBeLessThan(0.01);
    expect(r.altitude).toBeCloseTo(5000, 4);
  });
  test("sealed pitot ignores speed but rises in climb and falls in descent", () => {
    const s = initialState(),
      baseline = indications(s, defaults).ias;
    const patch = { inletBlocked: true, drainBlocked: true };
    expect(run(s, { ...patch, tas: 180 }).r.ias).toBeCloseTo(baseline, 4);
    expect(run(s, { ...patch, climb: 600 }).r.ias).toBeGreaterThan(baseline);
    expect(run(s, { ...patch, climb: -600 }).r.ias).toBeLessThan(baseline);
  });
  test("blocked static freezes altitude and reads low above / high below blockage", () => {
    const s = initialState();
    for (const climb of [-600, 600]) {
      const bad = run(s, { staticBlocked: true, climb });
      const good = run(s, { climb });
      expect(bad.r.altitude).toBeCloseTo(5000, 4);
      expect(bad.r.vsi).toBe(0);
      expect(Math.sign(bad.r.ias - good.r.ias)).toBe(-Math.sign(climb));
    }
  });
  test("both systems sealed freeze both instruments", () => {
    const s = initialState();
    const result = run(s, { inletBlocked: true, drainBlocked: true, staticBlocked: true, tas: 180, climb: 1000 });
    expect(result.s.pitot).toBe(s.pitot);
    expect(result.s.static).toBe(s.static);
    expect(result.r.vsi).toBe(0);
  });
  test("alternate static restores blocked source, biases IAS/altitude and produces a reversible VSI transient", () => {
    const s = initialState(),
      base = indications(s, defaults);
    const patch = { staticBlocked: true, alternate: true };
    const transient = run(s, patch, 1);
    expect(transient.r.vsi).toBeGreaterThan(0);
    const settled = run(transient.s, patch);
    expect(settled.r.altitude).toBeGreaterThan(base.altitude);
    expect(settled.r.ias).toBeGreaterThan(base.ias);
    expect(settled.r.vsi).toBeCloseTo(0, 0);
    expect(run(settled.s, {}, 1).r.vsi).toBeLessThan(0);
    const climbed = run(s, { staticBlocked: true, climb: 600 });
    expect(run(climbed.s, patch).r.altitude).toBeGreaterThan(5600);
  });
  test("drain-only obstruction has no immediate effect; leaks change the affected pressure", () => {
    const s = initialState();
    expect(run(s, { drainBlocked: true }).r.ias).toBeCloseTo(indications(s, defaults).ias, 4);
    expect(run(s, { pitotLeak: true }).r.ias).toBeLessThan(indications(s, defaults).ias);
    expect(run(s, { staticLeak: true }).r.altitude).toBeGreaterThan(5000);
  });
  test("heat clears ice but cannot clear manual obstructions or static blockage", () => {
    const iced = run(initialState(), { icing: true }, 15).s;
    expect(iced.ice).toBe(1);
    const heated = run(iced, { icing: true, heat: true }, 15).s;
    expect(heated.ice).toBe(0);
    expect(run(initialState(), { icing: true, heat: true, heatFailed: true }, 15).s.ice).toBe(1);
    const blocked = run(iced, { heat: true, inletBlocked: true, drainBlocked: true, staticBlocked: true, climb: 600 });
    expect(blocked.s.pitot).toBe(iced.pitot);
    expect(blocked.s.static).toBe(iced.static);
  });
  test("baro setting affects only altitude; zero offset alternate is unbiased", () => {
    const s = initialState();
    const changed = indications(s, { ...defaults, baro: 30.5 });
    expect(changed.altitude).toBeGreaterThan(5000);
    expect(changed.ias).toBe(indications(s, defaults).ias);
    expect(changed.vsi).toBe(0);
    expect(run(s, { alternate: true, cabinDrop: 0 }).r.altitude).toBeCloseTo(5000, 4);
    expect(step(s, defaults, 0)).toBe(s);
  });
});
