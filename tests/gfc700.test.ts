/**
 * Garmin GFC 700 AFCS logic (`lib/avionics/gfc700.ts`) with the C172S configuration, flown on the shared flight model.
 * Behaviour per the G1000 CRGs (Cessna NAV III 190-00384-13, DA40 190-00324-07 §6) and the DA40 GFC 700 AFMS.
 */
import { describe, expect, it } from "vitest";
import { AFCS_CFG } from "@/aircraft/c172s/model";
import { AFCS_CFG as DA40_CFG } from "@/aircraft/da40/model";
import { initFlight, stepFlight, type FlightState } from "@/lib/avionics/flight";
import {
  gfc700Annunc,
  gfc700Command,
  gfc700Fail,
  gfc700Init,
  gfc700Key,
  gfc700Power,
  gfc700Tick,
  type Gfc700Key,
  type Gfc700State,
} from "@/lib/avionics/gfc700";

const cfg = AFCS_CFG;
const fsAt = (p: Partial<FlightState> = {}) => initFlight({ t: 100, ...p });
/** Powered and through its preflight test. */
const ready = (fs = fsAt()) => gfc700Tick(gfc700Power(gfc700Init(), true, fs.t - cfg.pftSec, cfg), fs, cfg);
const press = (st: Gfc700State, fs: FlightState, ...keys: Gfc700Key[]) =>
  keys.reduce((s, k) => gfc700Key(s, k, fs, cfg), st);
const annAt = (st: Gfc700State, fs: FlightState, dt: number) => gfc700Annunc(st, { ...fs, t: fs.t + dt }, cfg)!;
/** Let the servos fly for `secs`, recording each new vertical mode. */
function fly(st: Gfc700State, fs: FlightState, secs: number, dt = 0.1) {
  const verts = [st.vert];
  for (let t = 0; t < secs; t += dt) {
    fs = stepFlight(fs, gfc700Command(st, fs, cfg) ?? { bank: 0 }, dt, cfg.flight);
    st = gfc700Tick(st, fs, cfg);
    if (st.vert !== verts.at(-1)) verts.push(st.vert);
  }
  return { st, fs, verts };
}

describe("power-up preflight test", () => {
  it("runs PFT (white) at power-up, during which the AP cannot engage, then passes with a tone", () => {
    const st = gfc700Power(gfc700Init(), true, 0, cfg),
      fs = fsAt({ t: 1 });
    expect(gfc700Annunc(st, fs, cfg)!.sys).toEqual({ text: "PFT", level: "a" });
    expect(gfc700Key(st, "AP", fs, cfg)).toBe(st);
    const done = gfc700Tick(st, fsAt({ t: cfg.pftSec }), cfg);
    expect(done.pft).toBe("pass");
    expect(gfc700Annunc(done, fsAt({ t: cfg.pftSec + 1 }), cfg)!).toMatchObject({ sys: null, tone: true });
  });

  it("a failing test, or AP DISC pressed during it, latches a red PFT", () => {
    const st = gfc700Power(gfc700Init(), true, 0, cfg);
    const failed = gfc700Tick(gfc700Fail(st, { pft: true }, 0), fsAt({ t: 6 }), cfg);
    expect(gfc700Annunc(failed, fsAt({ t: 7 }), cfg)!.sys).toEqual({ text: "PFT", level: "w" });
    expect(gfc700Key(st, "AP_DISC", fsAt({ t: 1 }), cfg).pft).toBe("fail");
  });

  it("power off clears everything: no annunciations", () => {
    expect(gfc700Annunc(gfc700Power(ready(), false, 100, cfg), fsAt(), cfg)).toBeNull();
  });
});

