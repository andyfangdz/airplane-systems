/** C182T catalogue: flight controls (POH Figure 7-1) and the electric flap drive (POH 7-20, Figure 7-3). */
import * as THREE from "three";
import { chanOfKey } from "@/lib/catalogue";
import type { Chan } from "@/lib/systems";
import { glowAnim as glow } from "@/lib/anims";
import { Y, Z, box, cyl, hingeX, tubeGeo } from "../geometry";
import { live } from "../model";
import { AFT_CRANK, PULLEYS, RIG, RIG_SPEC, RUD_TRIM } from "../rig";
import { IN } from "../../cessna/airframe";
import { pulleyGeo } from "../../cessna/rig";
import { CAP_END, HUB_LOW, capRot, controlWheelGeo, onCap, wheelEmblemGeo } from "../../cessna/yoke";
import { P3, S, onSurf, part, surfacePivot, wp } from "./catalogue";

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
    note: "Control-wheel shaft through the instrument panel: slides fore/aft for pitch and turns for roll. The pilot's shaft passes through the shaft collar that takes the control lock (POH 7-27, Fig 7-1).",
    pin: side === "L",
  });
  part(controlWheelGeo, ["controls"], {
    parent: wh,
    color: "#20262B",
    chan: ["elevator", "aileron"],
    name: side === "L" ? "Pilot's control wheel" : "Copilot's control wheel",
    note:
      side === "L"
        ? "Left horn: A/P DISC/TRIM INT switch and the split DN-UP manual electric trim switches on the outboard side (Fig 7-2 item 6), mic switch; map light and rheostat underneath (POH 7-14, 7-59; S3-10)."
        : "Dual controls, right seat: copilot control wheel at FS 26.0 (POH 6-22).",
    pin: true,
  });
  part(wheelEmblemGeo, ["controls"], { parent: wh, color: "#5C666E", chan: ["elevator", "aileron"] });
});
// control-wheel switches (left horn of the pilot's wheel — KAP 140 installation, Supplement 3)
part(() => box(0.012, 0.006, 0.012), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: onCap(-1, 0, CAP_END + 0.002, 0.004),
  rot: capRot(-1),
  color: "#C8313B",
  name: "A/P DISC/TRIM INT switch",
  note: "Disengages the autopilot and interrupts manual electric trim power: 2-second tone with the AP annunciation flashing (S3-10). In a malfunction: PUSH and HOLD throughout the recovery (S3-14).",
  pin: true,
});
part(() => box(0.012, 0.016, 0.006), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: onCap(-1, -0.004, -0.002, -0.019),
  rot: capRot(-1),
  color: "#9F85E6",
  name: "Manual electric trim (MET) switches",
  note: "Split DN – UP switches on the outboard side of the left wheel: both must be pressed the same way to trim; one alone does nothing (the right one alone lights the red PT within 5 s — monitor test). MET use disengages the autopilot (S3-10, S3-21).",
  pin: true,
});
part(() => box(0.026, 0.008, 0.026), ["lighting"], {
  parent: "wheel:L",
  pos: [HUB_LOW[0], HUB_LOW[1] - 0.003, -0.022],
  color: "#E8C46A",
  name: "Control wheel map light",
  note: "On the lower surface of the pilot's wheel, arm 21.5: turn NAV on, then the knurled rheostat — clockwise brighter (POH 7-59, 6-23). NAV LTS breaker, ELECTRICAL BUS 2.",
  pin: true,
});
part(() => box(0.03, 0.05, Z(RIG_SPEC.yoke.bl) * 2 + 0.04), ["controls"], {
  parent: "rig:cross",
  color: STEEL,
  chan: ["elevator", "aileron"],
  name: "Column interconnect",
  note: "Behind the panel the two control-wheel shafts are linked by a transverse member to the elevator arm at the lower forward cabin, and by a cable for the ailerons (POH Fig. 7-1).",
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
  note: "Arm at the lower forward cabin: the link from the column interconnect rocks it, pulling one elevator cable and paying out the other (POH Fig. 7-1 Sheet 2).",
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
// aft elevator bellcrank (tailcone) + downspring anchor
part(() => box(0.03, AFT_CRANK.arm * 2.3, 0.03), ["controls"], {
  parent: "rig:aftCrank",
  color: CTL,
  chan: ["elevator"],
  name: "Elevator bellcrank (aft)",
  note: "In the aft tailcone just forward of and below the horizontal stabilizer: the up and down cables rock it and a push-pull tube drives the elevator arm (POH Fig. 7-1 Sheet 2).",
  pin: true,
});
part(() => box(0.012, AFT_CRANK.rod, 0.012), ["controls"], {
  parent: "rig:aftCrank",
  pos: [0, AFT_CRANK.rod / 2, 0.035],
  color: STEEL,
  chan: ["elevator"],
});
part(() => cyl(0.012, 0.06, "z"), ["controls"], { pos: AFT_CRANK.c, color: "#5A636A", chan: ["elevator"] });
part(() => box(0.03, 0.03, 0.03), ["controls"], {
  pos: P3(205, 0, 38.6),
  color: "#5A636A",
  chan: ["elevator"],
  name: "Elevator downspring",
  note: "“The elevator control system is equipped with downsprings which provide improved stability in flight” (POH 7-6); drawn beside the aft bellcrank in Fig 7-1 Sheet 2.",
  pin: true,
});
// rudder bars and pedals (the pilot's pedals carry the brake master cylinders)
part(() => cyl(0.014, Z(RIG_SPEC.rud.half) * 2, "z"), ["controls", "gear"], {
  pos: P3(RIG_SPEC.rud.barFs, 0, RIG_SPEC.rud.barH),
  color: STEEL,
  chan: ["rudder"],
  name: "Rudder bars",
  note: "The interconnected rudder/brake pedals pivot on transverse rudder bars just aft of the firewall; the rudder cables, the steering bungee and the rudder trim bungee attach to them (POH 7-19, Fig 7-1).",
  pin: true,
});
[-17, -8.5, 8.5, 17].forEach((bl) => {
  const parent = bl < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.03, 0.17, 0.08), ["controls", "gear"], {
    parent,
    pos: P3(6.8, bl, 32.5),
    rot: [0, 0, 0.3],
    color: "#20262B",
    chan: ["rudder"],
    name: "Rudder / brake pedal",
    note: "Pedals steer the nosewheel through the bungee and move the rudder; toe pressure on the top applies that side's brake. Copilot pedals at FS 6.8 (POH 6-22, 7-46).",
  });
  if (bl < 0)
    part(() => cyl(0.014, 0.1), ["gear"], {
      parent,
      pos: P3(5.5, bl, 28.5),
      color: STEEL,
      name: "Brake master cylinder",
      note: "One on each of the pilot's pedals; the copilot's pedals act through the interconnect (POH 7-46).",
    });
});
// elevator arm on the torque tube, rudder horn, aileron horns
{
  const pv = surfacePivot("elevR"),
    arm = RIG_SPEC.elev.hornArm * IN;
  part(() => box(0.025, arm * 2.2, 0.025), ["controls"], {
    parent: "surf:elevR",
    pos: [0.02, -arm * 0.9, -pv[2] + 0.035],
    color: CTL,
    chan: ["elevator"],
    name: "Elevator arm",
    note: "Arm on the elevator torque tube at the centre of the elevator; the push-pull tube from the aft bellcrank drives it (POH 7-6, Fig 7-1 Sheet 2).",
    pin: true,
  });
  part(() => cyl(0.012, Z(4) * 2, "z"), ["controls"], {
    parent: "surf:elevR",
    pos: [0, 0, -pv[2]],
    color: STEEL,
    chan: ["elevator"],
    name: "Elevator torque tube",
    note: "Joins both elevator halves on the hinge line (POH 7-6).",
  });
  const rv = surfacePivot("rudder"),
    hy = Y(RIG_SPEC.rud.hornH);
  part(() => box(0.03, 0.025, Z(RIG_SPEC.rud.hornArm) * 2), ["controls"], {
    parent: "surf:rudder",
    pos: [hingeX(hy) + 0.02 - rv[0], hy - rv[1], 0],
    color: CTL,
    chan: ["rudder"],
    name: "Rudder horn",
    note: "Bottom of the rudder: each rudder cable pulls one end (POH Fig. 7-1 Sheet 1).",
    pin: true,
  });
}
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L",
    aw = PULLEYS["aw" + sd].c;
  onSurf("ail" + sd, [aw[0] - 0.16, aw[1] - 0.035, aw[2]], () => box(0.03, 0.04, 0.012), {
    color: CTL,
    name: "Aileron horn",
    note: "The push-pull rod from the bellcrank drives the aileron's inboard leading edge here (Fig 7-1).",
    pin: s > 0,
  });
});
// elevator trim wheel and indicator (vertical, pedestal), trim actuator
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
    note: "Vertically mounted wheel on the pedestal: forward = nose down, aft = nose up (POH 7-7). It turns under KAP 140 autotrim and manual electric trim because the KS-272C servo drives the same cable (S3-21).",
  },
);
part(() => box(0.012, 0.012, 0.035), ["controls", "autopilot"], {
  parent: "rig:trimWheel",
  pos: [0, RIG_SPEC.trim.r * IN, 0],
  color: "#E8ECEE",
  chan: ["elevator"],
});
part(() => box(0.01, 0.02, 0.01), ["controls", "autopilot"], {
  pos: P3(27.2, -1.6, 37.5),
  color: "#FFFFFF",
  chan: ["elevator"],
  anim: (m) => {
    m.position.y = Y(37.5) + live.kap.trim * 0.04;
  },
  name: "Trim position indicator",
  note: "Elevator trim tab is in the takeoff position when the pointer lines up with the index mark on the pedestal cover (POH 7-7, 4-32). Required for all operations (KOEL, POH 2-11).",
  pin: true,
});
part(() => box(0.06, 0.035, 0.05), ["controls"], {
  pos: RIG.p3(RIG_SPEC.trim.actuator),
  color: CTL,
  chan: ["elevator"],
  name: "Elevator trim tab actuator",
  note: "Inside the horizontal stabilizer (POH 7-6), right side; driven by the trim cable, it pushes the tab through a push-pull rod (Fig 7-1 Sheet 2).",
  pin: true,
});
// rudder trim: horizontally mounted wheel on the pedestal + indicator; a bungee biases the rudder bars (POH 7-7)
part(
  () => {
    const g = new THREE.CylinderGeometry(RUD_TRIM.r, RUD_TRIM.r, 0.022, 26);
    return g;
  },
  ["controls"],
  {
    parent: "rig:rudTrim",
    color: "#20262B",
    chan: ["rudder"],
    name: "Rudder trim wheel",
    pin: true,
    note: "Horizontally mounted wheel on the pedestal (Fig 7-2 item 25): rotate right for nose right, left for nose left. “The rudder is trimmed through a bungee connected to the rudder control system” (POH 7-7). Before start and takeoff: TAKEOFF position (POH 4-8, 4-17). Mounting dimensions are illustrative.",
  },
);
part(() => box(0.03, 0.012, 0.012), ["controls"], {
  parent: "rig:rudTrim",
  pos: [RUD_TRIM.r * 0.8, 0.012, 0],
  color: "#E8ECEE",
  chan: ["rudder"],
});
part(() => box(0.012, 0.006, 0.02), ["controls"], {
  pos: RUD_TRIM.indicator,
  color: "#FFFFFF",
  chan: ["rudder"],
  anim: (m) => {
    m.position.z = RUD_TRIM.indicator[2] + S().ctrl.rudTrim * 0.03;
  },
  name: "Rudder trim indicator",
  note: "Rudder trim position indicator beside the wheel; the KOEL requires it for every kind of operation (POH 2-11).",
  pin: true,
});
part(() => cyl(0.006, RUD_TRIM.wheel[1] - Y(RUD_TRIM.shaftBot), "y"), ["controls"], {
  pos: [RUD_TRIM.wheel[0], (RUD_TRIM.wheel[1] + Y(RUD_TRIM.shaftBot)) / 2, RUD_TRIM.wheel[2]],
  color: STEEL,
  chan: ["rudder"],
  name: "Rudder trim shaft",
  note: "Vertical shaft from the rudder-bar linkage up to the horizontal rudder trim wheel (Fig 7-1 Sheet 1). Mounting position and dimensions are illustrative.",
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
    note: "Sets cable tension; safety-wired after rigging. Cable tensions are not in the POH.",
    pin: i === 0,
  });
});
part(() => cyl(0.006, 0.05), ["controls", "cabin"], {
  pos: P3(19, -RIG_SPEC.yoke.bl, RIG_SPEC.yoke.h),
  color: "#C8313B",
  anim: (m) => {
    m.visible = S().cabin.lock;
  },
  name: "Control lock",
  note: "Shaped steel rod and flag through the pilot's control-wheel shaft and the panel collar: ailerons neutral, elevators slightly trailing edge down, flag over the ignition switch. Placard: CAUTION! CONTROL LOCK REMOVE BEFORE STARTING ENGINE (POH 7-27, 2-18). In gusty winds also fit a lock over the fin and rudder. Only the locking pin is shown; its size and mounting position are illustrative.",
  pin: true,
});

