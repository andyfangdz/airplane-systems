"use client";
import { useState } from "react";
import { selectSys } from "@/lib/fleet";
import { sysColor } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { live } from "../model";
import { CAT } from "../parts";
import { useC172 } from "../store";
import { SYS } from "../systems";
import { scenarioColdDark, scenarioCruise, scenarioRunUp } from "../tick";

export function Scenarios() {
  return (
    <BtnRow>
      <button type="button" className="btn" onClick={scenarioCruise}>Cruise · 4,500 ft</button>
      <button type="button" className="btn" onClick={scenarioColdDark}>Cold &amp; dark on the ramp</button>
      <button type="button" className="btn" onClick={scenarioRunUp}>Engine running · ramp</button>
    </BtnRow>
  );
}

export function Overview() {
  const theme = useView((x) => x.theme);
  return (
    <>
      <p className="lead">A study model of POH Section 7 for the Cessna 172S Skyhawk SP with NAV III avionics — Garmin G1000 and the GFC 700 autopilot — built around Paramus Flying Club&apos;s N6189Q (2008, s/n 172S10738). Pick a system to fly the camera to it, hover parts for their POH notes, and work the real switches, knobs and breakers in the panel. Everything is linked: pull a breaker or fail the alternator and the buses, displays, annunciations and 3D model all respond.</p>
      <H3>Start from</H3>
      <Ctl><Scenarios /></Ctl>
      <Small>“Cold &amp; dark” sets everything off and the engine cold so you can follow the POH 4-11 start in the Engine panel.</Small>
      <H3>At a glance</H3>
      <Facts rows={[
        ["Engine", "Lycoming IO-360-L2A · 180 BHP @ 2,700 RPM · fuel injected"],
        ["Propeller", "McCauley 1A170E/JHA7660 · 2 blades · 76 in · fixed pitch"],
        ["Fuel", "56.0 gal total · 53.0 usable · BOTH / LEFT / RIGHT"],
        ["Electrical", "28 V · 60 A alternator · 24 V main + standby battery"],
        ["Flaps", "Electric single-slot · UP / 10° / 20° / FULL (30°)"],
        ["Avionics", "G1000 NAV III · GDU 1040 PFD + MFD · GMA 1347"],
        ["Autopilot", "Garmin GFC 700 · 2-axis + pitch trim, no yaw damper"],
        ["Dimensions", "Span 36'-1\" · length 27'-2\" · height 8'-11\""],
        ["Weights", "MTOW 2,550 lb (normal) · 2,200 lb (utility)"],
        ["Speeds", "VNE 163 · VNO 129 · VA 105 · VFE 110 / 85 KIAS"],
      ]} />
      <H3>Systems</H3>
      <div className="overview-grid">
        {SYS.slice(1).map((s) => (
          <button key={s.id} type="button" style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => selectSys(s.id)}>
            <b>{s.name}</b><span>{s.blurb}</span>
          </button>
        ))}
      </div>
      <p className="disc">Unofficial study aid. Sources: Cessna 172S NAV III GFC 700 AFCS Pilot&apos;s Operating Handbook and FAA Approved Airplane Flight Manual 172SPHBUS-04 (Revision 4, 11 June 2021; serials 172S10468, 172S10507, 172S10640 and 172S10656 and on — which includes 172S10738) Sections 1–8; Garmin G1000 Cockpit Reference Guide for the Cessna NAV III, 190-00384-13 Rev. B; FAA TCDS 3A12 for control-surface travel; the KAP 140 edition (172SPHAUS) only as a cross-check. Breaker ratings the POH doesn&apos;t print were read from a photo of a 172S NAV III panel and are marked as such. Geometry is approximate, flight behaviour is a teaching model and currents are illustrative. Section 9 supplements and the actual equipment fitted to N6189Q are not covered — always use the airplane&apos;s own POH/AFM, supplements and equipment list.</p>
    </>
  );
}

