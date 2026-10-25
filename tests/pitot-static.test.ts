/**
 * The pitot-static component simulation against what the FAA handbooks (PHAK FAA-H-8083-25C ch. 8, IFH FAA-H-8083-15B,
 * AMT FAA-H-8083-31B ch. 10) and the Cessna 172S POH describe.
 */
import { describe, expect, it } from "vitest";
import { PITOT_STATIC as S, type Flaps } from "@/engines/components/pitot-static/spec";
import {
  defaultInputs,
  initialState,
  leakTestReached,
  pohKias,
  pressureAltitude,
  primary,
  run,
  step,
  type Inputs,
  type PSState,
} from "@/engines/components/pitot-static/model";

const inputs = (patch: (i: Inputs) => void = () => {}) => {
  const i = defaultInputs();
  patch(i);
  return i;
};

/** Steady flight at a KCAS and altitude, level. */
const steady = (kcas: number, alt: number, patch: (i: Inputs) => void = () => {}) => {
  const i = inputs((i) => {
    Object.assign(i.controls, { kcas, alt });
    patch(i);
  });
  const s = initialState(S, i);
  run(S, s, i, 3);
  return { i, s };
};

/** Run, returning the state's readings every `every` seconds. */
function trace(s: PSState, i: Inputs, seconds: number, every = 1) {
  const out: { t: number; ias: number; alt: number; vsi: number; vs: number; h: number }[] = [];
  for (let t = 0; t < seconds - 1e-9; t += every) {
    run(S, s, i, every);
    out.push({ t: t + every, ias: s.ias, alt: s.alt, vsi: s.vsi, vs: s.vs, h: s.h });
  }
  return out;
}

const SHEETS: Flaps[] = ["up", "10", "full"];

describe("the 172S POH's airspeed calibration (Figure 5-1)", () => {
  it.each(SHEETS)("a healthy system reads Sheet 1's KIAS for each KCAS, flaps %s (normal static source)", (flaps) => {
    for (const [kias, kcas] of S.poh.normal[flaps]) {
      const { s } = steady(kcas, 3000, (i) => (i.controls.flaps = flaps));
      expect(s.ias).toBeCloseTo(kias, 0);
    }
  });

  it.each(SHEETS)("with ALT STATIC AIR on in Sheet 2's conditions it reads Sheet 2's KIAS, flaps %s", (flaps) => {
    for (const [kias, kcas] of S.poh.alternate[flaps]) {
      const { s } = steady(kcas, 3000, (i) => {
        i.controls.flaps = flaps;
        // windows and ventilators closed; cabin heat, cabin air and defroster on maximum
        Object.assign(i.cockpit, { altStatic: true, ventsOpen: false, heatAir: true });
      });
      expect(s.ias).toBeCloseTo(kias, 0);
    }
  });

  it("the alternate source varies from the normal by no more than 11 kt and 50 ft with the windows closed (POH 3-32)", () => {
    let kt = 0,
      ft = 0;
    for (const flaps of SHEETS)
      for (const heatAir of [true, false]) {
        const top = S.poh.normal[flaps].at(-1)![1];
        for (let kcas = 45; kcas <= top; kcas += 3) {
          const set = (alt: boolean) => (i: Inputs) => {
            i.controls.flaps = flaps;
            Object.assign(i.cockpit, { altStatic: alt, heatAir, ventsOpen: false });
          };
          const a = steady(kcas, 0, set(false)).s,
            b = steady(kcas, 0, set(true)).s;
          kt = Math.max(kt, Math.abs(b.ias - a.ias));
          ft = Math.max(ft, Math.abs(b.alt - a.alt));
        }
      }
    expect(kt).toBeGreaterThan(2);
    expect(kt).toBeLessThanOrEqual(S.poh.altVariation.kt);
    expect(ft).toBeLessThanOrEqual(S.poh.altVariation.ft);
  });

  it("the panel's POH lookup inverts the table", () => {
    expect(pohKias(S, 107, "up", false)).toBeCloseTo(110, 6);
    expect(pohKias(S, 105, "up", true)).toBeCloseTo(110, 6);
    expect(pohKias(S, 63, "10", false)).toBeCloseTo(60, 6);
  });
});

