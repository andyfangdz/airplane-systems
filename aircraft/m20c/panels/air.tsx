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
  Rocker,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { hornLevel, live, mph, stallMph } from "../model";
import { CAT } from "../parts";
import { useM20C } from "../store";

export function Environment() {
  useTicker(200);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const env = s.env,
    ram = s.air || s.eng.running;
  return (
    <>
      <p className="lead">
        Two systems. The lower one mixes hot air from a muff around the exhaust manifold with cool air from the flush
        scoop on the right side at a junction box behind the firewall, then ducts it to the pilots' feet, the windshield
        defroster, the rear passengers' feet and the baggage compartment. The overhead one is a retractable scoop on the
        roof feeding four ceiling outlets with ram air. A left-side scoop gives the pilot an eyeball vent and cools the
        radios.
      </p>
      <H3>Controls</H3>
      <Ctl>
        <Slider
          id="heat"
          label="CABIN HEAT (push-pull)"
          min={0}
          max={1}
          step={0.05}
          value={env.heat}
          onChange={(v) =>
            up((d) => {
              d.env.heat = v;
            })
          }
          fmt={(v) => (v < 0.03 ? "OFF" : v > 0.97 ? "FULL" : Math.round(v * 100) + "%")}
        />
        <Slider
          id="vent"
          label="CABIN VENT (right scoop)"
          min={0}
          max={1}
          step={0.05}
          value={env.vent}
          onChange={(v) =>
            up((d) => {
              d.env.vent = v;
            })
          }
          fmt={(v) => (v < 0.03 ? "CLOSED" : v > 0.97 ? "OPEN" : Math.round(v * 100) + "%")}
        />
        <Slider
          id="scoop"
          label="Overhead scoop knob (counter-clockwise = extend)"
          min={0}
          max={1}
          step={0.05}
          value={env.scoop}
          onChange={(v) =>
            up((d) => {
              d.env.scoop = v;
            })
          }
          fmt={(v) => (v < 0.03 ? "RETRACTED" : v > 0.97 ? "FULLY OUT" : Math.round(v * 100) + "%")}
        />
        <Check
          id="storm"
          label="Pilot's storm window open"
          checked={env.stormWindow}
          onChange={(v) =>
            up((d) => {
              d.env.stormWindow = v;
            })
          }
        />
        <Readouts
          items={[
            ["Airflow", ram ? (s.air ? "Ram air" : "Prop wash only") : ["None (engine off)", "warnc"]],
            ["Heat muff", env.heat < 0.03 ? "Closed" : `Open ${Math.round(env.heat * 100)}%`],
            ["Mix", env.heat + env.vent < 0.05 ? "—" : `${Math.round((env.heat / (env.heat + env.vent)) * 100)}% hot`],
            ["Overhead", env.scoop < 0.03 ? "Scoop in" : "Scoop out — drag"],
          ]}
        />
      </Ctl>
      <Small>
        The pilot and co-pilot foot outlets have deflectors that aim the air or shut it off; with them shut the flow
        goes to the defrosters and the rear outlets (OM p. 11). Open the overhead scoop only enough for the outlets — it
        costs drag (OM p. 11).
      </Small>
      {s.env.stormWindow && s.air && mph(live.fs.ias) > 150 && (
        <Caution title="Storm window">Do not open the storm window above 150 mph (Ranger 4-9).</Caution>
      )}
      <H3>Procedures</H3>
      <Notes
        items={[
          "Engine fire: cabin heat OFF (Ranger 5-3).",
          "Carbon monoxide: the heat muff sits on the exhaust; a cracked muffler puts exhaust straight into the cabin air — carry a CO detector and have the muffler inspected every 100 h (NTSB Safety Alert SA-070 concerns an M20C).",
          "Before take-off: close the door and the pilot's window and latch them (OM p. 18).",
          "Maximum defrost: cabin heat on, vent closed, and shut the foot and rear outlets so everything goes to the windshield.",
        ]}
      />
      <H3>Details (OM p. 10–11)</H3>
      <Facts
        rows={[
          [
            "Heat source",
            "Muff around the exhaust manifold (Hanlon & Wilson exhaust from 1962); flexible duct to the junction box",
          ],
          ["Junction box", "Aft side of the firewall, co-pilot's side; hot and cool controlled separately"],
          [
            "Outlets",
            "Pilot's and co-pilot's feet (with deflectors), windshield defroster, rear feet, baggage compartment",
          ],
          [
            "Right scoop",
            "Flush, right fuselage side: cool air for the junction box and the radio vent grill on the firewall (valve for cold weather)",
          ],
          [
            "Left scoop",
            "One eyeball outlet by the pilot's knee plus two radio-cooling tubes (not on 1962–64 airplanes)",
          ],
          ["Overhead", "Retractable roof scoop, knob above the pilot; four ceiling outlets with inner volume knobs"],
          ["Blower", "None — all ram air"],
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("environment")} />
    </>
  );
}

export function Pitot() {
  useTicker(200);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const horn = hornLevel(s, E),
    vs = stallMph(live.flapAng);
  return (
    <>
      <p className="lead">
        A pitot tube under the left wing feeds the airspeed indicator; static ports on both sides of the tail cone feed
        the altimeter, airspeed and rate of climb; drains sit under the left wing root and under the tail-cone access
        door. The airspeed indicator reads miles per hour. The stall warning is a vane in the left wing's leading edge
        that closes an electric horn in the headliner — intermittent 5 to 10 mph above the stall, steady at it.
      </p>
      <H3>Pitot heat</H3>
      <Ctl>
        <div className="switches">
          <Rocker
            label="PITOT HEAT"
            on={s.sw.pitotHeat}
            onToggle={() =>
              up((d) => {
                d.sw.pitotHeat = !d.sw.pitotHeat;
              })
            }
          />
        </div>
        <Check
          id="heatInst"
          label="Heated pitot installed (optional equipment)"
          checked={s.pitot.heatInstalled}
          onChange={(v) =>
            up((d) => {
              d.pitot.heatInstalled = v;
            })
          }
        />
        <Slider
          id="oat"
          label="Outside air temperature"
          min={-25}
          max={35}
          step={1}
          value={s.pitot.oat}
          onChange={(v) =>
            up((d) => {
              d.pitot.oat = v;
            })
          }
          fmt={(v) => `${v} °C / ${Math.round((v * 9) / 5 + 32)} °F`}
        />
        <Check
          id="alts"
          label="Alternate static valve OPEN (SB M20-158, if fitted)"
          checked={s.pitot.altStatic}
          onChange={(v) =>
            up((d) => {
              d.pitot.altStatic = v;
            })
          }
        />
        <Readouts
          items={[
            [
              "Pitot heat",
              !s.pitot.heatInstalled
                ? "Not installed"
                : !s.sw.pitotHeat
                  ? "OFF"
                  : E.pitotHeat
                    ? "HEATING"
                    : ["NO PWR", "bad"],
            ],
            ["Static source", s.pitot.altStatic ? ["CABIN", "warnc"] : "Tail-cone ports"],
            ["Airspeed", s.air ? `${mph(live.fs.ias).toFixed(0)} mph` : "0"],
          ]}
        />
      </Ctl>
      <Small>
        Pitot heat was optional in the 1960s ('heated pitot (if installed)', OM p. 3) on its own switch-breaker; don't
        run it long on the ground. There was no factory alternate static: Service Bulletin M20-158 of 1969 added the
        valve under the left panel. With it open, cabin pressure makes the airspeed and altimeter read a little high
        (illustrative).
      </Small>
      <H3>Stall warning</H3>
      <Ctl>
        <Slider
          id="sias"
          label="Airspeed (demo)"
          min={0}
          max={130}
          step={1}
          value={s.stall.ias}
          onChange={(v) =>
            up((d) => {
              d.stall.ias = v;
            })
          }
          fmt={(v) => `${v} mph`}
        />
        <Check
          id="stuck"
          label="Vane stuck (ice, paint, damage)"
          checked={s.stall.stuck}
          onChange={(v) =>
            up((d) => {
              d.stall.stuck = v;
            })
          }
        />
        <Readouts
          items={[
            ["Stall speed", `${vs} mph (2,575 lb, flaps ${live.flapAng.toFixed(0)}°)`],
            ["Horn", horn > 0 ? [horn > 0.9 ? "STEADY" : "INTERMITTENT", "bad"] : "Quiet"],
            ["Margin", `${Math.round(Math.min(s.stall.ias, s.air ? mph(live.fs.ias) : 999) - vs)} mph`],
            ["STALL WARN breaker", E.stallWarn ? "OK" : ["NO PWR", "bad"]],
          ]}
        />
      </Ctl>
      <Small>
        Stall speeds, power off, 2,575 lb (OM Fig. 4): flaps up 67, take-off 64, full 57 mph IAS. The horn is electric
        (OM p. 3) — silent with the master off, like every warning device (Ranger 4-9). Set the flaps in the Flaps
        panel.
      </Small>
      <H3>Details</H3>
      <Facts
        rows={[
          [
            "Pitot",
            "Mast under the left wing; drain valve on the forward bottom skin just outboard of the fillet (Ranger 2-7)",
          ],
          ["Statics", "One port each side of the tail cone; drain in the belly below the tail-cone access door"],
          [
            "Instruments",
            "Airspeed (mph), sensitive altimeter, rate of climb; AI and DG on vacuum, turn coordinator electric",
          ],
          ["Stall vane", "Safe-Flight Model R lift detector, left leading edge (TCDS); horn in the headliner"],
          ["Airspeed limits", "VNE 189 · VNO 150 · VA 132 · VLO/VLE 120 · VFE 125 (1968) mph CAS"],
          ["ASI error", "Up to 2.5 mph (Ranger 6-6)"],
          [
            "Required",
            "Pitot heat is not required equipment; IFR needs the gyros, a sensitive altimeter and a clock (Ranger 4-8)",
          ],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Walk-around: pitot and stall vane unobstructed, static ports clear, pitot and static drains checked (Ranger 3-3, 3-4).",
          "Below 8,000 ft the airplane cruises into the yellow arc in smooth air; rough air means staying below 150 (OM p. 21).",
          "Approach at 90 on base and about 80 on final; the horn blows 5–10 mph above the stall (OM p. 23).",
          "The gear horn and the stall horn are both reed horns — the gear horn is tied only to throttle position.",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("pitot")} />
    </>
  );
}
