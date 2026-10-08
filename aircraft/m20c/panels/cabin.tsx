"use client";
import { Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Small } from "@/components/ui/controls";
import { CAT } from "../parts";
import { useM20C } from "../store";

export function Cabin() {
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  return (
    <>
      <p className="lead">
        Four seats in a cabin 43½ inches wide, entered through one forward-opening door on the right that serves both
        rows, with a baggage door above the wing trailing edge for loading from the ground. The panel in front of the
        pilot is shock mounted and carries the flight instruments; the engine cluster, tachometer and manifold-pressure
        gauge sit to its right, the radios in the centre, the switch-breakers at the lower left and the breaker cover at
        the lower right. The Johnson bar swings between the seats from a floor pivot, the flap pump lever lies beside it
        at cushion height, and the trim wheel is on the floor between the seats.
      </p>
      <H3>Door and windows</H3>
      <Ctl>
        <Check
          id="door"
          label="Cabin door closed and latched"
          checked={s.doors.cabin}
          onChange={(v) =>
            up((d) => {
              d.doors.cabin = v;
            })
          }
        />
        <Check
          id="bag"
          label="Baggage door secure"
          checked={s.doors.baggage}
          onChange={(v) =>
            up((d) => {
              d.doors.baggage = v;
            })
          }
        />
        <Check
          id="storm2"
          label="Pilot's storm window open"
          checked={s.env.stormWindow}
          onChange={(v) =>
            up((d) => {
              d.env.stormWindow = v;
            })
          }
        />
        <Readouts
          items={[
            ["Door", s.doors.cabin ? "Latched" : ["OPEN", "warnc"]],
            ["Baggage door", s.doors.baggage ? "Secure" : ["OPEN", "warnc"]],
            ["Storm window", s.env.stormWindow ? "Open (≤ 150 mph)" : "Closed"],
            ["Warning", "None — no door switches on this airplane"],
          ]}
        />
      </Ctl>
      <Small>
        Close the door with the pull strap and rotate the handle forward to latch; do not slam it (OM p. 15). There is
        no door-open warning; a door that pops on the take-off roll is noisy but the airplane flies — land and shut it.
      </Small>
      <H3>Instrument panel</H3>
      <Notes
        items={[
          "Flight panel (pilot): airspeed in mph, artificial horizon with the two red vacuum lights and test switch, sensitive altimeter; turn coordinator with the PC roll-trim knob, directional gyro, rate of climb (optional). The 1962 M20C introduced the 'T' grouping with the radios in the centre.",
          "Gear lights: green GEAR DOWN and red UNSAFE beside the Johnson bar's down socket; rotate to dim, press to test.",
          "Engine instruments: tachometer, combined manifold-pressure / fuel-pressure gauge, and the Garwin cluster with fuel quantity left and right, oil temperature, oil pressure, cylinder-head temperature and the ammeter. EGT optional.",
          "Centre: push-pull throttle, hexagon mixture, propeller and carburetor heat with friction locks; magneto / starter key switch on the left; master switch on the left of the flight panel.",
          "Lower left: the switch-breaker row. Lower right: the push-to-reset breaker cover. Compass on the windshield post.",
          "The live panel in the 3D view follows this description; the 1968 book's panel photograph is not available, so positions are approximate.",
        ]}
      />
      <H3>Seats, belts and baggage</H3>
      <Facts
        rows={[
          [
            "Front seats",
            "Individually mounted, adjustable fore and aft; belts attached to the seats; arms +36.5 to +44 in (TCDS)",
          ],
          ["Rear seat", "Bench at +70 in; backs removable for cargo (Ranger 2-18)"],
          ["Belts", "Lap belts; shoulder harnesses were not standard in 1968"],
          [
            "Baggage",
            "120 lb at +93 in, 15 cu ft, two pairs of tie-down straps; loose equipment (tow bar, eyebolts, sampler cup) stowed here",
          ],
          ["Hat rack", "10 lb of soft, light objects at +114 in (OM p. 14)"],
          ["Cabin", "43½ in wide — 'shoulder-to-shoulder'; low seating with knees under the panel"],
          [
            "Required to carry",
            "Airworthiness and registration certificates, owner's manual, weight and balance with equipment list (OM p. 28)",
          ],
        ]}
      />
      <H3>Before take-off (OM p. 17–18)</H3>
      <ol className="notes">
        {[
          "Flight controls free and smooth; fuel quantity, selector and pressure checked.",
          "Altimeter set; oil pressure and temperature; ammeter showing a charge; CHT.",
          "Mags at 1,700, max drop 125; exercise the propeller; mixture rich.",
          "Gear and vacuum lights tested; trim to the take-off mark; flaps to take-off (two strokes); boost pump on.",
          "Lights checked at night; seat belts; door and pilot's window closed and latched.",
          "Clear the floor for retraction-handle clearance.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("cabin")} />
    </>
  );
}
