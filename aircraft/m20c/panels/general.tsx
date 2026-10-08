"use client";
import { selectSys } from "@/lib/fleet";
import { sysColor } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Slider, Small } from "@/components/ui/controls";
import { extLit } from "../model";
import { CAT } from "../parts";
import { scenarioCruise, scenarioRamp, useM20C } from "../store";
import { SYS } from "../systems";

export function Overview() {
  const theme = useView((x) => x.theme);
  const air = useM20C((x) => x.s.air),
    running = useM20C((x) => x.s.eng.running);
  return (
    <>
      <p className="lead">
        A study model of the systems of N6947N, a Mooney M20C Ranger: Lycoming O-360-A1D, Hartzell constant-speed
        propeller, manual Johnson-bar landing gear, hand-pumped hydraulic flaps, the Brittain Positive Control wing
        leveler and the whole-tail pitch trim that makes a Mooney a Mooney. Pick a system to fly the camera to it, hover
        parts for their notes, and work the controls, switches, breakers and failures in the panel. Everything is
        linked: pull the throttle with the gear up and the horn sounds; let the vacuum drop and the gyros, the PC and
        the red lights respond.
      </p>
      <H3>Start from</H3>
      <Ctl>
        <BtnRow>
          <button type="button" className="btn" onClick={scenarioCruise}>
            Cruise · 5,500 ft
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              scenarioRamp();
              selectSys("engine");
            }}
          >
            Cold &amp; dark on the ramp → start
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["Where", air ? "Airborne" : "On the ramp"],
            ["Engine", running ? "RUNNING" : ["STOPPED", "bad"]],
          ]}
        />
      </Ctl>
      <H3>Key figures</H3>
      <Facts
        rows={[
          ["Engine", "Lycoming O-360-A1D · 180 hp @ 2,700 RPM · carbureted (MA-4-5)"],
          ["Propeller", "Hartzell HC-C2YK-1B / 7666A-2, 2 blades, 74 in, constant speed"],
          ["Fuel", "2 × 26 US gal integral wing tanks, 52 total · 100LL (91/98 min as built)"],
          ["Electrical", "12 V · 60 A alternator · 35 Ah battery · one bus"],
          ["Gear", "Manual (Johnson bar) · rubber shock discs · 120 mph"],
          ["Flaps", "Hydraulic hand pump: 2 strokes T/O 15° · 4½ strokes full 33°"],
          ["Trim", "Entire empennage pivots — no trim tab"],
          ["Wing leveler", "Brittain Positive Control, vacuum, standard"],
          ["Weights", "Gross 2,575 lb · ≈1,525 empty · baggage 120 lb"],
          ["Dimensions", "Span 35 ft · length 23 ft 2 in · height 8 ft 4 in · 167 ft²"],
          ["Speeds (mph)", "VNE 189 · VNO 150 · VA 132 · VLO/VLE 120 · VFE 125 · stall 67 / 57"],
        ]}
      />
      <H3>Systems</H3>
      <div className="overview-grid">
        {SYS.slice(1).map((s) => (
          <button
            key={s.id}
            type="button"
            style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties}
            onClick={() => selectSys(s.id)}
          >
            <b>{s.name}</b>
            <span>{s.blurb}</span>
          </button>
        ))}
      </div>
      <p className="disc">
        Unofficial study aid. Built from the 1965 Mark 21 (M20C) Owner's Manual with its 1962–64 supplement (the closest
        available edition to the 1967–68 books; same systems), the M20C Ranger Operator's Manual of December 1974
        (Sections I–II, IV, V and VII, used where the older book is silent), the 1963 FAA Approved Flight Manual for
        M20C s/n 2394, FAA Type Certificate Data Sheet 2A3 (limits, control travels, stations, equipment), the Lycoming
        O-360 operator's manual, Hartzell manual 115N and its ADs, Mooney's serial-number chronology, and owner and
        type-club material where marked. The 1968 Ranger owner's manual (Mooney 68-20C-OM-B) could not be found online;
        its dimensioned three-view was. Where the sources are silent (control routing, servo and antenna locations,
        panel layout) the model says so and is approximate. Geometry is approximate. Always use the manual, placards and
        equipment list carried in N6947N.
      </p>
    </>
  );
}

