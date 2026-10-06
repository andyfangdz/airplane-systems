"use client";
import { useState } from "react";
import { selectSys } from "@/lib/fleet";
import { sysColor } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { live, type Elt } from "../model";
import { CAT } from "../parts";
import { useC182 } from "../store";
import { SYS } from "../systems";
import { scenarioColdDark, scenarioCruise, scenarioRunUp } from "../store";

export function Scenarios() {
  return (
    <BtnRow>
      <button type="button" className="btn" onClick={scenarioCruise}>Cruise · 6,000 ft</button>
      <button type="button" className="btn" onClick={scenarioColdDark}>Cold &amp; dark on the ramp</button>
      <button type="button" className="btn" onClick={scenarioRunUp}>Engine running · ramp</button>
    </BtnRow>
  );
}

export function Overview() {
  const theme = useView((x) => x.theme);
  return (
    <>
      <p className="lead">A study model of POH Section 7 for the Cessna 182T Skylane with NAV III avionics — Garmin G1000 and the Bendix/King KAP 140 two-axis autopilot — built around Paramus Flying Club&apos;s N8050J (s/n 18281633) and N21200 (s/n 18281732). Pick a system to fly the camera to it, hover parts for their POH notes, and work the real switches, knobs and breakers in the panel. Everything is linked: pull a breaker or fail the alternator and the buses, displays, annunciations, the KAP 140 and the 3D model all respond.</p>
      <H3>Start from</H3>
      <Ctl><Scenarios /></Ctl>
      <Small>“Cold &amp; dark” sets everything off and the engine cold so you can follow the POH 4-13 start (prime with the FUEL PUMP — there is no primer) in the Engine panel.</Small>
      <H3>At a glance</H3>
      <Facts rows={[
        ["Engine", "Lycoming IO-540-AB1A5 · 230 BHP @ 2,400 RPM · six cylinders, fuel injected · cowl flaps"],
        ["Propeller", "McCauley B3D36C431/80VSA-1 · 3 blades · 79 in · constant speed (governor, blue knob)"],
        ["Fuel", "92.0 gal total · 87.0 usable · BOTH / LEFT / RIGHT / OFF · return line to the selected tank"],
        ["Electrical", "28 V · 60 A alternator (95 A optional) · 24 V main + standby battery · 6 buses"],
        ["Flaps", "Electric single-slot · UP / 10° / 20° / FULL (38°, TCDS)"],
        ["Trim", "Elevator trim wheel and tab · rudder trim wheel and bungee"],
        ["Avionics", "G1000 NAV III · GDU 1040 PFD + MFD · GMA 1347 · GIA 63 ×2"],
        ["Autopilot", "Bendix/King KAP 140 · 2-axis with altitude preselect · electric pitch trim"],
        ["Dimensions", "Span 36'-0\" · length 29'-0\" · height 9'-4\" · track 9'-0\""],
        ["Weights", "MTOW 3,100 lb · ramp 3,110 · max landing 2,950"],
        ["Speeds", "VNE 175 · VNO 140 · VA 110 (3,100 lb) · VFE 140 / 120 / 100 KIAS"],
      ]} />
      <H3>Systems</H3>
      <div className="overview-grid">
        {SYS.slice(1).map((s) => (
          <button key={s.id} type="button" style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => selectSys(s.id)}>
            <b>{s.name}</b><span>{s.blurb}</span>
          </button>
        ))}
      </div>
      <p className="disc">Unofficial study aid. Sources: Cessna Model 182T NAV III Pilot&apos;s Operating Handbook and FAA Approved Airplane Flight Manual 182TPHAUS-04 (Revision 4, 22 December 2005; this copy issued for s/n 18281780) Sections 1–8; Supplement 3, Bendix/King KAP 140 2-Axis Autopilot (182TPHAUS-S3-02), effective for serials 18281228, 18281318 – 18281868 and 18281870 – 18281875, which includes 18281633 and 18281732; Supplement 1 (Pointer 3000-11 ELT); Garmin G1000 Cockpit Reference Guide for the Cessna NAV III, 190-00384-13 Rev. B; FAA TCDS 3A13 Rev 66 for control-surface travel. The 2007 GFC 700 edition (182TPHBUS-01) is used only where the 2005 text is silent, and marked. Breaker ratings the POH doesn&apos;t print are left blank. Geometry is approximate, flight behaviour is a teaching model and currents are illustrative. The equipment actually fitted to N8050J and N21200 (alternator, fairings, ELT, options) is not known — always use the airplane&apos;s own POH/AFM, supplements and equipment list.</p>
    </>
  );
}

