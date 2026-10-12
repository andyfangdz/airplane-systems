/** IO-360-L2A hardware: Lycoming PC-IO-360-L2A June 2025 Figs 4,10–12,15,17,20–25;
 * Operator60297-12 §§1/3/7; POH172SPHBUS-04 §7-29–37. Sizes and installation offsets schematic. */
import { mergeGeos } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import { box, cyl, tubeGeo } from "../geometry";
import { DEPTH as D } from "../depth-anchors";
import { CYLS } from "./engine";
import { P3, part } from "./catalogue";
import { CAT } from "./catalogue";
const depthStart = CAT.parts.length;
const base = " Source: IO-360-L2A IPC June 2025; dimensions, offsets and internal paths schematic.";
for (const [name, at, note] of [
  [
    "Oil suction screen",
    D.oilScreen,
    "Screen at the sump pickup protects the accessory-housing oil pump from large debris (Lycoming Fig 15 pp. 30–31; POH 7-35).",
  ],
  [
    "Accessory-housing oil pump",
    D.oilPump,
    "Pressure pump inside the accessory housing: drives the wet-sump lubrication circuit, independently of electrical buses (Lycoming Fig 17 pp. 34–35; Operator1-3).",
  ],
  [
    "Oil filter bypass valve",
    D.oilAdapter,
    "Filter-adapter bypass maintains oil supply if the full-flow filter is plugged or oil extremely cold; bypassed oil is not filtered (POH 7-35; Lycoming Fig 20 pp. 40–41).",
  ],
  [
    "Oil pressure relief valve",
    D.oilRelief,
    "Spring-loaded valve at the rear of the right oil gallery regulates oil pressure (POH 7-35; Lycoming Fig 4 pp. 8–9). This is separate from the filter bypass and thermostatic cooler control.",
  ],
  [
    "Thermostatic oil cooler bypass",
    D.oilThermostat,
    "Oil-filter assembly includes the cooler bypass valve; cold oil and warmed oil use different cooler routing (Lycoming Fig 20 pp. 40–41; POH 7-35). Temperature threshold and actual passage dimensions are not simulated.",
  ],
  [
    "Crankcase breather fitting",
    D.breather,
    "Accessory-housing breather fitting vents crankcase gases through an overboard hose (Lycoming Fig 20 pp. 40–41; Cessna 172RPC24 79-20-00). Does not supply cabin air.",
  ],
] as [string, Vec3, string][])
  part(() => cyl(0.019, 0.036, "x", 16), ["engine"], { pos: at, color: "#B88547", name, note: note + base, pin: true });
for (const [name, at] of [
  ["Left oil gallery", D.oilGalleryL],
  ["Right oil gallery", D.oilGalleryR],
] as const)
  part(() => cyl(0.013, 0.23, "x"), ["engine"], {
    pos: at,
    name,
    color: "#BC794C",
    pin: true,
    note: "Oil galleries supply pressure lubrication to engine bearings and valve gear, followed by gravity return to the sump (POH 7-35; Lycoming Operator1-3). Functional internal passage schematic, not a separate external hose.",
  });
