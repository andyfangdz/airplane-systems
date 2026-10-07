"use client";
import { useState } from "react";
import { Gfc700Controls } from "@/components/avionics/Gfc700Controls";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Small, useTicker } from "@/components/ui/controls";
import { wrap360, type FlySet } from "@/lib/avionics/flight";
import { gfc700Engaged, gfc700Fail, gfc700Key, type Gfc700Fail, type Gfc700Key } from "@/lib/avionics/gfc700";
import { useView } from "@/lib/view";
import { Nav3AnnTable } from "../../cessna/panels";
import { mfdReversion, pfdReversion } from "../displays";
import { AFCS_CFG, C172S_ANN, densityFactor, live } from "../model";
import { CAT, P3 } from "../parts";
import { useC172 } from "../store";
import { SYS } from "../systems";
import { NAV3_BL } from "../../cessna/faceplate";
import { scenarioCruise } from "../store";

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
        <BtnRow>
          {([["Close-up: PFD", NAV3_BL.pfd], ["Close-up: MFD", NAV3_BL.mfd]] as [string, number][]).map(([label, bl]) => {
            const t = P3(18.62, bl, 60.6);
            // labels off for the close-up so they don't sit on the display
            return <button key={label} type="button" className="btn" onClick={() => { useView.getState().set({ labels: false }); useView.getState().flyTo([t[0] - 0.46, t[1] + 0.02, t[2]], t); }}>{label}</button>;
          })}
          <button type="button" className="btn" onClick={() => { const [p, t] = SYS.find((x) => x.id === "avionics")!.cam; useView.getState().set({ labels: true }); useView.getState().flyTo(p, t); }}>Whole panel</button>
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
      <Nav3AnnTable defs={C172S_ANN} />
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
      <p className="lead">The Garmin GFC 700 is a two-axis autopilot and flight director with pitch trim, run by the GIAs and flown through three servos: roll (aileron cables, FS 59.5), pitch (elevator cables, FS 180.7) and pitch trim (trim cable, FS 180.7) — there is no yaw servo. The AFCS keys are on both the PFD and MFD bezels; the pilot&apos;s wheel has A/P TRIM DISC, CWS and the split MET switch; GA is next to the throttle. The servos take power from the AUTO PILOT breaker on AVIONICS BUS 2; the flight director is computed in the GIAs (POH 7-71, Figure 7-10).</p>
      <Gfc700Controls st={st} fs={fs} powered={st.powered} cfg={AFCS_CFG} layout="cessna" where="PFD / MFD bezel" yoke="Pilot's wheel · GA" loc={[loc, false]} onKey={onKey} onSet={onSet} />
      {!st.powered && <Caution title="No power">The flight director needs GIA 1 and the PFD; the autopilot and MET also need GIA 2 and the AUTO PILOT breaker on AVIONICS BUS 2. Turn the AVIONICS switch on (Electrical) — the preflight test (white PFT) runs on power-up.</Caution>}
      {st.ap && outside && <Caution title="Limitation">Autopilot engagement range is 70–150 KIAS (POH 2-21).</Caution>}
      <H3>Set up</H3>
      <Ctl>
        <BtnRow>
          {/* left of the course (xtk < 0) with the present heading — and the heading bug — 30° / 20° right of it: an intercept */}
          {scen("GPS course to intercept", () => { const h = Math.round(live.fs.hdg); live.fs = { ...live.fs, navSrc: "GPS", crs: wrap360(h - 30), hdgBug: h, xtk: -2.2, gsErr: null, vpath: null }; })}
          {scen("ILS: LOC + glideslope", () => { setLoc(true); const h = Math.round(live.fs.hdg); live.fs = { ...live.fs, navSrc: "LOC1", crs: wrap360(h - 20), hdgBug: h, xtk: -0.5, gsErr: -350, vpath: null, selAlt: 1500 }; })}
          {scen("Climb: FLC to 6,500", () => { live.fs = { ...live.fs, selAlt: 6500 }; })}
          {scen("VNAV descent path", () => { live.fs = { ...live.fs, vpath: { err: -150, vs: -500 }, selAlt: 2500 }; })}
        </BtnRow>
        <Check id="loc1" label="NAV 1 tuned to a localizer (CDI shows LOC1)" checked={loc} onChange={setLoc} />
      </Ctl>
      <Small>Try: AP (engages in ROL/PIT), then HDG and move the bug; NAV with the GPS course set up (arms white, captures green); ALT knob up and FLC or VS to climb — ALTS arms and captures; APR on the ILS to capture LOC then GS. Switching the CDI while coupled drops to ROL with no aural alert.</Small>
      <H3>Failures</H3>
      <Ctl>
        <BtnRow>
          {FAILS.map(([k, label]) => <Check key={k} id={"f" + k} label={label} checked={k === "sys" && live.servoLost ? live.sysUser : !!st.fail[k]}
            onChange={(v) => { if (k === "sys" && live.servoLost) live.sysUser = v; else live.afcs = gfc700Fail(live.afcs, { [k]: v }, live.fs.t); }} />)}
          <Check id="mis" label="Elevator mistrim (↑ELE)" checked={st.fail.mistrim === "↑ELE"} onChange={(v) => { live.afcs = gfc700Fail(live.afcs, { mistrim: v ? "↑ELE" : null }, live.fs.t); }} />
          <Check id="apcb" label="AUTO PILOT breaker pulled" checked={!!s.elec.cb["AV2:AUTO PILOT"]} onChange={(v) => up((d) => { if (v) d.elec.cb["AV2:AUTO PILOT"] = true; else delete d.elec.cb["AV2:AUTO PILOT"]; })} />
        </BtnRow>
        <Readouts items={[["Flight director", E.fdPwr ? "GIA 1 + PFD" : ["OFF", "bad"]], ["Servo power", E.afcsPwr ? "AUTO PILOT · AVN BUS 2" : ["OFF", "bad"]], ["Preflight test", st.pft === "run" ? ["RUNNING", "warnc"] : st.pft === "pass" ? "Passed" : st.pft === "fail" ? ["FAILED", "bad"] : "—"], ["Servos", gfc700Engaged(st) ? ["DRIVING", "warnc"] : "Released"], ["Trim wheel", st.trim > 0.02 ? "Nose up" : st.trim < -0.02 ? "Nose down" : "Takeoff"]]} />
        <Small>Pulling the AUTO PILOT breaker removes servo power only: the flight director stays, AFCS (red) shows, and an engaged autopilot disconnects with the red AP and continuous tone.</Small>
      </Ctl>
      <Caution title="AP or PTRM annunciator (POH 3-22)">Control wheel — GRASP FIRMLY · A/P TRIM DISC — PRESS and HOLD · elevator trim — ADJUST MANUALLY · AUTO PILOT breaker — OPEN · A/P TRIM DISC — RELEASE. Don&apos;t re-engage until the cause is corrected.</Caution>
      <H3>Modes (CRG pp. 19–22)</H3>
      <Facts rows={[
        ["Default", "ROL: holds the roll attitude or rolls the wings level, depending on the commanded bank · PIT: holds the pitch attitude"],
        ["HDG", "Captures and tracks the selected heading (cyan bug)"],
        ["NAV", "Captures and tracks the CDI source — GPS, VOR or LOC (glideslope won't arm)"],
        ["APR", "GPS / VAPP / LOC; GP armed automatically with vertical guidance, GS armed automatically on a LOC"],
        ["BC", "Localizer back course (BC key)"],
        ["ALT", "Holds the current altitude reference"],
        ["VS", "Holds vertical speed; may be used to climb or descend to the selected altitude"],
        ["FLC", "Holds airspeed while climbing or descending to the selected altitude"],
        ["VNV", "VPTH: captures and tracks descent legs of an active vertical profile — needs a valid VNV flight plan"],
        ["ALTS", "Armed automatically when PIT, VS, FLC or GA is active; captures the selected altitude"],
        ["GA / TO", "GA button: in the air GA — disengages the AP, wings level and a constant pitch angle; on the ground TO"],
      ]} />
      <H3>AFCS alerts (CRG 117–118)</H3>
      <Facts rows={[["PFT", "White while the preflight test runs; red if it failed"], ["PTCH · ROLL", "Red: pitch / roll axis failure — AP inoperative"], ["PTRM", "Red: MET switch stuck or pitch trim failure"], ["AFCS", "Red: system failure — AP and MET unavailable, FD may still be available"], ["↑ELE ↓ELE ←AIL AIL→", "Yellow: a servo is holding a sustained force — be ready for it at disconnect"]]} />
      <H3>Generic GFC 700 behaviour (DA40 Garmin documents — not in the 172S POH or CRG)</H3>
      <Small>Modelled from the DA40 GFC 700 AFMS and CRG because the Cessna documents don&apos;t describe it; treat these as assumptions for N6189Q.</Small>
      <Facts rows={[
        ["Roll hold", "Below 6° bank rolls wings level; bank limited to 22°"],
        ["NAV / APR", "Captures at once within 1 dot of the CDI, otherwise arms (white)"],
        ["ALT key", "Holds the current altitude to the nearest 10 ft"],
        ["NOSE UP / DN", "VS reference in 100 fpm steps; in FLC, NOSE UP = slower"],
        ["Ranges modelled", "VS −3,000 … +1,500 fpm · PIT −15° … +20° · FLC 70–150 kt · GA / TO pitch 7°"],
        ["Mode changes", "Automatic armed → active changes flash green 10 s; a lost mode flashes yellow 10 s, then ROL / PIT"],
        ["AP disconnect", "Normal (AP key, A/P TRIM DISC, MET, GA): AP flashes yellow with a 2-s tone. Automatic: AP flashes red with a continuous tone until A/P TRIM DISC"],
        ["MAXSPD", "DA40 overspeed pitch-up (165 KIAS there). The 172S only limits engagement to 150 KIAS, so it is not modelled"],
      ]} />
      <H3>Limitations (POH 2-21)</H3>
      <Notes items={["Preflight test must pass before using the AP, FD or MET.", "Pilot with seat belt fastened in the left seat; AP off for takeoff and landing.", "Engagement 70–150 KIAS; electric trim up to 163 KIAS.", "Maximum fuel imbalance with the AP engaged: 90 lb.", "Disengage below 200 ft AGL on approach and 800 ft AGL otherwise; ILS coupled to Category I only.", "No AP use with the audio panel inoperative (no disconnect tone), or on a missed approach until a safe climb is established."]} />
      <H3>Servos &amp; controls — tap to locate</H3>
      <PartsList parts={CAT.pinned("autopilot")} />
      <Notes items={["CWS releases the pitch and roll servos while held; large pitch changes under CWS leave the airplane out of trim (POH 7-71).", "Overpowering the AP makes the autotrim run against you — expect large forces when it disconnects (CRG 113).", "Changing the CDI source while in NAV, APR or BC drops the AP to ROL with no aural alert — it will only hold wings level (POH 7-21).", "The trim servo drives the same cable as the trim wheel, so the wheel turns under MET and autotrim."]} />
    </>
  );
}