/* ---------- airframe + weight & balance ---------- */
/** Sample basic empty weight (POH 6-11): 1,924 lb, moment 70.9 × 1,000 lb-in. Arms: front 37, rear 74, fuel 46.5, baggage A 97, B 116, C 129 (POH 6-14). */
const BEW = 1924, BEM = 70900;
/** Forward CG limit (POH 2-8): 33.0 in at 2,250 lb or less, straight line to 35.5 at 2,700, straight line to 40.9 at 3,100; aft 46.0 at all weights. */
const fwdLimit = (W: number) => (W <= 2250 ? 33 : W <= 2700 ? 33 + ((W - 2250) / 450) * 2.5 : 35.5 + ((W - 2700) / 400) * 5.4);
function useWB() {
  const [w, set] = useState({ front: 340, rear: 200, fuel: 60, bagA: 50, bagB: 0, bagC: 0 });
  const items: [number, number][] = [[BEW, BEM / BEW], [w.front, 37], [w.rear, 74], [w.fuel * 6, 46.5], [w.bagA, 97], [w.bagB, 116], [w.bagC, 129]];
  const W = items.reduce((a, [m]) => a + m, 0), M = items.reduce((a, [m, arm]) => a + m * arm, 0), cg = M / W;
  const fwd = fwdLimit(W);
  const bagOk = w.bagA <= 120 && w.bagB + w.bagC <= 80 && w.bagA + w.bagB + w.bagC <= 200;
  const ok = W <= 3100 && cg >= fwd && cg <= 46.0 && bagOk;
  return { w, set, W, cg, fwd, ok, bagOk, mac: (cg - 25.98) / 0.588 };
}

export function Airframe() {
  const wb = useWB(), { w } = wb;
  const sl = (k: keyof typeof w, label: string, max: number, unit = "lb", step = 5) =>
    <Slider id={"wb" + k} label={label} min={0} max={max} step={step} value={w[k]} onChange={(v) => wb.set({ ...w, [k]: v })} fmt={(v) => `${v} ${unit}`} />;
  return (
    <>
      <p className="lead">All-metal, four-place, high-wing airplane. The semimonocoque fuselage carries the wings on front and rear carry-through spars across the cabin top; one streamlined lift strut per side runs from a fitting at the base of the forward door post to the wing front spar. The spring-steel main gear attaches at the base of the rear door posts, and four engine mount stringers run forward to the firewall. Each wing has an integral fuel tank (POH 7-5).</p>
      <Facts rows={[
        ["Wing span", "36'-0\" with strobes (POH 1-3) · area 174 sq ft"],
        ["Length · height", "29'-0\" · 9'-4\" to the beacon (POH 1-4)"],
        ["Horizontal tail span", "11'-8\""],
        ["Track · wheelbase", "9'-0\" · 66.5 in · prop clearance 10 7/8 in"],
        ["Wing", "Integral fuel tanks; full-span front spar, partial-span rear spar; constant-chord inboard panel, tapered outboard"],
        ["Ailerons · flaps", "“V” corrugated skins; balance weights in the aileron forward spar"],
        ["Empennage", "Dorsal fin; elevator tips and rudder top horn-balanced with weights; trim tab in the right elevator"],
        ["Datum", "Front face of the firewall, lower portion (FS 0)"],
        ["MAC", "58.80 in, LEMAC at FS 25.98"],
      ]} />
      <H3>Structure — tap to locate</H3>
      <PartsList parts={CAT.pinned("airframe")} />
      <H3>Weight &amp; balance check</H3>
      <Ctl>
        {sl("front", "Pilot + front passenger (arm 37)", 500)}
        {sl("rear", "Rear passengers (arm 74)", 400)}
        {sl("fuel", "Usable fuel (6 lb/gal, arm 46.5)", 87, "gal", 1)}
        {sl("bagA", "Baggage area A (arm 97, max 120)", 120)}
        {sl("bagB", "Baggage area B (arm 116)", 80)}
        {sl("bagC", "Baggage area C, shelf (arm 129)", 80)}
        <Readouts items={[["Weight", [`${Math.round(wb.W)} lb`, wb.W > 3100 ? "bad" : wb.W > 2950 ? "warnc" : ""]], ["CG", [`${wb.cg.toFixed(1)} in`, wb.ok ? "" : "bad"]], ["% MAC", wb.mac.toFixed(1)], ["Envelope", wb.ok ? "Within" : ["OUTSIDE", "bad"]], ["Baggage", wb.bagOk ? "OK" : ["OVER LIMIT", "bad"]]]} />
      </Ctl>
      <Small>Empty weight from the POH 6-11 sample (1,924 lb, moment 70.9) — use N8050J&apos;s or N21200&apos;s own weight and balance record. Limits: forward 33.0 in at 2,250 lb or less, straight line to 35.5 in at 2,700 lb and to 40.9 in at 3,100 lb; aft 46.0 in at all weights (POH 2-8). Forward limit at this weight: {wb.fwd.toFixed(1)} in. Baggage: A 120 lb, B + C 80 lb, all three 200 lb. Above 2,950 lb, allow fuel burn-off before landing (POH 6-18).</Small>
      <H3>Notes</H3>
      <Notes items={["Move the airplane by hand with a tow bar on the nose gear or by pushing on the wing struts — never on the tail surfaces (POH 7-19).", "To raise the nose, press down on a tailcone bulkhead just forward of the horizontal stabilizer, letting the tail rest on the tail tiedown ring — never on the stabilizer or elevator (POH 8-10).", "Load factors: +3.8 / −1.52 g flaps UP, +2.0 g flaps down (POH 2-9).", "Level the airplane longitudinally on the screws on the left side of the tailcone (FS 139.65 and 171.65), laterally on the upper door sills (POH 6-6, 8-11)."]} />
    </>
  );
}