describe("alternate static source (PHAK p. 8-3, IFH p. 5-3)", () => {
  it("in level flight: the altimeter a little higher, the ASI faster, a momentary climb on the VSI", () => {
    const { i, s } = steady(107, 5500, (i) => (i.cockpit.heatAir = true));
    const before = { ias: s.ias, alt: s.alt };
    i.cockpit.altStatic = true;
    const t = trace(s, i, 20, 0.5);
    const peak = Math.max(...t.map((x) => x.vsi));
    expect(peak).toBeGreaterThan(150);
    // then it stabilizes, altitude held constant
    expect(Math.abs(t.at(-1)!.vsi)).toBeLessThan(10);
    expect(s.alt - before.alt).toBeGreaterThan(5);
    expect(s.alt - before.alt).toBeLessThan(S.poh.altVariation.ft);
    expect(s.ias - before.ias).toBeGreaterThan(1);
    // the airplane itself never moved
    expect(s.h).toBeCloseTo(5500, 3);
  });

  it("with the static port blocked, it brings the altimeter and VSI back to life (POH 3-15)", () => {
    const { i, s } = steady(90, 4000, (i) => (i.cockpit.heatAir = true));
    i.failures.portL = true;
    i.controls.alt = 5000;
    run(S, s, i, 30);
    expect(s.alt).toBeLessThan(4100);
    i.cockpit.altStatic = true;
    run(S, s, i, 20);
    // climbing: the VSI shows it, the altimeter follows within the alternate source's error
    expect(s.vsi).toBeGreaterThan(500);
    expect(Math.abs(s.alt - s.h)).toBeLessThan(S.poh.altVariation.ft + 40);
  });

  it("bypasses water in the static line (POH 7-64)", () => {
    const { i, s } = steady(100, 6000, (i) => (i.weather.isaDev = -20));
    i.failures.water = true;
    run(S, s, i, 30);
    // frozen solid below 0 °C: like a blocked port
    expect(s.waterIce).toBe(1);
    const frozen = s.alt;
    i.controls.alt = 7000;
    run(S, s, i, 60);
    expect(s.h).toBeGreaterThan(6600);
    expect(Math.abs(s.alt - frozen)).toBeLessThan(5);
    i.cockpit.altStatic = true;
    run(S, s, i, 10);
    // the cold day's altimeter error remains: compare with a healthy altimeter at this altitude
    const healthy = steady(100, s.h, (i) => (i.weather.isaDev = -20)).s;
    expect(Math.abs(s.alt - healthy.alt)).toBeLessThan(60);
  });
});

describe("a blocked pitot system (PHAK pp. 8-10, 8-11)", () => {
  it("ram inlet blocked, drain open: the ASI decreases to zero, not instantly but very quickly", () => {
    const { i, s } = steady(107, 5500);
    i.failures.ram = true;
    const t = trace(s, i, 20, 0.5);
    expect(t[1].ias).toBeGreaterThan(60); // after 1 s
    expect(t.find((x) => x.t === 10)!.ias).toBeLessThan(30);
    expect(t.at(-1)!.ias).toBeLessThan(5);
    // the altimeter and VSI don't use the pitot
    expect(Math.abs(s.alt - 5541)).toBeLessThan(5);
    expect(Math.abs(s.vsi)).toBeLessThan(5);
  });

  it("inlet and drain blocked: no change with airspeed, but it rises in a climb and falls in a descent", () => {
    const { i, s } = steady(107, 5500);
    Object.assign(i.failures, { ram: true, drain: true });
    const held = s.ias;
    i.controls.kcas = 80;
    run(S, s, i, 15);
    // 27 kt slower: only the static port's position error moves the needle
    expect(Math.abs(s.ias - held)).toBeLessThan(3);
    i.controls.alt = 6500;
    run(S, s, i, 30);
    const climbed = s.ias;
    expect(climbed).toBeGreaterThan(held + 20);
    i.controls.alt = 4500;
    run(S, s, i, 240);
    expect(s.h).toBeLessThan(4600);
    expect(s.ias).toBeLessThan(held - 20);
  });
});

