/** C182T early NAV III topology and failure propagation, from selected POH Fig. 7-7 and Garmin 190-00352-00 Rev K. */
import { beforeEach, describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/c182t/parts";
import { DEPTH as D } from "@/aircraft/c182t/depth-anchors";
import { SYSTEM_DEPTH_PARTS } from "@/aircraft/c182t/parts/systems-depth";
import { SYSTEM_DEPTH_FLOWS as F, systemsDepthRates } from "@/aircraft/c182t/systems-depth-flow";
import { FLOWS, flowRates } from "@/aircraft/c182t/flows";
import { initialLive, initialSim, live, solve } from "@/aircraft/c182t/model";
import { kapView } from "@/aircraft/c182t/tick";
import { patched } from "./helpers";

beforeEach(() => Object.assign(live, initialLive()));
const route = (key: string) => F.find((f) => f.key === key)!;
const rates = (s = patched(initialSim)) => systemsDepthRates(s, solve(s), s.eng.rpm);
const cold = () =>
  patched(initialSim, {
    ground: true,
    eng: { running: false, rpm: 0, mags: "START", mix: 1 },
    fuel: { pump: false },
  });

describe("C182T NAV III protected inputs and independent systems", () => {
  it("uses separate GRS 77, GDC 74A and two GIA 63 units, not a dual-ADAHRS or GFC 700 installation", () => {
    expect(CAT.parts.filter((p) => p.name === "GRS 77 AHRS")).toHaveLength(1);
    expect(CAT.parts.filter((p) => p.name === "GDC 74A air data computer")).toHaveLength(1);
    expect(CAT.parts.filter((p) => /^GIA 63 #/.test(p.name ?? ""))).toHaveLength(2);
    expect(CAT.parts.some((p) => /GSU 75|GSA 81|GFC 700/.test(p.name ?? ""))).toBe(false);
    expect(F.filter((f) => /^depthGia\d(Pfd|Mfd)$/.test(f.key))).toHaveLength(2);
    expect(route("depthGeaGia1").pts[0]).toEqual(D.gea);
    expect(route("depthGeaGia2").pts.at(-1)).toEqual(D.gia2);
    expect(route("depthGeaGia1").note).toContain("RS-485");
    expect(route("depthXpdrGia1").note).toContain("RS-232");
    expect(route("depthAhrsGia2").note).toContain("ARINC 429");
    expect(route("depthGia1Pfd").note).toContain("Ethernet");
  });

  it("retains PFD data on essential-only power but loses all four cooling fans and AV2-only equipment (POH 7-69)", () => {
    const s = patched(initialSim, { elec: { bat: false, alt: false, avn1: false, avn2: false, stby: "ARM" } });
    const E = solve(s),
      R = rates(s);
    expect(E.pfd && E.ahrs && E.adc && E.gea).toBe(true);
    expect(R.depthPfdEss).toBe(1);
    expect(R.depthPfdAv1).toBe(0);
    expect(R.depthAhrsPfd).toBe(1);
    for (const key of [
      "depthPfdCool",
      "depthMfdCool",
      "depthDeckCool",
      "depthAftCool1",
      "depthAftCool2",
      "depthAftCoolXpdr",
    ])
      expect(R[key], key).toBe(0);
    expect(E.mfd || E.gia2 || E.audio || E.xpdr || E.kapPwr).toBe(false);
  });

  it.each(["PFD", "ADC AHRS", "NAV 1 ENG"])(
    "one %s input can fail without removing its protected alternate (POH Fig. 7-7 Sheet 2)",
    (label) => {
      const s = patched(initialSim, { elec: { cb: { [`ESS:${label}`]: true } } });
      let E = solve(s);
      const powered = () => (label === "PFD" ? E.pfd : label === "ADC AHRS" ? E.adc && E.ahrs : E.gea && E.gia1);
      expect(powered()).toBe(true);
      s.elec.cb[`AV1:${label}`] = true;
      E = solve(s);
      expect(powered()).toBe(false);
    },
  );

  it("distinguishes lost sensor data from intact receivers/displays and from the mechanical standby instruments", () => {
    const s = patched(initialSim, { avx: { ahrsFail: true } });
    let R = rates(s);
    expect(R.depthAhrsGia1 || R.depthAhrsGia2 || R.depthAhrsPfd || R.depthMagAhrs).toBe(0);
    expect(R.depthAdcPfd && R.depthGeaGia1 && R.depthGia1Pfd).toBe(1);
    expect(R.depthPitotAsi).toBe(1);
    s.avx.ahrsFail = false;
    s.avx.adcFail = true;
    R = rates(s);
    expect(R.depthAdcPfd || R.depthAdcGia1 || R.depthAdcGia2 || R.depthAdcAhrs || R.depthOatAdc).toBe(0);
    expect(R.depthAhrsPfd).toBe(1);
    expect(R.depthPitotAsi && R.depthStaticAsi && R.depthStaticAlt).toBe(1);
  });

  it("stops a failed GIA's links while the other receiver and its data paths remain powered (Garmin pp. 1-2–1-7)", () => {
    const s = patched(initialSim, { elec: { cb: { "AV2:NAV 2": true } } });
    const R = rates(s);
    for (const key of [
      "depthGia2Mfd",
      "depthGeaGia2",
      "depthAhrsGia2",
      "depthAdcGia2",
      "depthXpdrGia2",
      "depthGpsCoax2",
      "depthNavCoax2",
    ])
      expect(R[key], key).toBe(0);
    expect(R.depthGia1Pfd && R.depthGeaGia1 && R.depthAhrsGia1 && R.depthXpdrGia1).toBe(1);
    // The separately protected GIA 2 COM section remains live.
    expect(R.depthComCoax2).toBe(1);
  });

  it("separates satellite weather display, entertainment audio and passive RF channels", () => {
    const s = patched(initialSim, { elec: { cb: { "AV2:AUDIO": true } } });
    let R = rates(s);
    expect(R.depthGdlMfd).toBe(1);
    expect(R.depthGdlAudio || R.depthSpeaker || R.depthHeadset1 || R.depthMarkerCoax).toBe(0);
    expect(R.depthXmCoax).toBe(1);
    s.elec.cb["AV1:FIS"] = true;
    R = rates(s);
    expect(R.depthXmCoax || R.depthGdlMfd || R.depthGdlAudio).toBe(0);
  });

  it("keeps ELT remote control independent of aircraft buses and does not animate stationary mechanical cables", () => {
    const s = patched(initialSim, { elec: { bat: false, alt: false, stby: "OFF" }, cabin: { elt: "ON" } });
    const R = rates(s);
    expect(R.depthEltRemote).toBe(1);
    expect(R.depthGia1Pfd || R.depthPfdEss || R.depthPfdAv1).toBe(0);
    for (const key of [
      "depthParkCable",
      "depthHeatControl",
      "depthAirControl",
      "depthDefrostControl",
      "depthVacTransducer",
    ])
      expect(R[key], key).toBe(0);
  });

  it("models two integral-reservoir pilot brake masters and mechanical parking actuation (MM 32-42-00 p. 201)", () => {
    expect(CAT.parts.filter((p) => /brake master cylinder/i.test(p.name ?? ""))).toHaveLength(2);
    expect(SYSTEM_DEPTH_PARTS.filter((p) => p.name === "Integral brake-fluid reservoir")).toHaveLength(2);
    expect(CAT.parts.some((p) => /parking.*hydraulic.*valve|remote.*brake.*reservoir/i.test(p.name ?? ""))).toBe(false);
    expect(route("depthParkCable").pts).toContainEqual(D.masterL);
    expect(route("depthParkCable").pts.at(-1)).toEqual(D.masterR);
  });

  it("retains two static condensation sumps, two vent valves and their distinct thermal bypasses", () => {
    expect(SYSTEM_DEPTH_PARTS.filter((p) => p.name === "Static-line condensation sump")).toHaveLength(2);
    expect(SYSTEM_DEPTH_PARTS.filter((p) => p.name === "Fuel vent check valve")).toHaveLength(2);
    expect(SYSTEM_DEPTH_PARTS.filter((p) => p.name === "Vent-valve bypass bleed")).toHaveLength(2);
    expect(FLOWS.find((f) => f.key === "pitot")!.pts.at(-1)).toEqual(D.pitotTee);
    expect(FLOWS.find((f) => f.key === "staticL")!.pts.at(-1)).toEqual(D.staticTee);
    expect(route("depthStaticKap").pts[0]).toEqual(D.staticTee);
    expect(route("depthStaticKap").pts.at(-1)).toEqual(D.kap);
  });
});

describe("C182T start, priming and pressure-system continuity", () => {
  const stream = [
    "fuelL",
    "fuelR",
    "fuelPump",
    "fuelStr",
    "fuelEdp",
    "fuelServo",
    "fuelMetered",
    ...[1, 2, 3, 4, 5, 6].map((n) => "inj" + n),
  ];
  it("powered START drives the engine fuel pump before running, with no boost pump (POH 7-43)", () => {
    const s = cold(),
      E = solve(s),
      R = flowRates(s, E);
    expect(E.starterPwr && E.fuelPress).toBe(true);
    expect(E.fuelPumpOn).toBe(false);
    for (const key of stream) expect(R[key], key).toBeGreaterThan(0);
    expect(R.starter).toBeGreaterThan(0);
    expect(s.eng.running).toBe(false);
  });

  it("boost priming with the engine stopped supplies the complete selected stream without cranking", () => {
    const s = cold();
    s.eng.mags = "BOTH";
    s.fuel.pump = true;
    s.fuel.sel = "LEFT";
    const E = solve(s),
      R = flowRates(s, E);
    expect(E.fuelPumpOn).toBe(true);
    for (const key of stream.filter((key) => key !== "fuelR")) expect(R[key], key).toBeGreaterThan(0);
    expect(R.fuelR || R.starter).toBe(0);
  });

  it("unpowered START cannot create engine-driven pressure or move any feed stage", () => {
    const s = cold();
    s.elec.cb["XF:WARN"] = true;
    const E = solve(s),
      R = flowRates(s, E);
    expect(E.starterPwr || E.fuelPress).toBe(false);
    for (const key of stream) expect(R[key], key).toBe(0);
    expect(R.starter).toBe(0);
  });

  it("failed engine pump requires powered boost; pulling FUEL PUMP stops all stages again", () => {
    const s = cold();
    s.eng.fail.edp = true;
    let E = solve(s),
      R = flowRates(s, E);
    expect(E.fuelPress).toBe(false);
    for (const key of stream) expect(R[key], key).toBe(0);
    s.fuel.pump = true;
    E = solve(s);
    R = flowRates(s, E);
    expect(E.fuelPress).toBe(true);
    for (const key of stream) expect(R[key], key).toBeGreaterThan(0);
    s.elec.cb["E1:FUEL PUMP"] = true;
    E = solve(s);
    R = flowRates(s, E);
    expect(E.fuelPress).toBe(false);
    for (const key of stream) expect(R[key], key).toBe(0);
  });

  it("an OFF selector stops upstream/downstream fuel even with starter and boost available", () => {
    const s = cold();
    s.fuel.sel = "OFF";
    s.fuel.pump = true;
    const E = solve(s),
      R = flowRates(s, E);
    expect(E.starterPwr && E.fuelPumpOn).toBe(true);
    for (const key of stream) expect(R[key], key).toBe(0);
  });

  it("KAP 140 pressure input is independent of ADC failure but freezes with blocked static and recovers on alternate static (MM Fig. 201 Sheet 2)", () => {
    const s = patched(initialSim, { avx: { adcFail: true } });
    const f = { ...live.fs, alt: 7000, vs: 500, fail: { att: false, hdg: false, air: true } };
    let v = kapView(s, solve(s), f);
    expect(v.alt).toBe(7000);
    expect(v.vs).toBe(500);
    expect(v.fail.air).toBe(false);
    s.pitot.staticBlocked = true;
    live.staticAlt = 6500;
    v = kapView(s, solve(s), f);
    expect(v.alt).toBe(6500);
    expect(v.vs).toBe(0);
    s.pitot.altStatic = true;
    v = kapView(s, solve(s), f);
    expect(v.alt).toBeGreaterThan(6900);
    expect(v.vs).toBe(500);
  });
});
