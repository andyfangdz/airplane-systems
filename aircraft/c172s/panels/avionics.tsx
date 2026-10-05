"use client";
import { useState } from "react";
import { Gfc700Controls } from "@/components/avionics/Gfc700Controls";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Small, useTicker } from "@/components/ui/controls";
import { wrap360, type FlySet } from "@/lib/avionics/flight";
import { gfc700Fail, gfc700Key, type Gfc700Fail, type Gfc700Key } from "@/lib/avionics/gfc700";
import { Nav3AnnTable } from "../../cessna/panels";
import { mfdReversion, pfdReversion } from "../displays";
import { AFCS_CFG, densityFactor, live } from "../model";
import { CAT } from "../parts";
import { useC172 } from "../store";
import { scenarioCruise } from "../tick";

const onOff = (b: boolean): [string, "" | "bad"] => (b ? ["ON", ""] : ["OFF", "bad"]);

export function Avionics() {
  useTicker(300);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update), a = s.avx;
  const both = (label: string) => E.on["ESS:" + label] && E.on["AV1:" + label] ? "ESS + AVN 1" : E.on["ESS:" + label] ? "ESS only" : E.on["AV1:" + label] ? "AVN 1 only" : "none";
  return (
    <>
      <p className="lead">Garmin G1000 NAV III: two GDU 1040 displays (PFD and MFD), a GMA 1347 audio panel between them, two GIA 63W integrated avionics units, the GRS 77 AHRS with a GMU 44 magnetometer, the GDC 74A air data computer, the GEA 71 engine/airframe unit and a GTX 33 transponder. The displays here are live: they go dark when their breakers or buses die, and revert automatically (POH 7-68 – 7-74).</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="dbk" label="DISPLAY BACKUP (red button on the audio panel)" checked={a.backup} onChange={(v) => up((d) => { d.avx.backup = v; })} />
        <BtnRow>
          <Check id="pfdF" label="PFD fails" checked={a.pfdFail} onChange={(v) => up((d) => { d.avx.pfdFail = v; })} />
          <Check id="mfdF" label="MFD fails" checked={a.mfdFail} onChange={(v) => up((d) => { d.avx.mfdFail = v; })} />
          <Check id="ahrsF" label="AHRS fails" checked={a.ahrsFail} onChange={(v) => up((d) => { d.avx.ahrsFail = v; })} />
          <Check id="adcF" label="Air data computer fails" checked={a.adcFail} onChange={(v) => up((d) => { d.avx.adcFail = v; })} />
        </BtnRow>
        <Readouts items={[
          ["PFD", E.pfd ? (pfdReversion(s, E) ? ["PFD + EIS", ""] : ["ON", ""]) : ["OFF", "bad"]], ["MFD", E.mfd ? (mfdReversion(s, E) ? ["REVERSION", ""] : ["MAP + EIS", ""]) : ["OFF", "bad"]],
          ["AHRS", E.ahrs ? "Valid" : ["RED X", "bad"]], ["Air data", E.adc ? "Valid" : ["RED X", "bad"]],
          ["GIA 1 / 2", `${E.gia1 ? "on" : "off"} / ${E.gia2 ? "on" : "off"}`], ["Transponder", onOff(E.xpdr)], ["Audio panel", onOff(E.audio)], ["Fans fwd / aft", `${E.fwdFan ? "on" : "off"} / ${E.aftFan ? "on" : "off"}`],
        ]} />
      </Ctl>
      <Small>Reversion: either display shows the PFD instruments plus the EIS strip when the other is lost, or both do with DISPLAY BACKUP (POH 7-11; CRG 109). With the MFD off — e.g. during engine start before AVIONICS BUS 2 is on — the PFD carries the EIS.</Small>
      <H3>Power paths (Figure 7-7)</H3>
      <Facts rows={[["PFD", `PFD breakers on ESS and AVN BUS 1 — live: ${both("PFD")}`], ["ADC / AHRS", `ADC AHRS on ESS and AVN BUS 1 — live: ${both("ADC AHRS")}`], ["NAV 1 / GEA 71", `NAV 1 ENG on ESS and AVN BUS 1 — live: ${both("NAV 1 ENG")}`], ["COM 1", "COMM 1, ESSENTIAL BUS"], ["MFD (+ fan)", "MFD, AVIONICS BUS 2"], ["Audio · XPDR · NAV 2 · COM 2 · AP", "AVIONICS BUS 2"], ["Fans", "Forward + PFD fans on AVN 1 PFD; aft fan on NAV 2; none on the standby battery"]]} />
      <H3>Annunciation window (POH 7-51)</H3>
      <Nav3AnnTable />
      <Small>Expected before start with the MASTER on: OIL PRESSURE, LOW VOLTS and LOW VACUUM shown; LOW FUEL not shown (POH 4-5). Run-up: no annunciations (POH 4-16). PITOT HEAT has no annunciation on this airplane; “PITCH TRIM” is KAP 140 only.</Small>
      <H3>Units — tap to locate</H3>
      <PartsList parts={CAT.pinned("avionics")} />
      <Notes items={["A missing CDI deviation bar is the navigation warning flag on the HSI (POH 4-17).", "Red X on the attitude or HSI: AHRS lost — check both ADC/AHRS breakers, use the standby attitude indicator and compass; the autopilot won't operate (POH 3-21, 3-29).", "Use of the TRAFFIC MAP to maneuver, TERRAIN for primary avoidance or the NAVIGATION MAP for pilotage is prohibited (POH 2-20).", "Split COM (COM 1/2) on the audio panel is not approved (POH 2-21)."]} />
    </>
  );
}

