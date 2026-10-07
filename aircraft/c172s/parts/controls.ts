/** C172S catalogue: flight controls (POH Figure 7-1), the GFC 700 servos and controls, and the electric flap drive. */
import * as THREE from "three";
import { chanOfKey } from "@/lib/catalogue";
import type { Chan } from "@/lib/systems";
import { gfc700Engaged } from "@/lib/avionics/gfc700";
import { glowAnim } from "@/lib/anims";
import { X, Y, Z, box, cyl, hingeX, tubeGeo } from "../geometry";
import { live } from "../model";
import { PULLEYS, RIG, RIG_SPEC } from "../rig";
import { IN } from "../../cessna/airframe";
import { pulleyGeo } from "../../cessna/rig";
import { NAV3_BL, afcsKeys } from "../../cessna/faceplate";
import { CAP_END, HUB_LOW, capRot, controlWheelGeo, gripAft, onCap, wheelEmblemGeo } from "../../cessna/yoke";
import { P3, part, surfacePivot, onSurf, S, wp } from "./catalogue";

/* ---------- flight controls (POH Figure 7-1) ---------- */
const CTL = "#7C57CF",
  STEEL = "#8C959C";
export const YOKES = [
  { side: "L", bl: -RIG_SPEC.yoke.bl },
  { side: "R", bl: RIG_SPEC.yoke.bl },
] as const;
YOKES.forEach(({ side }) => {
  const yk = "yoke:" + side,
    wh = "wheel:" + side,
    colLen = (RIG_SPEC.yoke.fs - RIG_SPEC.yoke.colFs) * IN;
  part(() => cyl(0.016, colLen, "x"), ["controls"], {
    parent: yk,
    pos: [colLen / 2, 0, 0],
    color: STEEL,
    chan: ["elevator", "aileron"],
    name: "Control column",
    note: "Passes through the instrument panel: slides fore/aft for pitch and turns for roll. Both columns are joined behind the panel (POH Fig. 7-1).",
    pin: side === "L",
  });
  part(controlWheelGeo, ["controls"], {
    parent: wh,
    color: "#20262B",
    chan: ["elevator", "aileron"],
    name: side === "L" ? "Pilot's control wheel" : "Copilot's control wheel",
    note:
      side === "L"
        ? "Left horn: microphone button, Control Wheel Steering (CWS), A/P TRIM DISC button and the split Manual Electric Trim switch; map light and rheostat underneath (POH 7-14, 7-61)."
        : "Dual controls, right seat: copilot control wheel at FS 26.0 (POH 6-21).",
    pin: true,
  });
  part(wheelEmblemGeo, ["controls"], { parent: wh, color: "#5C666E", chan: ["elevator", "aileron"] });
});
// control-wheel switches (left horn of the pilot's wheel)
part(() => box(0.012, 0.006, 0.012), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: onCap(-1, 0.007, CAP_END + 0.002, 0.007),
  rot: capRot(-1),
  color: "#C8313B",
  name: "A/P TRIM DISC button",
  note: "Disconnects the autopilot; press and hold to remove power from the trim motor and servos (CRG 113). Before takeoff: press, verify the AP disengages and the aural alert sounds (POH 4-16).",
  pin: true,
});
part(() => box(0.006, 0.014, 0.012), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: gripAft(-1, 0.72),
  rot: capRot(-1),
  color: "#E8ECEE",
  name: "CWS button",
  note: "Control Wheel Steering: immediately disconnects the pitch and roll servos while held; references resync on release (POH 7-71).",
  pin: true,
});
part(() => box(0.012, 0.008, 0.016), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: onCap(-1, -0.008, CAP_END + 0.003, -0.006),
  rot: capRot(-1),
  color: "#9F85E6",
  name: "Manual Electric Trim (MET) switch",
  note: "Split rocker: both halves must move together; drives the GFC 700 trim servo (MET). Unavailable with AFCS or PTRM shown (CRG 117). Max 163 KIAS (POH 2-21).",
  pin: true,
});
part(() => box(0.026, 0.008, 0.026), ["lighting"], {
  parent: "wheel:L",
  pos: [HUB_LOW[0], HUB_LOW[1] - 0.003, -0.022],
  color: "#E8C46A",
  name: "Control wheel map light",
  note: "Under the pilot's wheel; turn NAV on, then set the knurled rheostat (POH 7-61). NAV LTS breaker, ELECTRICAL BUS 2.",
  pin: true,
});
part(() => box(0.03, 0.05, Z(RIG_SPEC.yoke.bl) * 2 + 0.04), ["controls"], {
  parent: "rig:cross",
  color: STEEL,
  chan: ["elevator", "aileron"],
  name: "Column interconnect",
  note: "Joins the two control columns behind the panel so both wheels move together (POH Fig. 7-1).",
  pin: true,
});
[-1, 1].forEach((s) =>
  part(() => box(0.02, Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH), 0.02), ["controls"], {
    parent: "rig:cross",
    pos: [0, (Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH)) / 2, s * Z(RIG_SPEC.yoke.bl)],
    color: STEEL,
    chan: ["elevator"],
  }),
);
part(() => box(0.04, RIG_SPEC.elev.arm * IN * 3.2, 0.03), ["controls"], {
  parent: "rig:crank",
  color: CTL,
  chan: ["elevator"],
  name: "Elevator bellcrank (forward)",
  note: "Under the forward cabin floor: the link from the column interconnect rocks it, pulling one elevator cable and paying out the other (POH Fig. 7-1).",
  pin: true,
});
Object.entries(PULLEYS).forEach(([k, d]) =>
  part(() => pulleyGeo(d.r, d.axis, d.double, d.gap), d.chan === "trim" ? ["controls", "autopilot"] : ["controls"], {
    chan: d.chan === "trim" ? ["elevator"] : [d.chan as Chan],
    parent: "rig:pul:" + k,
    color: k.startsWith("aw") ? CTL : "#A6AEB4",
    name: d.name,
    note: d.note,
    pin: true,
  }),
);
(["L", "R"] as const).forEach((sd) =>
  part(() => box(0.16, 0.012, 0.016), ["controls"], {
    parent: "rig:pul:aw" + sd,
    pos: [-0.04, -0.012, 0],
    color: STEEL,
    chan: ["aileron"],
  }),
);
// rudder bars and pedals (the pilot's pedals carry the brake master cylinders)
part(() => cyl(0.014, Z(RIG_SPEC.rud.half) * 2, "z"), ["controls", "gear"], {
  pos: P3(RIG_SPEC.rud.barFs, 0, RIG_SPEC.rud.barH),
  color: STEEL,
  chan: ["rudder"],
  name: "Rudder bars",
  note: "The interconnected rudder/brake pedals pivot on the rudder bars; the rudder cables and the nose-gear steering bungees attach to them (POH 7-22, 7-46).",
  pin: true,
});
[-16, -8, 8, 16].forEach((bl) => {
  const parent = bl < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.03, 0.17, 0.08), ["controls", "gear"], {
    parent,
    pos: P3(6.8, bl, 33),
    rot: [0, 0, 0.3],
    color: "#20262B",
    chan: ["rudder"],
    name: "Rudder / brake pedal",
    note: "Pedals steer the nosewheel through the bungee and move the rudder; toe pressure on the top applies that side's brake. Copilot pedals at FS 6.8 (POH 6-21).",
  });
  if (bl < 0)
    part(() => cyl(0.014, 0.1), ["gear"], {
      parent,
      pos: P3(5.5, bl, 29),
      color: STEEL,
      name: "Brake master cylinder",
      note: "One on each of the pilot's pedals; the copilot pedals act through the interconnect (POH 7-46).",
    });
});
// elevator bellcrank / torque tube in the tailcone, rudder horn, aileron horns
{
  const pv = surfacePivot("elevR"),
    arm = RIG_SPEC.elev.hornArm * IN;
  part(() => box(0.025, arm * 2.2, 0.025), ["controls"], {
    parent: "surf:elevR",
    pos: [0.02, 0, -pv[2] + 0.02],
    color: CTL,
    chan: ["elevator"],
    name: "Elevator bellcrank (tail)",
    note: "On the elevator torque tube: the up and down cables pull its upper and lower arms (POH 7-6, Fig. 7-1).",
    pin: true,
  });
  part(() => cyl(0.012, Z(4) * 2, "z"), ["controls"], {
    parent: "surf:elevR",
    pos: [0, 0, -pv[2]],
    color: STEEL,
    chan: ["elevator"],
    name: "Elevator torque tube",
    note: "Joins both elevator halves on the hinge line.",
  });
  const rv = surfacePivot("rudder"),
    hy = Y(RIG_SPEC.rud.hornH);
  part(() => box(0.03, 0.025, Z(RIG_SPEC.rud.hornArm) * 2), ["controls"], {
    parent: "surf:rudder",
    pos: [hingeX(hy) + 0.02 - rv[0], hy - rv[1], 0],
    color: CTL,
    chan: ["rudder"],
    name: "Rudder horn",
    note: "Bottom of the rudder: each rudder cable pulls one end (POH Fig. 7-1).",
    pin: true,
  });
}
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L",
    aw = PULLEYS["aw" + sd].c;
  onSurf("ail" + sd, [aw[0] - 0.16, aw[1] - 0.035, aw[2]], () => box(0.03, 0.04, 0.012), {
    color: CTL,
    name: "Aileron horn",
    note: "The push-pull rod from the bellcrank drives the aileron here.",
  });
});
// trim wheel and indicator, trim actuator
part(
  () => {
    const g = new THREE.CylinderGeometry(RIG_SPEC.trim.r * IN, RIG_SPEC.trim.r * IN, 0.03, 28);
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["controls", "autopilot"],
  {
    parent: "rig:trimWheel",
    color: "#20262B",
    chan: ["elevator"],
    name: "Elevator trim wheel",
    pin: true,
    note: "Vertical wheel on the pedestal: forward = nose down, aft = nose up (POH 7-7). It turns when the GFC 700 trim servo runs (MET or autotrim) because the servo drives the same cable (Fig. 7-10).",
  },
);
part(() => box(0.012, 0.012, 0.035), ["controls", "autopilot"], {
  parent: "rig:trimWheel",
  pos: [0, RIG_SPEC.trim.r * IN, 0],
  color: "#E8ECEE",
  chan: ["elevator"],
});
part(() => box(0.01, 0.02, 0.01), ["controls"], {
  pos: P3(25.8, 2.6, 37.5),
  color: "#FFFFFF",
  chan: ["elevator"],
  anim: (m) => {
    m.position.y = Y(37.5) + live.afcs.trim * 0.04;
  },
  name: "Trim position indicator",
  note: "Pointer beside the wheel; TAKEOFF when it lines up with the index mark on the pedestal cover (POH 4-31). Required for all operations (KOEL).",
});
part(() => box(0.06, 0.035, 0.05), ["controls"], {
  pos: RIG.p3(RIG_SPEC.trim.actuator),
  color: CTL,
  chan: ["elevator"],
  name: "Elevator trim tab actuator",
  note: "Inside the horizontal stabilizer (POH 7-6); driven by the trim cable, it pushes the tab through a push-pull rod.",
  pin: true,
});
(["elUp", "elDn", "rudL", "rudR", "trim"] as const).forEach((k, i) => {
  const c = RIG.cable(k).pts,
    a = c[c.length - 3],
    b = c[c.length - 2];
  part(() => cyl(0.008, 0.06, "x"), ["controls"], {
    pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    color: "#C9B98F",
    chan: chanOfKey(k === "trim" ? "el" : k),
    name: "Turnbuckle",
    note: "Sets cable tension; safety-wired after rigging.",
    pin: i === 0,
  });
});
part(() => cyl(0.006, 0.22, "x"), ["controls", "cabin"], {
  pos: P3(18.5, -13.5, 59),
  color: "#C8313B",
  anim: (m) => {
    m.visible = S().cabin.lock;
  },
  name: "Control lock",
  note: "Steel rod and flag through the pilot's column shaft and collar: ailerons neutral, elevator slightly TE down; the flag covers the ignition switch. “CAUTION! CONTROL LOCK REMOVE BEFORE STARTING ENGINE” (POH 7-28, 2-23).",
  pin: true,
});

/* ---------- autopilot: GFC 700 servos and controls ---------- */
/** Servos drive only while engaged and not released by CWS; the trim servo needs the AUTO PILOT breaker (no AFCS failure). */
const apEngaged = () => gfc700Engaged(live.afcs);
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], {
  pos: RIG.p3(RIG_SPEC.servo.roll),
  color: "#C8399F",
  chan: ["aileron"],
  anim: glowAnim("#C8399F", apEngaged, ["autopilot", "controls"], "#FF7BE0"),
  name: "GFC 700 roll servo",
  note: "Arm 59.5 (POH 6-19); drives the aileron system through a bridle cable and slip clutch — the pilot can overpower it (POH 4-16). Lateral position assumed.",
  pin: true,
});
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], {
  pos: RIG.p3(RIG_SPEC.servo.pitch),
  color: "#C8399F",
  chan: ["elevator"],
  anim: glowAnim("#C8399F", apEngaged, ["autopilot", "controls"], "#FF7BE0"),
  name: "GFC 700 pitch servo",
  note: "In the tailcone at FS 180.7 (POH 6-19): bridle on the elevator cables.",
  pin: true,
});
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], {
  pos: RIG.p3(RIG_SPEC.servo.trim),
  color: "#C8399F",
  chan: ["elevator"],
  anim: glowAnim(
    "#C8399F",
    () => live.afcs.powered && live.afcs.pft === "pass" && !live.afcs.fail.sys,
    ["autopilot"],
    "#FF7BE0",
  ),
  name: "GFC 700 pitch trim servo",
  note: "FS 180.7: drives the elevator trim cable (MET and autotrim) — so the cockpit trim wheel turns too (POH Fig. 7-10).",
  pin: true,
});
part(() => box(0.02, 0.022, 0.022), ["autopilot"], {
  pos: P3(18.3, -2.2, 48.8),
  color: "#20262B",
  name: "GA button",
  note: "Go-around button left of the throttle, below ALT STATIC AIR (Fig. 7-2 item 27): on the ground TO, in the air GA — disengages the AP, wings level and a fixed pitch-up (CRG 21–22).",
  pin: true,
});
// left strip of each GDU 1040 bezel (FS 17.9, WL 61), between the HDG and ALT knobs (aircraft/cessna/faceplate.ts)
(
  [
    [NAV3_BL.pfd, "PFD bezel AFCS keys"],
    [NAV3_BL.mfd, "MFD bezel AFCS keys"],
  ] as [number, string][]
).forEach(([bl, name], i) =>
  part(afcsKeys, ["autopilot", "avionics"], {
    pos: [X(17.9) - 0.018, Y(61), Z(bl)],
    color: "#4A525A",
    name,
    note: "AP FD / HDG ALT / NAV VNV / APR BC / VS FLC / NOSE UP NOSE DN on the left bezel of both GDUs — “push AP button on either PFD or MFD bezel” (POH 4-16).",
    pin: i === 0,
  }),
);