describe("engaging and mode keys", () => {
  const fs = fsAt({ vs: 340, ias: 120 });

  it("AP engages AP and FD in ROL + PIT with ALTS armed", () => {
    const st = press(ready(fs), fs, "AP");
    expect(st).toMatchObject({ ap: true, fd: true, lat: "ROL", vert: "PIT", vertArm: ["ALTS"] });
    expect(gfc700Annunc(st, fs, cfg)).toMatchObject({ ap: true, fd: true, lat: "ROL", vert: "PIT", vertArm: "ALTS" });
  });

  it("ROL holds bank: wings level below 6°, holds 6–22°, limits to 22° (CRG Table 6-3)", () => {
    const rol = (roll: number) => press(ready(), fsAt({ roll }), "AP").ref.rol;
    expect([rol(4), rol(15), rol(30)]).toEqual([0, 15, 22]);
  });

  it("the FD key toggles the flight director, but is disabled while the AP is engaged", () => {
    expect(press(ready(fs), fs, "FD")).toMatchObject({ fd: true, lat: "ROL", vert: "PIT" });
    const ap = press(ready(fs), fs, "AP");
    expect(press(ap, fs, "FD")).toBe(ap);
  });

  it("other keys activate the FD in their mode with the default for the other axis", () => {
    expect(press(ready(fs), fs, "HDG")).toMatchObject({ fd: true, lat: "HDG", vert: "PIT" });
    expect(press(ready(fs), fs, "VS")).toMatchObject({ fd: true, lat: "ROL", vert: "VS" });
  });

  it("mode keys are alternate action: a second press returns that axis to ROL / PIT", () => {
    expect(press(ready(fs), fs, "AP", "HDG", "HDG").lat).toBe("ROL");
    expect(press(ready(fs), fs, "AP", "VS", "VS").vert).toBe("PIT");
  });

  it("VS syncs to the current vertical speed (100 fpm steps); NOSE UP adds 100 fpm; FLC syncs within the 172S range", () => {
    expect(press(ready(fs), fs, "AP", "VS").ref.vs).toBe(300);
    expect(press(ready(fs), fs, "AP", "VS", "NOSE_UP").ref.vs).toBe(400);
    const fast = fsAt({ ias: 160 });
    expect(press(ready(fast), fast, "AP", "FLC").ref.ias).toBe(150); // POH 2-21 engagement limit
  });

  it("NAV captures at once with the CDI within 1 dot, otherwise arms and captures later with a green flash", () => {
    const on = fsAt();
    expect(press(ready(on), on, "AP", "NAV")).toMatchObject({ lat: "GPS", latArm: null });
    // 1.5 nm right of the GPS course (3 dots), heading 045 to intercept the 090 course in HDG
    const off = fsAt({ xtk: 1.5, hdg: 45, hdgBug: 45, crs: 90 });
    const armed = press(ready(off), off, "AP", "HDG", "NAV");
    expect(armed).toMatchObject({ lat: "HDG", latArm: "GPS" });
    const { st, fs: end } = fly(armed, off, 120);
    expect(st).toMatchObject({ lat: "GPS", latArm: null });
    expect(st.latFlash).toMatchObject({ c: "g" });
    expect(Math.abs(end.xtk)).toBeLessThan(0.5);
  });
});

describe("altitude capture", () => {
  it("climbing in VS, ALTS becomes active near the Selected Altitude and ALT within 50 ft of it", () => {
    const fs = fsAt({ alt: 4000, selAlt: 4500, vs: 500 });
    const { st, fs: end, verts } = fly(press(ready(fs), fs, "AP", "VS"), fs, 120);
    expect(verts).toEqual(["VS", "ALTS", "ALT"]);
    expect(st.ref.alt).toBe(4500);
    expect(Math.abs(end.alt - 4500)).toBeLessThan(50);
    expect(st.vertArm).toEqual([]);
  });
});

describe("VNAV profile loss", () => {
  it("loss of an active path reverts to PIT with the lost VPTH flashing yellow (CRG §6)", () => {
    const fs = fsAt({ alt: 6500, selAlt: 3000, vs: -500, vpath: { err: 0, vs: -500 } });
    const active = gfc700Tick(press(ready(fs), fs, "AP", "VNV"), fs, cfg);
    expect(active.vert).toBe("VPTH");
    const lost = gfc700Tick(active, { ...fs, vpath: null }, cfg);
    expect(lost).toMatchObject({
      vert: "PIT",
      vertArm: ["ALTS"],
      vertFlash: { text: "VPTH", c: "y" },
    });
    expect(gfc700Command(lost, fs, cfg)?.pitch).toBe(fs.pitch);
  });

  it("an unavailable flight plan cannot remain armed or retain a VPTH recapture guard (CRG p. 6-13)", () => {
    const fs = fsAt({ alt: 6500, selAlt: 3000, vpath: { err: -150, vs: -500 } });
    const armed = { ...press(ready(fs), fs, "AP", "VNV"), vpthRe: { until: fs.t + 10, away: false } };
    const lost = gfc700Tick(armed, { ...fs, vpath: null }, cfg);
    expect(lost.vertArm).toEqual(["ALTS"]);
    expect(lost.vpthRe).toBeNull();
    expect(lost.vertFlash).toBeNull();
  });
});