describe("a blocked static system (PHAK p. 8-11, Figure 8-11)", () => {
  it("the altimeter freezes, the VSI reads zero, the ASI reads low above the blockage", () => {
    const { i, s } = steady(100, 5000);
    const frozen = s.alt;
    i.failures.portL = true;
    i.controls.alt = 6000;
    const t = trace(s, i, 60);
    for (const x of t) {
      expect(Math.abs(x.alt - frozen)).toBeLessThan(2);
      expect(Math.abs(x.vsi)).toBeLessThan(2);
    }
    expect(s.h).toBeGreaterThan(5600);
    expect(s.ias).toBeLessThan(pohKias(S, 100, "up", false) - 10);
  });

  it("and high below it", () => {
    const { i, s } = steady(100, 5000);
    i.failures.portL = true;
    i.controls.alt = 4000;
    run(S, s, i, 60);
    expect(s.h).toBeLessThan(4400);
    expect(s.ias).toBeGreaterThan(pohKias(S, 100, "up", false) + 10);
  });

  it("taped over on the ground: normal on the take-off roll, then decreasing in the climb (AMT p. 10-81)", () => {
    const i = inputs((i) => Object.assign(i.controls, { kcas: 0, alt: 0 }));
    const s = initialState(S, i);
    i.failures.portL = true;
    Object.assign(i.controls, { kcas: 75, alt: 3000, rate: 700 });
    run(S, s, i, 14);
    // still on the runway at the lift-off speed: the trapped field pressure is right (without even position error)
    expect(s.h).toBeLessThan(5);
    expect(Math.abs(s.ias - s.kcas)).toBeLessThan(1.5);
    run(S, s, i, 40);
    expect(s.h).toBeGreaterThan(300);
    expect(s.ias).toBeLessThan(40);
    expect(Math.abs(s.alt)).toBeLessThan(5);
  });
});

describe("the vertical speed indicator (PHAK pp. 8-7, 8-8)", () => {
  it("shows the trend at once and the rate after 6–9 seconds", () => {
    const { i, s } = steady(90, 3000);
    expect(Math.abs(s.vsi)).toBeLessThan(1);
    Object.assign(i.controls, { alt: 9000, rate: 1000 });
    const t = trace(s, i, 12, 0.5);
    expect(t[1].vsi).toBeGreaterThan(50); // moving up within a second
    const [lo, hi] = S.handbook.vsiLagS;
    const within = (x: (typeof t)[number]) => Math.abs(x.vsi - x.vs) < 0.05 * x.vs;
    expect(within(t.find((x) => x.t === lo - 2)!)).toBe(false);
    expect(within(t.find((x) => x.t === hi)!)).toBe(true);
  });

  it("broken glass with the port blocked: the altimeter and ASI work again, late, and the VSI is no use (PHAK p. 8-3, IFH p. 11-8)", () => {
    const { i, s } = steady(90, 4000);
    i.failures.portL = true;
    i.controls.alt = 5000;
    run(S, s, i, 20);
    expect(s.alt).toBeLessThan(4100);
    i.failures.vsiGlass = true;
    const t = trace(s, i, 30, 0.5);
    // climbing all the while: the VSI needle shows a descent
    expect(Math.min(...t.map((x) => x.vsi))).toBeLessThan(-100);
    // static now comes from the cabin through the calibrated leak, seconds behind
    expect(Math.abs(t[0].alt - t[0].h)).toBeGreaterThan(150);
    expect(Math.abs(s.alt - s.h)).toBeLessThan(120);
  });
});

describe("pitot heat and icing (POH 4-4, 4-6, 3-14; IFH pp. 4-13, 10-23)", () => {
  it("the tube is warm to the touch within 30 seconds", () => {
    const i = inputs((i) => Object.assign(i.controls, { kcas: 0, alt: 0 }));
    const s = initialState(S, i);
    i.cockpit.pitotHeat = true;
    run(S, s, i, S.poh.heatCheckS);
    expect(s.headC - s.oat).toBeGreaterThan(30);
  });

  it("an open heater element does nothing", () => {
    const i = inputs((i) => Object.assign(i.controls, { kcas: 0, alt: 0 }));
    const s = initialState(S, i);
    Object.assign(i.cockpit, { pitotHeat: true });
    i.failures.heater = true;
    run(S, s, i, 30);
    expect(s.headC).toBeCloseTo(s.oat, 3);
  });

  it("in visible moisture below freezing the unheated pitot ices and the ASI falls; heat clears it", () => {
    const { i, s } = steady(107, 5500, (i) => (i.weather.isaDev = -15));
    const good = s.ias;
    i.weather.moisture = true;
    run(S, s, i, 60);
    expect(s.iceRam).toBe(1);
    expect(s.ias).toBeLessThan(good / 3);
    i.cockpit.pitotHeat = true;
    run(S, s, i, 40);
    expect(s.iceRam).toBe(0);
    expect(s.ias).toBeCloseTo(good, 0);
  });

  it("no ice above freezing, none with the heat on, none out of cloud", () => {
    for (const patch of [
      (i: Inputs) => (i.weather.isaDev = 10),
      (i: Inputs) => ((i.weather.isaDev = -15), (i.cockpit.pitotHeat = true)),
      (i: Inputs) => ((i.weather.isaDev = -15), (i.weather.moisture = false)),
    ]) {
      const { i, s } = steady(107, 5500, (i) => {
        i.weather.moisture = true;
        patch(i);
      });
      run(S, s, i, 60);
      expect(s.iceRam).toBe(0);
    }
  });
});