part(() => cyl(0.15, 0.018, "x", 48), ["engine"], {
  pos: P3(-33.4, 0, 50.375),
  color: "#9AA5AD",
  name: "Starter ring gear",
  pin: true,
  note: "Flywheel/starter ring gear at the forward crankshaft; starter pinion cranks the engine, while the flywheel pulley drives the alternator belt (Lycoming IPC Fig 25 pp. 50–51; 172RPC24 80-10-00). Ring diameter and tooth detail schematic; fixed-pitch propeller has no hydraulic governor.",
});
for (const c of CYLS) {
  const z = c.s * 11;
  for (const [name, dx] of [
    ["Intake valve spring/rocker", 0.6],
    ["Exhaust valve spring/rocker", -1.4],
  ] as const)
    part(() => mergeGeos([cyl(0.015, 0.055, "y", 14), box(0.045, 0.012, 0.014).translate(0, 0.029, 0)]), ["engine"], {
      pos: P3(c.fs + dx, z, 52),
      color: "#939EA6",
      name,
      pin: c.n === 1,
      note: `Cylinder ${c.n}: rocker operates the valve from a cam-driven hydraulic tappet and pushrod. Intake admits the mixed charge; exhaust releases burned gas (Lycoming IPC Fig 10 pp. 20–21). Valve gear is schematic inside the cylinder head.`,
    });
  for (const offset of [-1.4, 0.6])
    part(() => tubeGeo([P3(c.fs + offset, c.s * 5, 48), P3(c.fs + offset, z, 51)], 0.006, 0), ["engine"], {
      color: "#8C99A4",
      name: "Pushrod shroud",
      pin: c.n === 1 && offset < 0,
      note: `Cylinder ${c.n} pushrod enclosure between crankcase and head, protecting the cam-to-rocker linkage (Lycoming Fig 11 pp. 22–23). Placement and radius approximate.`,
    });
  part(() => tubeGeo([P3(c.fs, c.s * 11, 49), P3(c.fs + 1, c.s * 7, 42)], 0.005, 0), ["engine"], {
    color: "#BCA285",
    name: "Cylinder-head oil drain tube",
    pin: c.n === 1,
    note: `Cylinder ${c.n}: drains lubricating oil from rocker area toward the crankcase/sump (Lycoming Fig 12 pp. 24–25). Gravity return, independent of electrical power. Tube shape schematic.`,
  });
  part(() => cyl(0.007, 0.015, "y", 12), ["engine"], {
    pos: P3(c.fs, c.s * 12, 52),
    color: "#CC925B",
    name: "Cylinder head temperature probe",
    pin: c.n === 1,
    note: `Cylinder ${c.n} CHT sensor to the GEA 71; displays head temperature separately from EGT (POH 7-32; 172RPC24 77-20-00). Sensor locations and sizes schematic.`,
  });
  part(() => cyl(0.007, 0.018, "z", 12), ["engine"], {
    pos: P3(c.fs, c.s * 14, 45),
    color: "#CC925B",
    name: "Exhaust gas temperature probe",
    pin: c.n === 1,
    note: `Cylinder ${c.n} probe in its exhaust riser provides the EIS leaning indication (POH 7-32; 172RPC24 77-20-00). Probe station is not a specified installation distance.`,
  });
}
for (const [name, at, note] of [
  [
    "Throttle butterfly linkage",
    P3(-28.2, -2, 33.8),
    "Throttle push-pull control cable operates the fuel-servo air butterfly; fixed-pitch RPM depends on throttle and airspeed (POH 7-30,7-37).",
  ],
  [
    "Servo mixture linkage",
    P3(-28.2, 2, 33.8),
    "Vernier mixture control acts at the fuel/air control unit; idle cutoff stops metered fuel (POH 7-30; Lycoming Operator1-3).",
  ],
  [
    "Alternate-air return spring",
    P3(-29.4, 3.8, 35.6),
    "Spring retains the automatic alternate-air door until engine suction opens it after filter blockage (POH 7-36). No pilot carburetor-heat control on this injected engine.",
  ],
] as [string, Vec3, string][])
  part(() => box(0.025, 0.025, 0.025), ["engine"], {
    pos: at,
    name,
    note: note + " Linkage dimensions approximate.",
    color: "#C2A366",
    pin: true,
  });

part(() => cyl(0.007, 0.018, "x", 12), ["engine", "avionics"], {
  pos: P3(-5, 0, 47.5),
  name: "Oil temperature sensor",
  color: "#CC925B",
  pin: true,
  note: "Oil temperature pickup in the oil-filter assembly sends its electrical reading to GEA 71 (POH 7-32; 172RPC24 79-30). Schematic port location and dimensions, distinct from the thermostatic bypass mechanism.",
});
export const DEPTH_ENGINE_PARTS = CAT.parts.slice(depthStart);
