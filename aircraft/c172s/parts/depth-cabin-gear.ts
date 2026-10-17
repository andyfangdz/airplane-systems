// Frozen row keys identify authored members; preserve these tokens when inserting, moving or reshaping a row.
/** C172S cabin/gear mechanisms. POH172SPHBUS-04 7-23–28,7-46,7-62; 172RPC24
 * Chapters21,25,32,52. All shapes and installation offsets are schematic. */
import type { Vec3 } from "@/lib/math";
import { box, cyl, tubeGeo, onSkin, X, Y } from "../geometry";
import { DEPTH as D } from "../depth-anchors";
import { P3, PV, part } from "./catalogue";
import { CAT } from "./catalogue";
const depthStart = CAT.parts.length;
import { MG } from "./gear";
const steel = "#899AA5",
  cab = "#A08F74";
for (const side of [-1, 1]) {
  for (const rail of [-1, 1])
    part(() => box(0.56, 0.016, 0.025), ["cabin"], {
      id: "parts.depth-cabin-gear.front-seat-track.001",
      instance: [side, rail],
      pos: P3(43, side * 10 + rail * 3.3, 25.4),
      name: "Front seat track",
      pin: side < 0 && rail < 0,
      color: steel,
      note: "Crew seats slide fore/aft on floor tracks; releasing the adjustment handle must leave the seat positively locked (POH 7-24; 172RPC24 25-10). Track length/hole spacing schematic; no seat-lock inspection tolerances inferred.",
    });
  for (const [rowKey1, name, at, size, note] of [
    [
      "row-001",
      "Seat-track lock",
      P3(42, side * 10, 27),
      [0.035, 0.028, 0.04],
      "Spring-loaded locking mechanism holds the selected fore/aft position. Preflight checks secure seat adjustment; a rail does not replace the locking pin (POH 7-24; 172RPC24 25-10).",
    ],
    [
      "row-002",
      "Seat fore/aft release handle",
      P3(34, side * 10, 28),
      [0.04, 0.012, 0.07],
      "Handle beneath the seat releases the fore/aft lock; release it and verify engagement (POH 7-24).",
    ],
    [
      "row-003",
      "Seat height adjustment crank",
      P3(40, side * 10 + 3, 29),
      [0.015, 0.04, 0.035],
      "Crank under the right front corner raises/lowers the crew seat (POH 7-24). Gearbox/crank schematic.",
    ],
    [
      "row-004",
      "Seat-back release",
      P3(35, side * 10, 30),
      [0.025, 0.014, 0.025],
      "Front-seat back angle release beneath the front of the seat; an unoccupied back folds forward after release (POH 7-24).",
    ],
    [
      "row-005",
      "Lap belt buckle",
      P3(42, side * 7, 34),
      [0.035, 0.015, 0.025],
      "Integrated lap/shoulder restraint joins in one buckle; inertia reel permits normal movement but locks under sudden deceleration (POH 7-25–26).",
    ],
    [
      "row-006",
      "Rear inertia reel",
      P3(80, side * 16, 73),
      [0.055, 0.045, 0.04],
      "Rear-seat shoulder-harness inertia reels are mounted outboard in the upper cabin (POH 7-25). Approximate reel dimensions/station.",
    ],
    [
      "row-007",
      "Rear lap belt buckle",
      P3(76, side * 7, 35),
      [0.035, 0.015, 0.025],
      "Rear occupants use the integrated lap/shoulder harness, not an independent parachute harness (POH 7-25–26).",
    ],
  ] as [string, string, Vec3, Vec3, string][])
    part(() => box(...size), ["cabin"], {
      id: "parts.depth-cabin-gear.part.002",
      instance: [side, rowKey1],
      pos: at,
      name,
      color: cab,
      pin: side < 0,
      note: note + " Geometry schematic.",
    });
  for (const [rowKey2, fs, topBL, topH, seatH] of [
    ["row-001", 42, side * 3, 74.5, 42],
    ["row-002", 76, side * 16, 73, 45],
  ] as const)
    part(
      () => tubeGeo([P3(fs + 10, topBL, topH), P3(fs + 6, side * 9, seatH + 8), P3(fs, side * 7, seatH - 6)], 0.009, 0),
      ["cabin"],
      {
        id: "parts.depth-cabin-gear.part.003",
        instance: [side, rowKey2],
        name: fs === 42 ? "Front shoulder harness" : "Rear shoulder harness",
        color: "#5F666C",
        pin: side < 0,
        note: "Continuous restraint webbing from the inertia reel to the occupied seating position (POH 7-25–26). Path depicts the empty-seat study arrangement; belt anchorage and webbing dimensions approximate.",
      },
    );
  for (const [rowKey3, fs] of [
    ["row-001", 42],
    ["row-002", 76],
  ] as const)
    part(
      () => tubeGeo([P3(fs, side * 15, 33), P3(fs - 2, side * 12, 34), P3(fs, side * 7, fs < 50 ? 34 : 35)], 0.009, 0),
      ["cabin"],
      {
        id: "parts.depth-cabin-gear.part.004",
        instance: [side, rowKey3],
        name: fs < 50 ? "Front lap belt" : "Rear lap belt",
        color: "#5F666C",
        note: "Lap portion of the integrated restraint (POH 7-25–26). Schematic empty-seat webbing.",
      },
    );
  for (const [rowKey4, h] of [
    ["row-001", 36],
    ["row-002", 60],
  ] as const) {
    const skin = PV(onSkin(X(31), Y(h), side, 0.96));
    part(() => cyl(0.009, 0.04, "y", 12), ["cabin"], {
      id: "parts.depth-cabin-gear.cabin-door-hinge.005",
      instance: [side, rowKey4],
      pos: skin,
      name: "Cabin door hinge",
      pin: side < 0 && h < 40,
      color: steel,
      note: "Forward hinge hardware carries the door; actual door/window outlines remain the inspection surface (172RPC24 52-10). Inboard hinge placement schematic.",
    });
  }
  for (const [rowKey5, name, fs, h, note] of [
    ["row-001", "Cabin door latch bolt", 60, 51, "Latch bolt engages the aft door-post striker."],
    [
      "row-002",
      "Cabin door latch linkage",
      58,
      51,
      "Inside handle OPEN/CLOSE/LOCK acts through the latch linkage; handle spring returns toward CLOSE.",
    ],
    [
      "row-003",
      "Door-window lower latch",
      46,
      56,
      "Openable front door window is hinged at its top and latched at the lower edge.",
    ],
  ] as const) {
    const skin = PV(onSkin(X(fs), Y(h), side, 0.95));
    part(() => box(0.035, 0.02, 0.016), ["cabin"], {
      id: "parts.depth-cabin-gear.part.006",
      instance: [side, rowKey5],
      pos: skin,
      name,
      color: steel,
      pin: side < 0,
      note: note + " POH 7-27–28; 172RPC24 52-10/52-10-02. Hardware size/offset schematic.",
    });
  }
  part(() => cyl(0.004, 0.045, "x", 12), ["gear"], {
    id: "parts.depth-cabin-gear.brake-master-cylinder-piston.007",
    instance: [side],
    pos: P3(7, side * 8, 28.5),
    name: "Brake master-cylinder piston",
    pin: side < 0,
    color: "#C58563",
    note: "Toe pressure strokes a piston in each pilot-side master cylinder; copilot pedals are mechanically interconnected (POH 7-46; 172RPC24 32-30/32-32). Schematic internals, not separate copilot cylinders.",
  });
  part(() => box(0.025, 0.025, 0.035), ["gear"], {
    id: "parts.depth-cabin-gear.parking-brake-locking-lever.008",
    instance: [side],
    pos: P3(9, side * 8, 29),
    name: "Parking brake locking lever",
    pin: side < 0,
    color: steel,
    note: "Parking handle mechanically holds the applied master-cylinder arrangement (172RPC24 32-32; POH 7-46). This aircraft is not depicted with a hydraulic shutoff valve in the wheel lines.",
  });
  for (const [rowKey6, name, fs, bl, h, r, len, note] of [
    [
      "row-001",
      "Main wheel inner bearing",
      MG.fs,
      side * (MG.bl - 2.7),
      MG.h,
      0.018,
      0.015,
      "Tapered wheel bearing and grease seal support each wheel on its axle.",
    ],
    [
      "row-002",
      "Main wheel outer bearing",
      MG.fs,
      side * (MG.bl + 2.7),
      MG.h,
      0.018,
      0.015,
      "Outer bearing and axle nut complete the main-wheel support.",
    ],
    [
      "row-003",
      "Brake caliper piston",
      MG.fs - 2,
      side * (MG.bl - 4.5),
      MG.h + 3,
      0.017,
      0.024,
      "Fluid pressure advances the piston and pressure plate against the disc.",
    ],
    [
      "row-004",
      "Brake bleeder valve",
      MG.fs - 1,
      side * (MG.bl - 4.9),
      MG.h + 4,
      0.007,
      0.018,
      "Bleeder fitting permits removing trapped air during servicing; it is closed during operation.",
    ],
  ] as [string, string, number, number, number, number, number, string][])
    part(() => cyl(r, len, "z", 14), ["gear"], {
      id: "parts.depth-cabin-gear.part.009",
      instance: [side, rowKey6],
      pos: P3(fs, bl, h),
      name,
      pin: side > 0,
      color: name.includes("Brake") ? "#C58563" : steel,
      ext: true,
      note: note + "172RPC24 32-30-00 Fig 01. Exterior main-wheel hardware; shapes/sizes schematic.",
    });
  part(() => box(0.04, 0.035, 0.012), ["gear"], {
    id: "parts.depth-cabin-gear.brake-friction-lining.010",
    instance: [side],
    pos: P3(MG.fs - 2, side * (MG.bl - 3.8), MG.h + 3),
    name: "Brake friction lining",
    pin: side > 0,
    color: "#5E4741",
    ext: true,
    note: "Replaceable lining at the pressure/backplate assembly contacts the main-wheel disc (172RPC24 32-30-00 Fig 01). No wear limit or maintenance interval is invented.",
  });
  for (const [rowKey7, fs] of [
    ["row-001", 90],
    ["row-002", 107],
  ] as const)
    part(() => cyl(0.009, 0.015, "y", 12), ["cabin"], {
      id: "parts.depth-cabin-gear.baggage-net-floor-eyebolt.011",
      instance: [side, rowKey7],
      pos: P3(fs, side * 12, fs === 90 ? 29 : 30),
      name: "Baggage net floor eyebolt",
      pin: side < 0 && fs === 90,
      color: steel,
      note: "Four floor attachment eyebolts, two at FS90 and two at FS107, secure the baggage net (POH6-9; 7-24). Radius/height approximate.",
    });
  part(() => cyl(0.009, 0.015, "z", 12), ["cabin"], {
    id: "parts.depth-cabin-gear.baggage-net-upper-eyebolt.012",
    instance: [side],
    pos: P3(107, side * 13, 59),
    name: "Baggage net upper eyebolt",
    pin: side < 0,
    color: steel,
    note: "Two additional baggage-net eyebolts below the aft window at FS107 (POH6-9; 7-24). Inboard height/BL schematic.",
  });
  for (const [rowKey8, name, at, note] of [
    [
      "row-001",
      "Defroster sliding valve",
      P3(15.5, side * 7, 65.6),
      "Knob-controlled sliding valve regulates each windshield defroster outlet independently from heater temperature (POH 7-62).",
    ],
    [
      "row-002",
      "Front floor manifold outlet",
      P3(5, side * 8, 33),
      "Holes across the manifold deliver blended heat/ventilation ahead of the occupants' feet (POH 7-62).",
    ],
    [
      "row-003",
      "Rear floor duct outlet",
      P3(68, side * 15, 29),
      "Side duct delivers manifold air to the rear cabin at floor level (POH 7-62; Fig 7-8).",
    ],
  ] as [string, string, Vec3, string][])
    part(() => box(0.018, 0.015, 0.04), ["environment"], {
      id: "parts.depth-cabin-gear.part.013",
      instance: [side, rowKey8],
      pos: at,
      name,
      pin: side > 0,
      color: "#149C94",
      note: note + " Outlet size/offset schematic.",
    });
}
part(() => box(0.03, 0.02, 0.02), ["cabin"], {
  id: "parts.depth-cabin-gear.baggage-door-latch.014",
  pos: P3(108, -12.5, 44),
  name: "Baggage door latch",
  color: steel,
  pin: true,
  note: "Latch secures the left-side baggage door; external keyed handle is inspected before flight (POH 7-24; 172RPC24 52-30). Inboard position/shape schematic.",
});
part(() => cyl(0.008, 0.025, "x", 12), ["environment"], {
  id: "parts.depth-cabin-gear.heater-valve-shaft-and-return-spring.015",
  pos: D.heatValve,
  name: "Heater valve shaft and return spring",
  color: steel,
  pin: true,
  note: "Firewall valve assembly includes operating arm, spring and plate (172RPC24 21-40-00 Fig 01). Mechanical CABIN HT cable operates it without electrical power. Dimensions schematic.",
});
part(() => cyl(0.007, 0.025, "x", 12), ["environment"], {
  id: "parts.depth-cabin-gear.ventilation-door-operating-arm.016",
  pos: D.airValve,
  name: "Ventilation door operating arm",
  color: steel,
  pin: true,
  note: "CABIN AIR cable acts on the ventilation valve/door installation (172RPC24 21-20-00 Fig 01; POH 7-62). No cabin blower or air-conditioning compressor is standard in this study configuration.",
});
part(() => box(0.025, 0.012, 0.028), ["cabin"], {
  id: "parts.depth-cabin-gear.elt-mounting-bracket.017",
  pos: P3(134, 6, 47),
  name: "ELT mounting bracket",
  color: steel,
  pin: true,
  note: "Dedicated tray/bracket retains the ELT in the aft installation (172RPC24 25-60). ME406 operating details remain bounded by the installed Section 9 supplement; a schematic bracket is not evidence of a particular bracket part number.",
});
part(() => box(0.04, 0.016, 0.03), ["cabin"], {
  id: "parts.depth-cabin-gear.fire-extinguisher-retaining-bracket.018",
  pos: P3(42, 0, 25),
  name: "Fire extinguisher retaining bracket",
  color: steel,
  pin: true,
  note: "Floor bracket secures the extinguisher between the front seats for access (POH 7-79; 172RPC24 26-20). Release/retainer shape schematic.",
});

export const DEPTH_CABIN_GEAR_PARTS = CAT.parts.slice(depthStart);
