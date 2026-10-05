"use client";
import { Gfc700Controls } from "@/components/avionics/Gfc700Controls";
import { useReducer } from "react";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Small, useTicker } from "@/components/ui/controls";
import { initFlight, type FlightState, type FlySet } from "@/lib/avionics/flight";
import { gfc700Key, type Gfc700Fail, type Gfc700Key } from "@/lib/avionics/gfc700";
import { cruiseFlight, displays, live } from "../model";
import { CAT } from "../parts";
import { useDA40 } from "../store";
import { AFCS_CFG, PFD_LOST_KEYS } from "../tick";

export function Avionics() {
  useTicker(250);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const d = displays(s, E);
  const on = (b: boolean, txt = "ON"): [string, "" | "bad"] | string => (b ? txt : ["OFF", "bad"]);
  return (
    <>
      <p className="lead">Garmin G1000: a GDU 1040 PFD and a GDU 1042 MFD (10.4 in.; the GDU 1044 with the VNV key is optional and N949KC&apos;s fit is unconfirmed) with the GMA 1347 audio panel between them, two GIA 63W integrated avionics units and the GTX 33 transponder in a remote enclosure under the baggage floor, a GRS 77 AHRS with GMU 44 magnetometer, a GDC 74A air-data computer and a GEA 71 engine/airframe unit. The displays in the model are live: they lose power with their buses and revert automatically.</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="dbk" label="DISPLAY BACKUP button OUT (reversionary)" checked={s.avx.backup} onChange={(v) => up((x) => { x.avx.backup = v; })} />
        <BtnRow>
          <Check id="pfdF" label="PFD fails" checked={s.avx.pfdFail} onChange={(v) => up((x) => { x.avx.pfdFail = v; })} />
          <Check id="mfdF" label="MFD fails" checked={s.avx.mfdFail} onChange={(v) => up((x) => { x.avx.mfdFail = v; })} />
          <Check id="ahrsF" label="AHRS fails" checked={s.avx.ahrsFail} onChange={(v) => up((x) => { x.avx.ahrsFail = v; })} />
          <Check id="adcF" label="ADC fails" checked={s.avx.adcFail} onChange={(v) => up((x) => { x.avx.adcFail = v; })} />
        </BtnRow>
        <Readouts items={[
          ["PFD", d.pfd ? (d.pfdRev ? "Composite (reversion)" : "Normal") : ["OFF", "bad"]],
          ["MFD", d.mfd ? (d.mfdRev ? "Composite (reversion)" : "Normal") : ["OFF", "bad"]],
          ["AHRS", on(E.ahrs, "Valid")], ["ADC (air data)", on(E.adc, "Valid")],
          ["GIA 1 · COM 1", `${E.gia1 ? "ON" : "OFF"} · ${E.com1 ? "ON" : "OFF"}`], ["GIA 2 · COM 2", `${E.gia2 ? "ON" : "OFF"} · ${E.com2 ? "ON" : "OFF"}`],
          ["Audio panel", on(E.audio)], ["Transponder", on(E.xpdr)],
          ["Engine data (GEA)", E.gea && (E.gia1 || E.gia2) ? "Valid" : ["RED X", "bad"]], ["Standby attitude", E.stbyAtt ? (s.elec.emerg ? "EMERG BATT" : "ON") : ["OFF flag", "bad"]],
        ]} />
      </Ctl>
      <Small>If either display fails the other enters reversionary mode automatically; the red DISPLAY BACKUP button forces it. After an automatic entry, push the button OUT; one attempt to return to normal (button IN) is approved (AFMS p. 33).</Small>
      <H3>Annunciation window (AFMS 190-00492-10 §2.6)</H3>
      <Facts rows={[
        ["Warnings (red)", "OIL PRES LO · FUEL PRES LO · FUEL PRES HI · ALTERNATOR · STARTER ENGD · DOOR OPEN"],
        ["Cautions (yellow)", "PITOT OFF · PITOT FAIL · L FUEL LOW · R FUEL LOW · LOW VOLTS"],
        ["Advisories (white)", "PFD FAN FAIL · MFD FAN FAIL · GIA FAN FAIL"],
        ["Tones", "Warning: repeating tone until acknowledged · caution: single tone · advisory: none"],
        ["Window", "Right of the altimeter/VSI, up to 12 lines; on the MFD in reversion"],
        ["TRIM FAIL", "KAP 140 airplanes only — on the GFC 700 a trim failure is the red PTRM box"],
      ]} />
      <H3>Power by LRU (GFC 700 airplane)</H3>
      <Facts rows={[
        ["PFD · AHRS · ADC", "ESSENTIAL (PFD / AHRS / ADC 5 A)"],
        ["GIA 1", "ESSENTIAL (COM 1 + GPS/NAV 1)"],
        ["GTX 33 · GEA 71 · GMA 1347", "ESSENTIAL (XPDR / ENG INST / AUDIO)"],
        ["MFD", "MAIN (MFD 5 A)"],
        ["GIA 2 · GFC 700 · GDL 69A", "MAIN AVIONICS (COM 2 + GPS/NAV 2 / AFCS / GDL 69)"],
        ["Fans", "CDU FAN (PFD + MFD fans) and AV FAN (enclosure blower), MAIN"],
        ["Power-up", "Master: PFD, MFD, AHRS, ADC, GIA 1, GEA, XPDR, audio · AVIONIC MASTER: GIA 2, GFC 700, GDL 69A"],
      ]} />
      <H3>Failure effects on the autopilot (AFMS p. 10)</H3>
      <Facts rows={[
        ["AHRS lost", "AP disconnects, AP and FD inoperative; MET available"],
        ["ADC lost", "AP disconnects; FD available except ALT, VS, FLC"],
        ["PFD lost", "AP disconnects; AP and FD inoperative; MET available"],
        ["MFD lost", "AP stays engaged (limited) but can't be re-engaged — its keys are on the MFD bezel"],
        ["GIA 1 lost", "AP, FD and MET inoperative"],
        ["GIA 2 lost", "AP and MET inoperative; FD available"],
        ["Standby instruments", "No effect"],
      ]} />
      <H3>Notes</H3>
      <Notes items={[
        "Data paths: AHRS and ADC → PFD directly (ARINC 429) with backups to the MFD and both GIAs; engine data GEA → GIA 1 → PFD → MFD, backup GEA → GIA 2 → MFD (SMM 2-23 … 2-25).",
        "AHRS aligns in about a minute; 'AHRS ALIGN: Keep Wings Level' — it also aligns while moving (CRG 12-6).",
        "Minimum equipment for IFR: PFD, MFD, audio panel, ADC, AHRS, 2 GPS and all 7 static dischargers (AFMS p. 20).",
        "N949KC is reported to have been upgraded to a GTX 345R transponder; the model keeps the original GTX 33 in the enclosure.",
      ]} />
      <H3>Units — tap to locate</H3>
      <PartsList parts={CAT.pinned("avionics")} />
    </>
  );
}