describe("water and leaks (AMT p. 10-81)", () => {
  it("water in the static line makes the altimeter lag and wander", () => {
    const { i, s } = steady(100, 5000, (i) => (i.weather.isaDev = 10));
    i.failures.water = true;
    i.controls.alt = 6500;
    const t = trace(s, i, 60, 0.5);
    const lag = Math.max(...t.map((x) => x.h - x.alt));
    expect(lag).toBeGreaterThan(60);
    expect(s.waterIce).toBe(0);
  });

  it("leak test: a tight system and a seep pass, a cracked fitting loses more than 100 ft in a minute", () => {
    const loss = (leak: Inputs["failures"]["leak"]) => {
      const i = inputs((i) => {
        i.mode = "test";
        i.failures.leak = leak;
      });
      const s = initialState(S, i);
      i.test.alt = S.handbook.leakTest.ft;
      run(S, s, i, 50);
      expect(s.alt).toBeGreaterThan(900);
      // no airspeed while the test set holds the pitot side with the static side
      expect(s.ias).toBeLessThan(1);
      i.test.sealed = true;
      run(S, s, i, S.handbook.leakTest.s + 1);
      expect(s.leakTest.done).toBe(true);
      return s.leakTest.altLoss;
    };
    const max = S.handbook.leakTest.maxLossFt;
    expect(loss("none")).toBeLessThan(1);
    expect(loss("seep")).toBeLessThan(max);
    expect(loss("cracked")).toBeGreaterThan(max);
  });

  it("the test set can't reach the instruments through a taped port", () => {
    const i = inputs((i) => {
      i.mode = "test";
      i.failures.portL = true;
    });
    const s = initialState(S, i);
    i.test.alt = 1000;
    run(S, s, i, 50);
    expect(s.alt).toBeLessThan(20);
  });

  it("sealed before the instruments indicate the test altitude, the test has no result: tape, ALT STATIC AIR, a line off", () => {
    const seal = (patch: (i: Inputs) => void) => {
      const i = inputs((i) => {
        i.mode = "test";
        patch(i);
      });
      const s = initialState(S, i);
      i.test.alt = S.handbook.leakTest.ft;
      run(S, s, i, 50);
      i.test.sealed = true;
      run(S, s, i, 1);
      expect(s.leakTest.testFt).toBeCloseTo(S.handbook.leakTest.ft, 0);
      return leakTestReached(S, s.leakTest);
    };
    expect(seal(() => {})).toBe(true);
    expect(seal((i) => (i.failures.leak = "cracked"))).toBe(true);
    // one port of a pair taped: the test set reaches the line through the other
    expect(seal((i) => ((i.ports = "paired"), (i.failures.portR = true)))).toBe(true);
    expect(seal((i) => (i.failures.portL = true))).toBe(false);
    expect(seal((i) => (i.cockpit.altStatic = true))).toBe(false);
    expect(seal((i) => (i.failures.leak = "disconnected"))).toBe(false);
    // taped after the instruments went up: they stay above where the test set comes down to
    const i = inputs((i) => (i.mode = "test"));
    const s = initialState(S, i);
    i.test.alt = 500;
    run(S, s, i, 25);
    i.failures.portL = true;
    i.test.alt = 200;
    run(S, s, i, 15);
    i.test.sealed = true;
    run(S, s, i, 1);
    expect(s.leakTest.staticFt).toBeGreaterThan(400);
    expect(leakTestReached(S, s.leakTest)).toBe(false);
  });

  it("a static line off its fitting behind the panel reads cabin pressure, like the alternate source", () => {
    const { i, s } = steady(107, 5500, (i) => (i.cockpit.heatAir = true));
    const alt = s.alt,
      ias = s.ias;
    i.failures.leak = "disconnected";
    run(S, s, i, 5);
    expect(s.alt).toBeGreaterThan(alt + 5);
    expect(s.ias).toBeGreaterThan(ias + 0.5);
  });

  it("a pitot line leak makes the ASI read low", () => {
    const { i, s } = steady(107, 5500);
    const ias = s.ias;
    i.failures.pitotLeak = true;
    run(S, s, i, 5);
    expect(s.ias).toBeLessThan(ias - 2);
  });
});

