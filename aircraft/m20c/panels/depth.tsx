"use client";
import { Check, Ctl, Facts, H3, Notes, Readouts, Small, useTicker } from "@/components/ui/controls";
import type { SysId } from "@/lib/systems";
import { cabinHeatContaminated, live, pcAvailable, type Sim } from "../model";
import { useM20C } from "../store";

const FAULTS: Partial<Record<SysId, readonly [keyof Sim["faults"], string][]>> = {
  engine: [
    ["magL", "Left magneto fails"],
    ["magR", "Right magneto fails"],
    ["oilCooler", "Oil cooler obstructed"],
  ],
  fuel: [
    ["fuelScreen", "Common selector screen obstructed"],
    ["boostPump", "Electric boost pump fails"],
  ],
  flaps: [["flapLeak", "Flap check/release valve leaks"]],
  autopilot: [["pcLeak", "PC servo/command-line leak"]],
  vacuum: [["vacuumRegulator", "Vacuum regulator stuck high"]],
  electrical: [["overvoltage", "Alternator overvoltage / protective relay opens"]],
  environment: [["exhaustLeak", "Exhaust heater leak"]],
};
const FACTS: Partial<Record<SysId, readonly [string, string][]>> = {
  airframe: [
    [
      "Construction",
      "Welded steel-tube cabin and stressed aluminum wing/tail skins on main and auxiliary spars (1968 OM scan p. 7).",
    ],
    [
      "Empennage",
      "The entire tail pivots for longitudinal trim; fixed step and cowl openings belong to this selected 1968 configuration.",
    ],
    [
      "Inspection",
      "Use the actual 1968 preflight to inspect skin, attach points and fasteners. Internal geometry is a source-backed schematic, not a structural repair drawing.",
    ],
  ],
  engine: [
    [
      "Ignition",
      "O-360-A1D: left S4LN-200, right S4LN-204 and MA-4-5 carburetor in Lycoming 60297-12 Table 1; approved replacements may differ.",
    ],
    [
      "Oil service",
      "8 qt capacity; 6–8 qt in the 1968 book. Screens and optional full-flow filter have different service intervals.",
    ],
    [
      "Inspection",
      "Lycoming 60297-12 § 4: inspect ignition leads, inlet strainers, hose/clamp security and exhaust flanges. No installed modern multi-cylinder engine monitor is assumed.",
    ],
  ],
  propeller: [
    [
      "HC-C2YK-1B",
      "Non-counterweighted,-1 constant-speed hub. Oil raises pitch; spring and centrifugal twisting moment lower pitch. It does not feather and has no air charge (Hartzell 115N Description 2.B).",
    ],
    [
      "Configuration",
      "1968 OM lists74 in/7666 A-2. Actual hub suffix, replacement blades, STCs and AD applicability require installed propeller records.",
    ],
    [
      "Maintenance",
      "Inspect blades, spinner, hub and oil/grease leakage per Hartzell 115N Inspection/Check and Maintenance. No universal recurring AD interval is inferred from the model name.",
    ],
  ],
  fuel: [
    [
      "Feed",
      "Wet-wing pickup → floor selector/strainer → electric pump → engine pump → MA-4-5 float bowl. No BOTH position, injection divider or tank-return circuit.",
    ],
    [
      "Sampling",
      "1968 OM scan p. 87: sample both wing sumps and flush selector with each tank selected, then ensure drain closes. This edition specifies draining a half-cupful from each selector selection.",
    ],
    [
      "Inspection",
      "MAN 106 § 4-5: selector/drain screen cleaning every 50 h. § 4-11: check vents for obstruction; § 4-12: electrical transmitter inspection.",
    ],
  ],
  controls: [
    [
      "Linkage",
      "Push-pull tubes, self-aligning rod ends, Formica guides, bellcranks and a mechanical aileron/rudder interconnect (1968 OM 2-6; MAN 106 § 6).",
    ],
    [
      "Trim",
      "Floor wheel → reduction gearing/torque tube → aft gearbox/jackscrew → complete empennage. Mechanical trim and flap pointers require their own rigging.",
    ],
    [
      "Late 1968",
      "MAN 106 p. 6-7 separates elevator static-balance limits at serial 680181. N6947N, serial 680194 belongs to the later 1968 group; repaint/repair balancing must use that row.",
    ],
  ],
  flaps: [
    [
      "Circuit",
      "Common brake/flap reservoir → hand-pump inlet check → pump/outlet check → single actuator. UP releases pressure; springs and air load raise flaps.",
    ],
    [
      "Failure",
      "A valve or seal leak can cause creep; air can make pumping erratic. MAN 106 § 6-6 gives bleeding and indicator rigging. No electric flap actuator is part of this 1968 model.",
    ],
    [
      "Service",
      "Check hydraulic quantity with flaps retracted; use the specified fluid and bleed procedure (MAN 106 § 2-21). Low shared reservoir quantity matters to both brake and flap supply.",
    ],
  ],
  gear: [
    [
      "Retraction",
      "Johnson bar → torque tube/push-pull linkage → three gear assemblies. Wing assist and fuselage bungee springs balance weight; over-center geometry and handle lock secure extension.",
    ],
    [
      "Brakes",
      "Toe-pressure master cylinders → parking valve → separate left/right wheel calipers. Flexible wheel hoses fold with gear; hydraulic fluid never retracts this manual gear.",
    ],
    [
      "Maintenance",
      "Inspect downlock/latch engagement, prescribed over-center preload, trunnion bearings, shock-disc condition, steering/towing damage and wheel bearings (MAN 106 § 5).",
    ],
  ],
  autopilot: [
    [
      "Pneumatics",
      "Pump → regulated suction → pilot relay → tilted rate-gyro spool/sleeve valve → opposite aileron/rudder servo outputs. The other output vents to atmosphere.",
    ],
    [
      "Cut-off",
      "1968 wheel button vents a pneumatic relay. The later electric-solenoid disconnect is not fitted; basic PC has no pitch, altitude hold or magnetic heading lock.",
    ],
    [
      "Fault isolation",
      "Brittain 11968§§ 8–9 separates vacuum source, pilot valve, kinked/leaking lines, servo diaphragms and gyro command. A disabled study PC fault need not imply pump failure.",
    ],
  ],
  vacuum: [
    [
      "Two paths",
      "Central filter supplies inlet air to each gyro. Suction branches draw that air toward regulator/pump; regulator inlet filter is a separate component.",
    ],
    [
      "Warnings",
      "HI/LO switch and warning lamps require bus power; vacuum instrument suction does not.1968 uses separate lamps, unlike later combined flashing/steady annunciation.",
    ],
    [
      "Service",
      "Clogged central filter can make gyros sluggish; inspect plumbing, filters, regulator and pump drive (1968 OM 2-5; MAN 106 § 7; Brittain 11968§ 3).",
    ],
  ],
  electrical: [
    [
      "1968 options",
      "POH 1187 explicitly permits 50A generator OR60A alternator. This study retains the alternator; the installed N6947N charging-source model is unverified.",
    ],
    [
      "Alternator topology",
      "Main output → 1968 right-side-panel breaker → bus. Field breaker → regulator/overvoltage relay → field. Main output does not pass through the field regulator.",
    ],
    [
      "Starter/indications",
      "Separate contactor controls heavy starter current. Battery-current shunt feeds ammeter. Running magnetos, manual gear, hydraulic hand flaps and mechanical tachometer survive a dead bus.",
    ],
  ],
  pitot: [
    [
      "Pressure instruments",
      "Pitot goes to ASI; both tail-cone statics join a manifold feeding ASI reference, altimeter and optional VSI. Drain junctions are distinct from fuel sumps.",
    ],
    [
      "Optional equipment",
      "Heated pitot and alternate static source are explicitly optional in 1968 OM 2-6; their installation on this specific aircraft remains a study assumption.",
    ],
    [
      "Stall warning",
      "Left leading-edge vane/switch closes the electric horn circuit. This is not a suction-operated Cirrus stall warning. Electrical loss hides the warning while pressure instruments remain mechanical.",
    ],
  ],
  environment: [
    [
      "Heat",
      "Ram air flows around the exhaust heat muff, through a firewall shutoff valve and cabin junction box to feet/baggage/defrost outlets. Air and exhaust are separate circuits.",
    ],
    [
      "Fresh air",
      "Right scoop supplies junction/grill; left scoop supplies pilot outlet and two radio-cooling tubes. Retractable roof scoop supplies four ceiling outlets (1968 OM 2-16–17).",
    ],
    [
      "Inspection",
      "Exhaust/heater integrity, control travel, flexible ducts and leaks matter; source fault shows contamination exposure without assigning a fictional CO concentration (MAN 106 §§ 3-22,8-1).",
    ],
  ],
  cabin: [
    [
      "Cabin structure",
      "Forward-opening cabin door, baggage access, adjustable seats/tracks, lap-belt attachments and shock-mounted flight panel (1968 OM 2-5,2-18; IPC 205Figs15–17).",
    ],
    [
      "Installed equipment",
      "Radio models, harness retrofits, full-flow oil filter and extra autopilot functions require aircraft records. Schematic cases/anchors do not establish that installation.",
    ],
    [
      "Loading",
      "Baggage maximum 120 lb remains subject to the aircraft's actual weight/CG envelope; secure passengers, seats and cargo before flight.",
    ],
  ],
  lighting: [
    [
      "Separate circuits",
      "Position, anti-collision and nose landing lights use their switch-breakers; instrument rheostat, headliner lamps and fuel-selector illumination are separate interior loads.",
    ],
    [
      "Configuration",
      "Baseline photographed locations are retained. Lamp shape, radio modifications and optional equipment do not establish an exact as-delivered 1968 installation.",
    ],
  ],
};
export function DepthDetail({ system }: { system: SysId }) {
  useTicker(250);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const faults = FAULTS[system] ?? [],
    facts = FACTS[system] ?? [];
  return (
    <>
      <H3>Component paths &amp; maintenance</H3>
      <Facts rows={facts.map(([a, b]) => [a, b])} />
      {faults.length > 0 && (
        <Ctl>
          {faults.map(([key, label]) => (
            <Check
              key={key}
              id={"m20c-depth-" + key}
              label={label}
              checked={s.faults[key]}
              onChange={(value) =>
                up((d) => {
                  d.faults[key] = value;
                })
              }
            />
          ))}
          {system === "flaps" && (
            <Readouts
              items={[
                ["Held flap position", `${live.flapAng.toFixed(1)}°`],
                [
                  "Hydraulic state",
                  s.flaps.valve === "UP" ? "Releasing" : s.faults.flapLeak ? "Creeping up" : "Held / ready to pump",
                ],
              ]}
            />
          )}
          {system === "autopilot" && (
            <Readouts
              items={[
                [
                  "Pneumatic authority",
                  pcAvailable(s) ? "Available" : s.faults.pcLeak ? "Leak / unavailable" : "Unavailable",
                ],
              ]}
            />
          )}
          {system === "environment" && (
            <Readouts
              items={[
                [
                  "Heater integrity",
                  cabinHeatContaminated(s) ? ["Contamination exposure", "bad"] : "No exposure demonstrated",
                ],
              ]}
            />
          )}
        </Ctl>
      )}
      <Small>
        Failure responses and timing are qualitative study demonstrations. Oil-flow display crossover at 180°F is
        illustrative. Use the serial-specific flight manual, current maintenance instructions and installed-equipment
        records.
      </Small>
      {system === "overview" && (
        <Notes
          items={[
            "Primary 1968 POH 1187 and serial-applicable MAN 106/IPC 205 replace assumptions from later Ranger editions. Sources/applicability are documented in aircraft/m20c/SOURCES.md.",
          ]}
        />
      )}
    </>
  );
}
