/**
 * Bendix/King KAP 140 two-axis autopilot with altitude preselect (`lib/avionics/kap140.ts`), as described in the
 * C182T NAV III POH Supplement 3 (182TPHAUS-S3-02), flown on the shared flight model with the C182T constants.
 */
import { describe, expect, it } from "vitest";
import { C182_FLIGHT, kapReady } from "@/aircraft/c182t/model";
import { initFlight, stepFlight, type FlightState } from "@/lib/avionics/flight";
import {
  kap140Command,
  kap140Fail,
  kap140Init,
  kap140Key,
  kap140P,
  kap140Pfd,
  kap140Phase,
  kap140Power,
  kap140Tick,
  type Kap140Key,
  type Kap140State,
} from "@/lib/avionics/kap140";

const fsAt = (p: Partial<FlightState> = {}) => initFlight({ t: 0, ...p });
const press = (st: Kap140State, fs: FlightState, ...keys: Kap140Key[]) =>
  keys.reduce((s, k) => kap140Key(s, k, fs), st);
/** Through its self-test long ago (red P out), autopilot engaged. */
const engaged = (fs: FlightState) => press(kapReady(), fs, "AP");
function fly(st: Kap140State, fs: FlightState, secs: number, dt = 0.1) {
  for (let t = 0; t < secs; t += dt) {
    fs = stepFlight(fs, kap140Command(st, fs) ?? { bank: 0 }, dt, C182_FLIGHT);
    st = kap140Tick(st, fs, dt);
  }
  return { st, fs };
}

describe("power-up self-test (S3-20)", () => {
  const on = kap140Power(kap140Init(), true, 0);

  it("runs PFT 1…5, then a display test with PITCH TRIM on the PFD, then is ready with a tone", () => {
    expect(kap140Phase(on, 0.5)).toEqual({ ph: "pft", step: 1 });
    expect(kap140Phase(on, 4.5)).toEqual({ ph: "pft", step: 5 });
    expect(kap140Phase(on, 6)).toEqual({ ph: "test", step: 0 });
    expect(kap140Pfd(on, 6)).toBe("PITCH TRIM");
    const done = kap140Tick(on, fsAt({ t: 7 }), 0.1);
    expect(done).toMatchObject({ ready: true, toneKind: "pft" });
    expect(kap140Pfd(done, 8)).toBeNull();
  });

  it("ignores keys until ready, and the red P keeps the AP from engaging for ~30 s", () => {
    expect(kap140Key(on, "AP", fsAt({ t: 2 }))).toBe(on);
    const ready = kap140Tick(on, fsAt({ t: 7 }), 0.1);
    expect(kap140P(ready, 10)).toBe(true);
    expect(kap140Key(ready, "AP", fsAt({ t: 10 })).ap).toBe(false);
    expect(kap140Key(ready, "AP", fsAt({ t: 31 })).ap).toBe(true);
  });

  it("BARO flashes until set after power-up; the knobs set the baro first", () => {
    const ready = kap140Tick(on, fsAt({ t: 40 }), 0.1);
    expect(ready.baroSet).toBe(false);
    const set = press(ready, fsAt({ t: 40 }), "INNER_INC");
    expect(set.baroSet).toBe(true);
    expect(set.baro).toBeCloseTo(29.93);
    expect(set.selAlt).toBe(0);
  });
});