const BEZEL: Gfc700Key[] = ["AP", "FD", "YD", "HDG", "NAV", "APR", "BC", "ALT", "VS", "FLC", "VNV", "NOSE_UP", "NOSE_DN"];

/** Swap in a new flight state but keep the sim clock: the AFCS timers (tone, flashes, preflight test) run on it. */
const fly = (f: FlightState) => { live.fs = { ...f, t: live.fs.t }; };

/** Autopilot practice set-ups for the flight-state integrator. */
const SETUPS: [string, () => void][] = [
  ["Cruise 4,500 ft, on course", () => fly(cruiseFlight())],
  ["2 nm off the GPS course", () => fly({ ...cruiseFlight(), crs: 70, xtk: -2.0, hdg: 40, hdgBug: 40 })],
  ["ILS: 30° intercept, below the GS", () => { fly(initFlight({ hdg: 280, hdgBug: 280, crs: 310, navSrc: "LOC1", xtk: 0.9, gsErr: -300, alt: 2500, selAlt: 2500, ias: 95, power: 0.5, baro: 30.02, oat: 6 })); useDA40.getState().update((d) => { d.eng.throttle = 0.5; }); }],
  ["Climb to 7,500 (use FLC or VS)", () => fly({ ...live.fs, selAlt: 7500 })],
  ["VNAV path ahead (VNV)", () => fly({ ...cruiseFlight(), alt: 6500, selAlt: 3000, vpath: { err: -120, vs: -500 } })],
];

