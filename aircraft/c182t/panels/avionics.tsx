"use client";
import { useState } from "react";
import { Kap140Unit } from "@/components/avionics/Kap140Unit";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Small, useTicker } from "@/components/ui/controls";
import { wrap360, type FlySet } from "@/lib/avionics/flight";
import { kap140Fail, kap140Key, kap140P, kap140Pfd, kap140Phase, kap140R, type Kap140Fail, type Kap140Key, type Kap140State } from "@/lib/avionics/kap140";
import type { Vec3 } from "@/lib/math";
import { useView } from "@/lib/view";
import { Nav3AnnTable } from "../../cessna/panels";
import { mfdReversion, pfdReversion } from "../displays";
import { C182T_ANN, live, manifold, powerFrac, type Sim } from "../model";
import { CAT, P3 } from "../parts";
import { KAP_LCD } from "../parts-systems";
import { useC182 } from "../store";
import { SYS } from "../systems";
import { kapView, scenarioCruise } from "../tick";

const onOff = (b: boolean): [string, "" | "bad"] => (b ? ["ON", ""] : ["OFF", "bad"]);
/** Camera close-up in front of a panel point (labels off so they don't sit on the display). */
const closeUp = (t: Vec3, back = 0.46) => { useView.getState().set({ labels: false }); useView.getState().flyTo([t[0] - back, t[1] + 0.02, t[2]], t); };
const wholePanel = () => { const [p, t] = SYS.find((x) => x.id === "avionics")!.cam; useView.getState().set({ labels: true }); useView.getState().flyTo(p, t); };

export function Avionics() {
  useTicker(300);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update), a = s.avx;
  const both = (label: string) => E.on["ESS:" + label] && E.on["AV1:" + label] ? "ESS + AVN 1" : E.on["ESS:" + label] ? "ESS only" : E.on["AV1:" + label] ? "AVN 1 only" : "none";
  return (
    <>
      <p className="lead">Garmin G1000 NAV III: two GDU 1040 displays (PFD and MFD), a GMA 1347 audio panel between them, two GIA 63 integrated avionics units, the GRS 77 AHRS with a GMU 44 magnetometer, the GDC 74A air data computer, the GEA 71 engine/airframe unit and a GTX 33 transponder; the standby airspeed, vacuum attitude and altimeter sit below the audio panel, with the KAP 140 under them. The displays here are live: they go dark when their breakers or buses die, and revert automatically (POH 7-10 – 7-12, 7-66 – 7-70).</p>
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
          <button type="button" className="btn" onClick={() => closeUp(P3(18.82, -11.5, 61.0))}>Close-up: PFD</button>
          <button type="button" className="btn" onClick={() => closeUp(P3(18.82, 10.5, 61.0))}>Close-up: MFD</button>
          <button type="button" className="btn" onClick={() => closeUp([KAP_LCD.pos[0], KAP_LCD.pos[1] + 0.06, KAP_LCD.pos[2]], 0.34)}>Close-up: standby + KAP 140</button>
          <button type="button" className="btn" onClick={wholePanel}>Whole panel</button>
        </BtnRow>
        <Readouts items={[
          ["PFD", E.pfd ? (pfdReversion(s, E) ? ["PFD + EIS", ""] : ["ON", ""]) : ["OFF", "bad"]], ["MFD", E.mfd ? (mfdReversion(s, E) ? ["REVERSION", ""] : ["MAP + EIS", ""]) : ["OFF", "bad"]],
          ["AHRS", E.ahrs ? "Valid" : ["RED X", "bad"]], ["Air data", E.adc ? "Valid" : ["RED X", "bad"]],
          ["GIA 1 / 2", `${E.gia1 ? "on" : "off"} / ${E.gia2 ? "on" : "off"}`], ["Transponder", onOff(E.xpdr)], ["Audio panel", onOff(E.audio)], ["Fans fwd / MFD / aft", `${E.fwdFan ? "on" : "off"} / ${E.mfdFan ? "on" : "off"} / ${E.aftFan ? "on" : "off"}`],
        ]} />
      </Ctl>
      <Small>Reversion: either display shows the PFD instruments plus the EIS strip when the other is lost, or both do with DISPLAY BACKUP (POH 7-11, 7-28; CRG 109). With the MFD off — e.g. during engine start before AVIONICS BUS 2 is on — the PFD carries the EIS. The 182T PFD has no AFCS status bar: the KAP 140 shows its own modes, and only the red PITCH TRIM box (top right) reaches the PFD.</Small>
      <H3>Power paths (Figure 7-7 Sheet 2)</H3>
      <Facts rows={[["PFD", `PFD breakers on ESS and AVN BUS 1 — live: ${both("PFD")}`], ["ADC / AHRS", `ADC AHRS on ESS and AVN BUS 1 — live: ${both("ADC AHRS")}`], ["NAV 1 / GEA 71", `NAV 1 ENG on ESS and AVN BUS 1 — live: ${both("NAV 1 ENG")}`], ["COM 1", "COMM 1, ESSENTIAL BUS"], ["MFD (+ fan)", "MFD, AVIONICS BUS 2"], ["Audio · XPDR · NAV 2 · COM 2 · KAP 140", "AVIONICS BUS 2"], ["Fans", "Forward (deckskin) + PFD fans on AVN 1 PFD; MFD fan on MFD; aft fan on NAV 2; none on the standby battery"]]} />
      <H3>Annunciation window (POH 7-51)</H3>
      <Nav3AnnTable defs={C182T_ANN} />
      <Small>Expected before start with the MASTER on: OIL PRESSURE and LOW VACUUM shown (and LOW VOLTS); LOW FUEL not shown (POH 4-7). Run-up: no annunciations (POH 4-17). PITCH TRIM is drawn in its own red box at the top right of the PFD (S3-11); it also shows briefly as the lamp check at the end of the KAP 140 self-test. No pitot-heat annunciation.</Small>
      <H3>Units — tap to locate</H3>
      <PartsList parts={CAT.pinned("avionics")} />
      <Notes items={["A missing CDI deviation bar is the navigation warning flag on the HSI (POH 4-17).", "Red X on the attitude or HSI: AHRS lost — check both ADC/AHRS breakers, use the standby attitude indicator and the magnetic compass (POH 3-19, 3-20). The KAP 140 then works in ROL only (S3-19, modelled here). POH 3-26 says NAV/APR/REV still work with a valid GPS/NAV signal and a good turn coordinator and only HDG is lost — the sources disagree; the supplement governs the autopilot.", "Use of the TRAFFIC MAP to maneuver, TERRAIN for primary avoidance or the NAVIGATION MAP for pilotage is prohibited; split COM 1/2 is not approved (POH 2-16).", "Avionics cooling: the forward fan blows warm air up the windshield (check it on preflight with AVIONICS BUS 1 on); the aft fan cools the GIAs and transponder (check it with BUS 2) (POH 4-7, 7-69)."]} />
    </>
  );
}