describe("modes", () => {
  const fs = fsAt({ vs: 430, alt: 4987 });

  it("AP engages ROL + VS, holding the current vertical speed", () => {
    expect(engaged(fs)).toMatchObject({ ap: true, lat: "ROL", vert: "VS", vsRef: 400 });
  });

  it("HDG toggles HDG / ROL, and does nothing with the AP off", () => {
    expect(press(engaged(fs), fs, "HDG").lat).toBe("HDG");
    expect(press(engaged(fs), fs, "HDG", "HDG").lat).toBe("ROL");
    expect(kap140Key(kapReady(), "HDG", fs)).toMatchObject({ ap: false, lat: "ROL" });
  });

  it("UP / DN change VS by 100 fpm within +1500 / −2000 fpm; in ALT they move the reference 20 ft", () => {
    expect(press(engaged(fs), fs, "UP").vsRef).toBe(500);
    expect(press(engaged(fs), fs, ...Array<Kap140Key>(30).fill("DN")).vsRef).toBe(-2000);
    expect(press(engaged(fs), fs, ...Array<Kap140Key>(30).fill("UP")).vsRef).toBe(1500);
    const alt = press(engaged(fs), fs, "ALT");
    expect(alt).toMatchObject({ vert: "ALT", altRef: 4990 });
    expect(press(alt, fs, "UP").altRef).toBe(5010);
  });

  it("NAV captures within ~2.5 dots; further out it arms and the AP flies the heading bug, HDG flashing 5 s", () => {
    expect(press(engaged(fs), fs, "NAV")).toMatchObject({ lat: "NAV", latArm: null });
    const far = fsAt({ xtk: 1.5 }); // GPS course, 3 dots
    const armed = press(engaged(far), far, "NAV");
    expect(armed).toMatchObject({ lat: "HDG", latArm: "NAV", hdgFlash: far.t + 5 });
  });

  it("REV works only with a localizer tuned (S3-9 item 7)", () => {
    expect(press(engaged(fs), fs, "REV").lat).toBe("ROL");
    const loc = fsAt({ navSrc: "LOC1" });
    expect(press(engaged(loc), loc, "REV").lat).toBe("REV");
  });

  it("switching the nav source reverts to ROL with the old symbol flashing, no tone", () => {
    const nav = press(engaged(fs), fs, "NAV");
    const lost = kap140Tick(nav, { ...fs, navSrc: "VOR1" }, 0.1);
    expect(lost).toMatchObject({ lat: "ROL", lostLat: "NAV", tone: nav.tone });
  });

  it.each(["REV", "HDG", "APR", "NAV"] as const)(
    "%s releases a captured glideslope and holds the current VS (S3-8–S3-9)",
    (key) => {
      const loc = fsAt({ navSrc: "LOC1", gsErr: 0, vs: -500 });
      const approach = kap140Tick(press(engaged(loc), loc, "APR"), loc, 0.1);
      expect(approach.vert).toBe("GS");
      const left = kap140Tick(press(approach, loc, key), loc, 0.1);
      expect(left).toMatchObject({ vert: "VS", gsArm: false, vsRef: -500 });
      expect(kap140Command(left, { ...loc, gsErr: 200 })?.vs).toBe(-500);
    },
  );

  it("APR ARM flies the intercept heading even when selected from NAV (S3-11 item 15)", () => {
    const on = fsAt({ hdg: 90, hdgBug: 270, crs: 90 });
    const nav = press(engaged(on), on, "NAV");
    const far = { ...on, xtk: 1.5 };
    const armed = press(nav, far, "APR");
    expect(armed).toMatchObject({ lat: "HDG", latArm: "APR" });
    expect(kap140Command(armed, far)?.bank).toBeGreaterThan(0);
  });
});

describe("altitude preselect", () => {
  it("selecting an altitude with the AP engaged arms ALT; climbing in VS it captures and holds it", () => {
    const fs = fsAt({ alt: 4000, vs: 500 });
    // from 6,000 ft: outer knob −1,000, inner knob 5 × −100
    const climb = press(engaged(fs), fs, "OUTER_DEC", ...Array<Kap140Key>(5).fill("INNER_DEC"));
    expect(climb).toMatchObject({ selAlt: 4500, altArm: true });
    const { st: end, fs: after } = fly(climb, fs, 120);
    expect(end).toMatchObject({ vert: "ALT", altArm: false, altRef: 4500 });
    expect(Math.abs(after.alt - 4500)).toBeLessThan(30);
  });
});

describe("disconnects", () => {
  const fs = fsAt();

  it("A/P DISC, the AP button or MET: AP flashes for 5 s with a 2 s tone", () => {
    for (const k of ["DISC", "AP", "MET_UP"] as const) {
      expect(press(engaged(fs), fs, k), k).toMatchObject({ ap: false, apFlash: 5, tone: 2, toneKind: "disc" });
    }
  });

  it("a roll-axis or trim failure disengages the AP and keeps it from re-engaging", () => {
    const r = kap140Fail(engaged(fs), { r: true }, 0);
    expect(r.ap).toBe(false);
    expect(press(r, fs, "AP").ap).toBe(false);
    const trim = kap140Fail(engaged(fs), { trim: true }, 0);
    expect(trim.ap).toBe(false);
    expect(kap140Pfd(trim, 0)).toBe("PITCH TRIM");
  });
});