/* ---------- flaps: electric drive in the right wing root, cable interconnect to the left (POH 7-20, Figure 7-3) ---------- */
export const FLAP_LEVER = { fs: 18.2, bl: 8.8, h: 47.4, travel: 0.075 };
part(() => box(0.012, 0.06, 0.02), ["flaps"], {
  pos: P3(FLAP_LEVER.fs, FLAP_LEVER.bl, FLAP_LEVER.h),
  color: "#E8ECEE",
  anim: (m) => {
    m.position.y = Y(FLAP_LEVER.h) - (S().flaps.cmd / 38) * FLAP_LEVER.travel;
  },
  name: "Wing flap switch lever",
  note: "Lower right side of the center panel, in a slotted panel with mechanical stops at 10° and 20° — move it right to pass them. Placard: UP–10° 140 KIAS (dark blue), 10°–20° 120 KIAS (light blue), 20°–FULL 100 KIAS (white) (POH 7-20, 2-20).",
  pin: true,
});
part(() => box(0.008, 0.008, 0.012), ["flaps"], {
  pos: P3(FLAP_LEVER.fs + 0.3, FLAP_LEVER.bl - 1.4, FLAP_LEVER.h),
  color: "#FFD34D",
  anim: (m) => {
    m.position.y = Y(FLAP_LEVER.h) - (live.flapAng / 38) * FLAP_LEVER.travel;
  },
  name: "Flap position indicator",
  note: "Scale and pointer to the left of the flap lever: actual flap travel in degrees. No G1000 flap display or annunciation (POH 7-20).",
  pin: true,
});
part(() => box(0.16, 0.08, 0.09), ["flaps", "electrical"], {
  pos: wp(30, 0.62),
  color: "#7C57CF",
  anim: glow("#7C57CF", () => S().flaps.moving, ["flaps", "electrical"], "#B9A3F0"),
  name: "Flap motor and actuator",
  note: "At the inboard end of the RIGHT flap (Figure 7-3): drives a bellcrank that moves the flap through a push-pull rod. 10 A FLAP breaker on ELECTRICAL BUS 1. Motor type and transit time are not in the POH.",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.08, 0.05, 0.03), ["flaps"], {
    pos: wp(s * 24, 0.67),
    color: "#9F85E6",
    name: "Flap bellcrank",
    note: "At the inboard end of each flap; a push-pull rod drives the flap. The left bellcrank follows the right through the cross-cabin cables (Fig. 7-3).",
    pin: s > 0,
  }),
);
part(() => tubeGeo([wp(-24, 0.67), wp(-12, 0.65, 0, -0.03), wp(12, 0.65, 0, -0.03), wp(24, 0.67)], 0.006), ["flaps"], {
  color: "#9F85E6",
  name: "Flap interconnect cables",
  note: "Cables across the cabin top (several pulleys) tie the left flap to the right-wing drive so both move together (Fig. 7-3).",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        P3(16.5, 9, 47),
        P3(15.5, 20.0, 60),
        P3(29.0, 20.0, 60.5),
        P3(29.5, 19.7, 76),
        P3(33, 17.6, 79.6),
        wp(26, 0.55, 0, -0.03),
      ],
      0.004,
    ),
  ["flaps"],
  {
    color: "#B9A3F0",
    name: "Flap follow-up / control cable",
    note: "Figure 7-3 draws a single line from behind the panel up to the right wing root drive — the follow-up or wiring between the lever and the actuator (unlabeled in the POH).",
  },
);
