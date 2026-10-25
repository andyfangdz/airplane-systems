/**
 * The pitot-static page's "Try" set-ups show what their notes say (PHAK FAA-H-8083-25C ch. 8, IFH FAA-H-8083-15B,
 * AMT FAA-H-8083-31B p. 10-81, 172S POH).
 */
import { describe, expect, it } from "vitest";
import { PITOT_STATIC as S } from "@/engines/components/pitot-static/spec";
import { initialState, pohKias, run, type Inputs, type PSState } from "@/engines/components/pitot-static/model";
import { SCENARIOS, scenarioById, scenarioInputs } from "@/engines/components/pitot-static/scenarios";

/** Settle in the scenario's set-up, then fly its "then" for `seconds`. */
function play(id: string, seconds: number) {
  const sc = scenarioById(id)!;
  const { setup, then } = scenarioInputs(sc);
  const s = initialState(S, setup);
  const start = structuredClone(s);
  run(S, s, then, seconds);
  return { s, start, i: then };
}

const settled = (s: PSState, i: Inputs, seconds: number) => run(S, s, i, seconds);

describe("the pitot-static scenarios", () => {
  it("ids are unique and every group has one", () => {
    expect(new Set(SCENARIOS.map((x) => x.id)).size).toBe(SCENARIOS.length);
    expect(new Set(SCENARIOS.map((x) => x.group))).toEqual(
      new Set(["Blockages", "Alternate static", "Errors", "Maintenance"]),
    );
  });

  it("cruise reads the POH's KIAS", () => {
    const { s } = play("cruise", 5);
    expect(s.ias).toBeCloseTo(110, 0);
    expect(Math.abs(s.alt - s.h)).toBeLessThan(60);
  });

  it("pitot ices over below freezing, and clears with PITOT HEAT", () => {
    const { s, i } = play("pitot-ice", 60);
    expect(s.oat).toBeLessThan(-7);
    expect(s.ias).toBeLessThan(40);
    i.cockpit.pitotHeat = true;
    settled(s, i, 40);
    expect(s.ias).toBeCloseTo(110, 0);
  });

  it("ram inlet blocked: airspeed to zero", () => {
    expect(play("ram", 30).s.ias).toBeLessThan(3);
  });

  it("inlet and drain blocked: the airspeed climbs with the airplane", () => {
    const { s, start } = play("ram-drain", 120);
    expect(s.h - start.h).toBeGreaterThan(900);
    expect(s.ias - start.ias).toBeGreaterThan(30);
  });

  it("static port blocked: frozen altimeter, VSI zero, airspeed low in the climb and high in the descent", () => {
    const climb = play("static-climb", 120);
    expect(Math.abs(climb.s.alt - climb.start.alt)).toBeLessThan(2);
    expect(Math.abs(climb.s.vsi)).toBeLessThan(2);
    expect(climb.s.ias).toBeLessThan(climb.start.ias - 15);
    const down = play("static-descent", 120);
    expect(down.s.ias).toBeGreaterThan(pohKias(S, down.s.kcas, "up", false) + 15);
  });

  it("pitot blocked before take-off: no airspeed on the roll, and the airplane stays on the runway", () => {
    const { s } = play("pitot-takeoff", 20);
    expect(s.kcas).toBeGreaterThan(45);
    expect(s.ias).toBeLessThan(1);
    expect(s.h).toBe(0);
  });

  it("taped static port: right on the runway, zero by about 500 ft", () => {
    const { s } = play("tape", 60);
    expect(s.h).toBeGreaterThan(400);
    expect(s.h).toBeLessThan(700);
    expect(s.ias).toBeLessThan(5);
    expect(Math.abs(s.alt)).toBeLessThan(5);
  });

  it("ALT STATIC AIR in level flight: 112 KIAS (Figure 5-1 Sheet 2)", () => {
    const { s } = play("alt-level", 20);
    expect(s.ias).toBeCloseTo(112, 0);
  });

  it("static blocked, then the POH 3-15 checklist: the instruments come back", () => {
    const { s, i } = play("alt-blocked", 30);
    expect(s.alt - s.h).toBeGreaterThan(200);
    Object.assign(i.cockpit, { altStatic: true, ventsOpen: false, heatAir: true });
    settled(s, i, 15);
    expect(Math.abs(s.alt - s.h)).toBeLessThan(S.poh.altVariation.ft + 40);
    expect(s.vsi).toBeLessThan(-300);
  });

  it("broken VSI glass: the altimeter follows the climb again, the VSI doesn't", () => {
    const { s, i } = play("glass", 40);
    expect(Math.abs(s.alt - s.h)).toBeLessThan(120);
    expect(s.vs).toBeGreaterThan(400);
    settled(s, i, 2);
    expect(s.vsi).toBeLessThan(s.vs / 2);
  });

  it("slip: one port reads low, a pair doesn't", () => {
    const one = play("slip", 10);
    expect(one.s.ias).toBeLessThan(one.start.ias - 2);
    const sc = scenarioById("slip")!;
    const { setup, then } = scenarioInputs(sc);
    setup.ports = then.ports = "paired";
    const s = initialState(S, setup);
    const before = s.ias;
    run(S, s, then, 10);
    expect(Math.abs(s.ias - before)).toBeLessThan(0.2);
  });

  it("water in the static line freezes above the freezing level", () => {
    const { s } = play("water", 600);
    expect(s.h).toBeGreaterThan(9400);
    expect(s.waterIce).toBe(1);
    expect(s.h - s.alt).toBeGreaterThan(500);
  });

  it("a disconnected static line reads like the alternate source", () => {
    const { s, start } = play("disconnected", 5);
    expect(s.alt).toBeGreaterThan(start.alt + 5);
  });

  it("high to low: about 500 ft high; cold day: high too", () => {
    const hl = play("high-low", 2).s;
    expect(hl.alt - hl.h).toBeGreaterThan(400);
    expect(hl.alt - hl.h).toBeLessThan(560);
    const cold = play("cold", 2).s;
    expect(cold.alt - cold.h).toBeGreaterThan(300);
  });

  it("G1000 air data computer failure: red X on the PFD, the standby instruments right (POH p. 3-21)", () => {
    const { s } = play("adc", 3);
    expect(s.pfd.valid).toBe(false);
    expect(s.ias).toBeCloseTo(110, 0);
  });

  it("set-ups keep the airplane's installation unless they need another", () => {
    const keep = scenarioInputs(scenarioById("static-climb")!, { avionics: "g1000", ports: "paired" });
    expect(keep.then.avionics).toBe("g1000");
    expect(keep.then.ports).toBe("paired");
    expect(scenarioInputs(scenarioById("glass")!, { avionics: "g1000", ports: "single" }).then.avionics).toBe(
      "six-pack",
    );
    expect(scenarioInputs(scenarioById("adc")!, { avionics: "six-pack", ports: "single" }).then.avionics).toBe("g1000");
  });

  it("every set-up shows its effect on the G1000 too, the broken VSI glass aside", () => {
    for (const sc of SCENARIOS) {
      const { setup, then } = scenarioInputs(sc, { avionics: "g1000", ports: "single" });
      const s = initialState(S, setup);
      run(S, s, then, 2);
      expect(then.avionics).toBe(sc.id === "glass" ? "six-pack" : "g1000");
      expect(Number.isFinite(s.pfd.ias)).toBe(true);
    }
  });

  it("the leak test with a cracked fitting fails; repaired, it passes", () => {
    const test = (repair: boolean) => {
      const { s, i } = play("leak-test", 50);
      if (repair) i.failures.leak = "none";
      settled(s, i, 5);
      i.test.sealed = true;
      settled(s, i, 61);
      return s.leakTest;
    };
    expect(test(false).altLoss).toBeGreaterThan(S.handbook.leakTest.maxLossFt);
    expect(test(true).altLoss).toBeLessThan(S.handbook.leakTest.maxLossFt);
  });
});
