/** 1968 Ranger M20C POH 1187: Figure 3-1 and inspection on scan pages 34–36, not the 1974 manual. */
import type { FleetWalkData, FleetWalkItem, FleetWalkStation } from "@/lib/fleet-walk";
import { GROUND_Y } from "./geometry";
import type { Sim } from "./model";
const eye = GROUND_Y + 1.65;
type Row = [string, string, string[], FleetWalkItem<Sim>["system"], Partial<FleetWalkItem<Sim>>?];
const station = (
  n: number,
  title: string,
  side: "L" | "R" | undefined,
  x: number,
  z: number,
  ref: string,
  rows: Row[],
  extra: Partial<FleetWalkStation<Sim>> = {},
): FleetWalkStation<Sim> => ({
  n,
  title,
  side,
  cam: { p: [x, eye, z], t: [x > 3 ? 2.5 : x < -3 ? -3 : 0.1, 0, z * 0.5] },
  map: [x, z],
  items: rows.map(([text, standard, parts, system, extra], i) => ({
    id: `${n}-${i + 1}`,
    text,
    standard,
    parts,
    system,
    ref,
    ...extra,
  })),
  ...extra,
});
const inspect =
  "Check the actual skin, hinges and attachments for damage, loose rivets, dents and security. Physical defects are not simulated.";
const sample =
  "Sample the actual drain and check for water and sediment. Drain samples and dye stains cannot be assessed from the scene.";