/* ---------- autopilot ---------- */
const FAILS: [keyof Gfc700Fail, string][] = [["pft", "Preflight test fails (red PFT)"], ["pitch", "Pitch servo fails (PTCH)"], ["roll", "Roll servo fails (ROLL)"], ["trim", "Trim fails / MET stuck (PTRM)"], ["sys", "AFCS system failure (AFCS)"]];

export function Autopilot() {
  useTicker(100);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update);
  const [loc, setLoc] = useState(false);
  const st = live.afcs, fs = live.fs;
  const onKey = (k: Gfc700Key) => { live.afcs = gfc700Key(live.afcs, k, live.fs, AFCS_CFG); };
  const onSet = (p: FlySet) => {
    const { power, ...rest } = p;
    live.fs = { ...live.fs, ...rest };
    if (power != null) up((d) => { d.eng.throttle = Math.min(1, Math.pow(Math.max(0, power) / densityFactor(live.fs.alt), 1 / 0.85)); });
  };
  const air = () => { if (s.ground || !s.eng.running) scenarioCruise(); };
  const scen = (label: string, fn: () => void) => <button key={label} type="button" className="btn" onClick={() => { air(); fn(); }}>{label}</button>;
  const ias = fs.ias, outside = !s.ground && (ias < 70 || ias > 150);
  return (
    <>
      <p className="lead">The Garmin GFC 700 is a two-axis autopilot and flight director with pitch trim, run by the GIAs and flown through three servos: roll (aileron cables, FS 59.5), pitch (elevator cables, FS 180.7) and pitch trim (trim cable, FS 180.7) — there is no yaw servo. The AFCS keys are on both the PFD and MFD bezels; the pilot&apos;s wheel has A/P TRIM DISC, CWS and the split MET switch; GA is next to the throttle. Power comes through the AUTO PILOT breaker on AVIONICS BUS 2 (POH 7-71, Figure 7-10).</p>
      <Gfc700Controls st={st} fs={fs} powered={st.powered} cfg={AFCS_CFG} layout="cessna" where="PFD / MFD bezel" yoke="Pilot's wheel · GA" loc={[loc, false]} onKey={onKey} onSet={onSet} />
      {!st.powered && <Caution title="No power">The AFCS needs AVIONICS BUS 2, the AUTO PILOT breaker, a GIA and the PFD. Turn the AVIONICS switch on (Electrical) — the preflight test (white PFT) runs on power-up.</Caution>}
      {st.ap && outside && <Caution title="Limitation">Autopilot engagement range is 70–150 KIAS (POH 2-21).</Caution>}
      <H3>Set up</H3>
      <Ctl>
        <BtnRow>
          {scen("GPS course to intercept", () => { live.fs = { ...live.fs, navSrc: "GPS", crs: wrap360(Math.round(live.fs.hdg) + 30), xtk: -2.2, gsErr: null, vpath: null }; })}
          {scen("ILS: LOC + glideslope", () => { setLoc(true); live.fs = { ...live.fs, navSrc: "LOC1", crs: wrap360(Math.round(live.fs.hdg) + 20), xtk: -0.5, gsErr: -350, vpath: null, selAlt: 1500 }; })}
          {scen("Climb: FLC to 6,500", () => { live.fs = { ...live.fs, selAlt: 6500 }; })}
          {scen("VNAV descent path", () => { live.fs = { ...live.fs, vpath: { err: -150, vs: -500 }, selAlt: 2500 }; })}
        </BtnRow>
        <Check id="loc1" label="NAV 1 tuned to a localizer (CDI shows LOC1)" checked={loc} onChange={setLoc} />
      </Ctl>
      <Small>Try: AP (engages in ROL/PIT), then HDG and move the bug; NAV with the GPS course set up (arms white, captures green); ALT knob up and FLC or VS to climb — ALTS arms and captures; APR on the ILS to capture LOC then GS. Switching the CDI while coupled drops to ROL with no aural alert.</Small>
      <H3>Failures</H3>
      <Ctl>
        <BtnRow>
          {FAILS.map(([k, label]) => <Check key={k} id={"f" + k} label={label} checked={!!st.fail[k]} onChange={(v) => { live.afcs = gfc700Fail(live.afcs, { [k]: v }, live.fs.t); }} />)}
          <Check id="mis" label="Elevator mistrim (↑ELE)" checked={st.fail.mistrim === "↑ELE"} onChange={(v) => { live.afcs = gfc700Fail(live.afcs, { mistrim: v ? "↑ELE" : null }, live.fs.t); }} />
          <Check id="apcb" label="AUTO PILOT breaker pulled" checked={!!s.elec.cb["AV2:AUTO PILOT"]} onChange={(v) => up((d) => { if (v) d.elec.cb["AV2:AUTO PILOT"] = true; else delete d.elec.cb["AV2:AUTO PILOT"]; })} />
        </BtnRow>
        <Readouts items={[["AFCS power", E.afcsPwr ? "AVN BUS 2" : ["OFF", "bad"]], ["Preflight test", st.pft === "run" ? ["RUNNING", "warnc"] : st.pft === "pass" ? "Passed" : st.pft === "fail" ? ["FAILED", "bad"] : "—"], ["Servos", st.ap && !st.cws ? ["DRIVING", "warnc"] : "Released"], ["Trim wheel", st.trim > 0.02 ? "Nose up" : st.trim < -0.02 ? "Nose down" : "Takeoff"]]} />
      </Ctl>
      <Caution title="AP or PTRM annunciator (POH 3-22)">Control wheel — GRASP FIRMLY · A/P TRIM DISC — PRESS and HOLD · elevator trim — ADJUST MANUALLY · AUTO PILOT breaker — OPEN · A/P TRIM DISC — RELEASE. Don&apos;t re-engage until the cause is corrected.</Caution>
      <H3>Modes (CRG pp. 19–22)</H3>
      <Facts rows={[
        ["Default", "ROL (holds bank, levels below 6°) and PIT (holds pitch)"],
        ["HDG", "Turns to and holds the cyan heading bug"],
        ["NAV", "GPS, VOR or LOC on the CDI source: captures within 1 dot, otherwise arms (white)"],
        ["APR", "GPS / VAPP / LOC; arms GP (WAAS) or GS automatically"],
        ["BC", "Localizer back course (dedicated key on the Cessna bezel)"],
        ["ALT", "Holds the current altitude (nearest 10 ft)"],
        ["VS", "Holds vertical speed; NOSE UP/DN changes it 100 fpm"],
        ["FLC", "Holds airspeed toward the selected altitude; NOSE UP = slower"],
        ["VNV", "VPTH on a vertical profile; needs a VNAV flight plan"],
        ["ALTS", "Armed automatically in PIT, VS, FLC, GA; captures the ALT SEL altitude"],
        ["GA / TO", "GA button: in the air disengages the AP, wings level and fixed pitch-up; on the ground TO"],
      ]} />
      <H3>Annunciations (AFCS status bar, top of the PFD)</H3>
      <Facts rows={[["Green / white", "Active / armed modes; automatic changes flash green 10 s"], ["Yellow mode", "Lost mode (sensor or nav): flashes 10 s, then ROL / PIT"], ["AP flashing yellow", "Normal disconnect (AP key, A/P TRIM DISC, MET, GA) with a 2-s tone"], ["AP flashing red", "Automatic disconnect: continuous tone until A/P TRIM DISC"], ["PFT", "White while the preflight test runs; red if it failed"], ["PTCH · ROLL · PTRM · AFCS", "Red: pitch, roll, trim or system failure"], ["↑ELE ↓ELE ←AIL AIL→", "Yellow: servo holding a sustained force — expect it at disconnect"], ["MAXSPD", "Yellow: overspeed protection pitching up"]]} />
      <H3>Limitations (POH 2-21)</H3>
      <Notes items={["Preflight test must pass before using the AP, FD or MET.", "Pilot with seat belt fastened in the left seat; AP off for takeoff and landing.", "Engagement 70–150 KIAS; electric trim up to 163 KIAS.", "Maximum fuel imbalance with the AP engaged: 90 lb.", "Disengage below 200 ft AGL on approach and 800 ft AGL otherwise; ILS coupled to Category I only.", "No AP use with the audio panel inoperative (no disconnect tone), or on a missed approach until a safe climb is established."]} />
      <H3>Servos &amp; controls — tap to locate</H3>
      <PartsList parts={CAT.pinned("autopilot")} />
      <Notes items={["CWS releases the pitch and roll servos while held; large pitch changes under CWS leave the airplane out of trim (POH 7-71).", "Overpowering the AP makes the autotrim run against you — expect large forces when it disconnects (CRG 113).", "Changing the CDI source while in NAV, APR or BC drops the AP to ROL with no aural alert — it will only hold wings level (POH 7-21).", "The trim servo drives the same cable as the trim wheel, so the wheel turns under MET and autotrim."]} />
    </>
  );
}