/* ---------- cabin & safety ---------- */
export function Cabin() {
  useTicker(500);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update), c = s.cabin;
  // the hour meter needs oil pressure above 20 PSI and power through the WARN breaker (POH 7-12, Fig 7-7 Sheet 2)
  const hobbs: [string, "" | "warnc"] | string = !E.warnPwr ? ["No (no WARN power)", "warnc"] : live.oilP > 20 ? "Yes (oil > 20 PSI)" : "No";
  return (
    <>
      <p className="lead">Two vertically adjusting crew seats and a split-back rear bench, integrated belts with inertia reels, two cabin doors with openable windows, a three-area baggage compartment with a lockable door on the left, and the safety equipment: Halon extinguisher, ELT, CO detector and hour meter (POH 7-21 – 7-27, 7-74).</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="lock" label="Control lock installed (flag over the ignition switch)" checked={c.lock} onChange={(v) => up((d) => { d.cabin.lock = v; })} />
        <Seg id="elt" label="ELT remote switch" options={[["ON", "ON"], ["AUTO", "AUTO"], ["RESET", "RESET"]] as [Elt, string][]} value={c.elt} onChange={(v) => up((d) => { d.cabin.elt = v; })} />
        <Readouts items={[["Hobbs", live.hobbs.toFixed(1)], ["Hobbs running", hobbs], ["ELT", c.elt === "ON" ? ["TRANSMITTING", "bad"] : c.elt === "RESET" ? ["RESET", "warnc"] : "Armed (AUTO)"], ["CO", live.coPpm >= 50 ? ["CO LVL HIGH", "bad"] : `${Math.round(live.coPpm)} ppm`]]} />
      </Ctl>
      {c.lock && <Caution title="Caution">CONTROL LOCK — REMOVE BEFORE STARTING ENGINE (placard, POH 2-18).</Caution>}
      <H3>Equipment — tap to locate</H3>
      <PartsList parts={CAT.pinned("cabin")} />
      <H3>Seats &amp; restraints</H3>
      <Notes items={["Front seats: fore/aft handle below the centre of the frame, height crank under the right corner, seat-back release at the front centre under the seat bottom (POH 7-21).", "Rear bench: fixed one-piece bottom with an infinitely adjustable split back; it can be removed to carry cargo (POH 7-22, 6-10).", "Every seat has an integrated belt/harness with an overhead inertia reel — front reels on the cabin centerline, rear reels outboard; no more than one extra inch should pull out of the retractor once the lap belt is fastened (POH 7-22, 7-23).", "A pilot with the belt fastened must occupy the left seat during autopilot operation (S3-13)."]} />
      <H3>Doors, windows &amp; baggage</H3>
      <Facts rows={[["Cabin doors", "Recessed outside handle (must stay out while the door is open); inside handle OPEN – CLOSE – LOCK; key lock on the left door only"], ["Door open in flight", "Not a reason to land: trim ≈ 80 KIAS, push the door out slightly, close and lock it forcefully (POH 7-25)"], ["Door windows", "Openable up to 175 KIAS; rear side and rear windows fixed"], ["Baggage A", "FS 82–109 · 120 lb"], ["Baggage B", "FS 109–124 · B + C ≤ 80 lb"], ["Baggage C", "Shelf FS 124–134 · 80 lb · A + B + C ≤ 200 lb"], ["Baggage door", "Left side, lockable, 15.75 in wide, 22.0 / 20.5 in high"]]} />
      <H3>Emergency equipment</H3>
      <Facts rows={[["Extinguisher", "Halon 1211, 5B:C, on the floor between the front seats; ≈ 8 s of discharge; ventilate after use (POH 7-74)"], ["ELT", "Pointer 3000-11 as delivered (121.5 / 243.0 MHz) behind the aft cabin partition; remote ON / AUTO / RESET by the MFD (POH 7-12, S1)"], ["CO detector", "CO LVL HIGH at ≥ 50 PPM: CABIN HT off, CABIN AIR on, vents and windows open (POH 3-21)"], ["Hobbs", "Runs with oil pressure above 20 PSI (WARN breaker) (POH 7-12)"]]} />
      <Caution title="Warning">Ventilate the cabin promptly after using the extinguisher — the gases from thermal decomposition are hazardous (POH 7-74).</Caution>
      <Notes items={["Forced landing: doors UNLATCH before touchdown; ditching: open a window and flood the cabin if needed to equalize pressure so the doors can be opened (POH 3-8, 3-9).", "Placards: MANEUVERING SPEED 110 KIAS above the PFD; SMOKING PROHIBITED on the upper right panel (POH 2-20, 2-21)."]} />
    </>
  );
}
