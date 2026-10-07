import * as THREE from "three";
import { V, type Vec3 } from "@/lib/math";
import { AIL, FLAP, PANEL_X, box, cyl, sph, wingP } from "../geometry";
import { live } from "../model";
import { ARMS, ELEV_HORN, FLAP_ACT, FLAP_HORN, FLAP_TUBE, RUD_HORN, SERVO, TRIM_WHEEL, rudHornPivot } from "../rig";
import { part, surfacePivot, sim, glow, trimWheelAnim, flapLight } from "./catalogue";

/* ---------- flight-control mechanisms (AFM 7.3; intermediate positions inferred) ---------- */
const CTL = "#7C57CF";
const crank = (parent: string, chan: "elevator" | "aileron", name: string, note: string, arms: Vec3[], pin = true) => {
  part(() => cyl(0.02, 0.04, chan === "aileron" ? "y" : "z", 14), ["controls"], {
    parent,
    chan: [chan],
    color: CTL,
    name,
    note,
    pin,
  });
  arms.forEach((a) =>
    part(
      () => {
        const v = V(...a),
          len = v.length(),
          g = box(0.014, len, 0.014);
        g.translate(0, len / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), v.normalize()));
        return g;
      },
      ["controls"],
      { parent, chan: [chan], color: CTL },
    ),
  );
};
crank(
  "rig:eIdle",
  "elevator",
  "Elevator idler bellcrank",
  "Supports the long elevator push rod under the rear cabin floor (position inferred; the AFM gives no routing figure).",
  [[0, -ARMS.e, 0]],
);
crank(
  "rig:eFin",
  "elevator",
  "Elevator bellcrank (fin base)",
  "Two of its bearings can be seen next to the lower rudder hinge (AFM 7-7). Turns the fore-aft push rod into the vertical rod up the fin.",
  [
    [0, -ARMS.e, 0],
    [-ARMS.e, 0, 0],
  ],
);
part(() => box(0.012, ELEV_HORN.len, 0.03), ["controls"], {
  parent: "surf:elev",
  chan: ["elevator"],
  pos: (() => {
    const pv = surfacePivot("elev");
    return [
      ELEV_HORN.c[0] + (ELEV_HORN.dir[0] * ELEV_HORN.len) / 2 - pv[0],
      ELEV_HORN.c[1] + (ELEV_HORN.dir[1] * ELEV_HORN.len) / 2 - pv[1],
      0 - pv[2],
    ] as Vec3;
  })(),
  rot: [0, 0, Math.atan2(-ELEV_HORN.dir[0], ELEV_HORN.dir[1])],
  color: CTL,
  name: "Elevator horn",
  note: "Elevator horn, its bearing and the push-rod connection are inspected at the upper end of the rudder (AFM 7-7).",
  pin: true,
});
crank(
  "rig:aFwd",
  "aileron",
  "Aileron bellcrank (forward)",
  "Turns the sideways motion of the stick link into the fore-aft aileron push rod (inferred).",
  [
    [ARMS.a, 0, 0],
    [0, 0, ARMS.a],
  ],
);
crank(
  "rig:aAft",
  "aileron",
  "Aileron bellcrank (aft)",
  "Splits the aileron run into the two spanwise push rods behind the rear spar (inferred).",
  [
    [0, 0, ARMS.a],
    [-ARMS.a, 0, 0],
  ],
);
[1, -1].forEach((s) =>
  crank(
    "rig:wb" + (s > 0 ? "R" : "L"),
    "aileron",
    "Aileron bellcrank (wing)",
    "Drives the short push rod with rod-end bearing to the aileron horn; the rod-end nut is sealed with locking varnish so any disturbance shows (AFM 7-4).",
    [
      [0.06, 0, 0],
      [0, 0, s * 0.06],
    ],
    s > 0,
  ),
);
[1, -1].forEach((s) => {
  const key = "ail" + (s > 0 ? "R" : "L"),
    pv = surfacePivot(key),
    hz = wingP(s * 4.04, AIL.hinge, -1);
  part(() => box(0.012, 0.05, 0.03), ["controls"], {
    chan: ["aileron"],
    parent: "surf:" + key,
    pos: [hz.x - pv[0], hz.y - 0.025 - pv[1], hz.z - pv[2]],
    color: CTL,
    name: "Aileron control horn",
    note: "Aluminium horn held to the aileron by 3 screws; a bolt joins it to the push-rod's rod-end bearing (AFM 7-4).",
    pin: s > 0,
  });
});
{
  const rh = rudHornPivot();
  part(() => box(0.03, 0.025, RUD_HORN.half * 2 + 0.02), ["controls"], {
    chan: ["rudder"],
    parent: "surf:rudder",
    pos: [rh[0] - surfacePivot("rudder")[0], rh[1] - surfacePivot("rudder")[1], 0],
    color: CTL,
    name: "Rudder lower bracket (cable horn)",
    note: "The cable eyes connect to bolts on this bracket; the bearing bracket below it carries the rudder stops (AFM 7-7).",
    pin: true,
  });
}
part(
  () => {
    const g = new THREE.CylinderGeometry(TRIM_WHEEL.r, TRIM_WHEEL.r, 0.025, 28);
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["controls", "autopilot"],
  {
    pos: TRIM_WHEEL.c,
    chan: ["elevator"],
    color: "#1B1F23",
    anim: trimWheelAnim,
    name: "Elevator trim wheel",
    note: "Black wheel in the centre console behind the engine controls, with friction and a T/O mark. Forward = nose down, rear = nose up (AFM 7-8). It turns when the GFC 700 trims.",
    pin: true,
  },
);
part(() => box(0.012, 0.02, 0.028), ["controls"], {
  pos: [TRIM_WHEEL.c[0], TRIM_WHEEL.c[1] + TRIM_WHEEL.r - 0.005, TRIM_WHEEL.c[2]],
  chan: ["elevator"],
  color: "#F2F5F7",
  anim: (m) => {
    const a = live.afcs.trim * 2.6;
    m.position.set(
      TRIM_WHEEL.c[0] - Math.sin(a) * (TRIM_WHEEL.r - 0.005),
      TRIM_WHEEL.c[1] + Math.cos(a) * (TRIM_WHEEL.r - 0.005),
      TRIM_WHEEL.c[2],
    );
    m.rotation.z = a;
  },
});
part(() => box(0.1, 0.06, 0.07), ["autopilot", "controls"], {
  pos: SERVO.trim,
  chan: ["elevator"],
  color: "#C8399F",
  anim: glow("#7A3866", "#C8399F", () => sim().E.afcsPwr && live.afcs.pft === "pass", ["autopilot", "controls"]),
  name: "Pitch trim servo (GSA)",
  note: "GFC 700 trim servo on the trim Bowden cable: autotrim with the AP engaged, manual electric trim (both MET halves) otherwise. Location not documented — shown at the KAP 140 trim-servo arm (2.21 m).",
  pin: true,
});
part(() => box(0.12, 0.08, 0.08), ["autopilot", "controls"], {
  pos: SERVO.pitch,
  chan: ["elevator"],
  color: "#C8399F",
  anim: glow("#7A3866", "#C8399F", () => live.afcs.ap && !live.afcs.cws, ["autopilot", "controls"]),
  name: "Pitch servo (GSA)",
  note: "Moves the elevator push rod when the AP is engaged; a slip clutch lets the pilot overpower it in an emergency (CRG 6-21). Location not documented — KAP 140 pitch-servo arm 3.93 m.",
  pin: true,
});
part(() => box(0.12, 0.08, 0.08), ["autopilot", "controls"], {
  pos: SERVO.roll,
  chan: ["aileron"],
  color: "#C8399F",
  anim: glow("#7A3866", "#C8399F", () => live.afcs.ap && !live.afcs.cws, ["autopilot", "controls"]),
  name: "Roll servo (GSA)",
  note: "Drives the aileron push rod with the AP engaged (slip clutch for override). Location not documented — KAP 140 roll-servo arm 3.06 m.",
  pin: true,
});

/* ---------- flaps ---------- */
part(() => cyl(0.018, FLAP_TUBE.half * 2, "z"), ["flaps"], {
  parent: "rig:flapTube",
  color: "#9F85E6",
  name: "Flap torsion tube",
  note: "In the fuselage, joining the left and right flaps through aluminium fittings — both flaps always move together (AFM 7-5).",
  pin: true,
});
[1, -1].forEach((s) =>
  part(
    () => {
      const g = box(0.014, FLAP_TUBE.arm, 0.014);
      g.translate(0, -FLAP_TUBE.arm / 2, 0);
      return g;
    },
    ["flaps"],
    { parent: "rig:flapTube", pos: [0, 0, s * FLAP_TUBE.half], color: "#9F85E6" },
  ),
);
part(() => box(0.24, 0.07, 0.08), ["flaps", "electrical"], {
  pos: FLAP_ACT,
  color: "#7C57CF",
  anim: glow(
    "#5C4A8A",
    "#B9A3F0",
    () => {
      const t = [0, 20, 42][sim().s.flaps.cmd];
      return sim().E.flapsPwr && Math.abs(live.flapAng - t) > 0.3;
    },
    ["flaps"],
  ),
  name: "Flap actuator",
  note: "Electric motor drive (P/N 430555); keeps running until the selected position is reached; UP and LDG have limit switches (AFM 7-5, 7-6). Location not in the documents.",
  pin: true,
});
[1, -1].forEach((s) => {
  const key = "flap" + (s > 0 ? "R" : "L"),
    pv = surfacePivot(key),
    hz = wingP(s * 1.28, FLAP.hinge, 0);
  part(() => box(0.012, FLAP_HORN, 0.03), ["flaps"], {
    parent: "surf:" + key,
    pos: [hz.x - pv[0], hz.y - FLAP_HORN / 2 - pv[1], hz.z - pv[2]],
    color: CTL,
    name: "Flap control horn",
    note: "Steel push rod with rod-end bearing to the flap horn, held by 3 screws (AFM 7-5).",
    pin: s > 0,
  });
});
part(() => box(0.1, 0.07, 0.05), ["flaps"], {
  pos: [PANEL_X - 0.01, -0.17, 0.19],
  color: "#2B3238",
  name: "Flap selector",
  note: "Three-position switch below the right side of the MFD, Cruise (UP) at the top. The flaps keep travelling until they reach the selected position (AFM 7-6; SMM Fig. 2-1). Placard: T/O max 108 KIAS, LDG max 91 KIAS.",
  pin: true,
});
(
  [
    [0, "#2FD35A", 0.035, "Flap position light — UP (green)"],
    [1, "#F4F6F8", 0.0, "Flap position light — T/O (white)"],
    [2, "#F4F6F8", -0.035, "Flap position light — LDG (white)"],
  ] as [0 | 1 | 2, string, number, string][]
).forEach(([pos, c, dy, name]) =>
  part(() => sph(0.007), ["flaps", "lighting"], {
    pos: [PANEL_X - 0.024, -0.17 + dy, 0.155],
    color: c,
    anim: flapLight(pos, c),
    name,
    note: "Green UP, white T/O and white LDG. Two lights on together mean the flaps are travelling between those positions (AFM 7-6).",
  }),
);