/* ---------- autopilot ---------- */
/** Throttle for the ILS scenario (fraction of 230 BHP): the teaching flight model adds ≈ 1 kt per 13 fpm of descent. */
const ILS_POWER = 0.08;
const FAILS: [keyof Kap140Fail, string][] = [["p", "Pitch axis fails (red P)"], ["r", "Roll axis fails (red R)"], ["trim", "Pitch trim fault (PT / PITCH TRIM)"]];
/** Throttle that gives `power` (fraction of 230 BHP) at the present RPM and altitude, by bisection on the engine model. */
function throttleFor(s: Sim, power: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2, t: Sim = { ...s, eng: { ...s.eng, throttle: mid } };
    const p = powerFrac(t, manifold(t, Math.max(live.rpm, 1500), live.fs.alt), Math.max(live.rpm, 1500), live.fs.alt);
    if (p < power) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function Autopilot() {
  useTicker(100);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update);
  const [loc, setLoc] = useState(false);
  // KAP 140 and flight state live outside React: re-render at once after a change so controlled inputs don't snap back
  const [, force] = useState(0), rerender = () => force((n) => n + 1);
  const st = live.kap, fs = live.fs, now = fs.t;
  const onKey = (k: Kap140Key) => { const c = useC182.getState(); live.kap = kap140Key(live.kap, k, kapView(c.s, c.E, live.fs)); rerender(); };
  const onSet = (p: FlySet) => {
    const { power, ...rest } = p;
    live.fs = { ...live.fs, ...rest };
    rerender();
    if (power != null) up((d) => { d.eng.throttle = throttleFor(useC182.getState().s, power); });
  };
  const air = () => { if (s.ground || !s.eng.running) scenarioCruise(); };
  const scen = (label: string, fn: () => void) => <button key={label} type="button" className="btn" onClick={() => { air(); fn(); rerender(); }}>{label}</button>;
  const ph = kap140Phase(st, now).ph;
  const ias = fs.ias, outside = !s.ground && (ias < 80 || ias > 160);
  const pitchTrim = E.warnPwr && kap140Pfd(st, now) != null;
  // Aural: the disconnect horn (also the end-of-test tone) is powered through WARN and heard through the audio panel — it still sounds
  // when the computer loses power while engaged; the altitude-alert tones need the audio panel (S3-10 items 11–12, S3-19 item 7).
  const lostPwr = !st.powered && live.discTone > now;
  const kind = lostPwr ? "disc" : st.tone > now ? st.toneKind : null;
  const heard = kind === "alert" ? E.audio : E.warnPwr && E.audio;
  const unit: Kap140State = !kind || !heard ? { ...st, tone: 0 } : lostPwr ? { ...st, tone: live.discTone, toneKind: "disc" } : st;
  /** Knob → 7,500 through the KAP logic (arms ALT with the AP engaged and resets the alerter, S3-12); engages AP if needed, +500 FPM. */
  const preselectClimb = () => {
    const c = useC182.getState(), v = kapView(c.s, c.E, live.fs);
    let k: Kap140State = { ...live.kap, baroSet: true, disp: "alt", dispUntil: 0 };
    if (!k.ap) k = kap140Key(k, "AP", v);
    k = kap140Key({ ...k, selAlt: 7400 }, "INNER_INC", v);
    if (k.ap && k.vert === "VS") k = { ...k, vsRef: 500 };
    live.kap = k;
    onSet({ power: 1 }); // climb: full throttle (POH 4-20)
  };
  return (
    <>
      <p className="lead">The Bendix/King KAP 140 is a two-axis (roll and pitch) autopilot with altitude preselect and electric pitch trim — no flight director, yaw damper, CWS or go-around button. The panel unit flies three servos: KS 271C roll (aileron cables, FS 52.0), KS-270C pitch (elevator cables, FS 158.8) and KS-272C pitch trim (trim cable, FS 176.4). ROL uses its own hidden DC turn coordinator; VS and ALT run independently of the G1000 (their sensor is not given in the POH); the encoder&apos;s gray-code altitude feeds only the altitude alerter and preselect (POH 7-12; S3-19). HDG, NAV, APR and REV follow the G1000 heading bug, course and CDI through GIA #2. Power: the 5 A AUTO PILOT breaker on AVIONICS BUS 2; WARN feeds the PFD&apos;s PITCH TRIM box and the disconnect horn (POH 7-12, 7-68; Supplement 3).</p>
      <Kap140Unit st={unit} fs={fs} onKey={onKey} onSet={onSet} loc={[loc, false]} />
      {live.voice && now - live.voiceT < 3 && <Caution title="Voice message">“{live.voice}” (S3-16)</Caution>}
      {pitchTrim && <Caution title="PITCH TRIM (red, PFD)">{st.fail.trim ? "Pitch trim fault: Recovery Procedure — grasp the wheel, A/P DISC/TRIM INT push and hold, trim manually, AUTO PILOT breaker OPEN (S3-14)." : "Lamp check at the end of the self-test."}</Caution>}
      {!st.powered && <Caution title="No power">The KAP 140 and its servos need AVIONICS BUS 2 and the AUTO PILOT breaker. Turn the AVIONICS switch (BUS 2) on — the preflight self-test (PFT 1, 2, … — the step number) starts by itself, then the display test, PITCH TRIM and the disconnect tone; the red P can stay on for about 30 s.</Caution>}
      {st.ap && outside && <Caution title="Limitation">Autopilot airspeed range 80–160 KIAS (S3-13).</Caution>}
      {st.ap && live.flapAng > 10.5 && <Caution title="Limitation">Maximum flap extension with the autopilot engaged is 10° (S3-13).</Caution>}
      <H3>Set up</H3>
      <Ctl>
        <BtnRow>
          {/* left of the course (xtk < 0) with the present heading — and the heading bug — 30° / 20° right of it: an intercept */}
          {scen("GPS course to intercept", () => { setLoc(false); const h = Math.round(live.fs.hdg); live.fs = { ...live.fs, navSrc: "GPS", crs: wrap360(h - 30), hdgBug: h, xtk: -1.6, gsErr: null, vpath: null }; })}
          {/* approach power: the descent on the glideslope adds speed, so the throttle comes back (keeps it inside 80–160 KIAS, S3-13) */}
          {scen("ILS: LOC + glideslope", () => { setLoc(true); const h = Math.round(live.fs.hdg); live.fs = { ...live.fs, navSrc: "LOC1", crs: wrap360(h - 20), hdgBug: h, xtk: -0.5, gsErr: -350, vpath: null }; onSet({ power: ILS_POWER }); })}
          {scen("Preselect 7,500 and climb", preselectClimb)}
          {scen("CDI softkey: change source (reversion)", () => { live.fs = { ...live.fs, navSrc: live.fs.navSrc === "GPS" ? (loc ? "LOC1" : "VOR1") : "GPS" }; })}
        </BtnRow>
        <Check id="loc1" label="NAV 1 tuned to a localizer (CDI shows LOC1)" checked={loc} onChange={setLoc} />
      </Ctl>
      <Small>Try: hold AP (engages ROL + VS at the current vertical speed), then HDG and move the bug; NAV with the GPS course (captures at once within 2–3 dots, otherwise NAV ARM; on any NAV/APR/REV selection HDG flashes 5 s to remind you to set the bug to the desired course — S3-18, S3-33); set an altitude with the knobs (ALT ARM) and UP for a climb — ALT captures at the preselect; APR on the ILS captures LOC, then GS ARM → GS. Switching the CDI while coupled drops to ROL with the old mode flashing and no chime or PFD alert (S3-31).</Small>
      <H3>Failures</H3>
      <Ctl>
        <BtnRow>
          {FAILS.map(([k, label]) => <Check key={k} id={"kf" + k} label={label} checked={!!st.fail[k]} onChange={(v) => { live.kap = kap140Fail(live.kap, { [k]: v }, live.fs.t); rerender(); }} />)}
          <Check id="tcF" label="DC turn coordinator fails" checked={s.avx.tcFail} onChange={(v) => up((d) => { d.avx.tcFail = v; })} />
          <Check id="apcb" label="AUTO PILOT breaker pulled" checked={!!s.elec.cb["AV2:AUTO PILOT"]} onChange={(v) => up((d) => { if (v) d.elec.cb["AV2:AUTO PILOT"] = true; else delete d.elec.cb["AV2:AUTO PILOT"]; })} />
          <Check id="nav2cb" label="NAV 2 breaker pulled (GIA #2)" checked={!!s.elec.cb["AV2:NAV 2"]} onChange={(v) => up((d) => { if (v) d.elec.cb["AV2:NAV 2"] = true; else delete d.elec.cb["AV2:NAV 2"]; })} />
          <Check id="ahrs2" label="AHRS fails" checked={s.avx.ahrsFail} onChange={(v) => up((d) => { d.avx.ahrsFail = v; })} />
        </BtnRow>
        <Readouts items={[
          ["Power", E.kapPwr ? "AUTO PILOT · AVN BUS 2" : ["OFF", "bad"]], ["Self-test", ph === "off" ? "—" : ph === "pft" ? ["PFT running", "warnc"] : ph === "test" ? ["Display test", "warnc"] : "Passed"],
          ["P / R", `${kap140P(st, now) ? "P" : "–"} / ${kap140R(st) ? "R" : "–"}`], ["Servos", st.ap ? ["DRIVING", "warnc"] : "Released"],
          ["Autotrim", st.pt ? `PT ${st.pt === "up" ? "▲" : "▼"}` : st.fail.trim ? ["PT FAULT", "bad"] : "—"], ["Trim wheel", st.trim > 0.02 ? "Nose up" : st.trim < -0.02 ? "Nose down" : "Takeoff"],
          ["PITCH TRIM (PFD)", pitchTrim ? ["SHOWN", "bad"] : E.warnPwr ? "—" : ["No WARN power", "warnc"]], ["Lateral source", E.gia2 && E.ahrs ? "GIA #2 (HDG/NAV)" : ["ROL only", "warnc"]],
        ]} />
        <Small>Turn-coordinator failure disengages the autopilot and stops it engaging. With the AHRS or GIA #2 lost: ROL only (HDG flashes) (S3-19 — POH 3-26 says only HDG is lost with the AHRS; the supplement is modelled). Pulling AUTO PILOT removes the computer and servo power — and manual electric trim with it (S3-13); if the autopilot was engaged the display goes blank but the disconnect horn, on WARN, still sounds through the audio panel. Trip WARN (Electrical) and the horn and PITCH TRIM go silent.</Small>
      </Ctl>
      <Caution title="Autopilot or trim malfunction — Recovery (S3-14)">Control wheel — GRASP FIRMLY · A/P DISC/TRIM INT — PUSH and HOLD throughout recovery · airplane — TRIM manually · AUTO PILOT breaker — OPEN. Maximum altitude loss: 650 ft in cruise, climb or descent; 100 ft maneuvering or on approach.</Caution>
      <H3>Modes (S3-8 – S3-12)</H3>
      <Facts rows={[
        ["AP", "Hold ≈ 0.25 s to engage in ROL + VS (the VS at the moment of engagement); press again to disengage. Not until the self-test passes and the red P is out"],
        ["ROL", "Wings level (turn-coordinator roll rate)"],
        ["HDG", "Turns at about standard rate to the PFD heading bug; press again for ROL"],
        ["NAV", "VOR, LOC or GPS course on the HSI; ARM until the intercept, then captures. GPS roll steering with an active flight plan"],
        ["APR", "As NAV with higher sensitivity; on an ILS, GS ARM at localizer capture, then GS"],
        ["REV", "Localizer back course; glideslope locked out"],
        ["VS", "UP/DN ±100 fpm a press, 300 fpm/s held; limits +1,500 / −2,000 fpm"],
        ["ALT", "Holds the altitude at the press (≈ 10% of the VS overshoot); UP/DN ±20 ft, held ±500 fpm"],
        ["ALT ARM", "Automatic when an altitude is set with the knobs while engaged (or ARM): captures the preselect"],
        ["ALERT", "Steady 1,000→200 ft approaching; flashes 2 s on reaching; flashes when 200→1,000 ft away again"],
      ]} />
      <H3>Annunciations</H3>
      <Facts rows={[["AP flashing", "Disengaged (A/P DISC, AP button, MET use, monitor) with a 2-second tone"], ["P · R (red)", "Pitch / roll axis failure — that axis won't engage; P may show ≈ 30 s after power-up"], ["PT ▲▼", "Autotrim running; flashing PT = trim not satisfied for 10 s; PT without arrow = trim fault"], ["PITCH TRIM (red, PFD)", "Trim fault from the self-test or continuous monitor (WARN power)"], ["Flashing mode", "Lost heading or nav signal: reverted to ROL / VS"]]} />
      <H3>Limitations (S3-13)</H3>
      <Notes items={["Complete the preflight test before every flight; AP and MET use is prohibited until then.", "Autopilot OFF for takeoff and landing; a pilot with the belt fastened in the left seat.", "80–160 KIAS; maximum flap extension 10°; maximum fuel imbalance 90 lb.", "Disengage below 200 ft AGL on approach and 800 ft AGL otherwise; Category I approaches only.", "Manually overriding the autopilot in pitch or roll is prohibited — disengage first.", "No KAP 140 use with the GMA 1347 audio panel inoperative (no disconnect tone)."]} />
      <H3>Preflight test (S3-20 – S3-24)</H3>
      <Notes items={["MASTER (BAT) ON, AVIONICS (BUS 2) ON: PFT X (X = the test step number), display test, PITCH TRIM on the PFD and the disconnect tone. If the red P stays on, the test failed — pull AUTO PILOT.", "MET: each switch half alone must not move the trim wheel (the right half alone lights the red PT within 5 s); both together trim, and A/P DISC/TRIM INT held stops it. The tab moves UP with nose-down trim.", "Set or accept BARO; engage AP and overpower it in pitch and roll; A/P DISC — disengages with the tone; trim wheel to TAKEOFF."]} />
      <H3>Servos &amp; controls — tap to locate</H3>
      <PartsList parts={CAT.pinned("autopilot")} />
      <Notes items={["There is no connection between the G1000 ALT SEL and the KAP 140 altitude alerter — set both (POH 7-16, S3-12).", "On a GPS approach to an ILS the G1000 switches the CDI to NAV1 near the final course: the KAP 140 reverts to ROL — press APR again (POH 4-45, S3-38).", "The trim servo drives the same cable as the trim wheel, so the wheel turns under MET and autotrim (S3-21)."]} />
    </>
  );
}