export const WALK: FleetWalkStation<Sim>[] = [
  station(1, "Cabin and selector drain", undefined, 0.4, -1.4, "1968 OM 3-3 (scan 34)", [
    [
      "Master and ignition",
      "OFF",
      ["Master switch", "Magneto / starter switch"],
      "electrical",
      {
        sim: (s) => {
          s.elec.master = false;
          s.eng.key = "OFF";
        },
      },
    ],
    [
      "Selector drain — RIGHT tank",
      "SELECT RIGHT; HOLD RING FOR 5 SECONDS",
      ["Fuel selector valve", "Selector sump drain ring", "Fuel sample"],
      "fuel",
      {
        target: "Fuel selector valve",
        sim: (s) => {
          s.fuel.sel = "R";
        },
        note: "The ring is under the left forward seat area. Pulling it and observing fuel discharge are physical checks.",
      },
    ],
    [
      "Selector drain — LEFT tank",
      "SELECT LEFT; REPEAT 5-SECOND DRAIN",
      ["Fuel selector valve", "Selector sump drain ring", "Fuel sample"],
      "fuel",
      {
        target: "Fuel selector valve",
        sim: (s) => {
          s.fuel.sel = "L";
        },
        note: sample,
      },
    ],
  ]),
  station(2, "Right tailcone", "R", -2.2, 1.8, "1968 OM 3-3 (scan 34)", [
    ["Right instrument static port", "CLEAR", ["Static port"], "pitot"],
    ["Tail tiedown", "REMOVE", ["Tail skid & tie-down ring", "Tiedown ropes"], "airframe"],
  ]),
  station(3, "Empennage", undefined, -4.7, 0, "1968 OM 3-3 (scan 34)", [
    [
      "Empennage",
      "INSPECT",
      ["Horizontal stabilizer", "Vertical fin", "Elevator", "Rudder"],
      "controls",
      { note: inspect },
    ],
    [
      "Tail frost, snow and ice",
      "REMOVE ALL",
      ["Horizontal stabilizer", "Vertical fin", "Elevator", "Rudder", "Ice and snow"],
      "airframe",
    ],
  ]),
  station(4, "Left tailcone", "L", -2.2, -1.8, "1968 OM 3-3 (scan 34)", [
    ["Tailcone access door", "SECURE", ["Tailcone access door"], "airframe"],
    ["Left instrument static port", "CLEAR", ["Static port"], "pitot"],
  ]),
  station(5, "Left wing trailing edge and tip", "L", -0.8, -4.5, "1968 OM 3-4 (scan 35)", [
    ["Wing skins", "INSPECT", ["Left wing", "Wing trailing edge"], "airframe", { note: inspect }],
    ["Left flap and attachments", "CHECK", ["Left flap", "Flap attachment hardware"], "flaps"],
    ["Left aileron and attachments", "CHECK", ["Left aileron", "Aileron attachment hardware"], "controls"],
    [
      "Left wing tip and navigation light",
      "CHECK",
      ["Wing tip", "Left navigation light (red)"],
      "lighting",
      { target: "Wing tip" },
    ],
    ["Wing frost, snow and ice", "REMOVE ALL", ["Left wing", "Ice and snow"], "airframe"],
  ]),
  station(6, "Left leading edge, fuel and main gear", "L", 2.6, -3.5, "1968 OM 3-4 (scan 35)", [
    ["Left wing leading edge", "INSPECT", ["Wing leading edge"], "airframe", { target: "Wing leading edge" }],
    [
      "Pitot tube and stall vane",
      "UNOBSTRUCTED",
      ["Pitot tube", "Stall-warning vane (Safe-Flight Model R)"],
      "pitot",
      {
        target: "Pitot tube",
        note: "Check both openings for blockage. The 1968 exterior checklist does not prescribe a pitot-heat test here.",
      },
    ],
    ["Left fuel quantity and cap", "CHECK QUANTITY; CAP SECURE", ["Left fuel filler cap"], "fuel"],
    ["Left chock and tiedown", "REMOVE", ["Hoist point / tie-down", "Chocks", "Tiedown ropes"], "gear"],
    ["Left main gear shock discs and tire", "CHECK", ["Left main wheel", "Rubber shock discs"], "gear"],
    ["Left tank sump", "SAMPLE", ["Left tank sump drain", "Fuel sample"], "fuel", { crouch: true, note: sample }],
    ["Left tank vent", "CLEAR", ["Fuel vent inlet"], "fuel", { crouch: true }],
    [
      "Selector drain valve",
      "CLOSED",
      ["Selector sump drain outlet", "Drain-valve closure"],
      "fuel",
      { side: "any", crouch: true },
    ],
    ["Windshield", "CLEAN", ["Windshield cleanliness"], "cabin"],
    [
      "Left cowl fasteners",
      "SECURE",
      ["Cowling inspection region", "Cowl fastener security"],
      "airframe",
      { target: "Cowling inspection region" },
    ],
  ]),
  station(
    7,
    "Nose, propeller and nose gear",
    undefined,
    4.9,
    0,
    "1968 OM 3-4 (scan 35)",
    [
      ["Propeller", "NO NICKS OR CRACKS", ["Propeller blade"], "propeller", { fitParts: true }],
      [
        "Forward engine components",
        "CHECK STARTER, ALTERNATOR BELT AND FITTINGS",
        ["Starter", "Alternator belt"],
        "engine",
        {
          target: "Starter",
          note: "Inspect the actual accessory attachments and drive belt; the scene is an approximate installation.",
        },
      ],
      ["Landing light", "CHECK", ["Landing light"], "lighting"],
      [
        "Nose tire and gear",
        "CHECK; NO TOWING DAMAGE",
        ["Nose wheel", "Nose gear strut"],
        "gear",
        { target: "Nose wheel" },
      ],
      ["Nose shock discs", "CHECK", ["Nose gear shock discs"], "gear"],
    ],
    {
      warning:
        "Keep everyone clear of the propeller arc. Verify ignition OFF before physical inspection; a defective ignition circuit can still allow an unexpected start.",
    },
  ),
  station(8, "Right cowl, fuel and main gear", "R", 2.6, 3.5, "1968 OM 3-4–3-5 (scan 35–36)", [
    [
      "Right cowl fasteners",
      "SECURE",
      ["Cowling inspection region", "Cowl fastener security"],
      "airframe",
      { target: "Cowling inspection region" },
    ],
    [
      "Engine oil",
      "CHECK; FULL FOR EXTENDED FLIGHT",
      ["Oil filler cap / dipstick"],
      "engine",
      {
        target: "Oil filler cap / dipstick",
        note: "Verify quantity on the actual dipstick; use the aircraft manual for the installed engine.",
      },
    ],
    ["Windshield", "CLEAN", ["Windshield cleanliness"], "cabin"],
    ["Right tank sump", "SAMPLE", ["Right tank sump drain", "Fuel sample"], "fuel", { crouch: true, note: sample }],
    ["Right tank vent", "CLEAR", ["Fuel vent inlet"], "fuel", { crouch: true }],
    ["Right chock and tiedown", "REMOVE", ["Hoist point / tie-down", "Chocks", "Tiedown ropes"], "gear"],
    ["Right main gear shock discs and tire", "CHECK", ["Right main wheel", "Rubber shock discs"], "gear"],
    ["Right fuel quantity and cap", "CHECK QUANTITY; CAP SECURE", ["Right fuel filler cap"], "fuel"],
  ]),
  station(9, "Right leading edge, tip and trailing edge", "R", -0.8, 4.5, "1968 OM 3-5 (scan 36)", [
    ["Right wing leading edge", "INSPECT", ["Wing leading edge"], "airframe", { target: "Wing leading edge" }],
    ["Wing skins", "INSPECT", ["Right wing", "Wing trailing edge"], "airframe", { note: inspect }],
    [
      "Right wing tip and navigation light",
      "CHECK",
      ["Wing tip", "Right navigation light (green)"],
      "lighting",
      { target: "Wing tip" },
    ],
    ["Right aileron and attachments", "CHECK", ["Right aileron", "Aileron attachment hardware"], "controls"],
    ["Right flap and attachments", "CHECK", ["Right flap", "Flap attachment hardware"], "flaps"],
    ["Wing frost, snow and ice", "REMOVE ALL", ["Right wing", "Ice and snow"], "airframe"],
  ]),
  station(10, "Baggage door", "R", -1.1, 1.8, "1968 OM 3-5 (scan 36)", [
    ["Baggage door", "SECURE", ["Baggage door"], "cabin"],
  ]),
];
export const WALK_DATA: FleetWalkData<Sim> = {
  id: "m20c",
  short: "M20C",
  source: "1968 Ranger OM POH 1187 · 3-3–3-5 (scan 34–36) · Figure 3-1",
  sourceUrl: "https://www.manualslib.com/manual/1369120/Mooney-Ranger-M20c-1968.html?page=34#manual",
  applicability:
    "1968 Ranger M20C, s/n 680194, manual Johnson-bar gear, hydraulic hand-pump flaps, whole-tail trim and Brittain PC. Exterior inspection comes from the actual 1968 manual; the 1974 Ranger manual is not substituted.",
  general:
    "Check weight and balance and inspect all exterior surfaces before flight. Pay particular attention to loose rivets, dents, oil runs and fuel-dye stains (1968 OM scan 33).",
  throughout: [
    "Remove all frost, snow and ice from wing, tail and controls.",
    "Check beneath the airplane for evidence of oil and fuel leaks.",
    "Inspect physical attachment security, gear rubber discs, tires, and any towing damage.",
    "Drain the selector with each tank selected and sample both tank sumps; the scene cannot establish fuel quality.",
    "The study ramp has gear down and locked; it does not retract the Johnson bar during inspection.",
  ],
  next: "The 1968 OM continues with Before Starting on scan 36–37: gear down and locked and hydraulic flaps checked through all positions, then retracted. Those later checks are separate from the exterior walk.",
  stations: WALK,
  missing: {
    "Fuel sample": "Fuel quality and the physical drain action are outside the model.",
    "Tiedown ropes": "Removal is a physical action.",
    "Ice and snow": "Absence must be established on the aircraft.",
    "Tailcone access door": "Door and latch detail is not separately simulated.",
    "Flap attachment hardware": "Not every pin and bolt is shown.",
    "Aileron attachment hardware": "Not every pin and bolt is shown.",
    Chocks: "Removal is a physical action.",
    "Drain-valve closure": "Confirm actual closure and absence of leakage.",
    "Windshield cleanliness": "Contamination and cleaning are not simulated.",
    "Cowl fastener security": "Attachment security requires physical inspection.",
    "Alternator belt": "Actual belt condition and tension must be inspected.",
  },
};
