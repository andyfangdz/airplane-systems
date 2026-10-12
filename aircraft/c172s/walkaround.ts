import type { FleetWalkData, FleetWalkItem, FleetWalkStation } from "@/lib/fleet-walk";
import { GROUND_Y } from "./geometry";
import type { Sim } from "./model";
const eye = GROUND_Y + 1.65; // approximate standing camera height
const item = (
  id: string,
  text: string,
  standard: string,
  parts: string[],
  system: FleetWalkItem<Sim>["system"],
  ref: string,
  extra: Partial<FleetWalkItem<Sim>> = {},
): FleetWalkItem<Sim> => ({ id, text, standard, parts, system, ref, ...extra });
const physical = "Condition, security, inflation and wear require inspection of the actual aircraft.";
const sample =
  "Use a sampler at every drain location before each flight and after refuelling; check for water, sediment and the correct fuel grade. If contamination persists after repeated sampling, do not fly: qualified maintenance must drain and purge the system. Sampling is a physical action, not simulated here.";
const propWarning =
  "Keep everyone clear of the propeller arc. Treat the propeller as live when the master or external power is on, and whenever turning it by hand: an ignition fault can start the engine.";

export const WALK: FleetWalkStation<Sim>[] = [
  {
    n: 1,
    title: "Cabin",
    cam: { p: [0.6, eye, -1.6], t: [2, 0.1, 0] },
    map: [1.5, -1.4],
    warning: propWarning,
    items: [
      item(
        "1-1",
        "Pitot cover and opening",
        "REMOVE COVER; CHECK CLEAR",
        ["Heated pitot head", "Pitot cover"],
        "pitot",
        "POH 4-5",
        { target: "Heated pitot head", side: "L" },
      ),
      item("1-2", "Operating handbook", "AVAILABLE TO PILOT", ["Operating handbook"], "cabin", "POH 4-5", {}),
      item(
        "1-3",
        "G1000 cockpit reference guide",
        "AVAILABLE TO PILOT",
        ["G1000 reference guide"],
        "avionics",
        "POH 4-5",
        {},
      ),
      item("1-4", "Weight and balance", "VERIFY", ["Weight and balance record"], "cabin", "POH 4-5", {}),
      item("1-5", "Parking brake", "SET", ["Parking brake handle"], "gear", "POH 4-5", {
        sim: (s) => {
          s.gear.park = true;
        },
      }),
      item("1-6", "Control wheel lock", "REMOVE", ["Control lock"], "controls", "POH 4-5", {}),
      item("1-7", "Magnetos", "OFF", ["MAGNETOS switch"], "engine", "POH 4-5", {
        sim: (s) => {
          s.eng.mags = "OFF";
        },
      }),
      item("1-8", "Avionics buses 1 and 2", "OFF", ["AVIONICS switch (BUS 1 | BUS 2)"], "electrical", "POH 4-5", {
        sim: (s) => {
          s.elec.avn1 = s.elec.avn2 = false;
        },
      }),
      item("1-9", "Master ALT and BAT", "ON", ["MASTER switch (ALT | BAT)"], "electrical", "POH 4-5", {
        sim: (s) => {
          s.elec.alt = s.elec.bat = true;
        },
      }),
      item("1-10", "Primary flight display", "POWERED", ["PFD — GDU 1040"], "avionics", "POH 4-5", {}),
      item("1-11", "Left and right fuel indications", "CHECK", ["PFD — GDU 1040"], "fuel", "POH 4-5", {}),
      item("1-12", "LOW FUEL L / LOW FUEL R", "ABSENT", ["PFD — GDU 1040"], "fuel", "POH 4-5", {
        note: "Compare the actual quantity with planned requirements. Preserved model quantities may cause a legitimate low-fuel indication.",
      }),
      item("1-13", "OIL PRESSURE annunciation", "PRESENT BEFORE START", ["PFD — GDU 1040"], "engine", "POH 4-5", {}),
      item("1-14", "LOW VACUUM annunciation", "PRESENT BEFORE START", ["PFD — GDU 1040"], "vacuum", "POH 4-5", {}),
      item("1-15", "Avionics bus 1", "ON", ["AVIONICS switch (BUS 1 | BUS 2)"], "electrical", "POH 4-5", {
        sim: (s) => {
          s.elec.avn1 = true;
        },
      }),
      item(
        "1-16",
        "Forward avionics fan",
        "LISTEN FOR OPERATION",
        ["Forward avionics cooling fan"],
        "avionics",
        "POH 4-5",
        { note: "The model is silent; verify the actual fan can be heard." },
      ),
      item("1-17", "Avionics bus 1", "OFF", ["AVIONICS switch (BUS 1 | BUS 2)"], "electrical", "POH 4-6", {
        sim: (s) => {
          s.elec.avn1 = false;
        },
      }),
      item("1-18", "Avionics bus 2", "ON", ["AVIONICS switch (BUS 1 | BUS 2)"], "electrical", "POH 4-6", {
        sim: (s) => {
          s.elec.avn2 = true;
        },
      }),
      item("1-19", "Aft avionics fan", "LISTEN FOR OPERATION", ["Aft avionics cooling fan"], "avionics", "POH 4-6", {
        note: "Fan sound is a physical check.",
      }),
      item("1-20", "Avionics bus 2", "OFF", ["AVIONICS switch (BUS 1 | BUS 2)"], "electrical", "POH 4-6", {
        sim: (s) => {
          s.elec.avn2 = false;
        },
      }),
      item(
        "1-21",
        "Pitot heat",
        "ON; WARM WITHIN 30 SECONDS",
        ["Switch panel", "Heated pitot head"],
        "pitot",
        "POH 4-6",
        {
          target: "Heated pitot head",
          side: "L",
          sim: (s) => {
            s.pitot.heat = true;
          },
          note: "Check carefully: the probe becomes hot.",
        },
      ),
      item("1-22", "Pitot heat", "OFF", ["Switch panel"], "pitot", "POH 4-6", {
        sim: (s) => {
          s.pitot.heat = false;
        },
      }),
      item("1-23", "LOW VOLTS annunciation", "PRESENT BEFORE START", ["PFD — GDU 1040"], "electrical", "POH 4-6", {}),
      item("1-24", "Master ALT and BAT", "OFF", ["MASTER switch (ALT | BAT)"], "electrical", "POH 4-6", {
        sim: (s) => {
          s.elec.alt = s.elec.bat = false;
        },
      }),
      item("1-25", "Elevator trim", "TAKEOFF POSITION", ["Elevator trim wheel"], "controls", "POH 4-6", {
        note: "Check the actual takeoff markings. No numerical trim-wheel position is prescribed by this inspection.",
      }),
      item("1-26", "Fuel selector", "BOTH", ["Fuel selector valve"], "fuel", "POH 4-6", {
        sim: (s) => {
          s.fuel.sel = "BOTH";
        },
      }),
      item("1-27", "Alternate static air", "NORMAL / OFF", ["ALT STATIC AIR valve"], "pitot", "POH 4-6", {
        sim: (s) => {
          s.pitot.altStatic = false;
        },
        note: "Push fully in for normal static air on this C172S (POH 4-6).",
      }),
      item("1-28", "Fire extinguisher", "GAUGE IN GREEN ARC", ["Fire extinguisher"], "cabin", "POH 4-6", {
        note: "Charge and availability must be verified on the actual bottle.",
      }),
    ],
  },
  {
    n: 2,
    title: "Empennage",
    cam: { p: [-5.7, eye, -2], t: [-3.6, 0.3, 0] },
    map: [-4.8, 0],
    items: [
      item("2-1", "Baggage door", "CLOSED, SECURE; LOCK WITH KEY", ["Baggage door"], "cabin", "POH 4-6"),
      item("2-2", "Rudder gust lock, if fitted", "REMOVE", ["Rudder gust lock"], "controls", "POH 4-6"),
      item("2-3", "Tail tiedown", "DISCONNECT", ["Tail tiedown ring", "Tiedown ropes"], "airframe", "POH 4-6"),
      item(
        "2-4",
        "Tail control surfaces",
        "FREE MOVEMENT; SECURE",
        ["Elevator (left half)", "Elevator (right half)", "Rudder"],
        "controls",
        "POH 4-6",
      ),
      item("2-5", "Elevator trim tab", "SECURE", ["Elevator trim tab"], "controls", "POH 4-6"),
      item(
        "2-6",
        "Tail antennas",
        "CONDITION AND ATTACHMENT",
        ["VOR/GS navigation antenna", "ELT antenna"],
        "avionics",
        "POH 4-6",
      ),
    ],
  },
  {
    n: 3,
    title: "Right wing trailing edge",
    side: "R",
    cam: { p: [-0.8, eye, 3.8], t: [1.1, 0.8, 3] },
    map: [-0.8, 3.8],
    items: [
      item("3-1", "Right flap", "CONDITION AND SECURITY", ["Right flap"], "flaps", "POH 4-6"),
      item("3-2", "Right aileron", "FREE MOVEMENT; SECURE", ["Right aileron"], "controls", "POH 4-6"),
    ],
  },
  {
    n: 4,
    title: "Right wing",
    side: "R",
    cam: { p: [3.2, eye, 3.5], t: [1.7, 0.8, 3] },
    map: [2.9, 3.8],
    items: [
      item("4-1", "Wing tiedown", "DISCONNECT", ["Wing tiedown ring", "Tiedown ropes"], "airframe", "POH 4-7", {}),
      item("4-2", "Right main tire", "CONDITION AND INFLATION", ["Main wheel and tire"], "gear", "POH 4-7", {
        note: physical,
      }),
      item(
        "4-3",
        "Right tank sump drains",
        "AT LEAST ONE CUPFUL AT EVERY SUMP",
        ["Fuel tank sump drain", "Fuel sample"],
        "fuel",
        "POH 4-7",
        { crouch: true, note: sample },
      ),
      item("4-4", "Right tank fuel quantity", "VISUAL CHECK", ["Fuel filler cap"], "fuel", "POH 4-7", {}),
      item("4-5", "Fuel cap and cap vent", "CAP SECURE; VENT CLEAR", ["Fuel filler cap"], "fuel", "POH 4-7", {}),
    ],
  },
  {
    n: 5,
    title: "Nose",
    cam: { p: [5.6, eye, -1.8], t: [3.2, -0.15, 0] },
    map: [5.2, 0],
    warning: propWarning,
    items: [
      item(
        "5-1",
        "Fuel strainer and lower-system drains",
        "AT LEAST ONE CUPFUL; CHECK ALL DRAINS",
        ["Fuel strainer quick drain", "Fuel selector drain", "Fuel reservoir drain", "Fuel sample"],
        "fuel",
        "POH 4-8",
        { side: "any", crouch: true, target: "Fuel strainer quick drain", note: sample },
      ),
      item(
        "5-2",
        "Engine oil and filler cap",
        "MINIMUM 5 QT; 8 QT FOR EXTENDED FLIGHT; CAP SECURE",
        ["Oil dipstick / filler"],
        "engine",
        "POH 4-8",
        { target: "Oil dipstick / filler", side: "R" },
      ),
      item("5-3", "Engine cooling inlets", "CLEAR", ["Cooling air inlet"], "engine", "POH 4-9", {}),
      item(
        "5-4",
        "Propeller and spinner",
        "NO DAMAGE; SECURE",
        ["Propeller blade", "Spinner"],
        "propeller",
        "POH 4-9",
        { target: "Spinner", fitParts: true, note: "Physical damage and attachment security are not simulated." },
      ),
      item("5-5", "Induction filter", "NO RESTRICTION", ["Induction air filter"], "engine", "POH 4-9", {}),
      item(
        "5-6",
        "Nose strut and tire",
        "STRUT INFLATION; TIRE CONDITION",
        ["Nose gear shock strut (oleo)", "Nose wheel and tire"],
        "gear",
        "POH 4-9",
        { note: physical },
      ),
      item("5-7", "Left static source", "CLEAR", ["Static port"], "pitot", "POH 4-9", { side: "L" }),
    ],
  },
  {
    n: 6,
    title: "Left wing leading edge",
    side: "L",
    cam: { p: [3.5, eye, -3.4], t: [1.8, 0.8, -3] },
    map: [3.1, -3.8],
    items: [
      item("6-1", "Left tank vent", "CLEAR", ["Overboard fuel vent (check valve)"], "fuel", "POH 4-9", {}),
      item("6-2", "Stall warning inlet", "CLEAR; SUCTION TEST", ["Stall warning inlet"], "pitot", "POH 4-9", {
        note: "With a clean cloth over the inlet, apply suction and listen for the pneumatic horn. This test does not need electrical power and is not performed by the scene.",
      }),
      item(
        "6-3",
        "Landing and taxi lights",
        "LENSES CLEAN; GOOD CONDITION",
        ["Landing light", "Taxi light"],
        "lighting",
        "POH 4-9",
        {},
      ),
    ],
  },
  {
    n: 7,
    title: "Left wing",
    side: "L",
    cam: { p: [2.9, eye, -3.6], t: [1.6, 0.8, -3] },
    map: [1.9, -5.8],
    items: [
      item("7-1", "Wing tiedown", "DISCONNECT", ["Wing tiedown ring", "Tiedown ropes"], "airframe", "POH 4-10", {}),
      item("7-2", "Left fuel quantity", "VISUAL CHECK", ["Fuel filler cap"], "fuel", "POH 4-10", {}),
      item("7-3", "Fuel cap and cap vent", "CAP SECURE; VENT CLEAR", ["Fuel filler cap"], "fuel", "POH 4-10", {}),
      item(
        "7-4",
        "Left tank sump drains",
        "AT LEAST ONE CUPFUL AT EVERY SUMP",
        ["Fuel tank sump drain", "Fuel sample"],
        "fuel",
        "POH 4-10",
        { crouch: true, note: sample },
      ),
      item("7-5", "Left main tire", "CONDITION AND INFLATION", ["Main wheel and tire"], "gear", "POH 4-10", {
        note: physical,
      }),
    ],
  },
  {
    n: 8,
    title: "Left wing trailing edge",
    side: "L",
    cam: { p: [-0.8, eye, -3.8], t: [1.1, 0.8, -3] },
    map: [-0.8, -3.8],
    items: [
      item("8-1", "Left aileron", "FREE MOVEMENT; SECURE", ["Left aileron"], "controls", "POH 4-10"),
      item("8-2", "Left flap", "CONDITION AND SECURITY", ["Left flap"], "flaps", "POH 4-10"),
    ],
  },
];
export const WALK_DATA: FleetWalkData<Sim> = {
  id: "c172s",
  short: "C172S",
  source: "C172S information manual 172SIMBUS-00 · 4-4–4-10 · Figure 4-1",
  sourceUrl: "https://aerocadet.com/cbts/pdf/172S-POH.pdf",
  applicability:
    "NAV III IO-360-L2A / GFC 700 with vacuum standby instruments. Inspection order comes from the original 20 December 2007 information manual, a duplicate of POH 172SPHBUS-00 at issue; it is not a current aircraft-specific POH.",
  general:
    "Park in the normal ground attitude so the drain points can be sampled accurately. Complete weight, balance and flight planning before flight.",
  throughout: [
    "Inspect overall condition and attachment security at every station.",
    "Remove all ice, snow and frost, including accumulations inside controls.",
    "Use refuelling steps and assist handles for upper-wing access.",
    "For night flight, check every light and carry a flashlight.",
    "Collect sampled fuel safely; physical sampling, inflation and touch checks are not simulated.",
  ],
  next: "The handbook continues with Before Starting Engine on 4-11. The engine remains stopped throughout this study walk.",
  stations: WALK,
  missing: {
    "Pitot cover": "Removal is a physical action.",
    "Operating handbook": "Document availability is outside the scene.",
    "G1000 reference guide": "Document availability is outside the scene.",
    "Weight and balance record": "Loading calculations are outside the scene.",
    "Rudder gust lock": "Installation and removal are not simulated.",
    "Tiedown ropes": "Disconnect the actual ropes.",
    "Fuel sample": "Water, contamination and fuel grade are physical checks.",
  },
};
