"use client";
import { Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Small } from "@/components/ui/controls";
import { annunciations, displays, type CanopyPos } from "../model";
import { CAT } from "../parts";
import { useDA40 } from "../store";

export function Cabin() {
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const d = displays(s, E), shown = d.pfd || d.mfd;
  const doorMsg = shown && annunciations(s, E).some(([, t]) => t === "DOOR OPEN");
  const open = s.doors.canopy !== "CLOSED" || !s.doors.rear;
  return (
    <>
      <p className="lead">Four seats in two rows inside a GFRP cabin with a roll bar behind the front seats. The front canopy is hinged at its forward edge and swings up and forward; the rear passenger door on the left is hinged at its front edge and held open by a gas strut. Each has a locking handle and a sensor that lights the red DOOR OPEN warning on the PFD.</p>
      <H3>Canopy and rear door</H3>
      <Ctl>
        <Seg<CanopyPos> id="canopy" label="Front canopy" options={[["CLOSED", "Closed & locked"], ["GAP", "Cooling gap"], ["OPEN", "Open"]]} value={s.doors.canopy} onChange={(v) => up((x) => { x.doors.canopy = v; })} />
        <Check id="rear" label="Rear door closed and locked" checked={s.doors.rear} onChange={(v) => up((x) => { x.doors.rear = v; })} />
        <Readouts items={[
          ["DOOR OPEN warning", !shown ? ["No display power", "warnc"] : doorMsg ? ["DOOR OPEN (red)", "bad"] : "Out"],
          ["Canopy", s.doors.canopy === "CLOSED" ? "Locked (handle forward)" : s.doors.canopy === "GAP" ? ["Position 2 — cooling gap", "warnc"] : ["Open", "warnc"]],
          ["Rear door", s.doors.rear ? "Locked" : ["Open / unlocked", "warnc"]],
          ["Phase", s.air ? "In flight" : "On the ground"],
        ]} />
      </Ctl>
      <Small>The warning needs the engine-data path (ENG INST breaker and a GIA) and a lit display; in the model it lights for either opening. In flight the model only swings the canopy a few degrees open — the AFM says it stays partly open.</Small>
      {s.air && open && (
        <Caution title="DOOR OPEN in flight (AFM 3-40)">1. Airspeed — below 140 KIAS. 2. Canopy — hold it down with one hand; do not try to close and lock it in flight. 3. Rear door — never try to lock it in flight; it may come off, and the airplane can be flown and landed normally without it. 4. Land at the nearest suitable airfield.</Caution>
      )}
      <H3>Procedures</H3>
      <Notes items={[
        "Before start: canopy closed and locked, rear door closed and locked, DOOR OPEN out (AFM 4A-18; AFMS checklists).",
        "Cooling gap: canopy handle position 2 latches the bolts with a small gap — ground use only (AFM 7-17).",
        "Unlocked canopy in flight: keep below 140 KIAS; it stays partly open and can be held; land as soon as practical (AFM 3-40).",
        "Rear door unlocked in flight: do not try to lock it — the door may separate; fly and land normally (AFM 3-40, 7-18).",
        "Suspected CO: heat OFF, all ventilation and emergency windows open; the canopy may be unlatched in flight (AFM 3-39).",
        "Roll-over: leave through the rear door (front hinge); if neither canopy nor door opens, break the canopy with the emergency axe (OAM 40-326, AFM 7-19).",
        "Emergency landing: canopy unlatched before touchdown only if the AFM procedure calls for it; harnesses tight, seat backs locked (AFM 3-30).",
      ]} />
      <H3>Seats, harnesses and baggage</H3>
      <Facts rows={[
        ["Front seats", "Fixed seat shells; pedals adjust instead (electric on the XLS). Arm 2.30 m (AFM 6.5)"],
        ["Rear seats", "Arm 3.25 m; backs fold forward after pulling the locking-bolt knob (AFM 7-15)"],
        ["Harnesses", "Three-point Schroth at every seat; AmSafe inflatable lap belts optional"],
        ["Baggage", "30 kg / 66 lb at 3.65 m; with the XLS extension 45 kg / 100 lb total; tube 5 kg / 11 lb at 4.32 m (AFM 2-11)"],
        ["Baggage net", "Required — no baggage without the net (AFM 7-16)"],
        ["Max cabin load", "Front + rear seats + baggage per W&B chapter 6"],
      ]} />
      <H3>Safety equipment</H3>
      <Facts rows={[
        ["Fire extinguisher", "Portable Halon / Amerex, arm 2.79 m (AFM 6-22)"],
        ["Emergency axe", "Under the pilot's seat (OAM 40-326)"],
        ["ELT", "406 MHz, behind the baggage frame at arm 4.40 m; ELT switch on the panel (Suppl. S1)"],
        ["CO detector", "CO Guardian, alert light on the panel; stays on until CO < 50 ppm (AFM 7-55)"],
        ["Emergency window", "Left canopy window opens for air or escape (AFM 7-17)"],
        ["Canopy key lock", "Optional; must be unlocked in flight (placard, AFM 2-31)"],
      ]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("cabin")} />
    </>
  );
}
