/** Avionics: display bezels, ADAHRS, GIAs, GEA, the centre console stack, transponder, antennas and magnetometer. */
import { toVec3 } from "@/lib/math";
import { box, botY, cyl, topY, wingP } from "../geometry";
import { part } from "./catalogue";
import { STACK } from "./cabin";

/* ---------- avionics ---------- */
// GDU 1050A bezels around the 0.211 × 0.158 m screens (Airplane.tsx SCREENS), sized from the Pilot's Guide drawing (approximate):
// ≈1.31 × 1.25 of the screen, knobs on the inboard edges, softkeys below. The inboard control strips nearly meet, with a narrow
// strip between them carrying the red DISPLAY BACKUP button at the top (PG Fig 1-2, 1-6; Perspective+ brochure).
const BEZEL_Z = { pfd: -0.241, mfd: 0.054 } as const;
part(() => box(0.014, 0.198, 0.276), ["avionics"], {
  pos: [2.285, 0.092, BEZEL_Z.pfd],
  color: "#15181B",
  name: "PFD bezel",
  pin: true,
  note: "COM volume and frequency knobs, BARO, RANGE joystick, menu keys and the FMS knob on its right (inboard) edge; 12 softkeys under the screen.",
});
part(() => box(0.014, 0.198, 0.276), ["avionics"], {
  pos: [2.285, 0.092, BEZEL_Z.mfd],
  color: "#15181B",
  name: "MFD bezel",
  pin: true,
  note: "NAV volume and frequency knobs at the top of its left (inboard) edge; 12 softkeys under the screen.",
});
part(() => cyl(0.008, 0.012, "x"), ["avionics"], {
  pos: [2.274, 0.165, -0.0935],
  color: "#D32640",
  name: "DISPLAY BACKUP button",
  note: "Puts both displays in reversionary mode: PFD instruments plus the Engine Strip. Press again to exit. The other display reverts on its own if one fails (POH 7-72).",
});
// bezel controls (decorative): knobs on each inboard strip (PFD: COM volume, COM, BARO, RANGE, FMS; MFD: NAV volume, NAV), 12 softkeys under each screen
const KNOB = "#2C3136";
for (const [y, r] of [
  [0.165, 0.008],
  [0.127, 0.011],
  [0.089, 0.009],
  [0.055, 0.007],
  [0.008, 0.011],
] as const)
  part(() => cyl(r, 0.014, "x"), ["avionics"], { pos: [2.272, y, BEZEL_Z.pfd + 0.121], color: KNOB });
for (const [y, r] of [
  [0.165, 0.008],
  [0.127, 0.011],
] as const)
  part(() => cyl(r, 0.014, "x"), ["avionics"], { pos: [2.272, y, BEZEL_Z.mfd - 0.121], color: KNOB });
for (const z0 of [BEZEL_Z.pfd, BEZEL_Z.mfd])
  for (let i = 0; i < 12; i++)
    part(() => box(0.004, 0.006, 0.012), ["avionics"], { pos: [2.277, 0.008, z0 + (i - 5.5) * 0.0176], color: KNOB });