describe("where the static ports are (IFH p. 5-2, AMT p. 10-13)", () => {
  it("one port reads a sideslip; a cross-connected pair cancels it; one of a pair blocked brings it back", () => {
    const slip = (patch: (i: Inputs) => void) => steady(70, 3000, (i) => ((i.controls.slip = 10), patch(i))).s.ias;
    const straight = steady(70, 3000).s.ias;
    expect(Math.abs(slip(() => {}) - straight)).toBeGreaterThan(2);
    expect(Math.abs(slip((i) => (i.ports = "paired")) - straight)).toBeLessThan(0.1);
    expect(Math.abs(slip((i) => ((i.ports = "paired"), (i.failures.portR = true))) - straight)).toBeGreaterThan(2);
  });
});

describe("the altimeter (PHAK pp. 8-3 to 8-5, IFH pp. 5-4, 5-7)", () => {
  it("a quarter inch of setting is about 250 ft", () => {
    const right = steady(0, 0, (i) => (i.cockpit.kollsman = 29.92)).s.alt;
    const wrong = steady(0, 0, (i) => (i.cockpit.kollsman = 30.17)).s.alt;
    expect(wrong - right).toBeGreaterThan(220);
    expect(wrong - right).toBeLessThan(260);
  });

  it("from a high to a low without resetting: the airplane is lower than indicated", () => {
    const { s } = steady(100, 5500, (i) => {
      i.weather.qnh = 29.42;
      i.cockpit.kollsman = 29.92;
    });
    expect(s.alt - s.h).toBeGreaterThan(400);
  });

  it("from hot to cold: the airplane is lower than indicated", () => {
    const cold = steady(100, 5500, (i) => (i.weather.isaDev = -20)).s;
    const hot = steady(100, 5500, (i) => (i.weather.isaDev = 20)).s;
    expect(cold.alt - cold.h).toBeGreaterThan(300);
    expect(hot.alt - hot.h).toBeLessThan(-250);
  });

  it("the encoder reports pressure altitude in 100-ft steps, whatever the setting, and freezes with the port", () => {
    const { i, s } = steady(100, 5500, (i) => {
      i.weather.qnh = 30.2;
      i.cockpit.kollsman = 30.2;
    });
    expect(s.modeC % 100).toBe(0);
    expect(Math.abs(s.modeC - pressureAltitude(s.stat))).toBeLessThanOrEqual(50);
    expect(s.alt - s.modeC).toBeGreaterThan(200);
    const reported = s.modeC;
    i.failures.portL = true;
    i.controls.alt = 7000;
    run(S, s, i, 60);
    expect(s.modeC).toBe(reported);
  });
});

