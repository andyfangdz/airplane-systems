"use client";
import {
  Caution,
  Check,
  Ctl,
  Facts,
  H3,
  Notes,
  PartsList,
  Readouts,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { VAC, live, pcEngaged, vacOk } from "../model";
import { CAT } from "../parts";
import { useM20C } from "../store";

export function Vacuum() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const v = live.vac,
    ok = vacOk(v);
  return (
    <>
      <p className="lead">
        An engine-driven dry vacuum pump, regulated to 4.5–5.0 inches of mercury, runs the artificial horizon, the
        directional gyro and the Positive Control servos (and, on 1965–67 airplanes, the retractable step). There is no
        suction gauge on the panel: two red lights on the artificial horizon warn when the vacuum falls below 4.05 or
        rises above 5.20. Press the test switch beside the horizon to check them; turn the lens housings to dim them at
        night.
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Slider
          id="thr3"
          label="Throttle"
          min={0}
          max={1}
          step={0.01}
          value={s.eng.throttle}
          onChange={(d) =>
            up((x) => {
              x.eng.throttle = d;
            })
          }
          fmt={(x) => (x < 0.02 ? "CLOSED" : Math.round(x * 100) + "%")}
        />
        <Check
          id="vacPump"
          label="Vacuum pump fails (sheared drive)"
          checked={s.eng.fail.vacPump}
          onChange={(x) =>
            up((d) => {
              d.eng.fail.vacPump = x;
            })
          }
        />
        <Readouts
          items={[
            ["Vacuum", [v.toFixed(2) + " in Hg", ok ? "" : v > 2 ? "warnc" : "bad"]],
            ["LOW VACUUM light", E.vacWarn ? (v < VAC.lo ? ["ON", "bad"] : "out") : ["NO PWR", "bad"]],
            ["HIGH VACUUM light", E.vacWarn ? (v > VAC.hi ? ["ON", "bad"] : "out") : ["NO PWR", "bad"]],
            ["Artificial horizon", v >= 3 ? "Erect" : ["TUMBLING", "bad"]],
            ["Directional gyro", v >= 3 ? "Spinning" : ["PRECESSING", "bad"]],
            ["PC", pcEngaged(s) ? "Operating" : s.pc.cutoff ? "Cut off" : ["Inoperative", "warnc"]],
            ["Turn coordinator", E.turnBank ? "Electric — OK" : ["NO PWR", "bad"]],
          ]}
        />
      </Ctl>
      <Small>
        On the ramp with the engine off the Low Vacuum light is on as soon as the master goes on (OM p. 15); it goes out
        as the engine comes up to speed. The regulator holds 4.5–5.0 at any cruise RPM; the pump makes less at idle. The
        lights themselves need the bus (VAC WARN breaker) — a dead master hides a vacuum failure.
      </Small>
      {!ok && s.eng.running && v < VAC.lo && (
        <Caution title="Low vacuum">
          The artificial horizon and directional gyro are unreliable and the PC system has dropped out (OM p. 8, 10).
          Fly the electric turn coordinator and the pitot-static instruments: needle, ball and airspeed. Dry pumps fail
          without warning around 700–800 hours.
        </Caution>
      )}
      <H3>Details (OM p. 10; TCDS 2A3)</H3>
      <Facts
        rows={[
          [
            "Pump",
            "Airborne dry carbon-vane pump on the accessory case (113A / 200CC / 211CC approved); required for IFR, optional VFR",
          ],
          ["Regulator", "4.50–5.00 in Hg (3.5–5.0 on 1962–64 airplanes)"],
          [
            "Lights",
            "Red, on the artificial horizon: LOW below 4.05, HIGH above 5.20; test switch left of the horizon",
          ],
          ["Consumers", "Artificial horizon, directional gyro, PC servos; vacuum step on 1965–67"],
          [
            "Filter",
            "Central filter on the cabin air into the gyros; a clogged element makes them sluggish (Ranger 2-7)",
          ],
          [
            "Turn coordinator",
            "Electric gyro with a vacuum pick-off for PC (TURN & BANK breaker) — the one gyro that survives a pump failure",
          ],
          [
            "Panel",
            "Flight panel in front of the pilot; the 1968 book describes optional gyros in a 'T' with the horizon top centre and the DG below",
          ],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Pre-take-off: check the artificial horizon and directional gyro erect, test the gear and vacuum lights (OM p. 18).",
          "A leaking PC servo diaphragm or hose pulls the vacuum down even though the pump is fine — the lights are the first clue.",
          "1962–64 airplanes without PC and with the hand-cranked step have the same gyro system at a lower regulated vacuum.",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("vacuum")} />
    </>
  );
}