/* ---------- airframe + weight & balance ---------- */
/** Sample basic empty weight (POH 6-10): 1,642 lb, moment 62.6 × 1,000 lb-in. Arms: front 37, rear 73, fuel 48, baggage A 95, B 123 (POH 6-13). */
const BEW = 1642, BEM = 62600;
function useWB() {
  const [w, set] = useState({ front: 340, rear: 0, fuel: 53, bagA: 30, bagB: 0 });
  const items: [number, number][] = [[BEW, BEM / BEW], [w.front, 37], [w.rear, 73], [w.fuel * 6, 48], [w.bagA, 95], [w.bagB, 123]];
  const W = items.reduce((a, [m]) => a + m, 0), M = items.reduce((a, [m, arm]) => a + m * arm, 0), cg = M / W;
  const fwd = W <= 1950 ? 35 : 35 + ((W - 1950) / 600) * 6;
  const ok = W <= 2550 && cg >= fwd && cg <= 47.3 && w.bagA + w.bagB <= 120 && w.bagB <= 50;
  return { w, set, W, cg, fwd, ok, mac: (cg - 25.9) / 0.588 };
}

export function Airframe() {
  const wb = useWB(), { w } = wb;
  const sl = (k: keyof typeof w, label: string, max: number, unit = "lb", step = 5) =>
    <Slider id={"wb" + k} label={label} min={0} max={max} step={step} value={w[k]} onChange={(v) => wb.set({ ...w, [k]: v })} fmt={(v) => `${v} ${unit}`} />;
  return (
    <>
      <p className="lead">All-metal, four-place, high-wing airplane. The semimonocoque fuselage carries the wings on front and rear carry-through spars across the cabin top; one streamlined lift strut per side runs from a fitting at the base of the forward door post to the wing front spar. The main gear attaches at the base of the rear door posts, and four engine mount stringers run forward to the firewall (POH 7-5).</p>
      <Facts rows={[
        ["Wing span", "36'-1\" with strobes (POH 1-3) · area 174 sq ft"],
        ["Length · height", "27'-2\" · 8'-11\" max (POH 1-4)"],
        ["Horizontal tail span", "11'-4\""],
        ["Wheelbase", "65.0 in · prop clearance 11.25 in"],
        ["Wing", "Integral fuel tanks; full-span front spar, partial-span rear spar"],
        ["Ailerons · flaps", "“V” corrugated skins; balance weights in the aileron spar"],
        ["Empennage", "Dorsal fin; rudder and elevator tips horn-balanced with weights"],
        ["Datum", "Lower portion of the front face of the firewall (FS 0)"],
        ["MAC", "58.80 in, LEMAC at FS 25.90"],
      ]} />
      <H3>Structure — tap to locate</H3>
      <PartsList parts={CAT.pinned("airframe")} />
      <H3>Weight &amp; balance check (normal category)</H3>
      <Ctl>
        {sl("front", "Pilot + front passenger (arm 37)", 500)}
        {sl("rear", "Rear passengers (arm 73)", 400)}
        {sl("fuel", "Usable fuel (6 lb/gal, arm 48)", 53, "gal", 1)}
        {sl("bagA", "Baggage area A (arm 95, max 120)", 120)}
        {sl("bagB", "Baggage area B (arm 123, max 50)", 50)}
        <Readouts items={[["Weight", [`${Math.round(wb.W)} lb`, wb.W > 2550 ? "bad" : ""]], ["CG", [`${wb.cg.toFixed(1)} in`, wb.ok ? "" : "bad"]], ["% MAC", wb.mac.toFixed(1)], ["Envelope", wb.ok ? "Within" : ["OUTSIDE", "bad"]]]} />
      </Ctl>
      <Small>Empty weight from the POH 6-10 sample (1,642 lb, moment 62.6) — use N6189Q&apos;s own weight and balance record. Limits: forward 35.0 in at 1,950 lb or less, straight line to 41.0 in at 2,550 lb; aft 47.3 in (POH 2-9). Forward limit at this weight: {wb.fwd.toFixed(1)} in.</Small>
      <H3>Notes</H3>
      <Notes items={["Move the airplane by hand with a tow bar on the nose gear or by pushing on the wing struts — never on the tail surfaces (POH 7-22).", "To raise the nose, press down on a tailcone bulkhead just forward of the horizontal stabilizer, not on the stabilizer itself (POH 7-22, 8-10).", "Load factors (normal category): +3.8 / −1.52 g flaps UP, +3.0 g flaps FULL (POH 2-11)."]} />
    </>
  );
}

