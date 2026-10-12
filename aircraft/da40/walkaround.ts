/** DA40 avgas AFM 6.01.01-E Rev. 8, 4A.3.1: cabin plus eight exterior stations. */
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
  cam: { p: [x, eye, z], t: [x > 3 ? 2 : x < -3 ? -3 : 0.4, 0, z * 0.5] },
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
  "Inspect physical condition, cracks or delamination, play, attachment and freedom of movement. The scene cannot establish airworthiness.";
const sample =
  "Collect fuel from the actual drain and inspect for water and sediment. The model does not sample or establish fuel quality.";
const leftLight = "Left wing tip: position (red) + strobe";
const rightLight = "Right wing tip: position (green) + strobe";
export const WALK: FleetWalkStation<Sim>[] = [
  station(1, "Cabin", undefined, 1.4, -1.4, "AFM 4A-3–4A-5", [
    ["Weather, navigation, mass and CG", "PLANNING COMPLETE", ["Flight planning"], "cabin"],
    ["Aircraft documents", "COMPLETE AND CURRENT", ["Aircraft documents"], "cabin"],
    [
      "Ignition key",
      "OFF; REMOVE KEY",
      ["Ignition key switch", "Removable ignition key"],
      "engine",
      {
        sim: (s) => {
          s.eng.key = "OFF";
        },
      },
    ],
    [
      "Canopy and rear door",
      "CLEAN; UNDAMAGED; LATCHES WORK",
      ["Front canopy", "Rear passenger door (left)", "Canopy handle (left)", "Rear door safety lever"],
      "cabin",
      { note: inspect },
    ],
    [
      "Electrical equipment",
      "OFF",
      ["AVIONIC MASTER switch", "Master switch ALT / BAT"],
      "electrical",
      {
        sim: (s) => {
          s.elec.bat = s.elec.alt = s.elec.avMaster = s.elec.essBus = s.elec.emerg = false;
          s.fuel.pump = s.pitot.heat = false;
          s.lights.position = s.lights.strobe = s.lights.landing = s.lights.taxi = false;
        },
      },
    ],
    [
      "Circuit breakers",
      "IN; INVESTIGATE ANY PULLED BREAKER",
      ["Circuit-breaker panel"],
      "electrical",
      {
        sim: (s) => {
          s.cb = {};
        },
        note: "This healthy study state resets breakers; an actual pulled breaker requires its cause to be checked before resetting.",
      },
    ],
    [
      "Throttle, RPM and mixture levers",
      "CONDITION; FREE MOVEMENT; FULL TRAVEL",
      ["Throttle quadrant"],
      "engine",
      { note: "Physical full travel and cable condition cannot be proven by the animation." },
    ],
    [
      "Throttle",
      "IDLE",
      ["Throttle quadrant"],
      "engine",
      {
        sim: (s) => {
          s.eng.throttle = 0;
        },
      },
    ],
    [
      "Mixture",
      "LEAN",
      ["Throttle quadrant"],
      "engine",
      {
        sim: (s) => {
          s.eng.mix = 0;
        },
      },
    ],
    [
      "RPM lever",
      "HIGH RPM",
      ["Throttle quadrant"],
      "propeller",
      {
        sim: (s) => {
          s.eng.rpmLever = 1;
        },
      },
    ],
    [
      "BAT master",
      "ON",
      ["Master switch ALT / BAT"],
      "electrical",
      {
        sim: (s) => {
          s.elec.bat = true;
        },
      },
    ],
    [
      "Annunciations",
      "CHECK FUNCTION",
      ["PFD (GDU 1040) bezel"],
      "avionics",
      {
        note: "This XLS uses G1000 annunciations; the basic AFM directs the installation-specific function check (7.11 and applicable avionics supplement).",
      },
    ],
    [
      "Fuel indications",
      "CHECK AGAINST MEASURED QUANTITY",
      ["PFD (GDU 1040) bezel", "Fuel filler neck"],
      "fuel",
      {
        target: "PFD (GDU 1040) bezel",
        ref: "AFM 4A-3–4A-4; G1000 AFMS 190-00492-10 Rev. 8, 4A-1–2",
        sourceUrl: "https://manualzilla.com/doc/7043953",
        note: "On this G1000 installation, 3 US gal between 16 and 19 US gal per tank are ungauged. At an indication of 16 US gal, determine the actual quantity with the measuring device; without that measurement, use 16 US gal for flight planning. The base AFM’s AUX FUEL QTY switch and 2-minute procedure describe an older indication interface, not this G1000 installation. Physical quantity measurement is outside the scene (G1000 AFMS 190-00492-10 Rev. 8, 4A-1–2 and 7-6).",
      },
    ],
    [
      "Position and anti-collision lights",
      "CHECK OPERATION",
      [leftLight, rightLight, "Aft position light (white)"],
      "lighting",
      {
        sim: (s) => {
          s.lights.position = s.lights.strobe = true;
        },
      },
    ],
    [
      "BAT master",
      "OFF",
      ["Master switch ALT / BAT"],
      "electrical",
      {
        sim: (s) => {
          s.elec.bat = false;
        },
      },
    ],
    ["Loose cabin items", "SECURE", ["Loose items"], "cabin"],
    [
      "Controls and trim",
      "FREE; CORRECT RESPONSE",
      ["Control stick", "Elevator trim wheel", "Rudder pedal / toe brake"],
      "controls",
      { note: inspect },
    ],
    ["Baggage", "STOWED AND SECURE", ["Baggage compartment", "Baggage restraints"], "cabin"],
    ["Emergency axe, if fitted under OÄM 40-326", "STOWED AND SECURE", ["Emergency axe"], "cabin"],
  ]),
  station(2, "Left main landing gear", "L", 2.6, -2.2, "AFM 4A-6", [
    ["Main gear strut", "INSPECT", ["Main gear leg (spring steel)"], "gear"],
    ["Strut fairing, if fitted", "INSPECT", ["Main strut fairing"], "gear"],
    ["Wheel fairing", "INSPECT", ["Wheel fairing"], "gear"],
    [
      "Main tire pressure",
      "2.5 BAR / 36 PSI",
      ["Main wheel"],
      "gear",
      { note: "Measure on the actual tire; the model does not measure inflation." },
    ],
    ["Tire wear and tread", "CHECK", ["Main wheel"], "gear"],
    ["Tire, wheel and brake", "INSPECT", ["Main wheel", "Disc brake (Cleveland 30-239)"], "gear"],
    ["Brake-line connection", "NO LEAKS", ["Brake line (L)"], "gear", { crouch: true }],
    ["Tire slip marks", "INSPECT", ["Tire slip marks"], "gear"],
    ["Chocks", "REMOVE", ["Chocks"], "gear"],
  ]),
  station(3, "Left wing", "L", 0.4, -6.8, "AFM 4A-6–4A-7", [
    ["Entire wing surface", "INSPECT", ["Left wing", "Wing tip", "Wing trailing edge"], "airframe", { note: inspect }],
    ["Wing step", "INSPECT", ["Wing step"], "airframe"],
    ["Lower-wing air intake", "INSPECT", ["Fresh-air inlet (NACA)"], "environment", { crouch: true }],
    [
      "Lower-wing openings",
      "CHECK FOR FUEL TRACES",
      ["Tank vent — capillary", "Tank vent — check valve"],
      "fuel",
      { crouch: true, note: "Fuel can spill through the tank vent when full; inspect the actual source of any stain." },
    ],
    [
      "Left tank drain",
      "SAMPLE; NO WATER OR SEDIMENT",
      ["Left tank drain", "Fuel sample"],
      "fuel",
      { crouch: true, note: sample },
    ],
    [
      "Stall warning inlet",
      "SUCTION TEST; VERIFY HORN",
      ["Stall-warning orifice (red ring)"],
      "pitot",
      {
        target: "Stall-warning orifice (red ring)",
        note: "Suction and sound must be checked physically. This is the pneumatic inlet, not a Cessna/Mooney electric vane.",
      },
    ],
    ["Left fuel filler and quantity", "INSPECT; AGREES WITH INDICATOR", ["Fuel filler neck"], "fuel"],
    [
      "Lower-wing tank air outlet",
      "INSPECT",
      ["Tank vent — capillary", "Tank vent — check valve"],
      "fuel",
      { crouch: true },
    ],
    ["Two left stall strips", "INSPECT", ["Stall strips"], "airframe", { target: "Stall strips" }],
    [
      "Pitot-static mast (heated)",
      "CLEAN; ORIFICES CLEAR",
      ["Pitot-static mast (heated)", "Pitot opening", "Static orifice"],
      "pitot",
      { target: "Pitot-static mast (heated)" },
    ],
    ["Landing and taxi lights", "INSPECT", ["Landing light", "Taxi light"], "lighting"],
    ["Left wing tip", "INSPECT", ["Wing tip"], "airframe", { target: "Wing tip" }],
    ["Left position and strobe lights", "INSPECT", [leftLight, "Aft position light (white)"], "lighting"],
    ["Wing mooring", "CHECK; DISCONNECT", ["Tie-down eyelet", "Mooring ropes"], "airframe"],
    ["Left aileron and linkage", "INSPECT", ["Left aileron", "Aileron linkage hardware"], "controls"],
    ["Aileron hinges and safety pin", "INSPECT", ["Aileron hinge", "Safety pins"], "controls"],
    ["Aileron paddle", "NO FOREIGN OBJECTS", ["Left aileron", "Aileron paddle clearance"], "controls"],
    ["Left flap and linkage", "INSPECT", ["Left flap", "Flap linkage hardware"], "flaps"],
    ["Flap hinges and safety pin", "INSPECT", ["Flap hinge bracket", "Safety pins"], "flaps"],
  ]),
  station(4, "Left fuselage", "L", -1.1, -2, "AFM 4A-7", [
    ["Left canopy", "INSPECT", ["Front canopy"], "cabin"],
    ["Rear cabin door and window", "INSPECT", ["Rear passenger door (left)"], "cabin"],
    ["Fuselage skin", "INSPECT", ["Fuselage"], "airframe"],
    [
      "Antennas",
      "INSPECT",
      ["COM 1 antenna", "COM 2 antenna", "NAV (VOR/LOC/GS) antenna", "ELT antenna"],
      "avionics",
      { side: "any" },
    ],
    [
      "Separate autopilot static source, if OÄM 40-267 fitted",
      "NO BLOCKAGE",
      ["Optional autopilot static source"],
      "pitot",
      {
        note: "This conditional basic-AFM item is not evidence that a separate source is installed on the modelled GFC 700 XLS.",
      },
    ],
  ]),
  station(5, "Empennage", undefined, -5.5, -1.2, "AFM 4A-7", [
    [
      "Stabilizers and control surfaces",
      "INSPECT; FREE MOVEMENT",
      ["Horizontal stabilizer", "Vertical stabilizer", "Elevator", "Rudder"],
      "controls",
      { note: inspect },
    ],
    ["Tail hinges", "INSPECT", ["Tail hinge hardware"], "controls"],
    ["Elevator trim tab and locking wire", "INSPECT", ["Elevator trim tab", "Trim locking wire"], "controls"],
    ["Rudder trim tab", "INSPECT", ["Rudder trim tab"], "controls"],
    ["Fin mooring", "CHECK; DISCONNECT", ["Fin mooring", "Mooring ropes"], "airframe"],
    ["Tail skid and lower fin", "INSPECT", ["Lower fin and tail skid"], "airframe"],
    ["Towing assembly, if fitted", "INSPECT", ["Optional tail towing assembly"], "airframe"],
  ]),
  station(6, "Right fuselage", "R", -1.1, 2, "AFM 4A-8", [
    ["Fuselage skin", "INSPECT", ["Fuselage"], "airframe"],
    ["Right window", "INSPECT", ["Front canopy"], "cabin"],
    ["Right canopy", "INSPECT", ["Front canopy"], "cabin"],
    [
      "Separate autopilot static source, if OÄM 40-267 fitted",
      "NO BLOCKAGE",
      ["Optional autopilot static source"],
      "pitot",
    ],
  ]),
  station(7, "Right wing", "R", 0.4, 6.8, "AFM 4A-8", [
    ["Right flap and linkage", "INSPECT", ["Right flap", "Flap linkage hardware"], "flaps"],
    ["Flap hinges and safety pin", "INSPECT", ["Flap hinge bracket", "Safety pins"], "flaps"],
    ["Right aileron and linkage", "INSPECT", ["Right aileron", "Aileron linkage hardware"], "controls"],
    ["Aileron hinges and safety pin", "INSPECT", ["Aileron hinge", "Safety pins"], "controls"],
    ["Aileron paddle", "NO FOREIGN OBJECTS", ["Right aileron", "Aileron paddle clearance"], "controls"],
    ["Right wing tip", "INSPECT", ["Wing tip"], "airframe", { target: "Wing tip" }],
    ["Right position and strobe lights", "INSPECT", [rightLight, "Aft position light (white)"], "lighting"],
    ["Wing mooring", "CHECK; DISCONNECT", ["Tie-down eyelet", "Mooring ropes"], "airframe"],
    [
      "Entire right wing surface",
      "INSPECT",
      ["Right wing", "Wing tip", "Wing trailing edge"],
      "airframe",
      { note: inspect },
    ],
    ["Two right stall strips", "INSPECT", ["Stall strips"], "airframe", { target: "Stall strips" }],
    [
      "Lower-wing tank air outlet",
      "INSPECT",
      ["Tank vent — capillary", "Tank vent — check valve"],
      "fuel",
      { crouch: true },
    ],
    ["Right fuel filler and quantity", "INSPECT; AGREES WITH INDICATOR", ["Fuel filler neck"], "fuel"],
    [
      "Lower-wing openings",
      "CHECK FOR FUEL TRACES",
      ["Tank vent — capillary", "Tank vent — check valve"],
      "fuel",
      { crouch: true },
    ],
    [
      "Right tank drain",
      "SAMPLE; NO WATER OR SEDIMENT",
      ["Right tank drain", "Fuel sample"],
      "fuel",
      { crouch: true, note: sample },
    ],
    ["Wing step", "INSPECT", ["Wing step"], "airframe"],
  ]),
  station(8, "Right main landing gear", "R", 2.6, 2.2, "AFM 4A-9", [
    ["Main gear strut", "INSPECT", ["Main gear leg (spring steel)"], "gear"],
    ["Strut fairing, if fitted", "INSPECT", ["Main strut fairing"], "gear"],
    ["Wheel fairing", "INSPECT", ["Wheel fairing"], "gear"],
    ["Main tire pressure", "2.5 BAR / 36 PSI", ["Main wheel"], "gear"],
    ["Tire wear and tread", "CHECK", ["Main wheel"], "gear"],
    ["Tire, wheel and brake", "INSPECT", ["Main wheel", "Disc brake (Cleveland 30-239)"], "gear"],
    ["Brake-line connection", "NO LEAKS", ["Brake line (R)"], "gear", { crouch: true }],
    ["Tire slip marks", "INSPECT", ["Tire slip marks"], "gear"],
    ["Chocks", "REMOVE", ["Chocks"], "gear"],
  ]),
  station(
    9,
    "Front fuselage and underside",
    undefined,
    5.4,
    0,
    "AFM 4A-9–4A-10",
    [
      [
        "Engine oil",
        "MINIMUM 4 QT VFR / 6 QT IFR",
        ["Oil dipstick / filler"],
        "engine",
        { target: "Oil dipstick / filler" },
      ],
      ["Cowling", "INSPECT", ["Cowling inspection region"], "airframe", { target: "Cowling inspection region" }],
      ["Three air intakes", "CLEAR", ["Left cowl inlet", "Right cowl inlet", "Lower cowl inlet"], "engine"],
      [
        "Propeller",
        "INSPECT; SHAKE ≤3 MM (1/8 IN), ANGULAR PLAY ≤2°",
        ["Propeller blade"],
        "propeller",
        {
          fitParts: true,
          note: "Never move the propeller by hand with ignition ON. Measure play on the actual installation; the scene does not assess it.",
        },
      ],
      ["Spinner and attachment screws", "INSPECT", ["Spinner", "Spinner attachment screws"], "propeller"],
      ["Nose landing gear", "INSPECT", ["Nose gear strut", "Elastomer package"], "gear"],
      ["Nose tire and wheel", "INSPECT", ["Nose wheel"], "gear"],
      ["Nose tire slip marks", "INSPECT", ["Tire slip marks"], "gear"],
      ["Nose strut fairing, if fitted", "INSPECT", ["Nose strut fairing"], "gear"],
      ["Nose tiedown, if fitted", "CHECK; DISCONNECT", ["Optional nose tiedown"], "gear"],
      ["Nose tire wear and tread", "CHECK", ["Nose wheel"], "gear"],
      ["Nose wheel fairing", "INSPECT", ["Nose wheel fairing"], "gear"],
      ["Tow bar", "REMOVE", ["Tow bar"], "gear"],
      ["Nose tire pressure", "2.0 BAR / 29 PSI", ["Nose wheel"], "gear"],
      ["Chocks", "REMOVE", ["Chocks"], "gear"],
      [
        "Exhaust",
        "INSPECT",
        ["Tuned exhaust (Power Flow)"],
        "engine",
        { note: "Hot exhaust can burn; inspect the actual system only when safe." },
      ],
      ["Forward cabin air inlets, if fitted", "CLEAR", ["Forward cabin air inlets"], "environment"],
      ["Fresh-air winter baffle, if fitted", "INSPECT", ["Optional fresh-air winter baffle"], "environment"],
      [
        "Belly antennas, if fitted",
        "INSPECT",
        ["Transponder antenna", "Marker beacon antenna"],
        "avionics",
        { crouch: true, side: "any" },
      ],
      [
        "Gascolator",
        "SAMPLE; NO WATER OR SEDIMENT",
        ["Gascolator drain", "Fuel sample"],
        "fuel",
        { crouch: true, note: sample },
      ],
      ["Venting pipes", "CLEAR", ["Venting pipes"], "fuel", { crouch: true }],
      ["Fuselage underside", "NO EXCESS OIL, FUEL OR FLUID CONTAMINATION", ["Fuselage"], "airframe", { crouch: true }],
    ],
    {
      warning:
        "Do not turn a propeller with ignition ON. Keep clear of the rotation plane; a defective ignition can cause an unexpected start.",
    },
  ),
];
export const WALK_DATA: FleetWalkData<Sim> = {
  id: "da40",
  short: "DA40",
  source: "DA40 AFM 6.01.01-E Rev. 8 · 4A-3–4A-10",
  sourceUrl: "https://www.acbelleile.com/_files/ugd/ec5b88_820a629dca6a472ea7fe29b64398c055.pdf",
  applicability:
    "Avgas XLS IO-360-M1A / G1000 / GFC 700 with long-range tanks. This study follows AFM 4A.3.1, separating the cabin check from its eight exterior stations; conditional equipment checks remain conditional.",
  general:
    "Complete weather, navigation, mass and CG planning. This study explains inspection locations; marks record study progress, not aircraft readiness.",
  throughout: [
    "Look for cracks, delamination, damage, excessive play and insecure load paths or attachments.",
    "Check control surfaces for free movement.",
    "Remove every accumulation of ice and snow; use only approved ground de-icing fluids (AFM 8.6).",
    "Remove gust locks, pitot covers, tow bars and other ground equipment before flight.",
    "Fuel quality, tire pressure, touch, play and audible warning tests must be checked on the aircraft.",
  ],
  next: "AFM 4A.3.2 continues with Before Starting Engine on 4A-11. The study walk never starts the engine.",
  stations: WALK,
  missing: {
    "Flight planning": "Weather, navigation and loading calculations are outside the model.",
    "Aircraft documents": "Paperwork is outside the model.",
    "Removable ignition key": "The switch is shown; key removal is a physical action.",
    "Loose items": "Security must be checked in the actual cabin.",
    "Baggage restraints": "Attachment and loading are not simulated.",
    "Main strut fairing": "Optional installation is not represented separately.",
    "Tire slip marks": "Alignment must be inspected on the actual tire.",
    Chocks: "Removal is a physical action.",
    "Fuel sample": "Water and sediment are not simulated.",
    "Mooring ropes": "Disconnect the actual ropes.",
    "Aileron linkage hardware": "All pins, bolts and attachment details are not shown.",
    "Flap linkage hardware": "All linkage attachment details are not shown.",
    "Safety pins": "Presence and security require physical inspection.",
    "Aileron paddle clearance": "Foreign objects and clearance cannot be established here.",
    "Optional autopilot static source": "Conditional OÄM 40-267 installation is not established for this XLS.",
    "Tail hinge hardware": "Individual attachment hardware is not all shown.",
    "Trim locking wire": "Security requires physical inspection.",
    "Fin mooring": "Mooring attachment/removal is a physical check.",
    "Optional tail towing assembly": "Conditional installation is not represented.",
    "Spinner attachment screws": "Security is not simulated.",
    "Nose strut fairing": "Optional installation is not represented separately.",
    "Optional nose tiedown": "Conditional installation and removal are physical checks.",
    "Tow bar": "Removal is a physical action.",
    "Forward cabin air inlets": "Conditional installation must be checked on the actual aircraft.",
    "Optional fresh-air winter baffle": "Conditional installation is not represented.",
    "Venting pipes": "The AFM does not identify every underside vent pipe in this scene.",
  },
};
