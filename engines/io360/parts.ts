import type { EngineSpec } from "../types";

type Notes = NonNullable<EngineSpec["parts"]>;

/** The inspector uses the selected installation's catalog for shared schematic shapes. */
function parts(cessna: boolean): Notes {
  const catalog = cessna ? "PC-IO-360-L2A" : "PC-(L)IO-360-M1A";
  const ref = cessna ? "C172S POH §7" : "DA40 AFM §7";
  const note = (text: string) => ({ note: text });
  const rocker = note(
    `Six screws fasten the pressed cover to its gasket. Both valve rockers pivot on a common shaft inside the head (${catalog}, ch. 72-30).`,
  );
  const plug = note(
    `Each cylinder has two plugs. The left magneto feeds the upper-left and lower-right plugs. The right magneto feeds the other four (${ref}).`,
  );
  return {
    "*": note(
      `Illustrative detail of the ${cessna ? "IO-360-L2A" : "IO-360-M1A"} assembly. See Lycoming ${catalog} for the illustrated breakdown.`,
    ),
    Crankshaft: note(
      `Four throws convert piston motion into rotation of the propeller flange. The gear at the rear drives the accessories (${catalog}, ch. 72-20).`,
    ),
    "Crankshaft gear": note(
      "The rear gear transmits crankshaft rotation through the idlers to the camshaft and magnetos.",
    ),
    "Propeller flange": note(
      cessna
        ? "The two-blade, fixed-pitch McCauley mounts on the crankshaft through a 3.5-inch spacer (C172S POH 1-5, 6-23)."
        : "The crankshaft drives the three-blade MT hub. Governor oil reaches the pitch piston through the shaft (DA40 AMM 61-20).",
    ),
    "Long flange bushing (#)": note("Four 75656-S long bushings help locate the propeller on the crankshaft flange."),
    "Short flange bushing (#)": note("One 72155-S short bushing locates the propeller on the flange."),
    "Indexing flange bushing (#)": note("The 75657-S bushing indexes the propeller on the flange."),
    "Sump flange nut (#)": note("Clamps the sump flange against the crankcase."),
    "Accessory housing bolt (#)": note("Secures the accessory housing to the crankcase."),
    "Rocker shaft bushing (#), cylinder #": note(
      "Four 66610 bushings in the head support the LW-13790 shaft shared by both rockers.",
    ),
    "Propeller blade": note(
      cessna
        ? "The two blades of the 76-inch McCauley have fixed pitch. Propeller load and throttle determine RPM (C172S POH 1-5, 7-37)."
        : "The 1.83 m MTV-12-B/183-59b changes blade angle between 11° and 30° at 0.75 radius (AFMS SA06-52 p. 2).",
    ),
    Camshaft: note(
      "The camshaft turns once every two crankshaft revolutions. Its lobes lift the tappets in firing order 1-3-2-4.",
    ),
    "Cylinder # head": note(
      `Cooling air passes between the fins. Each head contains a pair of parallel valves, two spark plugs and an intake-port fuel nozzle (${catalog}, ch. 72-30 and 73-10).`,
    ),
    "Cylinder # barrel": note(
      "The piston rings seal against the steel barrel. Air passing between its fins carries away heat.",
    ),
    "Piston, cylinder #": note(
      "Expanding combustion gases drive the piston toward the crankcase. The wrist pin transfers the load to the connecting rod.",
    ),
    "Rocker cover, cylinder #": note("61247 rocker cover. " + rocker.note),
    "Rocker cover gasket, cylinder #": note("06B26669 silicone gasket. " + rocker.note),
    "Rocker cover screw (#), cylinder #": note("STD-1925 self-locking pan-head screw. " + rocker.note),
    "Rocker shaft, cylinder #": note("LW-13790. This shaft carries the intake and exhaust rockers in the head."),
    "Cylinder base packing, cylinder #": note(
      "The 71481 packing seals the barrel spigot to its opening in the crankcase.",
    ),
    "Inner valve spring, cylinder # intake": note(
      "17D29055. The inner and outer springs hold the valve against its seat.",
    ),
    "Inner valve spring, cylinder # exhaust": note(
      "17D29055. The inner and outer springs hold the valve against its seat.",
    ),
    "Outer valve spring, cylinder # intake": note(
      "17D29060. The outer spring works with the inner spring to close the valve.",
    ),
    "Outer valve spring, cylinder # exhaust": note(
      "17D29060. The outer spring works with the inner spring to close the valve.",
    ),
    "Crankcase, left half": note(
      "The two case halves carry the crankshaft main bearings and support the cylinder bases.",
    ),
    "Crankcase, right half": note("The two case halves enclose the crankshaft, camshaft and oil passages."),
    "Oil sump": note(
      `Oil drains back to the eight-quart wet sump. The installed minimum is ${cessna ? "five quarts (C172S POH 8-14)" : "four quarts (DA40 AFM 2-5)"}.`,
    ),
    "Oil suction screen": note(
      "The screen at the sump outlet catches coarse debris before oil enters the accessory pump.",
    ),
    "Oil filter": note("The spin-on filter removes contaminants before oil reaches the engine galleries."),
    "Oil cooler": note(
      cessna
        ? "The thermostatic bypass routes hot oil through the remote cooler (C172S POH 7-35)."
        : "The cooler attaches to the engine mounting frame. Cold oil bypasses the core (DA40 AMM 79-00).",
    ),
    "Filtered oil line": note("Filtered oil feeds the pressure galleries and bearings before draining to the sump."),
    "Fuel injector": note(
      `The RSA-5AD1 servo meters fuel from the pressure difference across its air and fuel diaphragms. Metered fuel goes to the flow divider (${catalog}, ch. 73-10).`,
    ),
    "Fuel manifold": note(
      "The flow divider distributes metered fuel through four individual tubes to the intake-port nozzles.",
    ),
    "Injector line, cylinder #": note(
      "Carries metered fuel from the flow divider to this cylinder’s injection nozzle.",
    ),
    "Engine-driven fuel pump": note("The accessory drive operates a diaphragm pump that supplies the injection servo."),
    Starter: note("When START is held the pinion engages the starter ring behind the propeller flange."),
    Alternator: note(`A single belt drive takes power from the crankshaft pulley to the alternator (${ref}).`),
    "Exhaust pipe, cylinder #": note(
      "Hot gas leaves the exhaust port and follows this header to the common exhaust assembly.",
    ),
    Tailpipe: note("The single outlet discharges exhaust below the cowling."),
    "Cabin heat muff": note(
      "Fresh air passes around the hot exhaust inside the shroud and flows to the cabin heat valve.",
    ),
    "Exhaust muffler": cessna
      ? note("Four risers feed a transverse muffler below the engine (C172S POH 7-37).")
      : {
          name: "Power Flow collector",
          note: "The four tuned headers feed the shrouded collector and its tailpipe (PFS-15102 installation instructions, pp. 3–8).",
        },
    "Left magneto": cessna
      ? {
          name: "Left impulse-coupled magneto",
          note: "A Slick 4371 impulse coupling retards the starting spark and snaps the rotor through its firing position (L2A IPC Fig. 24).",
        }
      : plug,
    "Left magneto (retard breaker)": note(
      "The Slick 4347 has retard points. SlickSTART boosts ignition energy during cranking (DA40 AMM 74-00).",
    ),
    "Right magneto": cessna
      ? {
          name: "Right impulse-coupled magneto",
          note: "The second Slick 4371 has its own impulse coupling and fires one plug per cylinder (L2A IPC Fig. 24).",
        }
      : note("The Slick 4370 serves the upper-right and lower-left plugs (DA40 AMM 74-00, M1A IPC Fig. 23)."),
    "Ignition harness": plug,
    "Spark plug, cylinder # top": plug,
    "Spark plug, cylinder # bottom": plug,
    "Fuel injection nozzle, cylinder #": note("Each nozzle atomizes metered fuel into its cylinder’s intake port."),
    "Intake valve, cylinder #": note(
      "The rocker opens the intake valve on the intake stroke, admitting the fuel-air charge.",
    ),
    "Exhaust valve, cylinder #": note(
      "The rocker opens the exhaust valve to release burnt gas into the exhaust header.",
    ),
    "Starter ring gear": note("The starter pinion engages ring gear 72566 to turn the crankshaft (IPC ch. 72-20)."),
    "Magneto distributor cap": note("Four high-tension leads leave this cap, one for each cylinder."),
    "Magneto drive gear": note("A crankshaft idler drives this magneto, which turns at crankshaft speed."),
    "Governor drive gear": note(
      "The front drive transmits camshaft rotation to the DA40 propeller governor (M1A IPC ch. 72-10).",
    ),
    "Propeller governor": note(
      "Flyweights and the speeder spring move a pilot valve. Pressure oil coarsens the blades when engine speed rises above the selected RPM (DA40 AMM 61-20).",
    ),
  };
}
export const IO360_PARTS = { c172s: parts(true), da40: parts(false) };