export function Airframe() {
  return (
    <>
      <p className="lead">
        A welded steel-tube cabin structure skinned in aluminium, a conventional monocoque tail cone, and a one-piece
        laminar-flow wing with a main and an auxiliary spar. The entire empennage — stabilizer, fin, rudder and elevator
        — pivots on two attachment points at the tail cone to trim the airplane. Low, slippery and small inside: the
        Mooney sits closer to the ground than most and needs a flare begun lower than you are used to.
      </p>
      <Facts
        rows={[
          ["Cabin", "Tubular steel truss covered with aluminium sheet; stainless firewall (OM p. 5)"],
          ["Tail cone", "Conventional aluminium monocoque"],
          [
            "Wing",
            "One piece, main + auxiliary spar, stressed skin; NACA 63-215 root / 64-412 tip; dihedral 5.5°; washout 1.5°",
          ],
          [
            "Riveting",
            "Flush over the forward top two-thirds of the wing (Ranger 1-2); 1962–67 airplanes were flush-riveted further aft",
          ],
          ["Empennage", "Pivots as one for trim; vertical leading edge, rudder trailing edge raked forward going up"],
          ["Span / length / height", "35 ft 0 in / 23 ft 2 in / 8 ft 4 in (Ranger Fig. 1-1)"],
          ["Stabilizer span", "11 ft 9 in"],
          ["Wing area / loading", "167 ft² · 15.1 lb/ft² at gross"],
          ["Track / wheelbase", "9 ft 0¾ in / 5 ft 6-9/16 in"],
          ["Gross weight", "2,575 lb (M20C from 1962; the M20B was 2,450)"],
          ["CG limits", "+46.5 to +49.0 in at 2,575 lb; +42.0 to +49.0 at 2,100 lb or less (TCDS 2A3)"],
          ["Datum", "Nose-gear attaching bolts, 33 in forward of the wing leading edge at WS 59.25"],
          ["Load factors", "+3.8 / −1.5 flaps up; +2.0 flaps down. No aerobatics, no spins"],
          ["Baggage", "120 lb at +93 in; hat rack 10 lb at +114 (OM p. 14; TCDS)"],
        ]}
      />
      <H3>1967 Mark 21 vs 1968 Ranger</H3>
      <Facts
        rows={[
          ["Windshield", "two-piece with centre post → one-piece"],
          ["Dorsal fin", "small factory fin → removed"],
          ["Cowl flaps", "adjustable (pull to open, not above 150 mph) → fixed"],
          ["Entry step", "vacuum-retracted → fixed"],
          ["Electrical", "50 A generator → 60 A alternator (no serial break found; check the equipment list)"],
          ["VFE", "100 mph → 125 mph (TCDS)"],
          ["Unchanged", "Johnson bar, hand-pump flaps, PC, two side windows, 52 gal"],
        ]}
      />
      <H3>Structure — tap to locate</H3>
      <PartsList parts={CAT.pinned("airframe")} />
      <H3>Notes</H3>
      <Notes
        items={[
          "Full fuel, 120 lb of baggage, a pilot and two rear passengers can put the CG past the aft limit — move one passenger to the right front seat (OM p. 14). Front-seat position matters at aft loadings (Ranger 4-10).",
          "Tie-down rings and jack points screw into the receptacles marked HOIST POINT outboard of each main gear; the tail ring is under the tail skid (OM p. 25; Ranger 7-3).",
          "Tow only with the hand tow bar in the nose gear, within the turn-limit marks: vehicle towing can damage the gear structure (OM p. 25).",
          "The steel cage corrodes under leaking windows — Service Bulletin M20-208 inspection; wet-wing sealant ages and weeps (type-club material).",
          "Stations in the model are set from the TCDS arms; the shape is traced from the 1968 manual's three-view and photos of N6947N.",
        ]}
      />
    </>
  );
}

