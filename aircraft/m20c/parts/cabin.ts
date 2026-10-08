/** M20C cabin: instrument panel, glareshield, compass, seats, baggage, doors, storm window, control wheels, trim wheel and jack screw. */
import * as THREE from "three";

import { V } from "@/lib/math";

import { PANEL_X, SY, box, cyl, onSkin, sectionSlab } from "../geometry";

import { ELEV_HORN, JACK, TRIM_WHEEL, WHEEL } from "../rig";
import { P, onSurf, part, sim, trimWheelAnim } from "./catalogue";

/* ---------- cabin ---------- */
part(() => sectionSlab(PANEL_X, -0.26, 0.2, 0.95, 0.04, PANEL_X), ["cabin", "vacuum"], {
  color: "#2B3238",
  name: "Instrument panel",
  note: "Shock-mounted flight panel in front of the pilot; engine cluster, switches and breakers; radios in the centre. The 1968 Ranger introduced the one-piece windshield; the standard 'T' instrument grouping followed on later models.",
  pin: true,
  pinIn: ["cabin"],
});
part(() => sectionSlab(PANEL_X + 0.1, 0.2, 0.26, 0.94, 0.16, PANEL_X + 0.16), ["cabin"], {
  color: "#2B3238",
  name: "Glareshield",
  note: "Over the panel; the defroster outlets are along its front edge.",
});
part(() => box(0.05, 0.05, 0.05), ["cabin", "vacuum"], {
  pos: [1.42, 0.45, 0],
  color: "#1B1F23",
  name: "Magnetic compass",
  note: "On the windshield post above the panel (Ranger 2-7).",
  pin: true,
  pinIn: ["cabin"],
});
(
  [
    [1.0, -0.32, "Pilot seat"],
    [1.0, 0.32, "Co-pilot seat"],
    [0.45, -0.3, "Rear seat (L)"],
    [0.45, 0.3, "Rear seat (R)"],
  ] as [number, number, string][]
).forEach(([x, z, name], i) => {
  part(() => box(0.44, 0.08, 0.4), ["cabin"], {
    pos: [x, -0.5, z],
    color: "#6B5A48",
    name,
    note:
      i < 2
        ? "Contoured sheet-metal seat, adjustable fore and aft (TCDS arm +36.5 to +44); the belts attach to the seat (OM p. 5; Ranger 2-18). Front seat positions affect the aft CG limit."
        : "Rear bench (TCDS arm +70); the backs can be removed for cargo (Ranger 2-18). Full fuel, 120 lb baggage, pilot and two rear passengers can exceed the aft limit (OM p. 14).",
    pin: i === 0 || i === 2,
  });
  part(() => box(0.08, 0.55, 0.38), ["cabin"], {
    pos: [x - 0.25, -0.2, z],
    rot: [0, 0, 0.2],
    color: "#6B5A48",
    name,
    note: "",
  });
});
part(() => box(0.5, 0.05, 0.8), ["cabin"], {
  pos: [-0.05, -0.5, 0],
  color: "#4A4F55",
  name: "Baggage compartment",
  note: "Behind the rear seats, 120 lb max at arm +93 (OM p. 14; TCDS); loaded from the ground through the door above the wing trailing edge (Ranger 1-2). 15 cu ft; tie-down straps.",
  pin: true,
});
part(() => box(0.3, 0.04, 0.6), ["cabin"], {
  pos: [-0.6, -0.3, 0],
  color: "#4A4F55",
  name: "Hat rack (utility shelf)",
  note: "Aft of the baggage compartment (arm +114): light objects only, 10 lb max for balance (OM p. 14; TCDS).",
  pin: true,
});
part(() => box(0.03, 0.04, 0.1), ["cabin"], {
  pos: P(onSkin(0.85, -0.05, 1, 1.0)),
  color: "#30363B",
  name: "Cabin door handle",
  note: "One forward-opening door on the right gives access to both rows (Ranger 1-2). Close it with the pull strap and rotate the handle forward to latch — don't slam (OM p. 15).",
  ext: true,
  pin: true,
});
part(() => box(0.03, 0.03, 0.06), ["cabin"], {
  pos: P(onSkin(-0.06, 0.0, 1, 1.0)),
  color: "#30363B",
  name: "Baggage door",
  note: "Right side just behind the rear window, above the wing trailing edge, between the window sill and the cheat line (Ranger 1-2; N6947N photo). Walk-around: secure.",
  ext: true,
  pin: true,
});
part(
  () => {
    const g = box(0.2, 0.14, 0.012);
    g.translate(0, -0.07, 0);
    return g;
  },
  ["cabin", "environment"],
  {
    pos: P(onSkin(1.3, 0.3, -1, 0.995)),
    color: "#9AB4C8",
    anim: (m) => {
      m.rotation.x = sim().s.env.stormWindow ? -0.7 : 0;
    },
    name: "Pilot's storm window",
    note: "Opening window in the pilot's side window; close and latch before take-off (OM p. 18). Don't open above 150 mph (Ranger 4-9).",
    ext: true,
    pin: true,
  },
);
// control wheels and shafts (moving)
(["L", "R"] as const).forEach((side) => {
  part(
    () => {
      const g = new THREE.TorusGeometry(WHEEL.r, 0.016, 10, 28);
      return g;
    },
    ["controls"],
    {
      parent: "wheel:" + side,
      chan: ["elevator", "aileron"],
      color: "#30363B",
      name: "Control wheel",
      note: "Dual control wheels on shafts through the panel: push-pull for the elevator, rotate for the ailerons (OM p. 8; Ranger 1-3). The pilot's left grip holds the PC cut-off valve.",
      pin: side === "L",
    },
  );
  part(() => box(0.02, 0.04, WHEEL.r * 2 - 0.02), ["controls"], {
    parent: "wheel:" + side,
    chan: ["aileron"],
    color: "#30363B",
  });
});
part(() => cyl(0.014, 2 * WHEEL.z - 0.1, "z"), ["controls"], {
  pos: [1.62, -0.42, 0],
  chan: ["elevator"],
  color: "#8C959C",
  name: "Elevator torque tube",
  note: "Under the panel, joining both wheel shafts in pitch; its lever drives the elevator push-pull tube aft (service-manual arrangement).",
  pin: true,
});
part(
  () => {
    const g = new THREE.CylinderGeometry(TRIM_WHEEL.r, TRIM_WHEEL.r, 0.03, 28);
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["controls"],
  {
    pos: TRIM_WHEEL.c,
    chan: ["elevator"],
    color: "#1B1F23",
    anim: trimWheelAnim,
    name: "Trim control wheel",
    note: "Small wheel on the floor between the front seats: forward = nose down, back = nose up (OM p. 9; Ranger 2-10). Friction screw on the pilot's side of the pedestal; take-off mark on the floor indicator.",
    pin: true,
  },
);
part(() => box(0.012, 0.02, 0.03), ["controls"], {
  pos: [TRIM_WHEEL.c[0], TRIM_WHEEL.c[1] + TRIM_WHEEL.r - 0.005, TRIM_WHEEL.c[2]],
  chan: ["elevator"],
  color: "#F2F5F7",
  anim: (m) => {
    const a = sim().s.ctrl.trim * 2.6;
    m.position.set(
      TRIM_WHEEL.c[0] - Math.sin(a) * (TRIM_WHEEL.r - 0.005),
      TRIM_WHEEL.c[1] + Math.cos(a) * (TRIM_WHEEL.r - 0.005),
      TRIM_WHEEL.c[2],
    );
    m.rotation.z = a;
  },
});
part(() => box(0.08, 0.1, 0.06), ["controls"], {
  pos: JACK,
  chan: ["elevator"],
  color: "#7C57CF",
  name: "Empennage jack screw",
  note: "Bolted to the rear tail-cone bulkhead; driven by the torque tube from the trim wheel it raises or lowers the whole tail about its pivot (OM p. 6, 9).",
  pin: true,
});
[1, -1].forEach((s) =>
  onSurf(
    "elev",
    V(ELEV_HORN.c[0] - 0.02, SY - 0.05, s * 0.14),
    () => cyl(0.01, 0.1, "y"),
    {
      chan: ["elevator"],
      color: "#E0B040",
      name: "Elevator trim bungee",
      note: "Springs on the elevator horns whose setting changes with the stabilizer trim, giving trim assist from the elevator (OM p. 9).",
      pin: s > 0,
    },
    true,
  ),
);