describe("disconnects", () => {
  const fs = fsAt();
  const engaged = () => press(ready(fs), fs, "AP");

  it("a normal disconnect flashes a yellow AP for 5 s with a 2 s tone; the FD stays on", () => {
    const off = press(engaged(), fs, "AP");
    expect(off).toMatchObject({ ap: false, fd: true });
    expect(annAt(off, fs, 1)).toMatchObject({ apFlash: "disc", tone: true });
    expect(annAt(off, fs, 3)).toMatchObject({ apFlash: "disc", tone: false });
    expect(annAt(off, fs, 6).apFlash).toBeNull();
  });

  it("after a normal disconnect AP DISC cancels flash and tone, a MET press only the tone (CRG p. 6-22)", () => {
    const off = press(engaged(), fs, "AP");
    expect(press(off, fs, "AP_DISC")).toMatchObject({ apFlash: null, tone: 0 });
    const met = press(off, fs, "TRIM_UP");
    expect(met.tone).toBe(0);
    expect(met.apFlash).toMatchObject({ kind: "disc" });
  });

  it("GA, MET and the AP DISC switch also disconnect the AP", () => {
    for (const k of ["GA", "TRIM_DN", "AP_DISC"] as const)
      expect(press(engaged(), fs, k).apFlash?.kind, k).toBe("disc");
    expect(press(engaged(), fs, "GA")).toMatchObject({ fd: true, lat: "GA", vert: "GA", vertArm: ["ALTS"] });
  });

  it("a failure disconnects abnormally: red AP and a continuous tone until acknowledged, and no re-engagement", () => {
    const failed = gfc700Fail(engaged(), { pitch: true }, fs.t);
    expect(annAt(failed, fs, 60)).toMatchObject({
      ap: false,
      apFlash: "abnormal",
      tone: true,
      sys: { text: "PTCH", level: "w" },
    });
    expect(press(failed, fs, "AP")).toBe(failed);
    expect(press(failed, fs, "AP_DISC")).toMatchObject({ apFlash: null, tone: 0 });
  });

  it("losing attitude (AHRS) disconnects abnormally and removes the FD", () => {
    const st = gfc700Tick(engaged(), fsAt({ fail: { att: true } }), cfg);
    expect(st).toMatchObject({ ap: false, fd: false, apFlash: { kind: "abnormal" } });
  });
});

describe("per-airplane configuration", () => {
  it("the DA40 has no BC key; NAV on a localizer is LOC until the course is more than 105° from the heading", () => {
    const fs = fsAt({ navSrc: "LOC1", hdg: 90, crs: 90 }),
      st = gfc700Tick(gfc700Power(gfc700Init(), true, 0, DA40_CFG), fs, DA40_CFG);
    expect(gfc700Key(st, "BC", fs, DA40_CFG)).toBe(st);
    expect(gfc700Key(st, "NAV", fs, DA40_CFG).lat).toBe("LOC");
    expect(gfc700Key(st, "NAV", { ...fs, hdg: 270 }, DA40_CFG).lat).toBe("BC");
  });

  it("MAXSPD overspeed protection above 165 KIAS on the DA40 (AFMS p. 16); none modelled for the 172S", () => {
    const fs = fsAt({ ias: 170 });
    const da40 = gfc700Key(gfc700Tick(gfc700Power(gfc700Init(), true, 0, DA40_CFG), fs, DA40_CFG), "FD", fs, DA40_CFG);
    expect(gfc700Annunc(da40, fs, DA40_CFG)!.maxspd).toBe(true);
    expect(gfc700Annunc(press(ready(fs), fs, "FD"), fs, cfg)!.maxspd).toBe(false);
  });
});