/* ---------- cabin & safety ---------- */
export function Cabin() {
  useTicker(500);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update), c = s.cabin;
  // the hour meter needs oil pressure above 20 PSI and power through the WARN breaker (POH 7-13, 7-49)
  const hobbs: [string, "warnc"] | string = !E.on["XF:WARN"] ? ["No (no WARN power)", "warnc"] : live.oilP > 20 ? "Yes (oil > 20 PSI)" : "No";
  return (
    <>
      <p className="lead">Two vertically adjusting crew seats and a rear bench, integrated belts with inertia reels, two cabin doors with openable windows, a two-area baggage compartment with a door on the left, and the safety equipment: Halon extinguisher, ELT, CO detector and hour meter.</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="lock" label="Control lock installed (flag over the ignition switch)" checked={c.lock} onChange={(v) => up((d) => { d.cabin.lock = v; })} />
        <Seg id="elt" label="ELT remote switch" options={[["ARM", "ARM"], ["ON", "ON"], ["TEST", "TEST/RESET"]]} value={c.elt} onChange={(v) => up((d) => { d.cabin.elt = v; })} />
        <Readouts items={[["Hobbs", live.hobbs.toFixed(1)], ["Hobbs running", hobbs], ["ELT", c.elt === "ON" ? ["TRANSMITTING", "bad"] : c.elt === "TEST" ? ["TEST", "warnc"] : "Armed"], ["CO", live.coPpm >= 50 ? ["CO LVL HIGH", "bad"] : `${Math.round(live.coPpm)} ppm`]]} />
      </Ctl>
      {c.lock && <Caution title="Caution">CONTROL LOCK — REMOVE BEFORE STARTING ENGINE (placard, POH 2-23).</Caution>}
      <H3>Equipment — tap to locate</H3>
      <PartsList parts={CAT.pinned("cabin")} />
      <H3>Seats &amp; restraints</H3>
      <Notes items={["Front seats: fore/aft handle under the centre of the frame, height crank under the right corner, seat-back button at the front centre (POH 7-24).", "Rear bench: fixed one-piece bottom, three-position reclining back.", "Every seat has an integrated belt/harness with an overhead inertia reel; no more than one extra inch should pull out of the retractor once the lap belt is fastened (POH 7-25).", "A pilot with the seat belt fastened must occupy the left seat during autopilot operation (POH 2-21)."]} />
      <H3>Doors, windows &amp; baggage</H3>
      <Facts rows={[["Cabin doors", "Recessed outside handle; inside handle OPEN – CLOSE – LOCK; key lock on the left door only"], ["Door open in flight", "Not a reason to land: ~75 KIAS, push the door out slightly, slam and lock (POH 7-27)"], ["Door windows", "Openable up to 163 KIAS; rear windows fixed"], ["Baggage A", "FS 82–108 · 120 lb"], ["Baggage B", "FS 108–142 · 50 lb · A + B ≤ 120 lb"], ["Baggage door", "Left side, lockable, 15.25 × 22 in"]]} />
      <H3>Emergency equipment</H3>
      <Facts rows={[["Extinguisher", "Halon 1211, 5B:C, floor between the front seats; ~8 s of discharge; ventilate after use (POH 7-79)"], ["ELT", "Artex ME406 (standard), remote ON / ARM / TEST-RESET switch by the MFD (POH 7-13)"], ["CO detector", "CO LVL HIGH at ≥ 50 PPM: CABIN HT off, CABIN AIR on, vents and windows open (POH 3-24)"], ["Hobbs", "Runs with oil pressure above 20 PSI (POH 7-13)"]]} />
      <Caution title="Warning">Ventilate the cabin promptly after using the extinguisher — the gases from thermal decomposition are hazardous (POH 7-79).</Caution>
    </>
  );
}