describe("the G1000 (NAV III): air data computer, PFD and standby instruments", () => {
  const g1000 = (i: Inputs) => (i.avionics = "g1000");

  it("the PFD and the standby instruments read the POH's KIAS and the same altitude; the PFD adds true airspeed", () => {
    const { s } = steady(107, 5500, g1000);
    expect(s.pfd.valid).toBe(true);
    expect(s.pfd.ias).toBeCloseTo(110, 0);
    expect(s.ias).toBeCloseTo(110, 0);
    expect(Math.abs(s.pfd.alt - s.alt)).toBeLessThan(1);
    expect(Math.abs(s.pfd.vs)).toBeLessThan(1);
    // TAS from the ADC's airspeed, the static pressure it senses and the OAT probe (POH p. 7-18)
    expect(Math.abs(s.pfd.tas - s.ktas)).toBeLessThan(4);
  });

  it("they share the pitot head and static port (POH p. 7-12): a blocked port fools both alike", () => {
    const { i, s } = steady(90, 4000, g1000);
    const frozen = s.pfd.alt;
    i.failures.portL = true;
    i.controls.alt = 5500;
    run(S, s, i, 60);
    expect(s.h).toBeGreaterThan(4500);
    expect(Math.abs(s.pfd.alt - frozen)).toBeLessThan(2);
    expect(Math.abs(s.alt - s.pfd.alt)).toBeLessThan(2);
    expect(Math.abs(s.pfd.vs)).toBeLessThan(5);
    expect(Math.abs(s.pfd.ias - s.ias)).toBeLessThan(1);
    expect(s.pfd.ias).toBeLessThan(pohKias(S, 90, "up", false) - 10);
  });

  it("the alternate source moves both, and the PFD's vertical speed shows the momentary climb too", () => {
    const { i, s } = steady(107, 5500, (i) => (g1000(i), (i.cockpit.heatAir = true)));
    const before = { pfd: s.pfd.alt, stby: s.alt };
    i.cockpit.altStatic = true;
    let peak = 0;
    for (let t = 0; t < 10; t += 0.1) {
      run(S, s, i, 0.1);
      peak = Math.max(peak, s.pfd.vs);
    }
    expect(peak).toBeGreaterThan(100);
    expect(Math.abs(s.pfd.vs)).toBeLessThan(10);
    expect(s.pfd.ias).toBeCloseTo(112, 0);
    expect(s.pfd.alt - before.pfd).toBeGreaterThan(5);
    expect(s.alt - before.stby).toBeGreaterThan(5);
  });

  it("an air data computer failure puts a red X on the PFD; the standby instruments carry on (POH p. 3-21)", () => {
    const { i, s } = steady(107, 5500, g1000);
    i.failures.adc = true;
    run(S, s, i, 2);
    expect(s.pfd.valid).toBe(false);
    const p = primary(s, i);
    expect(Number.isNaN(p.ias) && Number.isNaN(p.alt) && Number.isNaN(p.vs)).toBe(true);
    expect(s.ias).toBeCloseTo(110, 0);
    expect(Math.abs(s.alt - 5541)).toBeLessThan(5);
  });

  it("the PFD's BARO and the standby altimeter are set separately (POH p. 4-15)", () => {
    const { s } = steady(100, 3000, (i) => (g1000(i), (i.cockpit.baro = 30.17)));
    expect(s.pfd.alt - s.alt).toBeGreaterThan(220);
    expect(s.pfd.alt - s.alt).toBeLessThan(260);
  });

  it("vertical speed is the rate of pressure altitude: the climb rate in a steady climb", () => {
    const { i, s } = steady(90, 3000, g1000);
    Object.assign(i.controls, { alt: 8000, rate: 1000 });
    run(S, s, i, 15);
    expect(Math.abs(s.pfd.vs - s.vs)).toBeLessThan(0.05 * s.vs);
  });

  it("the trend vector shows the airspeed about six seconds ahead (Garmin 190-00498-07 p. 50)", () => {
    const { i, s } = steady(90, 3000, g1000);
    i.controls.kcas = 140;
    run(S, s, i, 5);
    // the airplane gains 4 KCAS a second: about 24 kt in six seconds
    expect(s.pfd.iasTrend).toBeGreaterThan(18);
    expect(s.pfd.iasTrend).toBeLessThan(30);
    run(S, s, i, 20);
    expect(Math.abs(s.pfd.iasTrend)).toBeLessThan(1);
  });

  it("there is no mechanical VSI on the static line: no VSI glass to break", () => {
    const a = steady(90, 4000, g1000),
      b = steady(90, 4000, g1000);
    for (const x of [a, b]) {
      x.i.failures.portL = true;
      x.i.controls.alt = 5000;
    }
    b.i.failures.vsiGlass = true;
    run(S, a.s, a.i, 20);
    run(S, b.s, b.i, 20);
    expect(b.s.alt).toBeCloseTo(a.s.alt, 3);
  });
});

describe("integration", () => {
  it("the result doesn't depend on the frame rate", () => {
    const a = steady(100, 5000).s,
      b = steady(100, 5000).s;
    const i = inputs((i) => {
      Object.assign(i.controls, { kcas: 100, alt: 6000 });
      i.failures.portL = true;
    });
    for (let t = 0; t < 30; t += 1 / 120) step(S, a, i, 1 / 120);
    for (let t = 0; t < 30; t += 1 / 20) step(S, b, i, 1 / 20);
    expect(b.h).toBeCloseTo(a.h, 0);
    expect(b.ias).toBeCloseTo(a.ias, 1);
    expect(b.alt).toBeCloseTo(a.alt, 1);
  });

  it("a frame of no time does nothing", () => {
    const { i, s } = steady(100, 5000);
    const before = JSON.stringify(s);
    step(S, s, i, 0);
    step(S, s, i, Number.NaN);
    expect(JSON.stringify(s)).toBe(before);
  });
});