export function Lighting() {
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const L = s.lights,
    x = extLit(s, E);
  const st = (sw: boolean, lit: boolean): [string, "" | "bad"] | string =>
    lit ? "ON" : sw ? ["NO PWR", "bad"] : "off";
  const flip = (k: "beacon" | "nav" | "landing") =>
    up((d) => {
      d.sw[k] = !d.sw[k];
    });
  return (
    <>
      <p className="lead">
        Navigation lights at the wing tips and tail, a rotating beacon (if installed), and a single 250 W landing light
        in the nose bowl — each on its own switch-breaker in the row on the lower left of the panel. Inside, two
        adjustable spot lights on the headliner light the panel, a small light under the panel lights the fuel selector,
        and the dome light is the backup if the panel lights fail. All of it is dead with the master switch off.
      </p>
      <H3>Switch-breakers (lower left panel, OM p. 4)</H3>
      <Ctl>
        <div className="switches">
          <Rocker label="BEACON" on={s.sw.beacon} onToggle={() => flip("beacon")} />
          <Rocker label="NAV LTS" on={s.sw.nav} onToggle={() => flip("nav")} />
          <Rocker label="LDG LT" on={s.sw.landing} onToggle={() => flip("landing")} />
        </div>
        <Slider
          id="spot"
          label="Headliner spot lights (rheostat)"
          min={0}
          max={1}
          step={0.05}
          value={L.spot}
          onChange={(v) =>
            up((d) => {
              d.lights.spot = v;
            })
          }
          fmt={(v) => (v < 0.02 ? "OFF" : Math.round(v * 100) + "%")}
        />
        <Slider
          id="instr"
          label="Instrument lights"
          min={0}
          max={1}
          step={0.05}
          value={L.instr}
          onChange={(v) =>
            up((d) => {
              d.lights.instr = v;
            })
          }
          fmt={(v) => (v < 0.02 ? "OFF" : Math.round(v * 100) + "%")}
        />
        <BtnRow>
          <button
            type="button"
            className="btn"
            onClick={() =>
              up((d) => {
                d.lights.cabin = !d.lights.cabin;
              })
            }
          >
            Dome light {L.cabin ? "OFF" : "ON"}
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["Beacon", st(s.sw.beacon, x.beacon)],
            ["Nav lights", st(s.sw.nav, x.nav)],
            ["Landing light", st(s.sw.landing, x.landing)],
            ["Spot lights", L.spot > 0 ? (E.bus > 0 ? "ON" : ["NO PWR", "bad"]) : "off"],
            ["Instrument lts", L.instr > 0 ? (E.instLts ? "ON" : ["NO PWR", "bad"]) : "off"],
            ["Dome", L.cabin ? (E.bus > 0 ? "ON" : ["NO PWR", "bad"]) : "off"],
          ]}
        />
      </Ctl>
      <Small>
        Exterior glows show in the Overview and Lighting views. A switch-breaker that trips flips itself to OFF (OM p.
        4) — try it in the Electrical panel.
      </Small>
      <H3>Lights — tap to locate</H3>
      <PartsList parts={CAT.pinned("lighting")} />
      <H3>Details</H3>
      <Facts
        rows={[
          ["Landing light", "One 250 W lamp in the nose cowl (100 W before 1962); on the LANDING LIGHT switch-breaker"],
          ["Nav lights", "Wing tips and tail; required at night"],
          [
            "Beacon",
            "'Rotating beacon (if installed)' (OM p. 3); the anti-collision light required for night VFR (Ranger 4-7). Fin-cap or belly — N6947N's position unconfirmed",
          ],
          [
            "Panel lights",
            "Two headliner spot lights with a rheostat beside them (OM p. 3); the original rheostat also fed the compass light and the selector light",
          ],
          ["Selector light", "Under the panel on the left; rotate the lens to dim (OM p. 3)"],
          ["Dome light", "Headliner, centre of the cabin; backup for the panel (OM p. 3)"],
          ["Gear lights", "Rotate the lens housings to dim, press to test (OM p. 6)"],
          ["Strobes", "Not original; many airplanes have them added"],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Check the lights on the walk-around if the flight is at night, and have a flashlight aboard (OM p. 15).",
          "Night VFR needs position lights, an anti-collision light and (for hire) the electric landing light (Ranger 4-7).",
          "With the alternator off line everything runs on the 35 Ah battery: shed the landing light first (Electrical panel).",
        ]}
      />
    </>
  );
}
