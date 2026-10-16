/**
 * The RSA fuel injection component page's model (engines/components/fuel-injector/model.ts), against how the FAA handbook says the
 * system works (FAA-H-8083-32B pp. 2-21–2-24), the IO-390 IOM's nozzle curve (Figure C-2, p. 58) and Precision's
 * troubleshooting chart (Form 15-901C). The flows themselves are the IO-390 engine model's (tests/io390-engine.test.ts).
 */
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { noFailures, step, type Failures } from "@/engines/model/engine";
import { nozzleFlow } from "@/engines/model/fuel";
import { SCENARIOS, type Setup } from "@/engines/model/scenarios";
import { settle } from "@/engines/model/trim";
import { curveAt, DIVIDER_FULL_LBH, injectorView, NOZZLE_LIMITS } from "@/engines/components/fuel-injector/model";
import { COMPONENT_IDS, componentById } from "@/engines/components";

const S = IO390;
const nominal = S.fuelSystem.kind === "injected" ? S.fuelSystem.nozzle.points : [];

function scenario(id: string, f: Failures = noFailures(S)): Setup {
  return SCENARIOS.find((x) => x.id === id)!.run(S, f);
}
const viewOf = ({ s, c }: Setup, f: Failures = noFailures(S)) => injectorView(S, s, c, f);

describe("component registry", () => {
  test("the fuel injection page is listed under its id", () => {
    expect(COMPONENT_IDS).toContain("fuel-injector");
    expect(componentById("fuel-injector")?.name).toBe("Fuel injection");
  });
});

describe("IOM Figure C-2 (fuel flow against nozzle pressure, p. 58)", () => {
  test("the high and low limits bracket the nominal curve and rise with pressure", () => {
    for (let psi = 0.5; psi <= 11; psi += 0.5) {
      const nom = curveAt(nominal, psi);
      expect(curveAt(NOZZLE_LIMITS.high, psi)).toBeGreaterThan(nom);
      expect(curveAt(NOZZLE_LIMITS.low, psi)).toBeLessThan(nom);
    }
    for (const pts of [NOZZLE_LIMITS.high, NOZZLE_LIMITS.low])
      for (let i = 1; i < pts.length; i++) expect(pts[i][1]).toBeGreaterThan(pts[i - 1][1]);
  });

  test("the band is a few percent either side of nominal at 4–10 psi, as printed", () => {
    for (const psi of [4, 6, 8, 10]) {
      const nom = curveAt(nominal, psi);
      expect(curveAt(NOZZLE_LIMITS.high, psi) / nom).toBeGreaterThan(1.015);
      expect(curveAt(NOZZLE_LIMITS.high, psi) / nom).toBeLessThan(1.06);
      expect(curveAt(NOZZLE_LIMITS.low, psi) / nom).toBeGreaterThan(0.94);
      expect(curveAt(NOZZLE_LIMITS.low, psi) / nom).toBeLessThan(0.985);
    }
  });
});