part(() => box(0.1, 0.09, 0.15), ["avionics", "pitot"], {
  pos: [2.43, 0.1, -0.24],
  name: "GSU 75 ADAHRS",
  note: "Behind the PFD: attitude/heading reference plus air data computer. ADAHRS 1 on ESS BUS 1.",
  pin: true,
});
part(() => box(0.12, 0.11, 0.15), ["avionics"], {
  pos: [2.44, 0.12, 0.2],
  name: "GIA 63W/64W ×2",
  note: "Integrated avionics units: WAAS GPS, VHF COM/NAV/GS, integration. GIA 1 on ESS BUS 1, GIA 2 on MAIN BUS 2.",
  pin: true,
});
part(() => box(0.1, 0.07, 0.1), ["avionics", "engine"], {
  pos: [2.44, -0.04, 0.3],
  name: "GEA 71 Engine Airframe Unit",
  note: "Digitizes fuel, CHT, EGT, MAP, RPM and other sensors. 3 A ENGINE INSTR on ESS BUS 2.",
});
part(() => box(0.012, 0.085, 0.15), ["avionics"], {
  pos: STACK.at(0.29, 0.006, 0.005),
  rot: STACK.rot,
  color: "#15181B",
  name: "GCU 479 FMS keyboard",
  note: "Upper section of the centre console, just below the displays (POH 7-76). Data entry, tuning, course. KEYPADS / AP CTRL on MAIN BUS 1.",
});
part(() => box(0.012, 0.04, 0.15), ["avionics", "controls"], {
  pos: STACK.at(0.215, 0.006, 0.005),
  rot: STACK.rot,
  color: "#15181B",
  name: "GMC 707 autopilot mode controller",
  note: "GFC 700 mode controller, below the FMS keyboard in the centre console (POH 7-73; position from Fig. 7-4, approximate).",
});
part(() => box(0.012, 0.045, 0.15), ["avionics"], {
  pos: STACK.at(0.16, 0.006, 0.005),
  rot: STACK.rot,
  color: "#15181B",
  name: "GMA 350 audio panel",
  note: "Audio panel with marker beacon receiver, below the autopilot controller in the centre console (POH 7-73; position from Fig. 7-4, approximate).",
});
part(() => box(0.16, 0.09, 0.12), ["avionics"], {
  pos: [-1.15, -0.08, -0.1],
  name: "GTX 335/345 transponder",
  note: "In the empennage avionics bay. XPONDER breaker on the AVIONICS bus.",
});
const ANT = "#C8399F";
part(() => cyl(0.007, 0.3), ["avionics"], {
  pos: [0.45, 0.82, 0],
  rot: [0, 0, 0.45],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "COM 1 antenna",
  note: "Rod on top above the passenger compartment.",
  ext: true,
});
part(() => cyl(0.007, 0.26), ["avionics"], {
  pos: [-0.35, -0.7, 0],
  rot: [0, 0, -0.45],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "COM 2 antenna",
  note: "Rod below the baggage compartment.",
  ext: true,
});
part(() => cyl(0.05, 0.015), ["avionics"], {
  pos: [1.0, 0.72, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "GPS 1 antenna",
  note: "Above the passenger compartment (GPS/XM combo if XM installed).",
  ext: true,
});
part(() => cyl(0.05, 0.015), ["avionics"], {
  pos: [-0.28, 0.54, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "GPS 2 / Iridium antenna",
  note: "Just forward of the baggage-compartment window.",
  ext: true,
});
part(() => box(0.2, 0.015, 0.015), ["avionics"], {
  pos: [-3.67, 1.545, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "NAV antenna",
  note: "Top of the fin: VOR/LOC and glideslope for both GIAs.",
  ext: true,
});
part(() => box(0.08, 0.08, 0.01), ["avionics"], {
  pos: [-0.72, -0.57, 0.12],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Transponder antenna",
  note: "Belly, just aft of the baggage bulkhead, right side.",
  ext: true,
});
part(() => box(0.2, 0.012, 0.08), ["avionics"], {
  pos: [0.25, topY(0.25) + 0.004, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Stormscope antenna (optional)",
  note: "Lightning-detection antenna directly above the passenger compartment.",
  ext: true,
});
part(() => box(0.14, 0.06, 0.012), ["avionics"], {
  pos: [1.45, topY(1.45) + 0.03, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Traffic antenna, top (optional)",
  note: "Just above the pilot/copilot compartment; a second traffic antenna sits under the belly.",
  ext: true,
});
part(() => box(0.3, 0.012, 0.1), ["avionics"], {
  pos: [-0.25, botY(-0.25) - 0.004, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Marker beacon antenna",
  note: "Sled type, below the baggage compartment floor.",
  ext: true,
});
part(() => box(0.1, 0.06, 0.012), ["avionics"], {
  pos: [2.3, botY(2.3) - 0.03, 0.1],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "DME antenna (optional)",
  note: "Blade on the belly just aft and right of the firewall.",
  ext: true,
});
part(() => box(0.07, 0.04, 0.07), ["avionics"], {
  pos: toVec3(wingP(-4.9, 0.45, 0)),
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Magnetometer (MAG 1)",
  note: "Senses the local magnetic field for AHRS heading. Mounted out near a wing tip, away from ferrous masses. Exact location approximate.",
  pin: true,
});