export function Autopilot() {
  useTicker(100);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  // `live` is mutated outside React: re-render straight away so controlled inputs don't snap back until the next tick
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const st = live.afcs, fs = live.fs, U = live.afcsUser;
  const onKey = (k: Gfc700Key) => {
    const E2 = useDA40.getState().E;
    if (BEZEL.includes(k) && !E2.mfd) return; // the AFCS keys are on the MFD bezel
    if (!E2.pfd && !PFD_LOST_KEYS.includes(k)) return; // PFD lost: AP and FD inoperative, MET still works (AFMS p. 10)
    live.afcs = gfc700Key(live.afcs, k, live.fs, AFCS_CFG);
    bump();
  };
  const onSet = (p: FlySet) => {
    const { power, ...rest } = p;
    if (power !== undefined) up((d) => { d.eng.throttle = power; });
    if (Object.keys(rest).length) { live.fs = { ...live.fs, ...rest }; bump(); }
  };
  const inject = (f: Gfc700Fail) => { live.afcsUser = { ...live.afcsUser, ...f }; bump(); };
  const outside = st.ap && !fs.onGround && (fs.ias < 70 || fs.ias > 165);
  return (
    <>
      <p className="lead">The Garmin GFC 700 is a two-axis autopilot and flight director with electric pitch trim: pitch, roll and pitch-trim servos with their own processing, flight-director logic in the GIAs, mode keys on the MFD bezel (the VNV key only on the optional GDU 1044), and AP DISC, CWS and the split AP TRIM switch on the pilot&apos;s stick. The GA button is on the left of the throttle knob. There is no yaw damper. Power comes through the AVIONIC MASTER switch and the AFCS breaker, and a preflight test (white PFT) must pass first.</p>
      <H3>GFC 700</H3>
      <Gfc700Controls st={st} fs={{ ...fs, power: s.eng.throttle }} powered={st.powered} cfg={AFCS_CFG} layout="da40" where="MFD bezel (GDU 1044 keys shown)" yoke="Pilot stick · throttle (GA)" loc={[true, false]} onKey={onKey} onSet={onSet} />
      <Ctl>
        <div className="row">
          <div className="lbl"><span>Set up</span></div>
          <BtnRow>{SETUPS.map(([t, f]) => <button key={t} type="button" className="btn" onClick={f}>{t}</button>)}</BtnRow>
        </div>
        <div className="row">
          <div className="lbl"><span>Failures</span></div>
          <BtnRow>
            <Check id="fPft" label="Preflight test will fail" checked={!!U.pft} onChange={(v) => inject({ pft: v })} />
            <Check id="fPtrm" label="Pitch trim (PTRM)" checked={!!U.trim} onChange={(v) => inject({ trim: v })} />
            <Check id="fPtch" label="Pitch servo (PTCH)" checked={!!U.pitch} onChange={(v) => inject({ pitch: v })} />
            <Check id="fRoll" label="Roll servo (ROLL)" checked={!!U.roll} onChange={(v) => inject({ roll: v })} />
            <Check id="fSys" label="AFCS system" checked={!!U.sys} onChange={(v) => inject({ sys: v })} />
            <Check id="fEle" label="Elevator out of trim (↓ELE)" checked={U.mistrim === "↓ELE"} onChange={(v) => inject({ mistrim: v ? "↓ELE" : null })} />
          </BtnRow>
        </div>
        <Readouts items={[
          ["AFCS power", st.powered ? "ON" : E.av > 0 ? ["AFCS BREAKER / GIA", "bad"] : ["AVIONIC MASTER OFF", "bad"]],
          ["Preflight test", st.pft === "run" ? ["RUNNING", "warnc"] : st.pft === "pass" ? "Passed" : st.pft === "fail" ? ["FAILED — pull AFCS CB", "bad"] : "—"],
          ["MFD keys", E.mfd ? "Available" : ["MFD OFF — keys dead", "bad"]],
          ["PFD", E.pfd ? "OK" : ["LOST: AP/FD out", "bad"]],
          ["Airplane", fs.onGround ? "On the ground" : `${Math.round(fs.ias)} KIAS`],
        ]} />
      </Ctl>
      <Small>The PFT starts when the avionics master (and AFCS breaker) power the servos; it ends with the autopilot disconnect tone. To see a failed PFT, tick &ldquo;Preflight test will fail&rdquo; and cycle the AFCS breaker in the Electrical panel. Fuel imbalance over 8 gal with the AP engaged gives a yellow aileron out-of-trim.</Small>
      {outside && <Caution title="Speed limits">Engage the autopilot only between 70 and 165 KIAS (AFMS p. 16). Below 70 KIAS in PIT, VS or ALT a stall is possible — disconnect if the stall horn sounds (AFMS p. 48).</Caution>}
      {s.air === false && <Caution title="On the ground">The flight director and preflight test work on the ground, but the airplane isn&apos;t flying: choose Normal cruise in the Overview to fly the autopilot.</Caution>}
      <H3>Modes (CRG 190-00324-07 §6)</H3>
      <Facts rows={[
        ["PIT (default)", "Holds pitch; NOSE UP/DN 0.5° steps, +20° nose up / −15° nose down (CRG 6-2; Table 6-1 prints −20…+15) (ALTS armed)"],
        ["ROL (default)", "< 6° bank → wings level; 6–22° held; > 22° limited to 22°"],
        ["HDG", "Turns to and holds the heading bug (HDG knob, push = sync)"],
        ["ALT", "Holds the altitude reference (nearest 10 ft); changing the baro setting makes the AP climb or descend to it (AFMS p. 50)"],
        ["ALTS", "Selected-altitude capture (ALT knob) → ALT at 50 ft"],
        ["VS", "Holds vertical speed, 100 fpm steps, +1,500 / −3,000 fpm"],
        ["FLC", "Holds airspeed 70–165 KIAS; NOSE UP = slower; never away from the selected altitude"],
        ["NAV: GPS / VOR / LOC / BC", "Captures with the CDI within one dot, otherwise arms (white). BC when the course is > 105° from heading"],
        ["APR: GPS / VAPP / LOC + GS / GP", "Approach; GS only after LOC capture; GP needs WAAS (GIA 63W)"],
        ["VPTH", "VNAV path (VNV key — optional GDU 1044, N949KC fit unconfirmed); ALTV target capture"],
        ["GA", "Throttle button: AP off, wings level, 7° nose up, ALTS armed"],
        ["CWS", "Hold: servos released, FD syncs; release: new reference"],
      ]} />
      <H3>Annunciations</H3>
      <Facts rows={[
        ["Green / white", "Active modes green, armed modes white; automatic captures flash green 10 s"],
        ["Yellow flashing mode", "Mode lost (sensor or nav signal): reverts to ROL / PIT after 10 s"],
        ["AP yellow flashing", "Normal disconnect (AP DISC, MET ARM, AP key, GA) — 5 s, 2 s tone"],
        ["AP red flashing", "Automatic disconnect — continuous tone until AP DISC or MET ARM"],
        ["PFT white / red", "Preflight test running / failed (pull the AFCS breaker, reset only on the ground)"],
        ["AFCS · PTCH · ROLL · PTRM (red)", "System / pitch / roll / pitch-trim failure — no re-engagement"],
        ["↑ELE ↓ELE ←AIL AIL→ (yellow)", "Servo holding a sustained force; ≤ 5 s during configuration changes is normal"],
        ["MAXSPD (yellow)", "Overspeed protection pitching up to stay ≤ 165 KIAS (not in ALT or GS)"],
      ]} />
      <H3>Limitations (AFMS p. 16–17)</H3>
      <Notes items={[
        "Preflight test must pass before using the AP, FD or manual electric trim.",
        "Pilot with seat belt fastened in the left seat; AP off for take-off and landing.",
        "Engage 70–165 KIAS; electric trim up to 178 KIAS.",
        "Fuel imbalance with the AP engaged ≤ 8 US gal (long-range tanks).",
        "Disengage below 200 ft AGL on approaches and 800 ft AGL otherwise; ILS coupled to Category I only.",
      ]} />
      <H3>Malfunction (AFMS p. 24)</H3>
      <ol className="notes">{["AP DISC — press and hold while gripping the stick firmly.", "Regain control (standby attitude if needed).", "Retrim with the trim wheel.", "AFCS (AP) circuit breaker — pull.", "AP DISC — release. Don't re-engage or reset until the cause is found. Max altitude loss: 200 ft cruise, 130 ft approach."].map((t) => <li key={t}>{t}</li>)}</ol>
      <H3>Servos &amp; switches — tap to locate</H3>
      <PartsList parts={CAT.pinned("autopilot")} />
    </>
  );
}