describe("how the RSA system works (FAA-H-8083-32B pp. 2-21–2-24)", () => {
  test("the air metering force rises with the air flow, about as its square, and is near 100 % at rated power", () => {
    const climb = viewOf(scenario("climb")),
      cruise = viewOf(scenario("economy65")),
      idle = viewOf(scenario("idle"));
    expect(idle.airForce).toBeLessThan(cruise.airForce);
    expect(cruise.airForce).toBeLessThan(climb.airForce);
    expect(climb.airForce).toBeGreaterThan(0.75);
    expect(climb.airForce).toBeLessThan(1.25);
    // a square law: half the air, about a quarter of the force (at one density)
    const ratio = cruise.air / climb.air;
    expect(cruise.airForce / climb.airForce).toBeGreaterThan(ratio ** 2 * 0.7);
    expect(cruise.airForce / climb.airForce).toBeLessThan(ratio ** 2 * 1.4);
  });

  test("the fuel metering force balances the air force, plus the constant-head idle spring that matters only near idle", () => {
    for (const id of ["idle", "economy65", "climb"]) {
      const v = viewOf(scenario(id));
      expect(v.fuelForce).toBeCloseTo(v.airForce + v.springForce, 9);
    }
    const idle = viewOf(scenario("idle")),
      climb = viewOf(scenario("climb"));
    expect(idle.springForce / idle.fuelForce).toBeGreaterThan((climb.springForce / climb.fuelForce) * 20);
  });

  test("the ball valve, the flow divider and the nozzles open further as the fuel flow rises", () => {
    const idle = viewOf(scenario("idle")),
      climb = viewOf(scenario("climb"));
    expect(idle.ball).toBeGreaterThan(0);
    expect(climb.ball).toBeGreaterThan(idle.ball * 3);
    // at idle the divider valve opens only as far as it must, and divides the flow; above idle it is fully open
    expect(idle.metered).toBeLessThan(DIVIDER_FULL_LBH);
    expect(idle.divider).toBeGreaterThan(0);
    expect(idle.divider).toBeLessThan(1);
    expect(climb.divider).toBe(1);
  });

  test("idle cut-off: no metered fuel, the flow divider shuts every nozzle line", () => {
    const setup = scenario("idle"),
      f = noFailures(S);
    setup.c.mixture = 0;
    for (let t = 0; t < 2; t += 0.05) step(S, setup.s, setup.c, setup.env, f, 0.05);
    const v = viewOf(setup);
    expect(v.cutoff).toBe(true);
    expect(v.metered).toBe(0);
    expect(v.divider).toBe(0);
    expect(v.nozzles.every((x) => x === 0)).toBe(true);
    expect(v.fuelForce).toBe(0);
  });

  test("the nozzles together pass all the metered fuel", () => {
    const f = noFailures(S);
    f.nozzle[1] = 0.3;
    const v = viewOf(scenario("cruise75", f), f);
    expect(v.nozzles.reduce((a, x) => a + x, 0)).toBeCloseTo(v.metered, 9);
  });

  test("an intake leak's air bypasses the venturi: the air force follows only the air through the throttle body", () => {
    const clean = scenario("cruise75");
    const before = viewOf(clean);
    const f = noFailures(S);
    f.intakeLeak[0] = 1;
    settle(S, clean.s, clean.c, clean.env, f, 10);
    const after = viewOf(clean, f);
    expect(after.totalAir).toBeGreaterThan(after.air);
    expect(after.air).toBeCloseTo(clean.s.meteredAir, 9);
    // same square law on the throttle-body air as without the leak (the density barely moves)
    expect(after.airForce / after.air ** 2).toBeCloseTo(before.airForce / before.air ** 2, 9);
    // the servo meters fuel for the throttle-body air only, so the engine as a whole runs leaner
    expect(after.far).toBeLessThan(before.far);
  });

  test("at a fixed mixture setting the fuel–air ratio follows the air flow: about the same at cruise and in the climb", () => {
    const setup = scenario("climb"),
      f = noFailures(S);
    const full = viewOf(setup).far;
    setup.c.throttle = 0.55;
    settle(S, setup.s, setup.c, setup.env, f, 10);
    const part = viewOf(setup).far;
    expect(part).toBeGreaterThan(full * 0.92);
    expect(part).toBeLessThan(full * 1.1);
  });
});

describe("the nozzle-pressure gauge (FAA-H-8083-32B p. 2-24; IOM Figure C-2)", () => {
  test("with clean nozzles it reads the flow the nozzles pass, and 75 % cruise (12.8 gph, Table A-1) is about 4.7 psig", () => {
    const v = viewOf(scenario("cruise75"));
    expect(v.indicated).toBeCloseTo(v.metered, 0);
    expect(v.metered / 6).toBeCloseTo(12.8, 0);
    expect(v.nozzlePsi).toBeGreaterThan(4.3);
    expect(v.nozzlePsi).toBeLessThan(5.1);
    expect(nozzleFlow(S, v.nozzlePsi)).toBeCloseTo(v.metered, 0);
  });

  test("a plugged nozzle: high fuel flow reading with loss of power and roughness (Precision Form 15-901C)", () => {
    const clean = scenario("cruise75");
    const before = viewOf(clean),
      hp = clean.s.hp;
    const f = noFailures(S);
    f.nozzle[2] = 0.6;
    settle(S, clean.s, clean.c, clean.env, f, 10);
    const after = viewOf(clean, f);
    // the servo meters the same air-matched fuel, but the gauge sees the higher pressure and reads high
    expect(after.metered).toBeCloseTo(before.metered, 0);
    expect(after.indicated).toBeGreaterThan(after.metered * 1.1);
    // that cylinder gets less fuel, the others more
    expect(after.nozzles[2]).toBeLessThan(before.nozzles[2] * 0.6);
    expect(after.nozzles[0]).toBeGreaterThan(before.nozzles[0]);
    expect(clean.s.hp).toBeLessThan(hp);
    expect(clean.s.rough).toBeGreaterThan(0.05);
  });
});