/* ---------- flaps: electric motor drive (POH 7-23, Figure 7-3) ---------- */
part(() => box(0.012, 0.06, 0.02), ["flaps"], {
  pos: P3(18.3, 8.6, 48.5),
  color: "#E8ECEE",
  anim: (m) => {
    m.position.y = Y(51) - (S().flaps.cmd / 30) * 0.075;
  },
  name: "Wing flap control lever",
  note: "Lower right of the center panel; mechanical stops at 10° and 20° — move the lever right to pass them. Placard WING FLAPS: UP–10° 110 KIAS (blue), 10°–FULL 85 KIAS (white) (POH 7-23, 2-25).",
  pin: true,
});
part(() => box(0.008, 0.008, 0.012), ["flaps"], {
  pos: P3(18.3, 7.3, 50),
  color: "#FFD34D",
  anim: (m) => {
    m.position.y = Y(51) - (live.flapAng / 30) * 0.075;
  },
  name: "Flap position indicator",
  note: "Scale and pointer left of the lever showing actual flap travel in degrees (POH 7-23). The KOEL requires it for all operations.",
  pin: true,
});
part(() => box(0.16, 0.08, 0.09), ["flaps", "electrical"], {
  pos: wp(30, 0.6, 0, 0),
  color: "#7C57CF",
  anim: glowAnim("#7C57CF", () => S().flaps.moving, ["flaps", "electrical"], "#B9A3F0"),
  name: "Flap motor and actuator",
  note: "Electric drive in the right wing root (Figure 7-3 shows the mechanism at the inboard end of the right flap; motor details are not in the POH). 10 A FLAPS breaker, ELECTRICAL BUS 1 — “a large electrical load” (POH 3-18).",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.08, 0.05, 0.03), ["flaps"], {
    pos: wp(s * 24, 0.66, 0, 0),
    color: "#9F85E6",
    name: "Flap bellcrank",
    note: "At the inboard end of each flap; push-pull rods drive the flap. The left side is slaved through the cross-cabin interconnect (Fig. 7-3).",
    pin: s > 0,
  }),
);
part(() => tubeGeo([wp(-24, 0.66), wp(-12, 0.64, 0, -0.03), wp(12, 0.64, 0, -0.03), wp(24, 0.66)], 0.006), ["flaps"], {
  color: "#9F85E6",
  name: "Flap interconnect",
  note: "Cables/rods across the cabin ceiling tie the left flap to the right-side drive so both flaps move together (Fig. 7-3).",
  pin: true,
});
part(
  () =>
    tubeGeo([P3(16.5, 9, 50), P3(22, 17.5, 60), P3(31, 18.4, 74), P3(33, 17.2, 79.5), wp(26, 0.55, 0, -0.03)], 0.004),
  ["flaps"],
  {
    color: "#B9A3F0",
    name: "Flap follow-up / control cable",
    note: "From the panel lever up the door post to the drive; the motor stops when the flap matches the lever (Fig. 7-3; internals not described).",
  },
);
