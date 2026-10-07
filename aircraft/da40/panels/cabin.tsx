"use client";
import { Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Small } from "@/components/ui/controls";
import { annunciations, displays, type CanopyPos } from "../model";
import { CAT } from "../parts";
import { useDA40 } from "../store";

export function Cabin() {
  const s = useDA40((x) => x.s),
    E = useDA40((x) => x.E),
    up = useDA40((x) => x.update);
  const d = displays(s, E),
    shown = d.pfd || d.mfd;
  const doorMsg = shown && annunciations(s, E).some(([, t]) => t === "DOOR OPEN");
  const open = s.doors.canopy !== "CLOSED" || !s.doors.rear;
  return (
    <>
      <p className="lead">
        Four seats in two rows inside a GFRP cabin with a roll bar behind the front seats. The front canopy is hinged at
        its forward edge and swings up and forward; the rear passenger door on the left opens upward on hinges along its
        top edge (its front hinge can be released for emergency exit) and a gas strut holds it open. Each has a locking
        handle and a sensor that lights the red DOOR OPEN warning on the PFD.
      </p>
      <H3>Canopy and rear door</H3>
      <Ctl>
        <Seg<CanopyPos>
          id="canopy"
          label="Front canopy"
          options={[
            ["CLOSED", "Closed & locked"],
            ["GAP", "Cooling gap"],
            ["OPEN", "Open"],
          ]}
          value={s.doors.canopy}
          onChange={(v) =>
            up((x) => {
              x.doors.canopy = v;
            })
          }
        />
        <Check
          id="rear"
          label="Rear door closed and locked"
          checked={s.doors.rear}
          onChange={(v) =>
            up((x) => {
              x.doors.rear = v;
            })
          }
        />
        <Readouts
          items={[
            [
              "DOOR OPEN warning",
              !shown ? ["No display power", "warnc"] : doorMsg ? ["DOOR OPEN (red)", "bad"] : "Out",
            ],
            [
              "Canopy",
              s.doors.canopy === "CLOSED"
                ? "Locked (handle forward)"
                : s.doors.canopy === "GAP"
                  ? ["Position 2 — cooling gap", "warnc"]
                  : ["Open", "warnc"],
            ],
            ["Rear door", s.doors.rear ? "Locked" : ["Open / unlocked", "warnc"]],
            ["Phase", s.air ? "In flight" : "On the ground"],
          ]}
        />
      </Ctl>
      <Small>
        The warning needs the engine-data path (ENG INST breaker and a GIA) and a lit display; in the model it lights
        for either opening. In flight the model only swings the canopy a few degrees open — when it is unlatched on
        purpose in the smoke or CO procedures the AFM says it stays partly open (AFM 3-27, 3-39).
      </Small>
      {s.air && open && (
        <Caution title="DOOR OPEN in flight (AFM 3-40)">
          1. Airspeed — reduce immediately. 2. Canopy — check visually closed. 3. Rear door — check visually closed. If
          either is unlocked: airspeed below 140 KIAS, land at the next suitable airfield. Do not try to lock the rear
          door in flight (it may separate); without it the airplane can be safely flown to the next suitable airfield.
        </Caution>
      )}
      <H3>Procedures</H3>
      <Notes
        items={[
          "Before start: rear door closed and locked, door/canopy locks unblocked with keys removed, front canopy position 1 or 2 (cooling gap) (AFM 4A-11; AFMS p. 37). Before take-off: canopy closed and locked and no DOOR OPEN message (AFMS p. 46).",
          "Cooling gap: canopy handle position 2 latches the bolts with a small gap — ground use only (AFM 7-17).",
          "Unlocked canopy in flight: reduce airspeed, check visually, keep below 140 KIAS and land at the next suitable airfield (AFM 3-40).",
          "Rear door unlocked in flight: below 140 KIAS, land at the next suitable airfield; do not try to lock it — the door may separate, and without it the airplane can be safely flown to the next suitable airfield (AFM 3-40).",
          "Suspected CO: heat OFF, all ventilation and emergency windows open; the canopy may be unlatched in flight (AFM 3-39).",
          "Roll-over: leave through the rear door (front hinge); if neither canopy nor door opens, break the canopy with the emergency axe (OAM 40-326, AFM 7-19).",
          "Emergency landing, engine off: 76 KIAS (1,200 kg), fuel selector OFF; when the field is assured flaps LDG, harnesses tight; if time allows ignition OFF and master OFF; touch down at the lowest possible airspeed (AFM 3-29/3-30).",
        ]}
      />
      <H3>Seats, harnesses and baggage</H3>
      <Facts
        rows={[
          ["Front seats", "Fixed seat shells; pedals adjust instead (electric on the XLS). Arm 2.30 m (AFM 6.5)"],
          ["Rear seats", "Arm 3.25 m; backs fold forward after pulling the locking-bolt knob (AFM 7-15)"],
          ["Harnesses", "Three-point Schroth at every seat; AmSafe inflatable lap belts optional"],
          [
            "Baggage",
            "30 kg / 66 lb at 3.65 m; with the XLS extension 45 kg / 100 lb total; tube 5 kg / 11 lb at 4.32 m (AFM 2-11)",
          ],
          ["Baggage net", "Required — no baggage without the net (AFM 7-16)"],
          ["Max cabin load", "Front + rear seats + baggage per W&B chapter 6"],
        ]}
      />
      <H3>Safety equipment</H3>
      <Facts
        rows={[
          ["Fire extinguisher", "Portable Halon / Amerex, arm 2.79 m (AFM 6-22)"],
          ["Emergency axe", "Under the pilot's seat (OAM 40-326)"],
          [
            "ELT",
            "406 MHz Artex ME406 (OAM 40-284, listed in AFM 6-21 and the XLS brochure; N949KC's unit inferred, its supplement not available), arm 4.40 m; remote switch on the panel",
          ],
          ["CO detector", "CO Guardian, alert light on the panel; stays on until CO < 50 ppm (AFM 7-55)"],
          ["Emergency window", "Left canopy window opens for air or escape (AFM 7-17)"],
          ["Canopy key lock", "Optional; must be unlocked in flight (placard, AFM 2-31)"],
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("cabin")} />
    </>
  );
}
